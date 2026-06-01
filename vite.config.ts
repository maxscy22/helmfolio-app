import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Single source of truth for the app version: package.json. Injected at build time
// so the UI never drifts from the published release (e.g. after `npm version`).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // Relative base so the bundled index.html works when loaded from file:// inside
  // the packaged Electron app (absolute "/assets" paths would otherwise 404).
  base: './',
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
