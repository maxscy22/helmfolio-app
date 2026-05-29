import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fetchIbkrFlexStatement } from './ibkrFlex.js';
import { fetchMarketReferenceData, fetchYtdBenchmarks } from './benchmarks.js';

const app = express();
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '127.0.0.1';
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((origin) => origin.trim());
const projectRoot = path.resolve(process.cwd());
const excludedBackupDirectories = new Set(['.git', 'node_modules', 'dist', '.vite']);
const excludedBackupFiles = new Set(['.DS_Store']);
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

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

const listBackupFiles = async (directory, relativeDirectory = '') => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && excludedBackupDirectories.has(entry.name)) continue;
    if (entry.isFile() && excludedBackupFiles.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.join(relativeDirectory, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      files.push(...await listBackupFiles(absolutePath, relativePath));
      continue;
    }
    if (!entry.isFile()) continue;
    const contentBase64 = await fs.readFile(absolutePath, 'base64');
    files.push({ path: relativePath, contentBase64 });
  }
  return files;
};

app.get('/api/project/backup', async (_request, response) => {
  try {
    const files = await listBackupFiles(projectRoot);
    response.json({
      projectName: path.basename(projectRoot),
      createdAt: new Date().toISOString(),
      excluded: ['.git/', 'node_modules/', 'dist/', '.vite/'],
      files,
    });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create project backup.' });
  }
});

app.get('/api/benchmarks/ytd', async (request, response) => {
  try {
    response.json(await fetchYtdBenchmarks({
      startDate: typeof request.query.start === 'string' ? request.query.start : undefined,
      endDate: typeof request.query.end === 'string' ? request.query.end : undefined,
    }));
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Failed to import benchmark data.' });
  }
});

app.get('/api/reference/market', async (request, response) => {
  try {
    response.json(await fetchMarketReferenceData({ forceRefresh: request.query.refresh === '1' }));
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Failed to import market reference data.' });
  }
});

app.post('/api/ibkr/flex/trades', async (_request, response) => {
  if (activeIbkrFlexImport) {
    response.status(409).json({ error: 'An IBKR Flex import is already running. Please wait for the current request to finish before starting another one.' });
    return;
  }
  try {
    activeIbkrFlexImport = fetchIbkrFlexStatement({
      token: process.env.IBKR_FLEX_TOKEN,
      queryId: process.env.IBKR_FLEX_QUERY_ID,
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
    response.status(500).json({ error: error instanceof Error ? error.message : 'Failed to import IBKR Flex trades.' });
  } finally {
    activeIbkrFlexImport = null;
  }
});

app.listen(port, host, () => {
  console.log(`IBKR importer API listening on http://${host}:${port}`);
});
