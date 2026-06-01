// Centralized API layer for the local dashboard backend.
//
// Two runtime modes are supported transparently:
//   1. Browser dev (`npm run dev`): the Vite dev server proxies `/api/*` to the
//      local Express backend, so we just use relative paths and no token.
//   2. Packaged Electron app: the Electron main process launches the backend on a
//      random loopback port and injects the port + a per-launch session token via
//      the preload bridge (`window.desktop`). We then target the absolute backend
//      URL and attach the `X-Session-Token` header to every request.

export interface IbkrCredentialStatus {
  hasToken: boolean;
  tokenMask: string;
  queryId: string;
  encryptionAvailable: boolean;
}

export interface IbkrCredentials {
  token: string;
  queryId: string;
}

export interface DataTransferResult {
  ok: boolean;
  canceled?: boolean;
  path?: string;
  error?: string;
}

export interface UpdateCheckResult {
  ok: boolean;
  status: 'available' | 'none' | 'unsupported' | 'error';
  version?: string;
  currentVersion?: string;
  message?: string;
}

interface SyncStorageBridge {
  get: (key: string) => string | null;
  set: (key: string, value: string) => boolean;
  remove: (key: string) => boolean;
}

interface DesktopBridge {
  isDesktop: true;
  backendPort: number;
  sessionToken: string;
  deviceId: string;
  getLicenseToken: () => Promise<{ token: string }>;
  setLicenseToken: (token: string) => Promise<{ ok: boolean }>;
  clearLicenseToken: () => Promise<{ ok: boolean }>;
  getIbkrCredentials: () => Promise<IbkrCredentialStatus>;
  setIbkrCredentials: (payload: { token?: string; queryId?: string }) => Promise<{ hasToken: boolean; queryId: string }>;
  clearIbkrCredentials: () => Promise<{ hasToken: boolean; queryId: string }>;
  revealIbkrCredentials: () => Promise<IbkrCredentials>;
  storage: SyncStorageBridge;
  exportData: () => Promise<DataTransferResult>;
  importData: () => Promise<DataTransferResult>;
  revealDataFolder: () => Promise<DataTransferResult>;
  checkForUpdates: () => Promise<UpdateCheckResult>;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

const getDesktopBridge = (): DesktopBridge | undefined => {
  if (typeof window === 'undefined') return undefined;
  const bridge = window.desktop;
  if (bridge && bridge.isDesktop && typeof bridge.backendPort === 'number') return bridge;
  return undefined;
};

export const isDesktopRuntime = (): boolean => getDesktopBridge() !== undefined;

// Resolves a relative API path (e.g. "/api/health") to an absolute URL when running
// inside Electron, or leaves it relative for the browser dev proxy.
export const resolveApiUrl = (path: string): string => {
  const bridge = getDesktopBridge();
  if (!bridge) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `http://127.0.0.1:${bridge.backendPort}${normalized}`;
};

// Drop-in replacement for `fetch` against the dashboard backend. Always use this
// instead of calling `fetch('/api/...')` directly so the session token and dynamic
// port are applied consistently.
// The current license JWT, kept in memory so apiFetch can attach it synchronously
// to every request. Set by the license module after load/activation/renewal.
let activeLicenseToken = '';
export const setActiveLicenseToken = (token: string): void => {
  activeLicenseToken = token || '';
};

export const apiFetch = (path: string, init: RequestInit = {}): Promise<Response> => {
  const bridge = getDesktopBridge();
  const url = resolveApiUrl(path);
  const headers = new Headers(init.headers);
  if (activeLicenseToken) headers.set('X-License-Token', activeLicenseToken);
  if (!bridge) return fetch(url, { ...init, headers });

  headers.set('X-Session-Token', bridge.sessionToken);
  return fetch(url, { ...init, headers });
};

// --- License token storage + device id (desktop only) ------------------------
export const getDeviceId = (): string => getDesktopBridge()?.deviceId ?? '';

export const getStoredLicenseToken = async (): Promise<string> => {
  const bridge = getDesktopBridge();
  if (!bridge) return '';
  const result = await bridge.getLicenseToken();
  return result?.token ?? '';
};

export const storeLicenseToken = async (token: string): Promise<void> => {
  const bridge = getDesktopBridge();
  if (!bridge) return;
  await bridge.setLicenseToken(token);
};

export const clearStoredLicenseToken = async (): Promise<void> => {
  const bridge = getDesktopBridge();
  if (!bridge) return;
  await bridge.clearLicenseToken();
};

// Whether the OS-encrypted IBKR credential store is available (Electron only).
export const hasSecureCredentialStore = (): boolean => getDesktopBridge() !== undefined;

// Masked status for display in Settings (never exposes the raw token).
export const getIbkrCredentialStatus = async (): Promise<IbkrCredentialStatus | null> => {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  return bridge.getIbkrCredentials();
};

export const saveIbkrCredentials = async (payload: { token?: string; queryId?: string }): Promise<void> => {
  const bridge = getDesktopBridge();
  if (!bridge) throw new Error('Secure credential storage is only available in the desktop app.');
  await bridge.setIbkrCredentials(payload);
};

export const clearIbkrCredentials = async (): Promise<void> => {
  const bridge = getDesktopBridge();
  if (!bridge) throw new Error('Secure credential storage is only available in the desktop app.');
  await bridge.clearIbkrCredentials();
};

// Decrypts the stored credentials for an actual import request. Returns null in
// browser dev, where the backend falls back to its .env configuration.
export const revealIbkrCredentials = async (): Promise<IbkrCredentials | null> => {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  return bridge.revealIbkrCredentials();
};

// Synchronous durable storage. In the desktop app this is electron-store (in
// userData); in the browser it falls back to localStorage. The synchronous shape
// lets existing persistence code stay unchanged.
export interface SyncStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export const dashboardStorage: SyncStorage = (() => {
  const bridge = getDesktopBridge();
  if (bridge) {
    return {
      getItem: (key) => {
        const value = bridge.storage.get(key);
        return value == null ? null : String(value);
      },
      setItem: (key, value) => {
        bridge.storage.set(key, value);
      },
      removeItem: (key) => {
        bridge.storage.remove(key);
      },
    };
  }
  return {
    getItem: (key) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(key)),
    setItem: (key, value) => {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    },
    removeItem: (key) => {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    },
  };
})();

// Native JSON dataset export/import (desktop only).
export const exportDashboardDataFile = async (): Promise<DataTransferResult | null> => {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  return bridge.exportData();
};

export const importDashboardDataFile = async (): Promise<DataTransferResult | null> => {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  return bridge.importData();
};

// Opens the local data folder (userData) in the OS file manager. Desktop only.
export const revealDataFolder = async (): Promise<DataTransferResult | null> => {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  return bridge.revealDataFolder();
};

// Manually trigger an auto-update check (desktop only). Returns null in the browser.
export const checkForUpdates = async (): Promise<UpdateCheckResult | null> => {
  const bridge = getDesktopBridge();
  if (!bridge || typeof bridge.checkForUpdates !== 'function') return null;
  return bridge.checkForUpdates();
};
