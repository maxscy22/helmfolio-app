// License lapse / expiry verification (the "1-year expiration" release blocker).
//
// These tests use REAL Ed25519 signatures (a throwaway keypair generated per run)
// so verifyToken's signature + expiry + device checks run through the exact crypto
// path the production app uses. We only mock the embedded public key (so it pairs
// with our test private key) and the ./api desktop bridge helpers.
//
// What we are proving:
//   1. A token whose `exp` has passed is reported as 'expired' -> feature lockdown.
//   2. When the Worker /validate returns 402 (LemonSqueezy says the 1-year term
//      ended), the app drops to a 'lapsed' state, clears the token, and surfaces
//      the renewal message — i.e. it locks down and prompts the user to renew.
//   3. A transient server error (5xx) or being offline must NOT lock out a paying
//      customer (no false lapse).
//   4. featureGate maps every non-active status to "no Pro" and shows the right
//      renewal/summary text.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as ed from '@noble/ed25519';

// SHA-512 impl for @noble in the test runtime (Node global crypto.subtle has it).
const installSha512 = (lib: typeof ed) => {
  lib.etc.sha512Async = async (...messages: Uint8Array[]) => {
    const message = new Uint8Array(lib.etc.concatBytes(...messages));
    return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-512', message));
  };
};
installSha512(ed);

// Generate a throwaway keypair before the module graph loads, and expose the
// public key (base64 of the raw 32-byte key) to the mocked licenseConfig so that
// tokens we sign here verify against the app's embedded key.
const cryptoKeys = vi.hoisted(async () => {
  const lib = await import('@noble/ed25519');
  lib.etc.sha512Async = async (...messages: Uint8Array[]) => {
    const message = new Uint8Array(lib.etc.concatBytes(...messages));
    return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-512', message));
  };
  const privateKey = lib.utils.randomPrivateKey();
  const publicRaw = await lib.getPublicKeyAsync(privateKey);
  let binary = '';
  publicRaw.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return { privateKey, publicKeyB64: btoa(binary) };
});

const apiMocks = vi.hoisted(() => ({
  hasSecureCredentialStore: vi.fn(() => true),
  getDeviceId: vi.fn(() => 'device-123'),
  getStoredLicenseToken: vi.fn(async () => ''),
  storeLicenseToken: vi.fn(async () => {}),
  clearStoredLicenseToken: vi.fn(async () => {}),
  setActiveLicenseToken: vi.fn(() => {}),
}));

vi.mock('./api', () => apiMocks);

vi.mock('./licenseConfig', async () => ({
  LICENSE_PUBLIC_KEY: (await cryptoKeys).publicKeyB64,
  LICENSE_API_URL: 'https://license.test',
  LICENSE_PURCHASE_URL: 'https://buy.test',
  PREMIUM_FEATURES: ['ibkrSync', 'benchmarks', 'marketReference', 'riskMetrics'],
}));

// SUT imported after the mocks are registered (vi.mock is hoisted).
import {
  LICENSE_LAPSED_MESSAGE,
  renewLicenseIfNeeded,
  verifyToken,
  type LicenseState,
} from './license';
import { isProEntitled, licenseSummary } from './featureGate';

const NOW = () => Math.floor(Date.now() / 1000);

