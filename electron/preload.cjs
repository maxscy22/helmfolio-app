// Secure preload bridge (contextIsolation on).
//
// Exposes ONLY the minimal data the renderer needs to talk to the local backend:
// the dynamic backend port and the per-launch session token. These are passed in
// from the main process via webPreferences.additionalArguments and read here from
// process.argv. No Node APIs are leaked to the renderer.

const { contextBridge, ipcRenderer } = require('electron');

const readArg = (prefix) => {
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : '';
};

const backendPort = Number(readArg('--backend-port='));
const sessionToken = readArg('--session-token=');
const deviceId = readArg('--device-id=');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  backendPort,
  sessionToken,
  deviceId,
  // License token (OS-encrypted via safeStorage in the main process).
  getLicenseToken: () => ipcRenderer.invoke('license:get'),
  setLicenseToken: (token) => ipcRenderer.invoke('license:set', token),
  clearLicenseToken: () => ipcRenderer.invoke('license:clear'),
  // IBKR credentials, OS-encrypted in the main process via safeStorage.
  getIbkrCredentials: () => ipcRenderer.invoke('ibkr-credentials:get'),
  setIbkrCredentials: (payload) => ipcRenderer.invoke('ibkr-credentials:set', payload),
  clearIbkrCredentials: () => ipcRenderer.invoke('ibkr-credentials:clear'),
  revealIbkrCredentials: () => ipcRenderer.invoke('ibkr-credentials:reveal'),
  // Durable, synchronous dashboard storage (electron-store in the main process).
  storage: {
    get: (key) => ipcRenderer.sendSync('store:get', key),
    set: (key, value) => ipcRenderer.sendSync('store:set', key, value),
    remove: (key) => ipcRenderer.sendSync('store:delete', key),
  },
  // JSON dataset export/import via native file dialogs.
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
  // Open the local data folder (userData) in the OS file manager.
  revealDataFolder: () => ipcRenderer.invoke('data:reveal-folder'),
  // Manually trigger an auto-update check (Settings -> Help & support).
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
});
