// Electron main process.
//
// Responsibilities (Phase 1 — Electron shell + local API hardening):
//   1. Launch the Express backend as a child process on a RANDOM loopback port
//      (PORT=0) so we never expose a predictable, fixed 8787.
//   2. Generate a per-launch SESSION_TOKEN and inject it into both the backend
//      (env) and the renderer (preload via additionalArguments). The backend then
//      rejects any request missing the matching X-Session-Token header.
//   3. Create the BrowserWindow with a secure preload (contextIsolation on,
//      nodeIntegration off) and load the built frontend.

const { app, BrowserWindow, Menu, shell, ipcMain, safeStorage, dialog } = require('electron');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Store = require('electron-store');
const { machineIdSync } = require('node-machine-id');

// Stable, hardware-derived device id used to bind the license token to this
// machine (prevents copying a token to another computer). Hashed, no PII.
let deviceId = '';
try {
  deviceId = machineIdSync();
} catch {
  deviceId = '';
}

// Durable JSON-backed storage in userData (survives app updates and Chromium
// cache clears, unlike renderer localStorage). The renderer reads/writes it
// synchronously through the preload bridge (ipcRenderer.sendSync) so the existing
// synchronous persistence code keeps working unchanged.
const dataStore = new Store({ name: 'dashboard-data' });

// Keys the dashboard persists. Used for JSON export/import of the full dataset.
const DASHBOARD_STORE_KEYS = [
  'ibkr-dashboard:last-loaded-data',
  'ibkr-dashboard:display-settings',
  'ibkr-dashboard:aaii-manual-sentiment',
];

const isDev = !app.isPackaged;
const sessionToken = crypto.randomUUID();

// In dev the renderer is served by Vite; in production we load the bundled files.
const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173';

let backendProcess = null;
let mainWindow = null;
let backendPort = null;

// Resolve the backend entry + working directory for both dev and packaged builds.
const getBackendPaths = () => {
  if (isDev) {
    const projectRoot = path.join(__dirname, '..');
    return { entry: path.join(projectRoot, 'server', 'index.js'), cwd: projectRoot };
  }
  // In production the server folder is shipped via electron-builder extraResources.
  const resourcesRoot = process.resourcesPath;
  return { entry: path.join(resourcesRoot, 'server', 'index.js'), cwd: resourcesRoot };
};

// Spawn the Express backend using Electron's bundled Node (ELECTRON_RUN_AS_NODE),
// so the packaged app does not depend on a system Node install. Resolves with the
// OS-assigned port once the backend prints the PORT_READY marker.
const startBackend = () =>
  new Promise((resolve, reject) => {
    const { entry, cwd } = getBackendPaths();
    const clientOrigin = isDev ? DEV_SERVER_URL : 'app://dashboard';

    backendProcess = spawn(process.execPath, [entry], {
      cwd,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: '0',
        HOST: '127.0.0.1',
        SESSION_TOKEN: sessionToken,
        CLIENT_ORIGIN: clientOrigin,
        // Durable per-user data dir so the backend can persist its market-data
        // cache (e.g. the weekly AAII release) across app relaunches/updates.
        DASHBOARD_DATA_DIR: app.getPath('userData'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Backend did not report a ready port within 30s.'));
    }, 30000);

    backendProcess.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      process.stdout.write(`[backend] ${text}`);
      const match = text.match(/PORT_READY:(\d+)/);
      if (match && !settled) {
        settled = true;
        clearTimeout(timeout);
        resolve(Number(match[1]));
      }
    });

    backendProcess.stderr.on('data', (chunk) => {
      process.stderr.write(`[backend:err] ${chunk.toString()}`);
    });

    backendProcess.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    backendProcess.on('exit', (code) => {
      process.stdout.write(`[backend] exited with code ${code}\n`);
      backendProcess = null;
    });
  });