const b64url = (bytes: Uint8Array) => {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const strToB64url = (value: string) => b64url(new TextEncoder().encode(value));

// Mint a real Ed25519-signed JWT with the throwaway private key.
const mintToken = async (claims: Record<string, unknown>) => {
  const { privateKey } = await cryptoKeys;
  const signingInput = `${strToB64url(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' }))}.${strToB64url(JSON.stringify(claims))}`;
  const signature = await ed.signAsync(new TextEncoder().encode(signingInput), privateKey);
  return `${signingInput}.${b64url(signature)}`;
};

const baseClaims = (overrides: Record<string, unknown> = {}) => ({
  iss: 'helmfolio-license',
  sub: 'LICENSE-KEY-0001',
  device: 'device-123',
  instanceId: 'instance-1',
  tier: 'pro',
  iat: NOW(),
  exp: NOW() + 86400,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('navigator', { onLine: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('verifyToken — signature, expiry, device binding', () => {
  it('accepts a correctly signed, unexpired, device-matched token as active', async () => {
    const token = await mintToken(baseClaims({ exp: NOW() + 3600 }));
    const result = await verifyToken(token);
    expect(result.status).toBe('active');
    expect(result.claims?.sub).toBe('LICENSE-KEY-0001');
  });

  it('reports a token whose exp has passed as expired (1-year term / grace ended)', async () => {
    const token = await mintToken(baseClaims({ iat: NOW() - 7200, exp: NOW() - 60 }));
    const result = await verifyToken(token);
    expect(result.status).toBe('expired');
    // claims still decoded so the UI can show context.
    expect(result.claims?.sub).toBe('LICENSE-KEY-0001');
  });

  it('rejects a token bound to a different device as invalid', async () => {
    const token = await mintToken(baseClaims({ device: 'some-other-machine' }));
    const result = await verifyToken(token);
    expect(result.status).toBe('invalid');
  });

  it('rejects a token signed by a different (wrong) key as invalid', async () => {
    // Re-sign the exact same header.payload with a foreign key: the signature is
    // well-formed base64url but will not verify against the embedded public key.
    const wrongKey = ed.utils.randomPrivateKey();
    const signingInput = `${strToB64url(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' }))}.${strToB64url(JSON.stringify(baseClaims()))}`;
    const forgedSig = await ed.signAsync(new TextEncoder().encode(signingInput), wrongKey);
    const result = await verifyToken(`${signingInput}.${b64url(forgedSig)}`);
    expect(result.status).toBe('invalid');
  });

  it('rejects a malformed token (not three segments) as invalid', async () => {
    expect((await verifyToken('not-a-jwt')).status).toBe('invalid');
    expect((await verifyToken('only.two')).status).toBe('invalid');
  });
});

describe('renewLicenseIfNeeded — lapse vs transient handling', () => {
  const expiredState = (): LicenseState => ({
    status: 'expired',
    tier: 'free',
    claims: baseClaims({ exp: NOW() - 60 }),
    expiresAt: NOW() - 60,
  });

  it('flips to LAPSED, clears the token, and prompts renewal when the server returns 402', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 402,
      json: async () => ({ error: 'This license is no longer active.' }),
    })));

    const result = await renewLicenseIfNeeded(expiredState());

    expect(result).not.toBeNull();
    expect(result?.status).toBe('lapsed');
    expect(result?.tier).toBe('free');
    expect(result?.message).toBe(LICENSE_LAPSED_MESSAGE);
    // Pro access is revoked + stored token wiped so the next launch starts free.
    expect(apiMocks.clearStoredLicenseToken).toHaveBeenCalledTimes(1);
    expect(apiMocks.setActiveLicenseToken).toHaveBeenCalledWith('');
  });

  it('recovers to ACTIVE when the server re-issues a fresh valid token', async () => {
    const freshToken = await mintToken(baseClaims({ exp: NOW() + 86400 }));
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ token: freshToken, instanceId: 'instance-1' }),
    })));

    const result = await renewLicenseIfNeeded(expiredState());

    expect(result?.status).toBe('active');
    expect(result?.tier).toBe('pro');
    expect(apiMocks.storeLicenseToken).toHaveBeenCalledWith(freshToken);
    expect(apiMocks.setActiveLicenseToken).toHaveBeenCalledWith(freshToken);
  });

  it('does NOT lock out a paying customer on a transient 5xx error', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: 'temporary' }),
    })));

    const result = await renewLicenseIfNeeded(expiredState());

    expect(result).toBeNull();
    expect(apiMocks.clearStoredLicenseToken).not.toHaveBeenCalled();
  });

  it('does nothing while offline (keeps the existing token, no server call)', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await renewLicenseIfNeeded(expiredState());

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skips renewal for an active token with plenty of time left', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const activeState: LicenseState = {
      status: 'active',
      tier: 'pro',
      claims: baseClaims({ exp: NOW() + 86400 }),
      expiresAt: NOW() + 86400,
    };
    const result = await renewLicenseIfNeeded(activeState);

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('featureGate — lockdown + renewal messaging', () => {
  it('grants Pro only for active (or browser-dev unsupported) states', () => {
    expect(isProEntitled({ status: 'active', tier: 'pro' })).toBe(true);
    expect(isProEntitled({ status: 'unsupported', tier: 'pro' })).toBe(true);
  });

  it('locks down every lapsed / expired / none / invalid state', () => {
    for (const status of ['expired', 'lapsed', 'none', 'invalid'] as const) {
      expect(isProEntitled({ status, tier: 'free' })).toBe(false);
    }
  });

  it('shows the explicit renewal message when the license has lapsed', () => {
    expect(licenseSummary({ status: 'lapsed', tier: 'free' })).toBe(LICENSE_LAPSED_MESSAGE);
  });

  it('asks an expired (offline) user to reconnect rather than re-buy', () => {
    expect(licenseSummary({ status: 'expired', tier: 'free' })).toMatch(/connect to the internet/i);
  });
});
