# Helmfolio — Progress notes

_Last updated: 2026-06-01 (evening). Website is LIVE at https://helmfolio.com. Resume from here._

## What was done this session

### Marketing website (new `site/` folder — static HTML + Tailwind CDN)
- `site/index.html` — single-page landing: sticky nav, hero (with dashboard screenshot),
  privacy strip, features grid, **screenshot gallery** (6 Demo-mode shots incl. the
  drill-down "detail box" leaderboard + P/L calendar), how-it-works, privacy deep section,
  pricing (Free vs Pro $99/yr · 2 devices), FAQ accordion, download section, footer.
- **Lightbox**: every screenshot is `.zoomable` → click to enlarge (Esc / backdrop / X to close).
- `site/legal/privacy.html`, `eula.html`, `disclaimer.html` — generated from `legal/*.md`,
  tokens filled (Max Shing / Hong Kong / support@helmfolio.com / updated 2026-05-31).
- `site/assets/` — logo, og-image, and `screenshot-*.jpg` (cropped via the script below).
- `site/README.md` — deploy steps (Cloudflare Pages, output dir `site/`) + placeholder list.
- `scripts/crop-screenshots.ps1` — auto-crops L/R background margins of the screenshots
  (PowerShell + System.Drawing, gradient-energy detection). Re-run after adding new shots.
- Removed personal identity from the public landing page (FAQ "who is behind" + footer).
  Legal pages keep seller/jurisdiction (required for enforceability — user confirmed "keep").

### Desktop app — fixed installer name + GitHub auto-update
- `electron-builder.yml`: `win.artifactName` → `${productName}-Setup.${ext}` = fixed
  `Helmfolio-Setup.exe` (stable website URL). Added `publish: github` (PLACEHOLDER owner/repo).
- `package.json`: added `electron-updater` dep + `electron:publish` script. (`npm install` done.)
- `electron/main.cjs`: `setupAutoUpdater()` (auto check on launch, background download,
  Restart/Later prompt) + `update:check` IPC handler for manual checks.
- `electron/preload.cjs`: exposes `checkForUpdates()`.
- `src/lib/api.ts`: `UpdateCheckResult` type + `checkForUpdates()` wrapper.
- `src/components/SettingsModal.tsx`: **Settings → Help & support → "Check for updates"** button
  (desktop-only) with inline status.
- `README.md`: new "Building & releasing the desktop app" section + release checklist.
- `npm run build` passes (tsc + vite).

### Launch milestones (2026-06-01, evening)
- **Website LIVE** on Cloudflare Pages → `helmfolio.com` **and** `www.helmfolio.com` both **Active + SSL** (apex bound via Pages Custom domains; deploy with `npx wrangler pages deploy site --project-name helmfolio`).
- **Anchored pricing**: list **$129/yr**, founding **$99/yr for first 100** via discount code **`Y4MTQWOQ`** (-$30). Shown consistently on site hero, pricing card (with code box + "after first 100, $129" note), and `docs/FAQ.md`.
- **Features expanded** to 9 cards (added Cycle KPIs, Sharpe/maxDD, leaderboard drill-down, P/L calendar, cost & execution review) + new **"in cycles" explainer** section (what a cycle is + why) — the core $99 justification. PDF card reworded to self-review / your-records (no tax framing).
- **`docs/FAQ.md` Free vs Pro table** expanded to match site (🔒 = preview in free, unlocked by Pro).
- **App ↔ site decoupled**: removed hardcoded price from `LicenseModal`; "See plans & upgrade" CTA now opens `APP_WEBSITE + '/#pricing'`. App version injected from `package.json` at build time (`__APP_VERSION__`).
- **Buy button wired** to real checkout `https://helmfolio.lemonsqueezy.com/checkout/buy/1a405411-...?checkout[discount_code]=Y4MTQWOQ` (code pre-applied). Same URL in `.env` `VITE_LICENSE_PURCHASE_URL`.
- **Published `v1.0.4`** via `npm run electron:publish` (GH_TOKEN in shell) → GitHub release `maxscy22/helmfolio-app`; auto-update verified working.
- **Anchor-jump bug fixed**: lazy full-width screenshots shifted layout so `/#pricing` landed on "Connected in about 3 minutes". Added a scroll-to-hash-on-load script in `site/index.html`. **Needs redeploy** (`wrangler pages deploy site`).

## Pending / TODO (next session)
1. **Website links** in `site/index.html` (search `TODO`):
   - ✅ `data-download-link` → `https://github.com/maxscy22/helmfolio-app/releases/latest/download/Helmfolio-Setup.exe` (done 2026-06-01).
   - ✅ `data-buy-link` → real Helmfolio LemonSqueezy checkout with `Y4MTQWOQ` pre-applied (done 2026-06-01).
   - ⏳ **Redeploy site** to push the anchor-jump fix live: `npx wrangler pages deploy site --project-name helmfolio`.
1b. **LemonSqueezy: leave test mode → LIVE** (the real blocker for taking money). Then run one real purchase to confirm $129 list + `Y4MTQWOQ` shows $99. Optional: "Connect domain" (e.g. `checkout.helmfolio.com`) for branding — if done, update buy link in `site/index.html` + `.env` and redeploy.
2. ✅ **`electron-builder.yml`**: `publish` set to `github` owner `maxscy22` / repo `helmfolio-app` (public). (done 2026-06-01)
3. **Auto-update first release**: set `GH_TOKEN`, bump `package.json` version per release,
   `npm run electron:publish`, ensure release is **public + published**. Test update flow
   (install v1.0.0 → publish v1.0.1 → app should auto-download + prompt restart).
4. **App's two disabled "IBKR setup guide — coming soon" buttons**: wire to the published
   guide URL once the site is live.
5. Optional: capture a dedicated 1200×630 OG banner; consider Cloudflare Web Analytics.

## Notes
- Local website preview server may still be running on `http://localhost:4321` (`npx serve site`).
- Nothing was committed to git this session (many staged-but-uncommitted changes exist).
- Original full-res screenshots remain in `build/` (e.g. `2026-06-01 04xxxx.jpg`).
- Plan file: `~/.windsurf/plans/helmfolio-website-016d37.md`.
