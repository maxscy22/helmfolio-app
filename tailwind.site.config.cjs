/**
 * Tailwind config for the MARKETING SITE (site/ folder), separate from the app
 * config (tailwind.config.js scans ./index.html + ./src).
 *
 * Compiles a static, purged stylesheet so the site no longer ships the
 * render-blocking Tailwind Play CDN runtime (cdn.tailwindcss.com), which was
 * the root cause of the very slow LCP on helmfolio.com.
 *
 * Build:  npm run build:site-css   ->  site/styles.css
 */
module.exports = {
  content: ['./site/**/*.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        base: '#020617', // slate-950 — matches the app shell
        panel: '#0b1220',
      },
    },
  },
  plugins: [],
};
