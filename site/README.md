# Helmfolio marketing website

Single-page, **static** landing site (plain HTML + Tailwind Play CDN). No build step.
This is **separate** from the desktop app — do **not** confuse it with the repo-root `index.html`
(which is the Vite/React app entry).

## Structure

```
site/
├── index.html                 # the entire landing page
├── assets/
│   ├── helmfolio-mark.png      # logo + favicon (copied from build/)
│   ├── og-image.png            # social share image (placeholder = logo)
│   └── screenshot-dashboard.png  # TODO: add a Demo-mode screenshot
└── README.md
```

## Before going live — fill these placeholders

Search `index.html` for `TODO`:

1. **Download link** (`data-download-link`) — point to the fixed-name installer on the latest
   GitHub release. Because the artifact name is version-less (`Helmfolio-Setup.exe`), this URL
   never changes across releases:
   `https://github.com/<owner>/<repo>/releases/latest/download/Helmfolio-Setup.exe`.
   Publish releases with `npm run electron:publish` (needs a `GH_TOKEN`); the release must be
   **public** for in-app auto-update to work without embedding a token.
2. ~~**Buy link** (`data-buy-link`)~~ — **done.** Points to the Helmfolio LemonSqueezy checkout
   with the founders' discount code (`Y4MTQWOQ`) pre-applied.
3. ~~Dashboard screenshot~~ — **done.** `assets/screenshot-*.jpg` are real Demo-mode captures
   (hero + KPIs + benchmark + equity curve). To refresh: run `npm run dev`, open in a **browser**
   (treated as Pro + Demo button available), click **Demo**, screenshot. Identity is masked to
   "Alex Carter" so no real data leaks.
4. **OG image** — `assets/og-image.jpg` is the dashboard screenshot (1024×568). Optional: replace
   with a dedicated 1200×630 banner for crisper social previews.
5. ~~Legal pages~~ — **done.** `legal/privacy.html`, `legal/eula.html`, `legal/disclaimer.html`
   are generated from the repo `legal/*.md` with tokens filled (Max Shing / Hong Kong /
   support@helmfolio.com, last updated 2026-05-31). If you edit the source `legal/*.md`, update
   these HTML copies too.

## Local preview

Any static server works, e.g.:

```bash
npx serve site
# or
python -m http.server 8080 --directory site
```

## Deploy — Cloudflare Pages

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → connect the repo.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `site`
4. Deploy, then add the custom domain **helmfolio.com** under the Pages project's **Custom domains**.

(Alternatively, drag-and-drop the `site/` folder into Pages' direct-upload option.)

## Analytics & conversion tracking

The site ships a privacy-first funnel (no cookie banner needed):

1. **Pageviews / traffic** — Cloudflare Web Analytics. Beacon tag is at the bottom of
   `index.html` with the live token for `helmfolio.com` (`data-cf-beacon`). Stats show up in
   Cloudflare dashboard → **Web Analytics** a few minutes after the site is deployed.
2. **Buy / Download clicks** — the buttons (`data-buy-link`, `data-download-link`) call
   `zaraz.track('buy_click' | 'download_click', …)`. This is a **no-op until you enable
   Cloudflare Zaraz** (free) in the dashboard; once enabled, events flow with no code change.
3. **Checkout visits / sales** — read from the **LemonSqueezy** dashboard. The Buy link carries
   `utm_source=helmfolio.com&utm_medium=website&utm_campaign=pricing_pro` so LS attributes the
   source; LS counts of checkout visits ≈ "Buy clicks".
4. **Installer downloads** — GitHub release download counter on `maxscy22/helmfolio-app`.

Funnel = CF visitors → (Zaraz `buy_click` / LS checkout visits) → LS sales; and CF visitors →
(Zaraz `download_click` / GitHub download count).

## Security headers

`site/_headers` sets CSP-independent hardening on every response (HSTS,
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`,
`Permissions-Policy`). These cannot break the current Tailwind Play CDN build.

**No `Content-Security-Policy` yet** — on purpose. The Tailwind Play CDN injects
styles at runtime and the page has inline `<script>` blocks, so any compatible CSP
would need `'unsafe-inline'` (and likely `'unsafe-eval'`), giving little real
protection. Add a strict hash/nonce CSP only **after** compiling Tailwind to a
static `styles.css` and removing the inline scripts.

## Notes

- Tailwind runs via the Play CDN for zero-build simplicity. For production polish, compile a
  static `styles.css` with the Tailwind CLI and drop the CDN `<script>`.
- Once the site is live, wire the desktop app's two disabled "IBKR setup guide — coming soon"
  buttons to the published guide URL.
