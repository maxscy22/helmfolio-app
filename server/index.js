import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import machineId from 'node-machine-id';
import { fetchIbkrFlexStatement } from './ibkrFlex.js';
import { fetchMarketReferenceData, fetchYtdBenchmarks } from './benchmarks.js';
import { LICENSE_PUBLIC_KEY } from './licenseConfig.js';

const app = express();
// Port 0 lets the OS assign a free port (used when Electron launches the backend
// so we never expose a predictable, fixed 8787). Falls back to 8787 in dev.
const port = Number(process.env.PORT ?? 8787);
// Always bind to loopback only. Never 0.0.0.0 — that would expose the API to the LAN.
const host = process.env.HOST || '127.0.0.1';
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((origin) => origin.trim());
// Per-launch session secret injected by the Electron main process. When set, every
// request must carry a matching X-Session-Token header, blocking other local
// processes, LAN devices, and malicious browser scripts from reaching the API.
const sessionToken = process.env.SESSION_TOKEN || '';
let activeIbkrFlexImport = null;

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS blocked: origin is not allowed for this local dashboard API.'));
  },
}));
app.use(express.json());

// Session-token gate (active only when SESSION_TOKEN is provided, e.g. inside the
// packaged Electron app). The health check stays open so the launcher can probe it.
app.use((request, response, next) => {
  if (!sessionToken) {
    next();
    return;
  }
  if (request.path === '/api/health') {
    next();
    return;
  }
  const provided = request.get('X-Session-Token');
  if (provided && provided === sessionToken) {
    next();
    return;
  }
  response.status(403).json({ error: 'Forbidden: missing or invalid session token for this local dashboard API.' });
});

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

// --- License enforcement ------------------------------------------------------
// Premium routes require a valid Ed25519-signed JWT (issued by the license
// Worker) in the X-License-Token header. This is the real paywall: repacking the
// frontend to force-show paid components cannot bypass it. Verification uses the
// same public key embedded in the app, plus expiry and device-binding checks.
const { machineIdSync } = machineId;
const deviceId = (() => {
  try {
    return machineIdSync();
  } catch {
    return '';
  }
})();

let licensePublicKey = null;
try {
  licensePublicKey = crypto.createPublicKey({ key: Buffer.from(LICENSE_PUBLIC_KEY, 'base64'), format: 'der', type: 'spki' });
} catch (error) {
  console.error('Invalid LICENSE_PUBLIC_KEY — premium routes will be denied:', error);
}

const fromBase64Url = (segment) => Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const verifyLicenseToken = (token) => {
  if (!licensePublicKey) return { valid: false, reason: 'server' };
  try {
    const parts = String(token).split('.');
    if (parts.length !== 3) return { valid: false, reason: 'malformed' };
    const ok = crypto.verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), licensePublicKey, fromBase64Url(parts[2]));
    if (!ok) return { valid: false, reason: 'signature' };
    const claims = JSON.parse(fromBase64Url(parts[1]).toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp && now >= claims.exp) return { valid: false, reason: 'expired' };
    if (deviceId && claims.device && claims.device !== deviceId) return { valid: false, reason: 'device' };
    if (claims.tier !== 'pro') return { valid: false, reason: 'tier' };
    return { valid: true, claims };
  } catch {
    return { valid: false, reason: 'malformed' };
  }
};

const requireLicense = (request, response, next) => {
  // Only enforce when launched by the desktop shell (SESSION_TOKEN set). Plain
  // browser dev (no session token) keeps the gate off so development isn't blocked.
  if (!sessionToken) {
    next();
    return;
  }
  const result = verifyLicenseToken(request.get('X-License-Token') || '');
  if (result.valid) {
    next();
    return;
  }
  response.status(402).json({
    error: 'A valid Pro license is required for this feature.',
    licenseRequired: true,
    reason: result.reason || 'none',
  });
};

// Benchmark indices (NASDAQ, S&P 500) are free, public market data — no license
// gate. A simple 24h in-memory cache (keyed by the requested date range) shields
// the upstream Yahoo Finance fetch from rate limits and abuse now that the route
// is open to free users, and makes the chart load instantly on repeat views.
const BENCHMARK_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const benchmarkCache = new Map();