const createWindow = () => {
  // Remove the default Electron application menu (File/Edit/View/Window/Help) in
  // packaged builds — it looks unprofessional for an end-user desktop app. In dev
  // we keep it so reload / DevTools accelerators remain available.
  if (!isDev) Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#020617',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // DevTools only in development. In packaged builds this disables the
      // F12 / Ctrl+Shift+I shortcuts and the Inspect menu so end users cannot
      // casually open DevTools to poke at renderer state. (Not a security
      // boundary — see the defense model — just hygiene and an anti-tamper deterrent.)
      devTools: isDev,
      // Pass the dynamic backend port + session token + device id to the preload.
      additionalArguments: [`--backend-port=${backendPort}`, `--session-token=${sessionToken}`, `--device-id=${deviceId}`],
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Open external links (and mailto: support links) in the user's real browser /
  // default mail client instead of inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // A bare mailto: link without target="_blank" would try to navigate the main
  // window; intercept it and hand off to the OS mail client instead.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('mailto:')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

const stopBackend = () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
};

// --- IBKR credentials: OS-encrypted at rest via Electron safeStorage ----------
// Stored as an encrypted blob in userData; never written in plaintext, never
// bundled in the app. The renderer reads/writes them only through these IPC
// handlers and passes them to the local backend per request.
const credentialsFile = () => path.join(app.getPath('userData'), 'ibkr-credentials.enc');

const readStoredCredentials = () => {
  try {
    if (!fs.existsSync(credentialsFile())) return { token: '', queryId: '' };
    if (!safeStorage.isEncryptionAvailable()) return { token: '', queryId: '' };
    const encrypted = fs.readFileSync(credentialsFile());
    const json = safeStorage.decryptString(encrypted);
    const parsed = JSON.parse(json);
    return { token: parsed.token || '', queryId: parsed.queryId || '' };
  } catch (error) {
    console.error('Failed to read stored IBKR credentials:', error);
    return { token: '', queryId: '' };
  }
};

ipcMain.handle('ibkr-credentials:get', () => {
  const { token, queryId } = readStoredCredentials();
  // Never return the raw token to the renderer; only whether it is set plus a mask.
  return {
    hasToken: Boolean(token),
    tokenMask: token ? `••••••••${token.slice(-4)}` : '',
    queryId,
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
  };
});

ipcMain.handle('ibkr-credentials:set', (_event, payload) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS-level encryption is not available, so credentials cannot be stored securely.');
  }
  const current = readStoredCredentials();
  // Empty token means "keep existing"; allows updating only the query ID.
  const token = typeof payload?.token === 'string' && payload.token.trim() ? payload.token.trim() : current.token;
  const queryId = typeof payload?.queryId === 'string' ? payload.queryId.trim() : current.queryId;
  const encrypted = safeStorage.encryptString(JSON.stringify({ token, queryId }));
  fs.writeFileSync(credentialsFile(), encrypted);
  return { hasToken: Boolean(token), queryId };
});

ipcMain.handle('ibkr-credentials:clear', () => {
  try {
    if (fs.existsSync(credentialsFile())) fs.unlinkSync(credentialsFile());
  } catch (error) {
    console.error('Failed to clear IBKR credentials:', error);
  }
  return { hasToken: false, queryId: '' };
});

// Returns the decrypted credentials for use in an actual import request. Kept
// separate and only invoked at import time to minimize plaintext exposure.
ipcMain.handle('ibkr-credentials:reveal', () => readStoredCredentials());

// --- Durable dashboard storage (synchronous, electron-store backed) -----------
ipcMain.on('store:get', (event, key) => {
  event.returnValue = dataStore.get(key, null);
});
ipcMain.on('store:set', (event, key, value) => {
  dataStore.set(key, value);
  event.returnValue = true;
});
ipcMain.on('store:delete', (event, key) => {
  dataStore.delete(key);
  event.returnValue = true;
});

