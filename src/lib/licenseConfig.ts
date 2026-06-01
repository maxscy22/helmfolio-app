// License system configuration shared by the renderer.
//
// LICENSE_PUBLIC_KEY is the Ed25519 public key (base64 SPKI DER) that pairs with
// the private key held only by the Cloudflare Worker. It is safe to commit and
// embed: it can verify tokens but cannot create them, so editing local files
// cannot forge a valid license. Keep it in sync with `server/licenseConfig.js`.
//
// NOTE: Must pair with the JWT_PRIVATE_KEY secret set on the Cloudflare Worker.
// Regenerate with `cloud/worker npm run keys` and replace this value (and the
// server copy) if you ever rotate the keypair.
export const LICENSE_PUBLIC_KEY = 'MCowBQYDK2VwAyEA70oKsA3SKL4HzeChSX6Ry7UqRCVLD9yA+LpFQV32dNY=';

// Deployed Worker base URL. Override at build time with VITE_LICENSE_API_URL.
export const LICENSE_API_URL =
  (import.meta.env?.VITE_LICENSE_API_URL as string | undefined) ||
  'https://ibkr-dashboard-license.example.workers.dev';

// LemonSqueezy checkout / product page where users buy a license key. Override
// at build time with VITE_LICENSE_PURCHASE_URL.
export const LICENSE_PURCHASE_URL =
  (import.meta.env?.VITE_LICENSE_PURCHASE_URL as string | undefined) ||
  'https://your-store.lemonsqueezy.com';

// Premium feature identifiers gated behind a valid license (UX layer only — the
// real enforcement is the backend requireLicense middleware).
// NOTE: Market sentiment (VIX, Fear & Greed, AAII) is intentionally FREE — it is
// public macro data anyone can look up, used as a free engagement hook, not a
// paywalled feature. So it is deliberately NOT listed here.
export const PREMIUM_FEATURES = ['ibkrSync', 'benchmarks', 'riskMetrics'] as const;
export type PremiumFeature = (typeof PREMIUM_FEATURES)[number];
