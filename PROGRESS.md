# Helmfolio — Progress notes

_Last updated: 2026-06-01 (~20:34). Website is LIVE at https://helmfolio.com. **v1.0.5 published.** US-market copy refined. Resume from here._

## Session 2 — analytics, security, guides, US-market scope (2026-06-01 evening)

### Analytics & conversion tracking (site)
- **Cloudflare Web Analytics** beacon in `site/index.html` with LIVE token `24f4cdbfbf5f4abb808dc0095a413750` (pageviews/traffic; no cookie banner needed).
- **Click events** via `zaraz.track()` (no-op until Zaraz enabled in CF dashboard): `buy_click`, `download_click`, and `download_intent` (`location: hero | pricing_free`) on the in-page #download CTAs.
- **UTM** on the buy link (`utm_source=helmfolio.com&utm_medium=website&utm_campaign=pricing_pro`) so LemonSqueezy attributes the source. Funnel doc in `site/README.md`.

### Security headers (site)
- New `site/_headers` (Cloudflare Pages): HSTS, X-Content-Type-Options, X-Frame-Options: DENY, Referrer-Policy, Permissions-Policy.
- **No CSP yet — on purpose** (Tailwind Play CDN + inline scripts would force `'unsafe-inline'`/`'unsafe-eval'`). Add a strict hash/nonce CSP only after compiling Tailwind to static CSS.
- CF dashboard: **Always Use HTTPS = ON**; dashboard HSTS left OFF (handled by `_headers`).

### IBKR setup guides (new `site/guides/`)
- `guides/index.html` hub + `guides/flex-token.html` (Flex Token & Query ID) + `guides/csv-email.html` (manual CSV export + daily-email delivery). Linked from main nav + footer.
- Flex guide is **code-accurate**: full **General Configuration table** (Date `yyyyMMdd`, Time `HHmmss`, Separator `;` flagged "must match" — app `splitTradeDateTime` in `src/App.tsx` splits on `;` and expects 8-digit date / 6-digit time), "Select All" per section, and a note that the standalone **Include Currency Rates?** toggle is optional because the app uses the per-row `FXRateToBase` field (`src/lib/cashFlow.ts`).
- Screenshot placeholders (dashed boxes) await real IBKR screenshots in `site/assets/guides/`.

### US-market scope disclosure (site + app + legal) — v1.0.5
- App only currency-converts **cash** (dividends/interest/deposits via `FXRateToBase`); **trade-level P/L for non-USD markets is NOT converted**. Decided to disclose clearly rather than chase worldwide-market data (solo dev).
- **Site**: new FAQ entry + amber callout in Download section + note under pricing.
- **App**: amber note in the IBKR sync panel (`src/App.tsx` ~1579).
- **Legal**: new Disclaimer clause 4 "Designed for US-market trading" in `legal/DISCLAIMER.md` (+ renumber) and mirrored in `site/legal/disclaimer.html`.
- **Version bumped to `1.0.5`**; `npm run build` passes. Site redeployed.
- **App release `v1.0.5` PUBLISHED** to GitHub `maxscy22/helmfolio-app` via `npm run electron:publish` (uploaded `Helmfolio-Setup.exe` + `latest.yml`). ACTION: confirm the release is **out of Draft** (electron-builder defaults to draft) so auto-update sees it.
- **`GH_TOKEN` gotcha (resolved)**: `setx` only affects NEW shells and does NOT update already-running Windsurf terminals — every publish failed until we used same-line `$env:GH_TOKEN="..."; npm run electron:publish` in the active shell. NOTE: the IDE forwards integrated-terminal commands+output to Cascade, so secrets typed there are visible — set tokens in an external terminal. Tokens pasted during this session should be REVOKED.

### Guides nav consistency fixes (site)
- Guides pages had a shorter nav: added **Privacy** link and reordered to match homepage exactly — **Features / Privacy / Pricing / Guides / FAQ** across `guides/index.html`, `flex-token.html`, `csv-email.html`.

### US-market copy refinement (scope/PnL framing)
- Reworded all US-market notices per user direction: "fully optimized", frame as **scope limitation** ("multi-currency reporting and local tracking rules ... currently not supported"), and **"affects PnL accuracy"** instead of "figures can be inaccurate" (keeps trust in core product).
- **Detailed version** → Download-section callout + FAQ answer. **Concise ⚠️ version** ("⚠️ US Market Support Only: ...") → under pricing/checkout + in-app IBKR sync note (app version drops the "before purchasing Pro" CTA).
- Updated `site/index.html` (3 spots), `src/App.tsx` (~1579), `legal/DISCLAIMER.md` clause 4, `site/legal/disclaimer.html`. `npm run build` passes; site deployed. **App copy needs next release (v1.0.6) to reach users.**

