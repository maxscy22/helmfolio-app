# License Worker (Cloudflare)

Validates LemonSqueezy licenses and signs short-lived **Ed25519 JWTs**. The app
holds only the **public key**, so local file edits cannot forge a valid token.

## Endpoints
- `POST /activate` `{ licenseKey, deviceId, instanceName? }` → `{ token, instanceId }`
- `POST /validate` `{ licenseKey, deviceId, instanceId }` → `{ token, instanceId }`
- `POST /deactivate` `{ licenseKey, instanceId }` → `{ deactivated }`

## One-time setup

1. **Generate signing keys**
   ```
   npm run keys
   ```
   - Put the **PRIVATE** key (base64 PKCS8) into the Worker:
     - local dev: copy `.dev.vars.example` → `.dev.vars`, set `JWT_PRIVATE_KEY`
     - production: `wrangler secret put JWT_PRIVATE_KEY`
   - Put the **PUBLIC** key (base64 SPKI) into the app + backend:
     - `src/lib/licenseConfig.ts` → `LICENSE_PUBLIC_KEY`
     - `server/licenseConfig.js` → `LICENSE_PUBLIC_KEY`
   > Regenerate keys before going live — the dev key printed to a terminal must
   > not be used in production.

2. **LemonSqueezy**
   - Create a product with **License Keys** enabled, activation limit **2**.
   - Set the API key secret: `wrangler secret put LEMONSQUEEZY_API_KEY`
   - (Recommended) Fill `LS_STORE_ID` / `LS_PRODUCT_ID` / `LS_VARIANT_ID` in
     `wrangler.toml` so licenses from other products are rejected.

3. **Point the app at the Worker**
   - Set the deployed Worker URL in `src/lib/licenseConfig.ts` → `LICENSE_API_URL`
     (e.g. `https://stock-dashboard-for-ibkr-license.<your-subdomain>.workers.dev`).

## Run / deploy
```
npm install
npm run dev      # local, uses .dev.vars
npm run deploy   # production, uses wrangler secrets
```
