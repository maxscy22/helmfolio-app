// Renderer-side license handling.
//
// Security model: this module VERIFIES the Ed25519-signed JWT issued by the
// Cloudflare Worker using the embedded public key, but it is only the UX layer.
// The real enforcement is the backend `requireLicense` middleware, which performs
// the same verification before serving premium data. Tampering with the frontend
// to force-show paid components therefore does nothing — the API still 402s.
//
// The token's `exp` doubles as the offline grace window (24 hours by default):
// the app keeps working as "pro" without contacting the server until the token
// expires, after which it silently re-validates (and re-issues) when online.
// Background renewal kicks in roughly halfway through the window so an online
// user is refreshed seamlessly and never interrupted.

import * as ed from '@noble/ed25519';
import {
  clearStoredLicenseToken,
  getDeviceId,
  getStoredLicenseToken,
  hasSecureCredentialStore,
  setActiveLicenseToken,
  storeLicenseToken,
} from './api';
import { LICENSE_API_URL, LICENSE_PUBLIC_KEY } from './licenseConfig';

// @noble/ed25519 v2 needs a SHA-512 implementation. SHA-512 (unlike Ed25519) is
// universally available in WebCrypto, so we route it through crypto.subtle.
ed.etc.sha512Async = async (...messages: Uint8Array[]) => {
  const message = new Uint8Array(ed.etc.concatBytes(...messages));
  return new Uint8Array(await crypto.subtle.digest('SHA-512', message));
};

// 'lapsed' = the license server (LemonSqueezy via the Worker) definitively
// confirmed the license is no longer active — e.g. the 1-year term ended. This is
// distinct from 'expired', which only means the offline token aged out and we
// have not been able to re-verify online yet.
export type LicenseStatus = 'none' | 'active' | 'expired' | 'invalid' | 'unsupported' | 'lapsed';
export type LicenseTier = 'free' | 'pro';

export interface LicenseClaims {
  iss?: string;
  sub: string;
  device: string;
  instanceId?: string;
  tier: string;
  iat: number;
  exp: number;
}

export interface LicenseState {
  status: LicenseStatus;
  tier: LicenseTier;
  claims?: LicenseClaims;
  expiresAt?: number;
  message?: string;
}

const RENEW_THRESHOLD_SECONDS = 12 * 60 * 60; // renew when < 12 hours remain

// Shown when the backend confirms the license term has genuinely ended.
export const LICENSE_LAPSED_MESSAGE =
  'Your 1-year Pro license has expired. Thank you for your support over the past year! Please renew your license to unlock your trading edge again.';

const base64ToBytes = (b64: string): Uint8Array => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const base64UrlToBytes = (b64url: string): Uint8Array => {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
  return base64ToBytes(padded);
};

// SPKI DER for Ed25519 = fixed 12-byte prefix + 32-byte raw key. @noble wants raw.
const publicKeyRaw = (): Uint8Array => base64ToBytes(LICENSE_PUBLIC_KEY).slice(-32);

const decodeClaims = (payloadSegment: string): LicenseClaims | null => {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadSegment))) as LicenseClaims;
  } catch {
    return null;
  }
};

// Verifies signature, expiry, and device binding. Returns the parsed claims plus
// a status describing why a token was rejected (for UX messaging).
export const verifyToken = async (token: string): Promise<{ status: LicenseStatus; claims?: LicenseClaims }> => {
  const parts = token.split('.');
  if (parts.length !== 3) return { status: 'invalid' };
  const claims = decodeClaims(parts[1]);
  if (!claims) return { status: 'invalid' };

  let signatureValid = false;
  try {
    const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    signatureValid = await ed.verifyAsync(base64UrlToBytes(parts[2]), signingInput, publicKeyRaw());
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) return { status: 'invalid', claims };

  const deviceId = getDeviceId();
  if (deviceId && claims.device && claims.device !== deviceId) return { status: 'invalid', claims };

  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && now >= claims.exp) return { status: 'expired', claims };

  return { status: 'active', claims };
};

const stateFromVerification = (status: LicenseStatus, claims?: LicenseClaims, message?: string): LicenseState => ({
  status,
  tier: status === 'active' ? 'pro' : 'free',
  claims,
  expiresAt: claims?.exp,
  message,
});