### License lapse test (2026-06-01, user-tested with a same-day-expiry key)
- **Observed**: (1) Pro worked normally for the first half of the day; (2) ~4-5PM it **silently reverted to Free with NO popup/notification**.
- **Verdict**: this IS the designed `lapsed` path, working correctly. Mechanism (`src/lib/license.ts`): the signed JWT `exp` doubles as a ~24h offline grace window; `renewLicenseIfNeeded()` skips the server unless the active token is within 12h of expiry (`RENEW_THRESHOLD_SECONDS`) or already `expired`. When it does re-validate and the Worker returns **402** (LemonSqueezy term ended), it sets `status: 'lapsed'`, clears the stored token, and drops `tier → 'free'` (covered by `license.test.ts` "flips to LAPSED on 402"). Downgrade-to-free is correct/expected.
- **UX GAP (not a bug, but worth fixing)**: lapse is **silent**. Background renewal only mutates `licenseState`; there is NO `setShowLicense(true)` / toast / banner on the `lapsed` (or `expired`) transition. `LICENSE_LAPSED_MESSAGE` ("Your 1-year Pro license has expired…") is only seen if the user manually opens the License modal. A paying user whose term ends just quietly loses Pro features with no explanation.
- **Timing note**: re-validation only fires on **app launch or the window `online` event** (no periodic timer), so the exact flip time depends on those triggers (network reconnect / sleep-wake / relaunch).
- ✅ **FIXED (commit `9112391`)**: added a dismissible top-of-dashboard banner (`App.tsx`, shown when `status` is `lapsed`/`expired`) with the renewal message + **Renew Pro / View license** CTA opening the License modal. Re-arms on each fresh downgrade; `data-pdf-hide` so it's excluded from exports. Needs next app release (v1.0.6) to reach users.

### Session 2 commits
- `50b5b2d` analytics · `e7dd6eb` _headers · `6b66a4a` guides + US-market site copy · `45e659b` v1.0.5 app/legal · `b2a4462` PROGRESS · `3505a5d` guides Privacy link · `563ce43` guides nav order · `e8bba2f` PROGRESS · `c65ff1f` US-market copy refinement · `8790f13` lapse test notes · `9112391` lapse/expiry banner.
- **App changes awaiting release (v1.0.6)**: US-market in-app copy (`c65ff1f`), license lapse/expiry banner (`9112391`). Bump `package.json` + `npm run electron:publish` when ready.

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
   - ✅ **Redeploy site** done (anchor-jump fix + analytics + headers + guides + US-market copy all live).
1b. **LemonSqueezy: leave test mode → LIVE** (the real blocker for taking money). Then run one real purchase to confirm $129 list + `Y4MTQWOQ` shows $99. Optional: "Connect domain" (e.g. `checkout.helmfolio.com`) for branding — if done, update buy link in `site/index.html` + `.env` and redeploy.
2. ✅ **`electron-builder.yml`**: `publish` set to `github` owner `maxscy22` / repo `helmfolio-app` (public). (done 2026-06-01)
3. **Auto-update first release**: set `GH_TOKEN`, bump `package.json` version per release,
   `npm run electron:publish`, ensure release is **public + published**. Test update flow
   (install v1.0.0 → publish v1.0.1 → app should auto-download + prompt restart).
3b. ✅ **Published app `v1.0.5`** (electron:publish, uploaded exe + latest.yml). ⏳ REMAINING: confirm the GitHub release is **published, not Draft**, then verify v1.0.4 auto-updates to v1.0.5 (or Settings → Check for updates).
4. **App's two disabled "IBKR setup guide — coming soon" buttons**: wire to `https://helmfolio.com/guides/flex-token.html` and `/guides/csv-email.html` (guides now LIVE). Needs an app release.
5. **Guide screenshots**: capture IBKR Flex Query "General Configuration" + Statements-CSV screens → drop in `site/assets/guides/`, replace the dashed placeholders in the two guide pages.
6. Optional: dedicated 1200×630 OG banner. ✅ Cloudflare Web Analytics now live.
7. Optional (future): compile Tailwind to static CSS, then add a strict CSP in `site/_headers`.
8. ✅ **License lapse notification DONE** (commit `9112391`): dismissible banner on `lapsed`/`expired` with Renew/View CTA. ⏳ Ships with next app release (v1.0.6).

## Notes
- Local website preview server may still be running on `http://localhost:5055` (`npx serve site -l 5055`).
- All Session 2 work is committed (see commit hashes above) and the site is deployed. Only the app `v1.0.5` release is outstanding.
- App FX limitation lives in `src/lib/cashFlow.ts` (cash only). Trade-level multi-currency conversion is NOT implemented — intentionally out of scope for now.
- Original full-res screenshots remain in `build/` (e.g. `2026-06-01 04xxxx.jpg`).
- Plan file: `~/.windsurf/plans/helmfolio-website-016d37.md`.
