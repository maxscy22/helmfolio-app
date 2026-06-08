// Cloudflare Worker — license activation + validation server.
//
// Endpoints:
//   POST /activate  { licenseKey, deviceId, instanceName? }
//       -> activates the license against LemonSqueezy (binds an instance to the
//          device), then returns a short-lived Ed25519-signed JWT.
//   POST /validate  { licenseKey, deviceId, instanceId }
//       -> re-checks the license status with LemonSqueezy and re-issues a fresh
//          JWT (used for silent background renewal).
//   POST /deactivate { licenseKey, instanceId }
//       -> releases a device activation slot.
//
// Secrets / vars (set via `wrangler secret put` or .dev.vars):
//   JWT_PRIVATE_KEY        base64 PKCS8 DER Ed25519 private key (NEVER in the app)
//   LEMONSQUEEZY_API_KEY   LemonSqueezy API key
//   LS_STORE_ID            (optional) expected store id, rejects keys from elsewhere
//   LS_PRODUCT_ID          (optional) expected product id
//   LS_VARIANT_ID          (optional) expected variant id
//   JWT_ISSUER             (optional) issuer string, defaults 'stock-dashboard-for-ibkr-license'
//   JWT_TTL_SECONDS        (optional) token lifetime, defaults 86400 (24 hours)

const LS_API = 'https://api.lemonsqueezy.com/v1/licenses';
const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24-hour offline grace window
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });

