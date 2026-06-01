# Monetization Plan — Licensed Desktop App

> Living document. Records the agreed strategy for turning the dashboard into a
> paid desktop application (`.exe` / `.app`) sold via a yearly license.
> Update this file as decisions change.

## 1. Goal

Convert the current Vite + React + Express dashboard into a self-contained
**Electron desktop app** sold as a **yearly subscription license**, so users no
longer need to keep a local server running manually.

## 2. Confirmed Decisions

| Topic | Decision |
|-------|----------|
| Packaging | **Electron** (backend is already Node.js — natural fit; Tauri would require a Rust rewrite) |
| Licensing provider | **LemonSqueezy** (license key API + recurring yearly billing + merchant of record for global tax) |
| Security model | **Hybrid**: license validation runs in the cloud (tamper-proof), IBKR compute stays local (privacy + offline). Feature gating enforced at the local backend via a cloud-signed short-lived JWT ("entry ticket"), with an offline grace period |
| Cloud validation | **Cloudflare Workers** (zero cold start via V8 isolates, free tier ~100k req/day → effectively $0 ops cost, deploy in seconds via Wrangler) |
| Free tier | **CSV-only**: manual CSV/XLSX upload + core KPIs (Total P/L, Win Rate, # Trades) |
| Paid tier | IBKR Flex auto-sync, Equity Curve, Sharpe/risk metrics, trade cycles, symbol leaderboards, benchmarks, AAII sentiment, JSON data export/import |
| Work isolation | Do Electron work on a separate git branch (`desktop-app`) or a copied folder; keep `main` working dashboard safe |

## 3. Feature Gating Map

| Feature | Free | Licensed |
|---------|------|----------|
| CSV / XLSX manual upload | Yes | Yes |
| Core KPIs (Total P/L, Win Rate, # Trades) | Yes | Yes |
| IBKR Flex auto-sync | No | Yes |
| Equity Curve & P/L Trend | No | Yes |
| Sharpe / risk metrics | No | Yes |
| Trade cycles & symbol leaderboards | No | Yes |
| Benchmarks & AAII sentiment | No | Yes |
| Data export/import (JSON) | No | Yes |
| Themes & portrait | Yes | Yes |

Rationale: IBKR auto-sync is the killer feature and justifies a *yearly* license
because IBKR data changes daily.

## 4. Files To Add / Change

**New files**
- `electron/main.js` — Electron main process; starts the Express backend internally on a **random loopback port** + generates a per-launch **session secret**; exposes `safeStorage` IPC handlers for the license JWT
- `electron/preload.js` — secure IPC bridge (contextIsolation); exposes the dynamic backend port + session token to the frontend
- `electron-builder.yml` — packaging config (Win/Mac/Linux targets)
- `cloud/worker/` — **Cloudflare Worker** (Wrangler project): `/activate` + `/validate` endpoints that verify LemonSqueezy license status and **sign a short-lived JWT with a private key**. Holds the private key + LemonSqueezy API key as Worker secrets
- `src/lib/license.ts` — activate / validate flow; **verify JWT signature with embedded public key**; device-fingerprint binding; offline grace-period logic + background renewal
- `src/lib/featureGate.ts` — derives tier from a **valid JWT only** (UX flags); not a security boundary
- `src/lib/api.ts` — fetch wrapper that targets the dynamic backend port and attaches `X-Session-Token` to every request
- `src/components/LicenseModal.tsx` — license key entry / activation UI

**Modified files**
- `package.json` — Electron deps + build scripts (`electron`, `electron-builder`, `electron-updater`, `electron-store`)
- `server/index.js` — **bind to `127.0.0.1` only**; add a **session-token middleware** (reject requests without the matching `X-Session-Token`); lock CORS to the Electron app origin; add a **`requireLicense` middleware** (verify cloud-signed JWT) on all premium routes; read IBKR credentials from request/secure store instead of `.env`
- `server/ibkrFlex.js` — detect token-expired error and return a clear, actionable message
- `src/components/SettingsModal.tsx` — add IBKR credentials section + license section; remove project-source backup; add JSON data export/import
- `src/App.tsx` — wrap premium sections in feature gates (UX only); handle backend `402/403` with a buy/upgrade prompt
- `src/lib/persistence.ts` — migrate storage from `localStorage` to `electron-store`; store the license JWT via OS-encrypted `safeStorage`

## 5. Architecture Decisions

1. **Backend inside Electron** — Express runs as a child of the Electron main
   process, solving the "server not always on" problem. It binds to `127.0.0.1`
   **only** on a **random OS-assigned port** (no fixed 8787), and the port +
   per-launch session token are injected to the frontend via `preload.js`.
2. **Local request authentication** — Electron generates a one-time
   `crypto.randomUUID()` **session secret** at launch, shared with both frontend
   and backend. The backend rejects any request missing the matching
   `X-Session-Token` header, blocking other local processes, LAN devices, and
   malicious browser scripts from reaching the API.
3. **IBKR credentials** — stored via Electron `safeStorage` (OS-encrypted),
   passed to the backend per request. Never bundled in the app, never plaintext.
4. **License state (tamper-proof)** — the source of truth is a **cloud-signed
   JWT**, NOT a mutable `isLicensed: true` flag. A **Cloudflare Worker** verifies
   the LemonSqueezy license and signs a short-lived JWT with a **private key**;
   the app only holds the **public key** to verify it, so editing local files
   cannot forge a valid token. The JWT is stored via OS-encrypted `safeStorage`
   and embeds a **device fingerprint** to prevent copying it to another machine.
5. **Feature gating at the backend (entry-ticket model)** — all premium routes
   (IBKR sync, benchmarks, AAII, risk metrics) pass through a `requireLicense`
   middleware that verifies the JWT signature + `exp` + device id. **Repacking
   the frontend to force-show paid components does nothing** — the backend
   returns `402/403`. The frontend gate is UX only, not the security boundary.
6. **Offline grace period** — the JWT carries a longer `exp` (e.g., 7 days) and
   silently renews in the background when online. Paying users stay unlocked
   while offline; once the JWT expires and the cloud is still unreachable, the
   app reverts to the free CSV tier. Prevents locking out legitimate users.
7. **Privacy preserved** — IBKR compute stays 100% local; trade data never goes
   to the cloud. The Cloudflare Worker only handles license validation + JWT
   signing.
8. **Free tier works fully offline** — CSV upload + core KPIs require no license.

## 6. Critical Risks & Required Handling

These were specifically flagged and MUST be handled (not deferred):

### 6.1 Code Signing — "Unknown Publisher" warning (HIGH PRIORITY)
- Target users are high-net-worth traders, highly security-sensitive. An unsigned
  `.exe` triggers a large Windows SmartScreen warning → most users will delete it.
- **Also affects auto-update**: `electron-updater` on Windows fails or warns if the
  app is unsigned.
- **Treat as a budget decision up front**, not a Phase 7 afterthought.
- Annual cost estimate:
  - Windows OV/EV certificate: ~$100-400/year (EV often needs hardware token or cloud HSM)
  - Apple Developer Program (Mac): $99/year
  - Total: ~$200-500/year
- **Cheaper option for Windows-only**: consider **Azure Trusted Signing** (~$10/month,
  avoids physical token).
- Factor this fixed annual cost into the subscription price.

### 6.2 localStorage 5MB ceiling (MANDATORY MIGRATION)
- Current data (1264 trades + 531 NAV rows + calendar + sentiment) is fine now,
  but localStorage has a hard ~5MB cap. After 3-5 years / tens of thousands of
  trades, writes will fail and the app can crash.
- **Mandatory in Phase 2-3**: migrate `STORAGE_KEY` / `SETTINGS_KEY` from
  `localStorage` to `electron-store` (local JSON file → capacity = disk size).
- Bonus: makes JSON data export/import simpler (direct file read/write).
- The existing "consider IndexedDB at 4-5 MB" warning in `SettingsModal.tsx`
  confirms this risk already exists.

### 6.3 IBKR Flex Token expiry
- IBKR Flex tokens expire periodically (~1 year) and must be regenerated in the
  IBKR portal.
- Current `server/index.js` / `server/ibkrFlex.js` only return a generic error.
- **Required (Phase 2)**: catch IBKR's token-expired/unavailable error codes and
  return a clear, actionable message — e.g. "Your IBKR token has expired. Click
  here for the guide to regenerate it in the IBKR portal." Do NOT show a generic
  "Fetch Failed" (users will think the app is broken).

### 6.4 Refund / cancellation lock logic
- Handle: refund within refund window, or yearly subscription cancellation.
- On app launch (and periodically in background), call
  `POST /v1/licenses/validate`:
  - `active` → keep full version
  - `expired` (not renewed) → revert to free CSV tier
  - `refunded` → immediately revoke license → revert to free tier
  - `disabled` → immediately revoke
  - no network → keep full within grace period (e.g., 7 days), then revert
- On refund/disable, immediately clear the encrypted license JWT in `safeStorage`
  and re-apply CSV-only feature gates.
- Grace period prevents locking out legitimate paying users who are simply offline.

### 6.5 Local port exposure (8787) — local API hardening (HIGH PRIORITY)
- **Risk**: any other process, malicious browser script, or LAN device can hit
  `127.0.0.1:8787` and steal trade data or the IBKR token.
- **Required (Phase 1)** — layered defense:
  - **Loopback only**: backend listens on `127.0.0.1` exclusively; never `0.0.0.0`.
  - **Random port**: Electron requests an OS-assigned free port (listen on `0`)
    instead of a fixed 8787; the port is passed to the frontend via `preload.js`.
  - **Per-launch session token**: Electron main generates `crypto.randomUUID()`
    at startup, injected into both frontend and backend. A backend middleware
    rejects any request missing the matching `X-Session-Token` header (403).
  - **Origin lock**: CORS only allows the Electron app origin (replace the
    current `localhost:5173` allowlist), blocking external web scripts.

### 6.6 License tamper-proofing — cloud-signed JWT (HIGH PRIORITY)
- **Risk**: a plaintext `electron-store` JSON lets anyone flip `isLicensed:false`
  → `true` and crack the paywall.
- **Required (Phase 4)** — never trust a local boolean:
  - **Cloudflare Worker signs a JWT**: on activation the app calls the Worker,
    which verifies the LemonSqueezy license key and returns a JWT signed with a
    **private key** (held as a Worker secret). Payload: `exp` (short, e.g. 7d),
    `licenseKey`, `deviceId`, `tier`.
  - **App can only verify, not forge**: the app embeds the **public key** to
    verify the signature. Hand-editing the JSON cannot produce a valid signature.
  - **OS-encrypted storage**: the JWT is stored via Electron `safeStorage`
    (DPAPI/keychain), not plaintext — copying the file to another machine fails.
  - **Device binding**: the JWT embeds a `deviceId` (machine fingerprint hash);
    verification compares it against the local fingerprint to stop token sharing.

### 6.7 Feature gating location — backend entry-ticket (HIGH PRIORITY)
- **Risk**: Electron frontend code is easily unpacked/rewritten; a cracker can
  force-show every paid component if gating lives only in `src/App.tsx`.
- **Required (Phase 5)** — move the security boundary to the backend:
  - **`requireLicense` middleware**: every premium route (IBKR Flex sync,
    benchmarks, AAII, risk metrics) verifies the cloud-signed JWT (signature +
    `exp` + `deviceId`) before executing. A rewritten frontend still gets `402/403`.
  - **Frontend gate = UX only**: `src/App.tsx` gates control display and
    buy/upgrade prompts, not access. Free routes (CSV parse, core KPIs) are
    never gated.
  - **Offline grace**: longer-`exp` JWT + silent background renewal keeps paying
    users working offline; on expiry without network, revert to the free tier.

## 7. Implementation Phases (Build Order)

1. **Phase 1 — Electron shell + local API hardening (§6.5)**: wrap frontend +
   Express; random loopback port + per-launch session token + origin lock;
   produce a working (unsigned) `.exe`.
2. **Phase 2 — IBKR credentials + token expiry handling**: Settings UI for token
   + query ID; backend reads from secure store; clear token-expired message.
3. **Phase 3 — Storage migration + data export/import**: move to `electron-store`;
   remove project-source backup; add JSON export/import of user data.
4. **Phase 4 — Cloudflare Worker + LemonSqueezy licensing (§6.6)**: deploy the
   Worker (`/activate`, `/validate`) that verifies LemonSqueezy and signs a
   short-lived JWT with the private key; license key entry UI; verify JWT with
   embedded public key; store via `safeStorage`; device binding; refund/cancel
   state machine + offline grace period.
5. **Phase 5 — Backend feature gating (§6.7)**: `requireLicense` middleware on
   all premium routes (entry-ticket); frontend gate as UX only + 402/403 buy
   prompt; enforce CSV-free vs full split across the app.
6. **Phase 6 — Auto-update**: `electron-updater` + GitHub Releases (requires signing).
7. **Phase 7 — Polish for sale**: app icon, code signing, EULA, privacy policy,
   "not financial advice" disclaimer, optional trial period.

## 8. Non-Code Setup (Owner To Do)

1. Create a LemonSqueezy account + store.
2. Create a **yearly subscription product** with **license keys enabled**.
3. Obtain API key + Store/Product IDs.
4. Create a **Cloudflare account** + install **Wrangler**; deploy the licensing
   Worker (free tier ~100k req/day).
5. Generate a **JWT signing key pair** (e.g. Ed25519/RS256): keep the **private
   key** as a Cloudflare Worker secret; embed the **public key** in the app.
   Store the LemonSqueezy API key as a Worker secret too.
6. Acquire a **code-signing certificate** (Windows) and/or Apple Developer account.
7. Prepare EULA, privacy policy, and a "not financial advice" disclaimer.

## 9. Safety Note

The current dashboard works perfectly. All desktop/monetization work should be
done on a separate branch (`desktop-app`) or a copied folder so the working
version on `main` stays intact. Commit the current working state before starting.
