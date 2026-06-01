// Sanity check: sign a JWT exactly like the Worker, then verify it the two ways
// the app does (backend Node crypto + renderer @noble/ed25519). Throwaway script.
import { generateKeyPairSync, createPublicKey, sign as nodeSign, verify as nodeVerify } from 'node:crypto';
import * as ed from '@noble/ed25519';

// Mirror the renderer: provide SHA-512 via WebCrypto (available in Node 18+).
ed.etc.sha512Async = async (...m) => {
  const message = new Uint8Array(ed.etc.concatBytes(...m));
  return new Uint8Array(await crypto.subtle.digest('SHA-512', message));
};

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const privatePkcs8 = privateKey.export({ type: 'pkcs8', format: 'der' });
const publicSpki = publicKey.export({ type: 'spki', format: 'der' });

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// --- Sign like the Worker (Node equivalent of crypto.subtle Ed25519 sign) ---
const header = b64url(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' }));
const payload = b64url(JSON.stringify({ sub: 'KEY-123', device: 'dev', tier: 'pro', iat: 1, exp: 9999999999 }));
const signingInput = `${header}.${payload}`;
const signature = nodeSign(null, Buffer.from(signingInput), privateKey);
const token = `${signingInput}.${b64url(signature)}`;

// --- Backend path: Node crypto.verify with SPKI public key ---
const pubObj = createPublicKey({ key: Buffer.from(publicSpki.toString('base64'), 'base64'), format: 'der', type: 'spki' });
const backendOk = nodeVerify(null, Buffer.from(signingInput), pubObj, fromB64url(token.split('.')[2]));

// --- Renderer path: @noble verify with raw 32-byte key (SPKI slice(-32)) ---
const pubRaw = new Uint8Array(publicSpki).slice(-32);
const nobleOk = await ed.verifyAsync(fromB64url(token.split('.')[2]), new TextEncoder().encode(signingInput), pubRaw);

console.log('backend (node crypto.verify):', backendOk);
console.log('renderer (@noble raw key):  ', nobleOk);
if (!backendOk || !nobleOk) {
  console.error('ROUND-TRIP FAILED');
  process.exit(1);
}
console.log('OK: both verification paths agree.');