// --- base64url helpers --------------------------------------------------------
const bytesToBase64Url = (bytes) => {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Decodes standard base64 OR base64url. Tolerates surrounding whitespace and
// missing padding so a secret pasted as base64url (with - / _) still works.
const base64ToBytes = (b64) => {
  const normalized = String(b64).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const stringToBase64Url = (str) => bytesToBase64Url(new TextEncoder().encode(str));

// --- Ed25519 JWT signing ------------------------------------------------------
let cachedKey = null;
const importPrivateKey = async (privateKeyB64) => {
  if (cachedKey) return cachedKey;
  if (!privateKeyB64 || typeof privateKeyB64 !== 'string' || !privateKeyB64.trim()) {
    throw new Error('Server misconfigured: JWT_PRIVATE_KEY secret is not set. Run `wrangler secret put JWT_PRIVATE_KEY` (or add it to cloud/worker/.dev.vars for local dev).');
  }
  if (privateKeyB64.includes('-----')) {
    throw new Error('Server misconfigured: JWT_PRIVATE_KEY must be raw base64 PKCS8 DER, not PEM. Remove the -----BEGIN/END----- lines and newlines.');
  }
  let keyBytes;
  try {
    keyBytes = base64ToBytes(privateKeyB64);
  } catch {
    throw new Error('Server misconfigured: JWT_PRIVATE_KEY is not valid base64. Regenerate with `npm run keys` and re-set the secret.');
  }
  try {
    cachedKey = await crypto.subtle.importKey('pkcs8', keyBytes, { name: 'Ed25519' }, false, ['sign']);
  } catch {
    throw new Error('Server misconfigured: JWT_PRIVATE_KEY is not a valid Ed25519 PKCS8 key. Regenerate with `npm run keys` and re-set the secret.');
  }
  return cachedKey;
};

const signJwt = async (payload, env) => {
  const header = { alg: 'EdDSA', typ: 'JWT' };
  const signingInput = `${stringToBase64Url(JSON.stringify(header))}.${stringToBase64Url(JSON.stringify(payload))}`;
  const key = await importPrivateKey(env.JWT_PRIVATE_KEY);
  const signature = await crypto.subtle.sign({ name: 'Ed25519' }, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
};

const buildTokenPayload = (licenseKey, deviceId, instanceId, env) => {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Number(env.JWT_TTL_SECONDS || DEFAULT_TTL_SECONDS);
  return {
    iss: env.JWT_ISSUER || 'stock-dashboard-for-ibkr-license',
    sub: licenseKey,
    device: deviceId,
    instanceId,
    tier: 'pro',
    iat: now,
    exp: now + ttl,
  };
};

// --- LemonSqueezy calls -------------------------------------------------------
const callLemonSqueezy = async (endpoint, params, env) => {
  const response = await fetch(`${LS_API}/${endpoint}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(env.LEMONSQUEEZY_API_KEY ? { Authorization: `Bearer ${env.LEMONSQUEEZY_API_KEY}` } : {}),
    },
    body: new URLSearchParams(params).toString(),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
};

// Ensures the license belongs to a configured store/product/variant, if set.
// Each var may hold a single id OR a comma-separated list of allowed ids, so a
// single Worker can accept keys from BOTH the live store and the (test-mode)
// store at once — e.g. LS_PRODUCT_ID = "1107286,1101253". A blank/unset var
// means "do not restrict on this field".
const matchesConfiguredProduct = (meta, env) => {
  if (!meta) return true;
  const allowsValue = (configured, actual) => {
    const list = String(configured || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    return list.length === 0 || list.includes(String(actual));
  };
  if (env.LS_STORE_ID && !allowsValue(env.LS_STORE_ID, meta.store_id)) return false;
  if (env.LS_PRODUCT_ID && !allowsValue(env.LS_PRODUCT_ID, meta.product_id)) return false;
  if (env.LS_VARIANT_ID && !allowsValue(env.LS_VARIANT_ID, meta.variant_id)) return false;
  return true;
};

const licenseIsActive = (licenseKey) => {
  const status = String(licenseKey?.status || '').toLowerCase();
  return status === 'active';
};

// --- Handlers -----------------------------------------------------------------
const handleActivate = async (request, env) => {
  const { licenseKey, deviceId, instanceName } = await request.json().catch(() => ({}));
  if (!licenseKey || !deviceId) return json({ error: 'licenseKey and deviceId are required.' }, 400);

  const { ok, data } = await callLemonSqueezy('activate', {
    license_key: licenseKey,
    instance_name: instanceName || `device-${deviceId}`,
  }, env);

  if (!ok || !data?.activated) {
    return json({ error: data?.error || 'License activation failed. Check the key or device limit.' }, 402);
  }
  if (!matchesConfiguredProduct(data.meta, env)) {
    return json({ error: 'This license key is not valid for this product.' }, 402);
  }
  if (!licenseIsActive(data.license_key)) {
    return json({ error: 'This license is not active.' }, 402);
  }

  const instanceId = data.instance?.id;
  const token = await signJwt(buildTokenPayload(licenseKey, deviceId, instanceId, env), env);
  return json({ token, instanceId });
};

const handleValidate = async (request, env) => {
  const { licenseKey, deviceId, instanceId } = await request.json().catch(() => ({}));
  if (!licenseKey || !deviceId) return json({ error: 'licenseKey and deviceId are required.' }, 400);

  const { ok, data } = await callLemonSqueezy('validate', {
    license_key: licenseKey,
    ...(instanceId ? { instance_id: instanceId } : {}),
  }, env);

  if (!ok || !data?.valid) {
    return json({ error: data?.error || 'License validation failed.' }, 402);
  }
  if (!matchesConfiguredProduct(data.meta, env)) {
    return json({ error: 'This license key is not valid for this product.' }, 402);
  }
  if (!licenseIsActive(data.license_key)) {
    return json({ error: 'This license is no longer active.' }, 402);
  }

  const token = await signJwt(buildTokenPayload(licenseKey, deviceId, instanceId, env), env);
  return json({ token, instanceId });
};

const handlePing = async (request, env) => {
  const body = await request.json().catch(() => ({}));
  const tier = ['free', 'pro'].includes(body?.tier) ? body.tier : 'free';
  const version = typeof body?.version === 'string' ? body.version.slice(0, 20) : 'unknown';
  const platform = typeof body?.platform === 'string' ? body.platform.slice(0, 20) : 'unknown';
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const country = request.cf?.country ?? 'unknown';
  const continent = request.cf?.continent ?? 'unknown';
  const session = body?.session === 'first' ? 'first' : 'returning';
  // Granular license status (distinguishes never-paid 'none'/'free' from churned
  // 'expired'/'lapsed') — better churn visibility than tier alone.
  const status = ['none', 'active', 'expired', 'invalid', 'lapsed'].includes(body?.status)
    ? body.status
    : 'unknown';
  // Version-adoption signal: first install / updated since last launch / same version.
  const launchType = ['first', 'updated', 'same'].includes(body?.launchType) ? body.launchType : 'unknown';
  // Activation signal: has the user imported any data yet? Boolean only, no content.
  const hasImportedData = body?.hasImportedData === 'yes' ? 'yes' : 'no';

  if (env.ANALYTICS) {
    env.ANALYTICS.writeDataPoint({
      // NOTE: append-only — never reorder existing blobs or historical queries break.
      // blob1..7 (existing) + blob8 status, blob9 launchType, blob10 hasImportedData.
      blobs: [tier, version, platform, date, country, continent, session, status, launchType, hasImportedData],
      indexes: [tier],
    });
  }

  return json({ ok: true });
};

const handleDeactivate = async (request, env) => {
  const { licenseKey, instanceId } = await request.json().catch(() => ({}));
  if (!licenseKey || !instanceId) return json({ error: 'licenseKey and instanceId are required.' }, 400);
  const { ok, data } = await callLemonSqueezy('deactivate', { license_key: licenseKey, instance_id: instanceId }, env);
  if (!ok) return json({ error: data?.error || 'Deactivation failed.' }, 400);
  return json({ deactivated: Boolean(data?.deactivated) });
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

    const { pathname } = new URL(request.url);
    try {
      if (pathname === '/activate') return await handleActivate(request, env);
      if (pathname === '/validate') return await handleValidate(request, env);
      if (pathname === '/deactivate') return await handleDeactivate(request, env);
      if (pathname === '/ping') return await handlePing(request, env);
      return json({ error: 'Not found.' }, 404);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Internal error.' }, 500);
    }
  },
};
