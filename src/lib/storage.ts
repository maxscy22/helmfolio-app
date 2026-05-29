import { SETTINGS_KEY, STORAGE_KEY, type BrowserStorageUsage } from './persistence';

export const bytesForStorageValue = (value: string | null) => value ? new TextEncoder().encode(value).length : 0;

export const formatStorageMb = (bytes: number | null) => bytes === null ? 'N/A' : `${(bytes / 1024 / 1024).toFixed(2)} MB`;

export const measureLocalStorageBytes = () => {
  try {
    let bytes = 0;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      bytes += bytesForStorageValue(key);
      bytes += bytesForStorageValue(localStorage.getItem(key));
    }
    return bytes;
  } catch {
    return 0;
  }
};

export const measureBrowserStorageUsage = async (): Promise<BrowserStorageUsage> => {
  let originUsageBytes: number | null = null;
  let originQuotaBytes: number | null = null;
  try {
    const estimate = await navigator.storage?.estimate?.();
    originUsageBytes = estimate?.usage ?? null;
    originQuotaBytes = estimate?.quota ?? null;
  } catch {
    originUsageBytes = null;
    originQuotaBytes = null;
  }
  return {
    dashboardBytes: bytesForStorageValue(localStorage.getItem(STORAGE_KEY)),
    settingsBytes: bytesForStorageValue(localStorage.getItem(SETTINGS_KEY)),
    localStorageBytes: measureLocalStorageBytes(),
    originUsageBytes,
    originQuotaBytes,
    updatedAt: new Date().toLocaleString(),
  };
};
