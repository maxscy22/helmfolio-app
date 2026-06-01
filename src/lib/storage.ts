import { AAII_MANUAL_KEY, SETTINGS_KEY, STORAGE_KEY, type BrowserStorageUsage } from './persistence';
import { dashboardStorage, hasSecureCredentialStore } from './api';

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
  // Read sizes from the durable store so desktop (electron-store) is measured
  // accurately instead of always reading the empty browser localStorage.
  const dashboardBytes = bytesForStorageValue(dashboardStorage.getItem(STORAGE_KEY));
  const settingsBytes = bytesForStorageValue(dashboardStorage.getItem(SETTINGS_KEY));

  if (hasSecureCredentialStore()) {
    // Desktop: data lives in the electron-store JSON file in userData. There is
    // no browser-origin quota, so report the total of the known dashboard keys.
    const aaiiBytes = bytesForStorageValue(dashboardStorage.getItem(AAII_MANUAL_KEY));
    const totalBytes = dashboardBytes + settingsBytes + aaiiBytes;
    return {
      isDesktop: true,
      dashboardBytes,
      settingsBytes,
      localStorageBytes: totalBytes,
      originUsageBytes: totalBytes,
      originQuotaBytes: null,
      updatedAt: new Date().toLocaleString(),
    };
  }

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
    isDesktop: false,
    dashboardBytes,
    settingsBytes,
    localStorageBytes: measureLocalStorageBytes(),
    originUsageBytes,
    originQuotaBytes,
    updatedAt: new Date().toLocaleString(),
  };
};