app.get('/api/benchmarks/ytd', async (request, response) => {
  const startDate = typeof request.query.start === 'string' ? request.query.start : undefined;
  const endDate = typeof request.query.end === 'string' ? request.query.end : undefined;
  const cacheKey = `${startDate ?? ''}|${endDate ?? ''}`;
  try {
    const cached = benchmarkCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAtMs < BENCHMARK_CACHE_TTL_MS) {
      response.json(cached.payload);
      return;
    }
    const payload = await fetchYtdBenchmarks({ startDate, endDate });
    benchmarkCache.set(cacheKey, { cachedAtMs: Date.now(), payload });
    response.json(payload);
  } catch (error) {
    // On an upstream failure, serve a stale cache entry if we have one rather than
    // failing the now-free chart for everyone.
    const stale = benchmarkCache.get(cacheKey);
    if (stale) {
      response.json(stale.payload);
      return;
    }
    response.status(500).json({ error: error instanceof Error ? error.message : 'Failed to import benchmark data.' });
  }
});

// Market sentiment (VIX, Fear & Greed, AAII) is free, public macro data — not gated.
app.get('/api/reference/market', async (request, response) => {
  try {
    response.json(await fetchMarketReferenceData({ forceRefresh: request.query.refresh === '1' }));
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Failed to import market reference data.' });
  }
});

app.post('/api/ibkr/flex/trades', requireLicense, async (request, response) => {
  if (activeIbkrFlexImport) {
    response.status(409).json({ error: 'An IBKR Flex import is already running. Please wait for the current request to finish before starting another one.' });
    return;
  }
  // Prefer credentials passed per-request from the client (Electron secure store).
  // Fall back to .env for browser dev / standalone server use.
  const body = request.body ?? {};
  const token = (typeof body.token === 'string' && body.token.trim()) || process.env.IBKR_FLEX_TOKEN;
  const queryId = (typeof body.queryId === 'string' && body.queryId.trim()) || process.env.IBKR_FLEX_QUERY_ID;
  if (!token || !queryId) {
    response.status(400).json({ error: 'IBKR Flex token and query ID are required. Open Settings and enter your IBKR Flex Web Service token and Flex Query ID.' });
    return;
  }
  try {
    activeIbkrFlexImport = fetchIbkrFlexStatement({
      token,
      queryId,
      requestTimeoutMs: Number(process.env.IBKR_FLEX_REQUEST_TIMEOUT_MS || 30000),
      requestAttempts: Number(process.env.IBKR_FLEX_REQUEST_ATTEMPTS || 3),
      maxAttempts: Number(process.env.IBKR_FLEX_POLL_ATTEMPTS || 30),
      pollMs: Number(process.env.IBKR_FLEX_POLL_MS || 5000),
      initialWaitMs: Number(process.env.IBKR_FLEX_INITIAL_WAIT_MS || 20000),
    });
    const statement = await activeIbkrFlexImport;
    response.json({
      trades: statement.trades,
      positions: statement.positions,
      navRows: statement.navRows ?? [],
      cashRows: statement.cashRows ?? [],
      count: statement.trades.length,
      positionsCount: statement.positions.length,
      navRowsCount: statement.navRows?.length ?? 0,
      cashRowsCount: statement.cashRows?.length ?? 0,
      importedAt: new Date().toISOString(),
    });
  } catch (error) {
    // Token expired/invalid → 401 with a clear, actionable message and a flag the
    // client can use to highlight the credentials section.
    if (error && error.isTokenError) {
      response.status(401).json({ error: error.message, tokenError: true, ibkrCode: error.code });
      return;
    }
    response.status(500).json({ error: error instanceof Error ? error.message : 'Failed to import IBKR Flex trades.' });
  } finally {
    activeIbkrFlexImport = null;
  }
});

const server = app.listen(port, host, () => {
  const actualPort = server.address().port;
  console.log(`IBKR importer API listening on http://${host}:${actualPort}`);
  // Machine-readable line so the Electron main process can discover the OS-assigned
  // port when it launches the backend with PORT=0.
  console.log(`PORT_READY:${actualPort}`);
});
