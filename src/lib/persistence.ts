import type { RawCash, RawNav, RawPosition, RawTrade } from '../types';
import { dashboardStorage, hasSecureCredentialStore } from './api';
import {
  normalizedRawStringByAliases,
  normalizedTradeId,
  rawDateByAliases,
  rawDateTimeByAliases,
  rawNumberByAliases,
  rawStringByAliases,
  stableRowSignature,
} from './rawRow';

export const STORAGE_KEY = 'ibkr-dashboard:last-loaded-data';
export const SETTINGS_KEY = 'ibkr-dashboard:display-settings';
export const AAII_MANUAL_KEY = 'ibkr-dashboard:aaii-manual-sentiment';
export const AAII_HISTORY_LIMIT = 4;
// Neutral default for fresh installs / after "Clear data". Must NOT be a real
// personal funding figure — the starting NAV auto-derives from imported NAV data
// (or the user's manual override), so 0 is the correct blank-slate value.
export const DEFAULT_INITIAL_FUNDING = 0;
export const DEFAULT_BENCHMARK_START_DATE = '2025-07-01';
export const restoreStatusSuffixPattern = /(?:\s*Restored from this browser's saved data at .+?\.)+$/;

export const cleanSavedImportStatus = (status: string) => status.replace(restoreStatusSuffixPattern, '').trim();

// One-time migration: when running in the desktop app for the first time after
// the electron-store switch, copy any data left in the renderer's localStorage
// (used by the Phase 1/2 builds) into the durable store so users don't lose it.
(() => {
  if (!hasSecureCredentialStore()) return; // desktop runtime only
  if (typeof localStorage === 'undefined') return;
  try {
    [STORAGE_KEY, SETTINGS_KEY, AAII_MANUAL_KEY].forEach((key) => {
      if (dashboardStorage.getItem(key) == null) {
        const legacy = localStorage.getItem(key);
        if (legacy != null) dashboardStorage.setItem(key, legacy);
      }
    });
  } catch {
    // Migration is best-effort; ignore failures.
  }
})();

export type PersistedDashboardData = {
  rows: RawTrade[];
  positions: RawPosition[];
  navRows?: RawNav[];
  cashRows?: RawCash[];
  dataSource: 'empty' | 'csv' | 'ibkr';
  importStatus: string;
  savedAt: string;
  initialFunding?: number;
  themeId?: string;
  portraitDataUrl?: string;
  displayName?: string;
};

export type PersistedDashboardSettings = {
  themeId: string;
  portraitDataUrl: string;
  displayName: string;
  benchmarkRangeMode: 'all' | 'portfolio' | 'custom';
  benchmarkFromDate: string;
  benchmarkToDate: string;
  startingNavBasis: 'open' | 'close';
  useManualStartingNav: boolean;
  manualStartingNav: number | null;
  // Master analysis start date. '' = auto (earliest imported trade/NAV date).
  portfolioStartDate: string;
};

export type BrowserStorageUsage = {
  isDesktop: boolean;
  dashboardBytes: number;
  settingsBytes: number;
  localStorageBytes: number;
  originUsageBytes: number | null;
  originQuotaBytes: number | null;
  updatedAt: string;
};

export type AaiiSentimentRow = { weekEnding: string; bullish: number; neutral: number; bearish: number };

export const tradeDedupKey = (row: RawTrade) => {
  const tradeId = normalizedTradeId(row);
  if (tradeId) return `trade-id|${tradeId}`;
  return [
    'trade-composite',
    normalizedRawStringByAliases(row, ['Symbol', 'symbol', 'Underlying Symbol', 'UnderlyingSymbol']),
    normalizedRawStringByAliases(row, ['Asset Class', 'AssetCategory', 'assetCategory']),
    rawDateTimeByAliases(row, ['Date/Time', 'DateTime', 'dateTime']) || rawDateByAliases(row, ['Trade Date', 'TradeDate', 'tradeDate', 'Report Date', 'ReportDate']),
    normalizedRawStringByAliases(row, ['Buy/Sell', 'BuySell', 'buySell', 'Transaction Type', 'TransactionType']),
    rawNumberByAliases(row, ['Quantity', 'Qty', 'quantity']),
    rawNumberByAliases(row, ['TradePrice', 'Trade Price', 'tradePrice']),
    rawNumberByAliases(row, ['Trade Money', 'TradeMoney', 'tradeMoney']),
    rawNumberByAliases(row, ['IB Commission', 'IBCommission', 'ibCommission']),
    rawNumberByAliases(row, ['Realized P/L', 'RealizedPL', 'FifoPnlRealized', 'FIFO PnL Realized', 'fifoPnlRealized']),
  ].join('|') || `trade-signature|${stableRowSignature(row)}`;
};

export const navDedupKey = (row: RawNav) => {
  const date = rawDateByAliases(row, ['Report Date', 'ReportDate', 'Date', 'date', 'To Date', 'ToDate']);
  const fromDate = rawDateByAliases(row, ['From Date', 'FromDate']);
  const value = rawNumberByAliases(row, ['Total', 'total', 'EndingValue', 'Ending Value', 'Net Asset Value(NAV) in base', 'Net Asset Value', 'NetAssetValue', 'netAssetValue', 'Total Equity', 'TotalEquity', 'Equity With Loan Value', 'EquityWithLoanValue']);
  const startingValue = rawNumberByAliases(row, ['StartingValue', 'Starting Value']);
  const change = rawNumberByAliases(row, ['Change in NAV', 'ChangeInNAV', 'Change NAV']);
  const depositsWithdrawals = rawNumberByAliases(row, ['DepositsWithdrawals']);
  if (!date && !fromDate && !value && !startingValue && !change && !depositsWithdrawals) return `nav-signature|${stableRowSignature(row)}`;
  return [
    'nav',
    date,
    fromDate,
    rawStringByAliases(row, ['Currency', 'currency']),
    value,
    startingValue,
    change,
    depositsWithdrawals,
  ].join('|');
};

export const cashDedupKey = (row: RawCash) => {
  const transactionId = rawStringByAliases(row, ['TransactionID', 'Transaction ID']);
  if (transactionId) return `cash-transaction|${transactionId}`;
  const date = rawDateByAliases(row, ['Date/Time', 'DateTime', 'ReportDate', 'Report Date']);
  const settleDate = rawDateByAliases(row, ['SettleDate', 'Settle Date']);
  const amount = rawNumberByAliases(row, ['Amount']);
  const type = rawStringByAliases(row, ['Type']);
  if (!date && !settleDate && !type && !amount) return `cash-signature|${stableRowSignature(row)}`;
  return [
    'cash',
    rawStringByAliases(row, ['ClientAccountID', 'Account ID', 'AccountID', 'accountId', 'acctId']),
    date,
    settleDate,
    type,
    amount,
    rawStringByAliases(row, ['Currency', 'currency']),
    rawStringByAliases(row, ['Symbol', 'symbol']),
    rawStringByAliases(row, ['Description', 'description']),
  ].join('|');
};

export const positionDedupKey = (row: RawPosition) => [
  'position',
  rawStringByAliases(row, ['Account ID', 'AccountID', 'ClientAccountID', 'accountId', 'acctId']),
  rawStringByAliases(row, ['Symbol', 'symbol', 'Underlying Symbol', 'UnderlyingSymbol']),
  rawStringByAliases(row, ['Asset Class', 'AssetCategory', 'assetCategory']),
  rawStringByAliases(row, ['Expiry', 'expiry']),
  rawStringByAliases(row, ['Strike', 'strike']),
  rawStringByAliases(row, ['Put/Call', 'PutCall', 'putCall']),
  rawStringByAliases(row, ['Open Date Time', 'OpenDateTime', 'openDateTime', 'Open Date', 'OpenDate']),
  rawStringByAliases(row, ['Side', 'side']),
].join('|');

export const mergeUniqueRows = <T extends RawTrade | RawPosition | RawNav | RawCash>(existingRows: T[], incomingRows: T[], keySelector: (row: T) => string) => {
  const merged = new Map<string, T>();
  existingRows.forEach((row) => merged.set(keySelector(row), row));
  incomingRows.forEach((row) => merged.set(keySelector(row), row));
  return Array.from(merged.values());
};

export const dedupeRows = <T extends RawTrade | RawPosition | RawNav | RawCash>(rows: T[], keySelector: (row: T) => string) =>
  mergeUniqueRows([], rows, keySelector);

export const parseAaiiDateValue = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

export const toAaiiDateInputValue = (value: string) => {
  // If already YYYY-MM-DD, return as-is to avoid UTC timezone shifts.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  // Use local date components to preserve the intended date regardless of timezone.
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const normalizeAaiiManualRows = (rows: AaiiSentimentRow[]) =>
  rows
    .filter((row) => row.weekEnding && Number.isFinite(row.bullish) && Number.isFinite(row.neutral) && Number.isFinite(row.bearish))
    .map((row) => ({
      weekEnding: row.weekEnding,
      bullish: Number(row.bullish.toFixed(1)),
      neutral: Number(row.neutral.toFixed(1)),
      bearish: Number(row.bearish.toFixed(1)),
    }))
    .sort((a, b) => parseAaiiDateValue(b.weekEnding) - parseAaiiDateValue(a.weekEnding));

export const loadAaiiManualRows = (): AaiiSentimentRow[] => {
  try {
    const value = dashboardStorage.getItem(AAII_MANUAL_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? normalizeAaiiManualRows(parsed as AaiiSentimentRow[]).slice(0, AAII_HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
};

export const mergeAaiiSentimentRows = (baseRows: AaiiSentimentRow[], manualRows: AaiiSentimentRow[]) => {
  const merged = new Map<string, AaiiSentimentRow>();
  baseRows.forEach((row) => merged.set(row.weekEnding, row));
  manualRows.forEach((row) => merged.set(row.weekEnding, row));
  return normalizeAaiiManualRows(Array.from(merged.values())).slice(0, AAII_HISTORY_LIMIT);
};

export const loadPersistedDashboardData = (): PersistedDashboardData | null => {
  try {
    const value = dashboardStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) as PersistedDashboardData : null;
  } catch {
    return null;
  }
};

export const defaultDashboardSettings = (): PersistedDashboardSettings => ({
  themeId: 'command',
  portraitDataUrl: '',
  displayName: '',
  benchmarkRangeMode: 'portfolio',
  benchmarkFromDate: '',
  benchmarkToDate: '',
  startingNavBasis: 'open',
  useManualStartingNav: false,
  manualStartingNav: null,
  portfolioStartDate: '',
});

export const loadPersistedDashboardSettings = (): PersistedDashboardSettings => {
  const defaults = defaultDashboardSettings();
  try {
    const value = dashboardStorage.getItem(SETTINGS_KEY);
    const parsed = value ? JSON.parse(value) as Partial<PersistedDashboardSettings> : {};
    return {
      themeId: parsed.themeId || defaults.themeId,
      portraitDataUrl: parsed.portraitDataUrl || defaults.portraitDataUrl,
      displayName: parsed.displayName || defaults.displayName,
      benchmarkRangeMode: parsed.benchmarkRangeMode === 'all' ? 'all' : parsed.benchmarkRangeMode === 'custom' ? 'custom' : 'portfolio',
      benchmarkFromDate: typeof parsed.benchmarkFromDate === 'string' ? parsed.benchmarkFromDate : defaults.benchmarkFromDate,
      benchmarkToDate: typeof parsed.benchmarkToDate === 'string' ? parsed.benchmarkToDate : defaults.benchmarkToDate,
      startingNavBasis: parsed.startingNavBasis === 'close' ? 'close' : 'open',
      useManualStartingNav: parsed.useManualStartingNav === true,
      manualStartingNav: typeof parsed.manualStartingNav === 'number' && Number.isFinite(parsed.manualStartingNav) ? parsed.manualStartingNav : null,
      portfolioStartDate: typeof parsed.portfolioStartDate === 'string' ? parsed.portfolioStartDate : defaults.portfolioStartDate,
    };
  } catch {
    return defaults;
  }
};
