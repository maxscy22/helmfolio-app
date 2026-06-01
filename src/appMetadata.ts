// Injected from package.json at build time (vite.config.ts `define`) so the version
// shown in the UI always matches the published release. Falls back for non-Vite
// contexts (e.g. unit tests) where the global isn't defined.
export const DASHBOARD_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0-dev';

// Single source of truth for product branding. Update these to rename the product
// everywhere (window title, dashboard header, legal documents, etc.).
export const APP_NAME = 'Helmfolio';
export const APP_TAGLINE = 'Take the helm of your trading performance. Built for IBKR traders.';
export const APP_WEBSITE = 'https://helmfolio.com';
export const APP_SUPPORT_EMAIL = 'support@helmfolio.com';
