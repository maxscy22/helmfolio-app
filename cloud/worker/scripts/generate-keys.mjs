// Generates an Ed25519 keypair for signing/verifying license JWTs.
//
//   node cloud/worker/scripts/generate-keys.mjs
//
// Output:
//   - PRIVATE key (base64 PKCS8 DER): set as the Cloudflare Worker secret
//       JWT_PRIVATE_KEY  (wrangler secret put JWT_PRIVATE_KEY)
//     and for local dev put it in cloud/worker/.dev.vars (gitignored).
//   - PUBLIC key (base64 SPKI DER): embed in the app + backend so they can
//     verify tokens. It is safe to commit the public key.
//
// The private key NEVER ships in the app, so editing local files cannot forge
// a valid license token.

import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');

const privatePkcs8 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
const publicSpki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

console.log('JWT_PRIVATE_KEY (base64 PKCS8 DER) — Worker secret, keep private:');
console.log(privatePkcs8);
console.log('');
console.log('LICENSE_PUBLIC_KEY (base64 SPKI DER) — embed in app + backend, safe to commit:');
console.log(publicSpki);