// Fire-and-forget anonymous launch ping. Sends only: tier, app version, platform.
// No personal data, no device ID, no trading data. Errors are silently swallowed
// so a failed ping never affects the app. Skipped in-browser (dev/unsupported).
const sendLaunchPing = (tier: LicenseTier): void => {
  try {
    const version = typeof __APP_VERSION__ !== 'undefined' ? String(__APP_VERSION__) : 'unknown';
    const platform = typeof process !== 'undefined' ? String(process.platform) : 'unknown';
    fetch(`${LICENSE_API_URL}/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, version, platform }),
    }).catch(() => {});
  } catch {
    // Never let a telemetry error surface to the user.
  }
};

// Loads the stored token, verifies it, and primes the in-memory token used by
// apiFetch. In the browser (no desktop bridge) the license system is unsupported
// and everything runs unrestricted for development.
export const loadLicenseState = async (): Promise<LicenseState> => {
  if (!hasSecureCredentialStore()) {
    return { status: 'unsupported', tier: 'pro' };
  }
  const token = await getStoredLicenseToken();
  if (!token) {
    setActiveLicenseToken('');
    sendLaunchPing('free');
    return { status: 'none', tier: 'free' };
  }
  const { status, claims } = await verifyToken(token);
  if (status === 'active') {
    setActiveLicenseToken(token);
  } else {
    setActiveLicenseToken('');
  }
  const state = stateFromVerification(status, claims);
  sendLaunchPing(state.tier);
  return state;
};

// Converts a Worker error into a message safe to show a paying customer. Genuine
// license problems (HTTP 400/402: bad key, device limit, inactive/refunded) are
// already user-friendly and shown as-is. Anything that smells like an internal
// server fault (HTTP 5xx, or messages mentioning key/crypto internals like the
// raw `atob`/base64/PKCS8 errors) is hidden behind a reassuring generic message
// so a customer never sees a scary technical string for a problem on our side.
const friendlyActivationError = (httpStatus: number, serverError?: string): string => {
  const raw = (serverError || '').toLowerCase();
  const looksInternal = httpStatus >= 500
    || raw.includes('atob')
    || raw.includes('base64')
    || raw.includes('misconfigured')
    || raw.includes('jwt_private_key')
    || raw.includes('pkcs8')
    || raw.includes('ed25519')
    || raw.includes('internal');
  if (looksInternal) {
    return 'Activation is temporarily unavailable due to a server issue on our side. Your license key was not used up — please try again in a moment, or contact support if this keeps happening.';
  }
  return serverError || 'Activation failed. Please double-check your license key, or you may have reached the device limit.';
};

// Activates a license key against the Worker and stores the returned token.
export const activateLicense = async (licenseKey: string): Promise<LicenseState> => {
  if (!hasSecureCredentialStore()) {
    return { status: 'unsupported', tier: 'pro', message: 'License activation is only available in the desktop app.' };
  }
  const key = licenseKey.trim();
  if (!key) return { status: 'none', tier: 'free', message: 'Please enter a license key.' };

  let response: Response;
  try {
    response = await fetch(`${LICENSE_API_URL}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: key, deviceId: getDeviceId(), instanceName: getDeviceId() }),
    });
  } catch {
    return { status: 'none', tier: 'free', message: 'Could not reach the license server. Check your internet connection.' };
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.token) {
    return { status: 'none', tier: 'free', message: friendlyActivationError(response.status, data?.error) };
  }

  const { status, claims } = await verifyToken(data.token);
  if (status !== 'active') {
    return stateFromVerification(status, claims, 'We could not finish activation due to a temporary issue on our side. Your key was not used up — please try again shortly, or contact support.');
  }
  await storeLicenseToken(data.token);
  setActiveLicenseToken(data.token);
  return stateFromVerification('active', claims, 'License activated successfully — Pro features are now unlocked.');
};

// Silent background renewal / recovery. Contacts the server to re-issue a fresh
// token in two cases:
//   - 'active' token close to expiry → roll the offline grace window forward.
//   - 'expired' token (offline grace lapsed) → recover Pro the moment we are back
//     online, or flip to 'lapsed' if the license term has genuinely ended.
// Returns the new state, or null when nothing should change (offline / transient
// server error / active token with plenty of time left).
export const renewLicenseIfNeeded = async (state: LicenseState): Promise<LicenseState | null> => {
  if (!hasSecureCredentialStore() || !state.claims) return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;

  const now = Math.floor(Date.now() / 1000);
  if (state.status === 'active') {
    if (state.claims.exp - now > RENEW_THRESHOLD_SECONDS) return null;
  } else if (state.status !== 'expired') {
    return null;
  }

  try {
    const response = await fetch(`${LICENSE_API_URL}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: state.claims.sub, deviceId: getDeviceId(), instanceId: state.claims.instanceId }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.token) {
      const verified = await verifyToken(data.token);
      if (verified.status !== 'active') return null;
      await storeLicenseToken(data.token);
      setActiveLicenseToken(data.token);
      return stateFromVerification('active', verified.claims);
    }
    // The server was reachable but rejected the license. A 402 means LemonSqueezy
    // reports the license is no longer active (e.g. the 1-year term ended) — treat
    // it as a genuine lapse: drop to free and show the explicit renewal message.
    // Any other response (5xx, etc.) is treated as transient — keep the current
    // token and try again later rather than locking out a paying customer.
    if (response.status === 402) {
      await clearStoredLicenseToken();
      setActiveLicenseToken('');
      return { status: 'lapsed', tier: 'free', expiresAt: state.claims.exp, message: LICENSE_LAPSED_MESSAGE };
    }
    return null;
  } catch {
    return null;
  }
};

// Removes the local token. Best-effort releases the device slot on the server.
export const deactivateLicense = async (state: LicenseState): Promise<LicenseState> => {
  if (state.claims?.instanceId) {
    try {
      await fetch(`${LICENSE_API_URL}/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: state.claims.sub, instanceId: state.claims.instanceId }),
      });
    } catch {
      // Ignore — clearing the local token is what matters for this device.
    }
  }
  await clearStoredLicenseToken();
  setActiveLicenseToken('');
  return { status: 'none', tier: 'free' };
};
