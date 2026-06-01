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
2. **Buy link** (`data-buy-link`) — replace `https://your-store.lemonsqueezy.com` with the real
   LemonSqueezy checkout URL.
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

## Notes

- Tailwind runs via the Play CDN for zero-build simplicity. For production polish, compile a
  static `styles.css` with the Tailwind CLI and drop the CDN `<script>`.
- Once the site is live, wire the desktop app's two disabled "IBKR setup guide — coming soon"
  buttons to the published guide URL.