// --- JSON data export / import (full dashboard dataset) -----------------------
ipcMain.handle('data:export', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export dashboard data',
    defaultPath: `Helmfolio-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  const data = {};
  DASHBOARD_STORE_KEYS.forEach((key) => {
    const value = dataStore.get(key, null);
    if (value != null) data[key] = value;
  });
  const payload = { app: 'helmfolio', schema: 1, exportedAt: new Date().toISOString(), data };
  fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2));
  return { ok: true, path: result.filePath };
});

ipcMain.handle('data:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import dashboard data',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePaths?.[0]) return { ok: false, canceled: true };
  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf8');
    const parsed = JSON.parse(raw);
    const data = parsed?.data && typeof parsed.data === 'object' ? parsed.data : null;
    if (!data) return { ok: false, error: 'The selected file is not a valid dashboard backup.' };
    DASHBOARD_STORE_KEYS.forEach((key) => {
      if (data[key] != null) dataStore.set(key, data[key]);
    });
    return { ok: true, path: result.filePaths[0] };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to import dashboard data.' };
  }
});

// Reveal the local data folder (electron-store userData) in the OS file manager.
ipcMain.handle('data:reveal-folder', async () => {
  try {
    await shell.openPath(app.getPath('userData'));
    return { ok: true, path: app.getPath('userData') };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to open data folder.' };
  }
});

// --- License token: OS-encrypted at rest via safeStorage ----------------------
const licenseFile = () => path.join(app.getPath('userData'), 'license.enc');

ipcMain.handle('license:get', () => {
  try {
    if (!fs.existsSync(licenseFile()) || !safeStorage.isEncryptionAvailable()) return { token: '' };
    return { token: safeStorage.decryptString(fs.readFileSync(licenseFile())) };
  } catch (error) {
    console.error('Failed to read license token:', error);
    return { token: '' };
  }
});

ipcMain.handle('license:set', (_event, token) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS-level encryption is not available, so the license cannot be stored securely.');
  }
  fs.writeFileSync(licenseFile(), safeStorage.encryptString(String(token || '')));
  return { ok: true };
});

ipcMain.handle('license:clear', () => {
  try {
    if (fs.existsSync(licenseFile())) fs.unlinkSync(licenseFile());
  } catch (error) {
    console.error('Failed to clear license token:', error);
  }
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Auto-update (GitHub releases via electron-updater).
//
// Runs only in packaged production builds. The update version + feed come from
// the `latest.yml` published next to each GitHub release (configured under
// `publish:` in electron-builder.yml). The installer filename is fixed
// (Helmfolio-Setup.exe); the updater reads the real version from latest.yml, so a
// constant filename is fine. For unauthenticated in-app updates the GitHub RELEASE
// must be public.
// ---------------------------------------------------------------------------
const setupAutoUpdater = () => {
  if (isDev) return; // never check for updates against a dev build
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (error) {
    console.error('[updater] electron-updater unavailable:', error);
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('error', (err) => console.error('[updater] error:', err));
  autoUpdater.on('update-available', (info) => console.log('[updater] update available:', info?.version));
  autoUpdater.on('update-not-available', () => console.log('[updater] no update available'));
  autoUpdater.on('update-downloaded', (info) => {
    if (!mainWindow) return;
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
        title: 'Update ready',
        message: `Helmfolio ${info?.version ?? ''} has been downloaded.`,
        detail: 'Restart the app to finish installing the update.',
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      })
      .catch(() => {});
  });
  autoUpdater.checkForUpdates().catch((err) => console.error('[updater] check failed:', err));
};

// Manual "Check for updates" trigger from Settings. Returns a status the renderer
// can show inline. If an update is found it downloads in the background and the
// existing update-downloaded dialog prompts the user to restart.
ipcMain.handle('update:check', async () => {
  if (isDev) {
    return { ok: false, status: 'unsupported', message: 'Updates are only available in the installed desktop app.' };
  }
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (error) {
    return { ok: false, status: 'error', message: 'The updater is unavailable in this build.' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    const currentVersion = app.getVersion();
    const latest = result && result.updateInfo ? result.updateInfo.version : currentVersion;
    if (latest && latest !== currentVersion) {
      return { ok: true, status: 'available', version: latest, currentVersion };
    }
    return { ok: true, status: 'none', version: latest, currentVersion };
  } catch (error) {
    return { ok: false, status: 'error', message: 'Could not check for updates. Please try again later.' };
  }
});

app.whenReady().then(async () => {
  try {
    backendPort = await startBackend();
  } catch (error) {
    console.error('Failed to start the dashboard backend:', error);
    app.quit();
    return;
  }
  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', stopBackend);
app.on('quit', stopBackend);
