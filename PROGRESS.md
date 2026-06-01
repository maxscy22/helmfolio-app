# Helmfolio — Progress notes

_Last session: 2026-06-01. Resume from here._

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

## Pending / TODO (next session)
1. **Website links** in `site/index.html` (search `TODO`):
   - ✅ `data-download-link` → `https://github.com/maxscy22/helmfolio-app/releases/latest/download/Helmfolio-Setup.exe` (done 2026-06-01).
   - ⏳ `data-buy-link` → real LemonSqueezy checkout URL (replaces `https://your-store.lemonsqueezy.com`).
     **BLOCKED**: LemonSqueezy awaiting approval to leave test mode (~2-3 days).
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
