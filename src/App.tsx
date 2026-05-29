import { Component, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ChangeEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Award, BarChart3, LineChart, Settings, ShieldCheck, Target, TrendingDown, TrendingUp, Upload, WalletCards } from 'lucide-react';
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { calculateDashboardStats } from './analytics';
import { DASHBOARD_VERSION } from './appMetadata';
import { parseIbkrCsv } from './csvImport';
import { StatCard } from './components/StatCard';
import { MonthlyPnlCalendar } from './components/MonthlyPnlCalendar';
import { SettingsModal } from './components/SettingsModal';
import { SymbolTable } from './components/SymbolTable';
import {
  cashFlowByCurveDate,
  cashTransactionAmountInBase,
  cashTransactionDate,
  cashTransactionFlowRowsFromRows,
  cashTransactionInsights,
  cashTransactionType,
  cashTransactionWithdrawalDetailRows,
  withholdingTaxRefundDetailRows,
  cumulativeCashTransactionFlow,
  cumulativeNavCashFlow,
  latestNavCashBalance,
  latestNavValue,
  navCashFlowRowsFromRows,
  navEstimateFromPositions,
  navValueForDate,
  numberFromRaw,
  rawDateKey,
  sortedNavCurveFromRows,
  valueByAliases,
} from './lib/cashFlow';
import { money, priceMoney, percent, benchmarkPercent, dateMonthLabel, compactDateLabel, daysBetween } from './lib/formatters';
import {
  AAII_HISTORY_LIMIT,
  AAII_MANUAL_KEY,
  type AaiiSentimentRow,
  type BrowserStorageUsage,
  cashDedupKey,
  cleanSavedImportStatus,
  DEFAULT_BENCHMARK_START_DATE,
  DEFAULT_INITIAL_FUNDING,
  dedupeRows,
  loadAaiiManualRows,
  loadPersistedDashboardData,
  loadPersistedDashboardSettings,
  mergeAaiiSentimentRows,
  mergeUniqueRows,
  navDedupKey,
  normalizeAaiiManualRows,
  parseAaiiDateValue,
  type PersistedDashboardData,
  type PersistedDashboardSettings,
  positionDedupKey,
  SETTINGS_KEY,
  STORAGE_KEY,
  toAaiiDateInputValue,
  tradeDedupKey,
} from './lib/persistence';
import { withoutSamplePreviewRows } from './lib/rawRow';
import { benchmarkReturnsFromStart, calculateRiskMetrics, type BenchmarkPoint } from './lib/risk';
import { tradeDateKey } from './lib/trades';
import { bytesForStorageValue, formatStorageMb, measureBrowserStorageUsage } from './lib/storage';
import { buildSyncDiff, type SyncDiff } from './lib/syncDiff';
import { themePresets } from './lib/themes';
import type { DashboardStats, Position, RawCash, RawNav, RawPosition, RawTrade, SymbolStats, Trade, TradeCycle } from './types';
import changelogText from '../CHANGELOG.md?raw';

type MarketReferenceData = {
  importedAt?: string;
  vix?: {
    data: {
      symbol: string;
      yahooSymbol: string;
      value: number;
      date: string;
      ytdReturnPct: number;
    } | null;
    error: string | null;
  };
  fearGreed?: {
    data: {
      value: number;
      rating: string;
      previousClose: number | null;
      previous1Week: number | null;
      previous1Month: number | null;
      previous1Year: number | null;
      updatedAt: string | null;
    } | null;
    error: string | null;
  };
  aaii?: {
    data: {
      sourceUrl: string;
      fetchedAt: string | null;
      weekEnding: string;
      bullish: number;
      neutral: number;
      bearish: number;
      history: AaiiSentimentRow[];
      historicalAverages: { bullish: number; neutral: number; bearish: number };
      oneYearHighs: { label: string; value: number; weekEnding: string }[];
    } | null;
    error: string | null;
    cached?: boolean;
    cachedAt?: string | null;
  };
  servedFromCache?: boolean;
};


type ProjectBackupFile = {
  path: string;
  contentBase64: string;
  encoding: 'utf8';
};

type ProjectBackupPayload = {
  projectName: string;
  createdAt: string;
  excluded: string[];
  files: ProjectBackupFile[];
};

class DashboardErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8">
          <div className="max-w-2xl rounded-2xl border border-rose-300/20 bg-rose-300/10 p-8">
            <h2 className="text-2xl font-bold text-rose-300">Dashboard Error</h2>
            <p className="mt-4 text-slate-300">Something went wrong while rendering this section. The error has been caught to prevent the entire app from crashing.</p>
            {this.state.error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-rose-200">Error details</summary>
                <pre className="mt-2 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-400">{this.state.error.message}</pre>
              </details>
            )}
            <button
              className="mt-6 rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-300/20"
              type="button"
              onClick={() => window.location.reload()}
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type DirectoryHandleLike = {
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<DirectoryHandleLike>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Uint8Array) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: () => Promise<DirectoryHandleLike>;
};

const base64ToBytes = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const writeProjectBackupFile = async (rootHandle: DirectoryHandleLike, backupFile: ProjectBackupFile) => {
  const parts = backupFile.path.split('/').filter(Boolean);
  let currentHandle = rootHandle;
  for (const directoryName of parts.slice(0, -1)) {
    currentHandle = await currentHandle.getDirectoryHandle(directoryName, { create: true });
  }
  const fileHandle = await currentHandle.getFileHandle(parts[parts.length - 1], { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(base64ToBytes(backupFile.contentBase64));
  await writable.close();
};

const writeTextFileToDirectory = async (rootHandle: DirectoryHandleLike, fileName: string, content: string) => {
  const fileHandle = await rootHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(new TextEncoder().encode(content));
  await writable.close();
};


const shiftMonth = (month: string, delta: number) => {
  const [year, monthIndex] = month.split('-').map(Number);
  const date = new Date(year, monthIndex - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const tradeDateRange = (trades: Trade[]) => {
  const dates = trades.map(tradeDateKey).filter(Boolean).sort((a, b) => a.localeCompare(b));
  return {
    from: dates[0] ?? '',
    to: dates[dates.length - 1] ?? '',
  };
};

const calendarDaysInclusive = (from: string, to: string) => {
  if (!from || !to) return 0;
  const fromTime = new Date(`${from}T00:00:00`).getTime();
  const toTime = new Date(`${to}T00:00:00`).getTime();
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || toTime < fromTime) return 0;
  return Math.floor((toTime - fromTime) / 86400000) + 1;
};

const weekStartKey = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  const day = parsed.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  parsed.setDate(parsed.getDate() + diff);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
};


const holdingsOnDate = (trades: Trade[], date: string) => Array.from(trades
  .filter((trade) => tradeDateKey(trade) <= date && trade.assetClass.toUpperCase() !== 'CASH')
  .sort((a, b) => tradeDateKey(a).localeCompare(tradeDateKey(b)))
  .reduce((bySymbol, trade) => {
    const current = bySymbol.get(trade.symbol) ?? { symbol: trade.symbol, assetClass: trade.assetClass, quantity: 0, lastPrice: 0 };
    current.quantity += trade.quantity;
    current.lastPrice = trade.price || trade.closePrice || current.lastPrice;
    current.assetClass = trade.assetClass || current.assetClass;
    bySymbol.set(trade.symbol, current);
    return bySymbol;
  }, new Map<string, { symbol: string; assetClass: string; quantity: number; lastPrice: number }>())
  .values())
  .filter((holding) => Math.abs(holding.quantity) > 0.000001)
  .map((holding) => ({
    ...holding,
    estimatedValue: holding.quantity * holding.lastPrice,
  }))
  .sort((a, b) => Math.abs(b.estimatedValue) - Math.abs(a.estimatedValue));


const sectionSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function Section({ title, subtitle, children, id }: { title: string; subtitle: string; children: ReactNode; id?: string }) {
  const anchorId = id ?? sectionSlug(title);
  return (
    <section id={anchorId} className="scroll-mt-24 rounded-3xl border border-white/10 bg-[var(--dashboard-section)] p-6 shadow-2xl shadow-black/20">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

const stickyNavLinks: { label: string; href: string }[] = [
  { label: 'Markets', href: '#market-reference' },
  { label: 'Snapshot', href: '#portfolio-snapshot' },
  { label: 'Open Book', href: '#open-positions-insight' },
  { label: 'Equity', href: '#equity-curve-p-l-trend' },
  { label: 'Benchmark', href: '#period-benchmark-comparison' },
  { label: 'Risk', href: '#risk-metrics' },
  { label: 'Symbols', href: '#symbol-leaderboard' },
  { label: 'Calendar', href: '#monthly-p-l-calendar' },
  { label: 'Asset Class', href: '#asset-class-realized-p-l-contribution' },
  { label: 'Cycles', href: '#cost-execution-review' },
  { label: 'Cash', href: '#cash-income-cost-leakage' },
  { label: 'Import', href: '#data-import' },
];

function DashboardStickyNav() {
  return (
    <nav className="sticky top-0 z-30 -mx-4 mb-2 border-b border-white/10 bg-[var(--dashboard-panel)]/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto flex max-w-[96rem] gap-2 overflow-x-auto pb-1 text-sm">
        {stickyNavLinks.map((link) => (
          <a key={link.href} href={link.href} className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-semibold text-slate-200 transition hover:bg-white/[0.12] hover:text-white">{link.label}</a>
        ))}
      </div>
    </nav>
  );
}


function TradeTable({ trades }: { trades: Trade[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-slate-300">
          <tr>
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Side</th>
            <th className="px-4 py-3">Qty</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3 text-right">Realized P/L</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10 text-slate-200">
          {trades.map((trade, index) => (
            <tr key={`${trade.tradeId}-${index}`} className="hover:bg-white/[0.03]">
              <td className="px-4 py-3 font-medium text-white">{trade.symbol}</td>
              <td className="px-4 py-3">{trade.tradeDate || trade.date || '-'}</td>
              <td className="px-4 py-3">{trade.buySell || trade.transactionType || '-'}</td>
              <td className="px-4 py-3">{trade.quantity}</td>
              <td className="px-4 py-3">{trade.price}</td>
              <td className={`px-4 py-3 text-right font-semibold ${trade.realizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(trade.realizedPnl)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TradeCycleTable({ rows }: { rows: TradeCycle[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-slate-300">
          <tr>
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3">Period</th>
            <th className="px-4 py-3">Orders</th>
            <th className="px-4 py-3">Fills</th>
            <th className="px-4 py-3 text-right">Total IN</th>
            <th className="px-4 py-3 text-right">Total OUT</th>
            <th className="px-4 py-3">Result</th>
            <th className="px-4 py-3 text-right">Cycle P/L</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10 text-slate-200">
          {rows.map((row, index) => (
            <tr key={`${row.symbol}-${row.start}-${row.end}-${index}`} className="hover:bg-white/[0.03]">
              <td className="px-4 py-3 font-medium text-white">{row.symbol}</td>
              <td className="px-4 py-3">{row.start || '-'} – {row.end || '-'}</td>
              <td className="px-4 py-3">{row.orders}</td>
              <td className="px-4 py-3">{row.executions}</td>
              <td className="px-4 py-3 text-right">{money(row.totalIn)}</td>
              <td className="px-4 py-3 text-right">{money(row.totalOut)}</td>
              <td className={`px-4 py-3 font-semibold ${row.result === 'WIN' ? 'text-emerald-300' : row.result === 'LOSS' ? 'text-rose-300' : 'text-slate-300'}`}>{row.result}</td>
              <td className={`px-4 py-3 text-right font-semibold ${row.realizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(row.realizedPnl)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


export default function App() {
  const persistedData = useMemo(loadPersistedDashboardData, []);
  const persistedSettings = useMemo(loadPersistedDashboardSettings, []);
  const [rows, setRows] = useState<RawTrade[]>(() => dedupeRows(withoutSamplePreviewRows(persistedData?.rows ?? []), tradeDedupKey));
  const [positions, setPositions] = useState<RawPosition[]>(() => dedupeRows(persistedData?.positions ?? [], positionDedupKey));
  const [navRows, setNavRows] = useState<RawNav[]>(() => dedupeRows(persistedData?.navRows ?? [], navDedupKey));
  const [cashRows, setCashRows] = useState<RawCash[]>(() => dedupeRows(persistedData?.cashRows ?? [], cashDedupKey));
  const [dataSource, setDataSource] = useState<'empty' | 'csv' | 'ibkr'>(() => persistedData?.dataSource === 'csv' || persistedData?.dataSource === 'ibkr' ? persistedData.dataSource : 'empty');
  const [benchmarks, setBenchmarks] = useState<{ nasdaq: BenchmarkPoint[]; sp500: BenchmarkPoint[] }>({ nasdaq: [], sp500: [] });
  const [benchmarkStatus, setBenchmarkStatus] = useState('Loading Yahoo Finance benchmarks...');
  const [marketReference, setMarketReference] = useState<MarketReferenceData | null>(null);
  const [marketReferenceStatus, setMarketReferenceStatus] = useState('Loading market reference data...');
  const [startingNav, setStartingNav] = useState(() => persistedData?.initialFunding ?? DEFAULT_INITIAL_FUNDING);
  const [initialFunding, setInitialFunding] = useState(() => persistedData?.initialFunding ?? DEFAULT_INITIAL_FUNDING);
  const [benchmarkRangeMode, setBenchmarkRangeMode] = useState<'all' | 'custom'>('custom');
  const [benchmarkFromDate, setBenchmarkFromDate] = useState(DEFAULT_BENCHMARK_START_DATE);
  const [benchmarkToDate, setBenchmarkToDate] = useState('');
  const [showAllWinningSymbols, setShowAllWinningSymbols] = useState(false);
  const [showAllLosingSymbols, setShowAllLosingSymbols] = useState(false);
  const [showAllLeaderboard, setShowAllLeaderboard] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [importStatus, setImportStatus] = useState(() => persistedData ? `${cleanSavedImportStatus(persistedData.importStatus)} Restored from this browser's saved data at ${new Date(persistedData.savedAt).toLocaleString()}.` : '');
  const [syncDiff, setSyncDiff] = useState<SyncDiff | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [importProgressMessage, setImportProgressMessage] = useState('');
  const [isCsvImporting, setIsCsvImporting] = useState(false);
  const [themeId, setThemeId] = useState<string>(() => persistedSettings.themeId ?? 'command');
  const [portraitDataUrl, setPortraitDataUrl] = useState<string>(() => persistedSettings.portraitDataUrl ?? '');
  const [displayName, setDisplayName] = useState<string>(() => persistedSettings.displayName ?? '');
  const [showSettings, setShowSettings] = useState(false);
  const [backupStatus, setBackupStatus] = useState('');
  const [isBackingUpProject, setIsBackingUpProject] = useState(false);
  const [storageUsage, setStorageUsage] = useState<BrowserStorageUsage | null>(null);
  const [aaiiManualRows, setAaiiManualRows] = useState<AaiiSentimentRow[]>(loadAaiiManualRows);
  const [showAaiiEditor, setShowAaiiEditor] = useState(false);
  const [aaiiDraftWeekEnding, setAaiiDraftWeekEnding] = useState('');
  const [aaiiDraftBullish, setAaiiDraftBullish] = useState('');
  const [aaiiDraftNeutral, setAaiiDraftNeutral] = useState('');
  const [aaiiDraftBearish, setAaiiDraftBearish] = useState('');
  const refreshStorageUsage = () => {
    measureBrowserStorageUsage().then(setStorageUsage).catch(() => setStorageUsage(null));
  };
  const stats: DashboardStats = useMemo(() => {
    const calculated = calculateDashboardStats(rows, positions);
    return {
      ...calculated,
      benchmark: [
        { name: 'Your portfolio', returnPct: 0 },
        { name: 'NASDAQ', returnPct: benchmarks.nasdaq[benchmarks.nasdaq.length - 1]?.returnPct ?? 0 },
        { name: 'S&P 500', returnPct: benchmarks.sp500[benchmarks.sp500.length - 1]?.returnPct ?? 0 },
      ],
    };
  }, [rows, positions, benchmarks]);
  const navCurve = useMemo(() => sortedNavCurveFromRows(navRows), [navRows]);
  const hasActualNavCurve = navCurve.length >= 2;

  const allBenchmarkStartDate = (hasActualNavCurve ? navCurve[0]?.date : stats.portfolioCurve[0]?.date) ?? '';
  const navCurveLastDate = navCurve[navCurve.length - 1]?.date ?? '';
  const portfolioCurveLastDate = stats.portfolioCurve[stats.portfolioCurve.length - 1]?.date ?? '';
  const allBenchmarkEndDate = [navCurveLastDate, portfolioCurveLastDate].filter(Boolean).sort().pop() ?? '';
  const effectiveBenchmarkStartDate = benchmarkRangeMode === 'custom' && benchmarkFromDate ? benchmarkFromDate : allBenchmarkStartDate;
  const effectiveBenchmarkEndDate = benchmarkRangeMode === 'custom' && benchmarkToDate ? benchmarkToDate : allBenchmarkEndDate;
  const downloadedStartingNav = effectiveBenchmarkStartDate ? navValueForDate(navRows, effectiveBenchmarkStartDate) : null;
  const benchmarkStartingNav = downloadedStartingNav ?? startingNav;
  const riskStartingNav = benchmarkStartingNav ?? startingNav;

  useEffect(() => {
    if (dataSource === 'empty') return;
    const dedupedRows = dedupeRows(withoutSamplePreviewRows(rows), tradeDedupKey);
    const dedupedPositions = dedupeRows(positions, positionDedupKey);
    const dedupedNavRows = dedupeRows(navRows, navDedupKey);
    const dedupedCashRows = dedupeRows(cashRows, cashDedupKey);
    if (dedupedRows.length !== rows.length) setRows(dedupedRows);
    if (dedupedPositions.length !== positions.length) setPositions(dedupedPositions);
    if (dedupedNavRows.length !== navRows.length) setNavRows(dedupedNavRows);
    if (dedupedCashRows.length !== cashRows.length) setCashRows(dedupedCashRows);
  }, [rows, positions, navRows, cashRows, dataSource]);

  useEffect(() => {
    if (dataSource === 'empty') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        rows,
        positions,
        navRows,
        cashRows,
        dataSource,
        importStatus: cleanSavedImportStatus(importStatus),
        initialFunding,
        themeId,
        portraitDataUrl,
        displayName,
        savedAt: new Date().toISOString(),
      }));
    } catch {
      setImportStatus((status) => status.includes('Browser storage is full') ? status : `${status} Browser storage is full, so this dataset could not be saved for next time.`);
    }
  }, [rows, positions, navRows, cashRows, dataSource, initialFunding, themeId, portraitDataUrl, displayName]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ themeId, portraitDataUrl, displayName }));
  }, [themeId, portraitDataUrl, displayName]);

  useEffect(() => {
    localStorage.setItem(AAII_MANUAL_KEY, JSON.stringify(aaiiManualRows));
  }, [aaiiManualRows]);

  useEffect(() => {
    if (!showSettings) return;
    refreshStorageUsage();
  }, [showSettings, rows, positions, navRows, cashRows, themeId, portraitDataUrl, displayName]);

  useEffect(() => {
    if (!isImporting) return;
    const startedAt = Date.now();
    const updateEstimatedProgress = () => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      if (elapsedSeconds < 3) {
        setImportProgress(8);
        setImportProgressMessage('Sending one IBKR Flex generation request...');
        return;
      }
      if (elapsedSeconds < 20) {
        setImportProgress(Math.min(35, 12 + Math.round((elapsedSeconds / 20) * 23)));
        setImportProgressMessage(`IBKR accepted the request. Waiting before download polling (${Math.max(0, 20 - elapsedSeconds)}s)...`);
        return;
      }
      const pollingSeconds = elapsedSeconds - 20;
      setImportProgress(Math.min(92, 35 + Math.round((pollingSeconds / 280) * 57)));
      setImportProgressMessage(`Polling IBKR for the generated statement... ${elapsedSeconds}s elapsed`);
    };
    updateEstimatedProgress();
    const interval = window.setInterval(updateEstimatedProgress, 1000);
    return () => window.clearInterval(interval);
  }, [isImporting]);

  useEffect(() => {
    const loadBenchmarks = async () => {
      try {
        const params = new URLSearchParams();
        if (effectiveBenchmarkStartDate) params.set('start', effectiveBenchmarkStartDate);
        if (effectiveBenchmarkEndDate) params.set('end', effectiveBenchmarkEndDate);
        const response = await fetch(`/api/benchmarks/ytd?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Failed to load Yahoo Finance benchmarks.');
        setBenchmarks(payload.benchmarks);
        setBenchmarkStatus(`Yahoo Finance benchmarks loaded for ${payload.startDate ?? 'YTD start'} to ${payload.endDate ?? 'today'}.`);
      } catch (error) {
        setBenchmarkStatus(error instanceof Error ? error.message : 'Failed to load Yahoo Finance benchmarks.');
      }
    };
    loadBenchmarks();
  }, [effectiveBenchmarkStartDate, effectiveBenchmarkEndDate]);

  useEffect(() => {
    const loadMarketReference = async () => {
      try {
        const response = await fetch('/api/reference/market?refresh=1');
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Failed to load market reference data.');
        setMarketReference(payload);
        const loaded = [
          payload.vix?.data ? 'VIX' : null,
          payload.fearGreed?.data ? 'CNN Fear & Greed' : null,
          payload.aaii?.data ? 'AAII Sentiment' : null,
        ].filter(Boolean).join(', ');
        setMarketReferenceStatus(loaded ? `${loaded} loaded at ${new Date(payload.importedAt).toLocaleString()}.` : 'Market reference data is temporarily unavailable.');
      } catch (error) {
        setMarketReferenceStatus(error instanceof Error ? error.message : 'Failed to load market reference data.');
      }
    };
    loadMarketReference();
  }, []);

  const handleFile = async (file: File) => {
    setIsCsvImporting(true);
    setImportStatus('Parsing CSV file...');
    try {
      const result = await parseIbkrCsv(file);
      setImportStatus('Merging data with existing dashboard...');
      
      // Basic validation
      const warnings: string[] = [];
      if (result.rows.length === 0) {
        warnings.push('No trade rows found in CSV.');
      }
      if (result.navRows.length === 0) {
        warnings.push('No NAV rows found in CSV.');
      }
      
      const existingRows = dataSource === 'empty' ? [] : dedupeRows(withoutSamplePreviewRows(rows), tradeDedupKey);
      const existingNavRows = dataSource === 'empty' ? [] : dedupeRows(navRows, navDedupKey);
      const existingCashRows = dataSource === 'empty' ? [] : dedupeRows(cashRows, cashDedupKey);
      const mergedRows = mergeUniqueRows(existingRows, result.rows, tradeDedupKey);
      const mergedNavRows = mergeUniqueRows(existingNavRows, result.navRows, navDedupKey);
      const mergedCashRows = mergeUniqueRows(existingCashRows, result.cashRows ?? [], cashDedupKey);
      const duplicateTrades = result.rows.length - Math.max(0, mergedRows.length - existingRows.length);
      const duplicateNavRows = result.navRows.length - Math.max(0, mergedNavRows.length - existingNavRows.length);
      const duplicateCashRows = (result.cashRows ?? []).length - Math.max(0, mergedCashRows.length - existingCashRows.length);
      const mergedPositions = result.positions.length ? mergeUniqueRows([], result.positions, positionDedupKey) : dataSource === 'empty' ? [] : positions;
      setRows(mergedRows);
      setPositions(mergedPositions);
      setNavRows(mergedNavRows);
      setCashRows(mergedCashRows);
      setDataSource('csv');
      
      let statusMessage = `${dataSource === 'empty' ? 'Clean dashboard data was initialized. ' : ''}Merged ${Math.max(0, mergedRows.length - existingRows.length)} new trades from ${result.rows.length} CSV trades (${Math.max(0, duplicateTrades)} duplicates skipped), ${Math.max(0, mergedNavRows.length - existingNavRows.length)} new NAV rows from ${result.navRows.length} CSV NAV rows (${Math.max(0, duplicateNavRows)} duplicates skipped), and ${Math.max(0, mergedCashRows.length - existingCashRows.length)} new cash transactions from ${(result.cashRows ?? []).length} CSV cash rows (${Math.max(0, duplicateCashRows)} duplicates skipped). Long-term saved history now has ${mergedRows.length} unique trades, ${mergedNavRows.length} NAV rows, and ${mergedCashRows.length} cash transactions. ${result.positions.length ? `Open positions snapshot replaced with ${mergedPositions.length} current positions.` : dataSource === 'empty' ? 'No open positions in this CSV.' : 'No open positions in this CSV, so the previous snapshot was kept.'}`;
      
      if (warnings.length > 0) {
        statusMessage += ` ${warnings.join(' ')}`;
      }
      
      setImportStatus(statusMessage);
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : 'CSV import failed.');
    } finally {
      setIsCsvImporting(false);
    }
  };

  const importDashboardBackup = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as {
        rows?: RawTrade[];
        rawTrades?: RawTrade[];
        trades?: RawTrade[];
        positions?: RawPosition[];
        rawPositions?: RawPosition[];
        navRows?: RawNav[];
        cashRows?: RawCash[];
        initialFunding?: number;
        themeId?: string;
        portraitDataUrl?: string;
        displayName?: string;
        exportedAt?: string;
      };
      const incomingRows = withoutSamplePreviewRows(parsed.rows ?? parsed.rawTrades ?? parsed.trades ?? []);
      if (!Array.isArray(incomingRows) || incomingRows.length === 0) {
        throw new Error('This JSON backup does not contain trade rows to restore.');
      }
      const incomingPositions = Array.isArray(parsed.rawPositions) ? parsed.rawPositions : Array.isArray(parsed.positions) ? parsed.positions : [];
      const incomingNavRows = Array.isArray(parsed.navRows) ? parsed.navRows : [];
      const incomingCashRows = Array.isArray(parsed.cashRows) ? parsed.cashRows : [];
      const existingRows = dataSource === 'empty' ? [] : dedupeRows(withoutSamplePreviewRows(rows), tradeDedupKey);
      const existingNavRows = dataSource === 'empty' ? [] : dedupeRows(navRows, navDedupKey);
      const existingCashRows = dataSource === 'empty' ? [] : dedupeRows(cashRows, cashDedupKey);
      const mergedRows = mergeUniqueRows(existingRows, incomingRows, tradeDedupKey);
      const mergedNavRows = mergeUniqueRows(existingNavRows, incomingNavRows, navDedupKey);
      const mergedCashRows = mergeUniqueRows(existingCashRows, incomingCashRows, cashDedupKey);
      const mergedPositions = incomingPositions.length ? mergeUniqueRows([], incomingPositions, positionDedupKey) : dataSource === 'empty' ? [] : positions;
      const restoredFunding = Number(parsed.initialFunding);
      setRows(mergedRows);
      setPositions(mergedPositions);
      setNavRows(mergedNavRows);
      setCashRows(mergedCashRows);
      setDataSource('csv');
      if (Number.isFinite(restoredFunding) && restoredFunding > 0) {
        setInitialFunding(restoredFunding);
        setStartingNav(restoredFunding);
      }
      if (parsed.themeId && themePresets.some((theme) => theme.id === parsed.themeId)) setThemeId(parsed.themeId);
      if (typeof parsed.portraitDataUrl === 'string') setPortraitDataUrl(parsed.portraitDataUrl);
      if (typeof parsed.displayName === 'string') setDisplayName(parsed.displayName);
      setImportStatus(`Imported JSON backup${parsed.exportedAt ? ` from ${new Date(parsed.exportedAt).toLocaleString()}` : ''}. ${dataSource === 'empty' ? 'Clean dashboard data was initialized. ' : ''}Merged ${Math.max(0, mergedRows.length - existingRows.length)} trade rows, ${Math.max(0, mergedNavRows.length - existingNavRows.length)} NAV rows, and ${Math.max(0, mergedCashRows.length - existingCashRows.length)} cash transactions. Saved history now has ${mergedRows.length} unique trades, ${mergedPositions.length} open positions, ${mergedNavRows.length} NAV rows, and ${mergedCashRows.length} cash transactions.`);
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : 'JSON backup import failed.');
    }
  };

  const buildDashboardBackupPayload = () => ({
      exportedAt: new Date().toISOString(),
      dataSource,
      importStatus,
      initialFunding,
      themeId,
      portraitDataUrl,
      displayName,
      storageMode: 'cumulative-deduplicated-history',
      rows,
      rawTrades: rows,
      rawPositions: positions,
      cashRows,
      trades: stats.trades,
      positions: stats.positions,
      navRows,
      summary: {
        totalTrades: stats.totalTrades,
        totalOrders: stats.totalOrders,
        totalExecutions: stats.totalExecutions,
        uniqueRawTrades: rows.length,
        currentOpenPositions: positions.length,
        savedNavRows: navRows.length,
        savedCashRows: cashRows.length,
        totalRealizedPnl: stats.totalRealizedPnl,
        totalUnrealizedPnl: stats.totalUnrealizedPnl,
        totalCommissions: stats.totalCommissions,
        winRate: stats.winRate,
        profitLossRatio: stats.profitLossRatio,
        profitFactor: stats.profitFactor,
        expectancy: stats.expectancy,
      },
    });

  const exportDashboardData = () => {
    const payload = buildDashboardBackupPayload();
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ibkr-dashboard-cleaned-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportDashboardPdf = () => {
    const reportWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!reportWindow) {
      setImportStatus('Popup blocked. Please allow popups for this local dashboard to export PDF.');
      return;
    }
    const topSymbols = [...stats.bySymbol].sort((a, b) => Math.abs(b.realizedPnl) - Math.abs(a.realizedPnl)).slice(0, 10);
    const topWinningSymbols = stats.bySymbol.filter((row) => row.realizedPnl > 0).sort((a, b) => b.realizedPnl - a.realizedPnl).slice(0, 10);
    const topLosingSymbols = stats.bySymbol.filter((row) => row.realizedPnl < 0).sort((a, b) => a.realizedPnl - b.realizedPnl).slice(0, 10);
    const openPositions = stats.positions.slice(0, 10);
    const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
    const themeStyle = activeTheme.style as Record<string, string>;
    const accent = themeStyle['--dashboard-accent'] || '#22d3ee';
    const panel = themeStyle['--dashboard-panel'] || 'rgba(2, 6, 23, 0.86)';
    const card = themeStyle['--dashboard-card'] || 'rgba(255,255,255,0.08)';
    const section = themeStyle['--dashboard-section'] || 'rgba(2,6,23,0.72)';
    const reportKpis = [
      ['Total Realized P/L', money(stats.totalRealizedPnl), stats.totalRealizedPnl >= 0],
      ['Unrealized P/L', stats.positionsCount ? money(stats.totalUnrealizedPnl) : 'N/A', stats.totalUnrealizedPnl >= 0],
      ['Trade Total P/L', money(stats.totalRealizedPnl + stats.totalUnrealizedPnl), stats.totalRealizedPnl + stats.totalUnrealizedPnl >= 0],
      ['Cycle Win Rate', percent(stats.winRate), true],
      ['Cycle Payoff Ratio', `${stats.profitLossRatio.toFixed(2)}x`, stats.profitLossRatio >= 1],
      ['Cycle Profit Factor', `${stats.profitFactor.toFixed(2)}x`, stats.profitFactor >= 1],
      ['Orders', `${stats.totalOrders}`, true],
      ['Fills', `${stats.totalExecutions}`, true],
      ['Open Positions', `${stats.positionsCount}`, true],
      ['Commissions', money(stats.totalCommissions), stats.totalCommissions >= 0],
    ];
    reportWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>IBKR Dashboard Report</title>
          <style>
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { size: A4; margin: 12mm; }
            body {
              margin: 0;
              min-height: 100vh;
              background: ${themeStyle['--dashboard-bg'] || 'linear-gradient(135deg,#020617,#0f172a,#020617)'};
              color: #f8fafc;
              font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            .page { padding: 28px; }
            .toolbar { position: sticky; top: 0; z-index: 2; margin-bottom: 18px; display: flex; justify-content: flex-end; }
            button { border: 0; border-radius: 14px; background: ${accent}; color: #020617; padding: 12px 18px; font-weight: 800; cursor: pointer; }
            .hero { display: grid; grid-template-columns: 1fr 132px; gap: 24px; align-items: center; border: 1px solid rgba(255,255,255,0.12); border-radius: 28px; background: ${panel}; padding: 28px; box-shadow: 0 24px 70px rgba(0,0,0,0.35); }
            .badge { display: inline-flex; border: 1px solid color-mix(in srgb, ${accent} 45%, transparent); border-radius: 999px; background: color-mix(in srgb, ${accent} 16%, transparent); color: ${accent}; padding: 7px 12px; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
            h1 { margin: 16px 0 0; font-size: 40px; line-height: 1.05; letter-spacing: -0.04em; }
            .owner { margin-top: 12px; display: inline-flex; border: 1px solid rgba(255,255,255,0.12); border-radius: 999px; background: rgba(255,255,255,0.07); padding: 8px 12px; color: #e0f2fe; font-weight: 700; }
            .meta { margin-top: 14px; color: #cbd5e1; line-height: 1.6; font-size: 13px; }
            .portrait { width: 132px; height: 132px; border-radius: 26px; border: 1px solid rgba(255,255,255,0.12); background: ${card}; padding: 8px; overflow: hidden; }
            .portrait img { width: 100%; height: 100%; border-radius: 20px; object-fit: cover; }
            .portrait-empty { width: 100%; height: 100%; border-radius: 20px; border: 1px dashed rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; color: #94a3b8; text-align: center; font-size: 11px; }
            .section { margin-top: 20px; border: 1px solid rgba(255,255,255,0.12); border-radius: 24px; background: ${section}; padding: 20px; page-break-inside: avoid; }
            h2 { margin: 0 0 14px; font-size: 20px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
            .kpi { border: 1px solid rgba(255,255,255,0.12); border-radius: 18px; padding: 16px; background: ${card}; min-height: 92px; }
            .label { color: #cbd5e1; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
            .value { font-size: 25px; font-weight: 900; margin-top: 9px; letter-spacing: -0.03em; }
            .positive { color: #86efac; }
            .negative { color: #fda4af; }
            .benchmark { border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 18px; background: linear-gradient(135deg, color-mix(in srgb, ${accent} 20%, transparent), rgba(255,255,255,0.05)); }
            .benchmark .value { font-size: 34px; color: ${accent}; }
            table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 16px; font-size: 11px; }
            th, td { border-bottom: 1px solid rgba(255,255,255,0.10); padding: 9px; text-align: left; }
            th { background: rgba(255,255,255,0.10); color: #e2e8f0; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; }
            td { color: #e5e7eb; }
            .right { text-align: right; }
            .note { color: #cbd5e1; font-size: 12px; line-height: 1.7; }
            @media print {
              .toolbar { display: none; }
              .page { padding: 0; }
              .section, .hero { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="toolbar"><button onclick="window.print()">Save / Print PDF</button></div>
            <div class="hero">
              <div>
                <div class="badge">IBKR Trading Dashboard Report</div>
                <h1>Trading Performance Command Center</h1>
                ${displayName ? `<div class="owner">Prepared for ${escapeHtml(displayName)}</div>` : ''}
                <div class="meta">Exported ${new Date().toLocaleString()} · Source: ${escapeHtml(dataSource)} · Theme: ${escapeHtml(activeTheme.name)}<br />Review period: ${escapeHtml(reviewPeriodLabel)} · ${stats.totalOrders} orders · ${stats.totalExecutions} fills · ${stats.positionsCount} open positions</div>
              </div>
              <div class="portrait">${portraitDataUrl ? `<img src="${portraitDataUrl}" alt="Dashboard portrait" />` : '<div class="portrait-empty">Portrait<br />not set</div>'}</div>
            </div>

            <div class="section">
              <h2>Core KPI Summary</h2>
              <div class="grid">
                ${reportKpis.map(([label, value, positive]) => `<div class="kpi"><div class="label">${escapeHtml(label)}</div><div class="value ${positive ? 'positive' : 'negative'}">${escapeHtml(value)}</div></div>`).join('')}
              </div>
            </div>

            <div class="section">
              <h2>Investment-Period Benchmark Snapshot</h2>
              <div class="grid">
                ${benchmarkSummaryCards.map((row) => `<div class="benchmark"><div class="label">${escapeHtml(row.label)}</div><div class="value">${row.value === undefined ? 'N/A' : benchmarkPercent(row.value)}</div><div class="note">Period return since ${escapeHtml(effectiveBenchmarkStartDate || DEFAULT_BENCHMARK_START_DATE)}</div></div>`).join('')}
              </div>
            </div>

            <div class="section">
              <h2>Period Benchmark Comparison</h2>
              <p class="note">Selected period: ${escapeHtml(effectiveBenchmarkStartDate || '-')} to ${escapeHtml(effectiveBenchmarkEndDate || '-')}. Portfolio return is rebased to the selected period.</p>
              <table>
                <thead><tr><th>Benchmark</th><th class="right">Period Return</th></tr></thead>
                <tbody>
                  <tr><td>Portfolio</td><td class="right">${latestBenchmarkPoint?.portfolio === undefined ? 'N/A' : benchmarkPercent(latestBenchmarkPoint.portfolio)}</td></tr>
                  <tr><td>NASDAQ</td><td class="right">${latestBenchmarkPoint?.nasdaq === undefined ? 'N/A' : benchmarkPercent(latestBenchmarkPoint.nasdaq)}</td></tr>
                  <tr><td>S&P 500</td><td class="right">${latestBenchmarkPoint?.sp500 === undefined ? 'N/A' : benchmarkPercent(latestBenchmarkPoint.sp500)}</td></tr>
                </tbody>
              </table>
            </div>

            <div class="section">
              <h2>Reference Market Data</h2>
              <div class="grid">
                <div class="kpi"><div class="label">VIX Index</div><div class="value">${vixData ? vixData.value.toFixed(2) : 'N/A'}</div><div class="note">${vixData ? `${escapeHtml(vixData.date)} · YTD ${vixData.ytdReturnPct.toFixed(2)}%` : 'Unavailable'}</div></div>
                <div class="kpi"><div class="label">CNN Fear & Greed</div><div class="value">${fearGreedData ? fearGreedData.value.toFixed(1) : 'N/A'}</div><div class="note">${fearGreedData ? escapeHtml(fearGreedData.rating) : 'Unavailable'}</div></div>
                <div class="kpi"><div class="label">Net Deposits / Withdrawals</div><div class="value">${cashFlowValue === null ? 'N/A' : money(cashFlowValue)}</div><div class="note">${escapeHtml(cashFlowSource)}</div></div>
              </div>
            </div>

            <div class="section">
              <h2>Top Symbols</h2>
              <table>
                <thead><tr><th>Symbol</th><th class="right">Orders</th><th class="right">Fills</th><th class="right">Realized P/L</th><th class="right">Commission</th><th class="right">Cycle Win Rate</th></tr></thead>
                <tbody>${topSymbols.map((row) => `<tr><td>${escapeHtml(row.symbol)}</td><td class="right">${row.orders}</td><td class="right">${row.executions}</td><td class="right">${money(row.realizedPnl)}</td><td class="right">${money(row.commissions)}</td><td class="right">${percent(row.winRate)}</td></tr>`).join('')}</tbody>
              </table>
            </div>

            <div class="section">
              <h2>Top Winners</h2>
              <table>
                <thead><tr><th>Symbol</th><th class="right">Orders</th><th class="right">Fills</th><th class="right">Realized P/L</th><th class="right">Commission</th><th class="right">Cycle Win Rate</th></tr></thead>
                <tbody>${topWinningSymbols.length ? topWinningSymbols.map((row) => `<tr><td>${escapeHtml(row.symbol)}</td><td class="right">${row.orders}</td><td class="right">${row.executions}</td><td class="right positive">${money(row.realizedPnl)}</td><td class="right">${money(row.commissions)}</td><td class="right">${percent(row.winRate)}</td></tr>`).join('') : '<tr><td colspan="6">No winning symbols loaded.</td></tr>'}</tbody>
              </table>
            </div>

            <div class="section">
              <h2>Top Losses</h2>
              <table>
                <thead><tr><th>Symbol</th><th class="right">Orders</th><th class="right">Fills</th><th class="right">Realized P/L</th><th class="right">Commission</th><th class="right">Cycle Win Rate</th></tr></thead>
                <tbody>${topLosingSymbols.length ? topLosingSymbols.map((row) => `<tr><td>${escapeHtml(row.symbol)}</td><td class="right">${row.orders}</td><td class="right">${row.executions}</td><td class="right negative">${money(row.realizedPnl)}</td><td class="right">${money(row.commissions)}</td><td class="right">${percent(row.winRate)}</td></tr>`).join('') : '<tr><td colspan="6">No losing symbols loaded.</td></tr>'}</tbody>
              </table>
            </div>

            <div class="section">
              <h2>Open Positions</h2>
              <table>
                <thead><tr><th>Symbol</th><th>Side</th><th class="right">Qty</th><th class="right">Value</th><th class="right">Cost</th><th class="right">Unrealized P/L</th><th class="right">% NAV</th></tr></thead>
                <tbody>${openPositions.map((position) => `<tr><td>${escapeHtml(position.symbol)}</td><td>${escapeHtml(position.side || '-')}</td><td class="right">${position.quantity}</td><td class="right">${money(position.value)}</td><td class="right">${money(position.costBasis)}</td><td class="right">${money(position.unrealizedPnl)}</td><td class="right">${position.percentOfNav ? `${position.percentOfNav.toFixed(2)}%` : '-'}</td></tr>`).join('')}</tbody>
              </table>
            </div>
          </div>
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
    setTimeout(() => reportWindow.print(), 300);
  };

  const backupProjectFolder = async () => {
    const directoryPicker = (window as WindowWithDirectoryPicker).showDirectoryPicker;
    if (!directoryPicker) {
      setBackupStatus('Your browser does not support direct folder backup. Please use Chrome or Edge on localhost, or manually copy the project folder to your backup location.');
      return;
    }
    setIsBackingUpProject(true);
    setBackupStatus('Preparing project backup from local backend...');
    try {
      const response = await fetch('/api/project/backup');
      const responseText = await response.text();
      if (responseText.trim().startsWith('<')) {
        throw new Error('Project backup API is not available yet. Please close and reopen Open Dashboard.bat so the local backend loads the new backup endpoint.');
      }
      const payload = JSON.parse(responseText) as ProjectBackupPayload | { error?: string };
      if (!response.ok || !('files' in payload)) {
        throw new Error('error' in payload ? payload.error ?? 'Project backup failed.' : 'Project backup failed.');
      }
      const selectedDirectory = await directoryPicker();
      const timestamp = payload.createdAt.replace(/[:.]/g, '-');
      const backupDirectoryName = `${payload.projectName} v${DASHBOARD_VERSION} Backup ${timestamp}`;
      const backupDirectory = await selectedDirectory.getDirectoryHandle(backupDirectoryName, { create: true });
      for (const backupFile of payload.files) {
        await writeProjectBackupFile(backupDirectory, backupFile);
      }
      const dashboardJsonFileName = `ibkr-dashboard-data-v${DASHBOARD_VERSION}-${timestamp}.json`;
      await writeTextFileToDirectory(selectedDirectory, dashboardJsonFileName, JSON.stringify(buildDashboardBackupPayload(), null, 2));
      setBackupStatus(`Project backup completed: ${payload.files.length} files copied into "${backupDirectoryName}". Dashboard JSON saved separately as "${dashboardJsonFileName}" in the selected target folder. Excluded generated folders: ${payload.excluded.join(', ')}.`);
    } catch (error) {
      setBackupStatus(error instanceof Error ? error.message : 'Project backup failed.');
    } finally {
      setIsBackingUpProject(false);
    }
  };

  const importFromIbkr = async () => {
    setIsImporting(true);
    setImportProgress(5);
    setImportProgressMessage('Starting secure backend sync...');
    setImportStatus('Requesting IBKR Flex statement from secure backend...');
    try {
      const response = await fetch('/api/ibkr/flex/trades', { method: 'POST' });
      const responseText = await response.text();
      const payload = responseText ? JSON.parse(responseText) : null;
      if (!response.ok) {
        throw new Error(payload?.error ?? `IBKR import failed with HTTP ${response.status}.`);
      }
      if (!payload?.trades) {
        throw new Error('IBKR import returned no trade data.');
      }
      const incomingTrades = payload.trades as RawTrade[];
      const incomingPositions = (payload.positions ?? []) as RawPosition[];
      const incomingNavRows = (payload.navRows ?? []) as RawNav[];
      const incomingCashRows = (payload.cashRows ?? []) as RawCash[];
      const existingRows = dataSource === 'empty' ? [] : dedupeRows(withoutSamplePreviewRows(rows), tradeDedupKey);
      const existingNavRows = dataSource === 'empty' ? [] : dedupeRows(navRows, navDedupKey);
      const existingCashRows = dataSource === 'empty' ? [] : dedupeRows(cashRows, cashDedupKey);
      const mergedRows = mergeUniqueRows(existingRows, incomingTrades, tradeDedupKey);
      const mergedNavRows = mergeUniqueRows(existingNavRows, incomingNavRows, navDedupKey);
      const mergedCashRows = mergeUniqueRows(existingCashRows, incomingCashRows, cashDedupKey);
      const duplicateTrades = incomingTrades.length - Math.max(0, mergedRows.length - existingRows.length);
      const duplicateNavRows = incomingNavRows.length - Math.max(0, mergedNavRows.length - existingNavRows.length);
      const duplicateCashRows = incomingCashRows.length - Math.max(0, mergedCashRows.length - existingCashRows.length);
      const mergedPositions = incomingPositions.length ? mergeUniqueRows([], incomingPositions, positionDedupKey) : dataSource === 'empty' ? [] : positions;
      const existingCashKeys = new Set(existingCashRows.map(cashDedupKey));
      const newCashEntries = mergedCashRows.filter((row) => !existingCashKeys.has(cashDedupKey(row)));
      const navFromValue = sortedNavCurveFromRows(existingNavRows).slice(-1)[0]?.value ?? null;
      const navToValue = sortedNavCurveFromRows(mergedNavRows).slice(-1)[0]?.value ?? null;
      setRows(mergedRows);
      setPositions(mergedPositions);
      setNavRows(mergedNavRows);
      setCashRows(mergedCashRows);
      setDataSource('ibkr');
      setSyncDiff(buildSyncDiff(
        Math.max(0, mergedRows.length - existingRows.length),
        Math.max(0, mergedNavRows.length - existingNavRows.length),
        Math.max(0, mergedCashRows.length - existingCashRows.length),
        newCashEntries,
        navFromValue,
        navToValue,
      ));
      setImportProgress(100);
      setImportProgressMessage('Complete. Trades, NAV, cash transactions, and open positions refreshed.');
      setImportStatus(`${dataSource === 'empty' ? 'Clean dashboard data was initialized. ' : ''}Merged ${Math.max(0, mergedRows.length - existingRows.length)} new trades from IBKR (${Math.max(0, duplicateTrades)} duplicates skipped). Saved history now has ${mergedRows.length} unique trades. Merged ${Math.max(0, mergedNavRows.length - existingNavRows.length)} new NAV rows (${Math.max(0, duplicateNavRows)} duplicates skipped). Merged ${Math.max(0, mergedCashRows.length - existingCashRows.length)} new cash transactions from IBKR (${Math.max(0, duplicateCashRows)} duplicates skipped). Saved cash history now has ${mergedCashRows.length} cash transactions. ${incomingPositions.length ? `Open positions snapshot replaced with ${mergedPositions.length} current positions.` : dataSource === 'empty' ? 'No open positions returned.' : 'No open positions returned, so the previous snapshot was kept.'} Imported at ${new Date(payload.importedAt).toLocaleString()}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'IBKR import failed.';
      setImportProgress(null);
      setImportProgressMessage('');
      setImportStatus(message.includes('Statement could not be generated') ? `${message} This response comes from IBKR before data download starts. Check that the Flex Query ID is enabled, uses a small date range, includes Trades/Open Positions, and that the token is active. No real IBKR data was imported; the dashboard is still showing the previous data source.` : message);
    } finally {
      setIsImporting(false);
    }
  };

  const largestWinningCycle = stats.winners[0] ?? null;
  const largestLosingCycle = stats.losers[0] ?? null;
  const splitTradeDateTime = (value: string) => {
    const raw = String(value || '').trim();
    if (!raw) return { date: '', time: '' };
    const [datePart, timePart = ''] = raw.split(';');
    const date = /^\d{8}$/.test(datePart) ? `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}` : datePart.slice(0, 10);
    const time = /^\d{6}$/.test(timePart) ? `${timePart.slice(0, 2)}:${timePart.slice(2, 4)}` : timePart.slice(0, 5);
    return { date, time };
  };
  const formatTradeDateTime = (value: string) => {
    const { date, time } = splitTradeDateTime(value);
    if (!date) return '-';
    return time ? `${date} ${time}` : date;
  };
  const tradeCycleDetail = (cycle: TradeCycle | null) => {
    if (!cycle) return <p>No cycle available.</p>;
    const startDateOnly = splitTradeDateTime(cycle.start).date;
    const endDateOnly = splitTradeDateTime(cycle.end).date;
    const holdingDays = calendarDaysInclusive(startDateOnly, endDateOnly);
    const grossPct = cycle.totalIn ? cycle.realizedPnl / cycle.totalIn : 0;
    return (
      <div>
        <p>Trade cycles measure a position from first opening trade until net quantity returns to zero. Bond/cash-yield symbols (SGOV, IB01) and zero-PnL cycles are excluded from the largest-winner/largest-loser ranking for fairness.</p>
        <p className="mt-2 font-semibold text-white">Cycle detail</p>
        <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-xs">
            <tbody className="divide-y divide-white/10">
              <tr><td className="px-2 py-2 text-slate-400">Symbol</td><td className="px-2 py-2 font-semibold text-white">{cycle.symbol}</td></tr>
              <tr><td className="px-2 py-2 text-slate-400">Opened</td><td className="px-2 py-2 text-white">{formatTradeDateTime(cycle.start)}</td></tr>
              <tr><td className="px-2 py-2 text-slate-400">Closed</td><td className="px-2 py-2 text-white">{formatTradeDateTime(cycle.end)}</td></tr>
              <tr><td className="px-2 py-2 text-slate-400">Holding</td><td className="px-2 py-2 text-white">{holdingDays} days</td></tr>
              <tr><td className="px-2 py-2 text-slate-400">Trades / Orders / Fills</td><td className="px-2 py-2 text-white">{cycle.trades} / {cycle.orders} / {cycle.executions}</td></tr>
              <tr><td className="px-2 py-2 text-slate-400">Shares (buy / sell)</td><td className="px-2 py-2 text-white">{cycle.buyQuantity.toLocaleString()} / {cycle.sellQuantity.toLocaleString()}</td></tr>
              <tr><td className="px-2 py-2 text-slate-400">Avg Buy / Sell Price</td><td className="px-2 py-2 text-white">{money(cycle.averageBuyPrice)} / {money(cycle.averageSellPrice)}</td></tr>
              <tr><td className="px-2 py-2 text-slate-400">Total In / Out</td><td className="px-2 py-2 text-white">{money(cycle.totalIn)} / {money(cycle.totalOut)}</td></tr>
              <tr><td className="px-2 py-2 text-slate-400">Commissions</td><td className={`px-2 py-2 font-semibold ${cycle.commissions >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(cycle.commissions)}</td></tr>
              <tr><td className="px-2 py-2 text-slate-400">Realized P/L</td><td className={`px-2 py-2 font-bold ${cycle.realizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(cycle.realizedPnl)} ({percent(grossPct)} of capital deployed)</td></tr>
              <tr><td className="px-2 py-2 text-slate-400">Result</td><td className="px-2 py-2 font-semibold text-white">{cycle.result}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  const bondCashYieldStats = useMemo(() => stats.bySymbol.filter((row) => ['SGOV', 'IB01'].includes(row.symbol.toUpperCase())), [stats.bySymbol]);
  const bondCashYieldRealizedPnl = useMemo(() => bondCashYieldStats.reduce((total, row) => total + row.realizedPnl, 0), [bondCashYieldStats]);
  const bondCashYieldCommissions = useMemo(() => bondCashYieldStats.reduce((total, row) => total + row.commissions, 0), [bondCashYieldStats]);
  const bondCashYieldProfitCommissionRatio = bondCashYieldStats.length && bondCashYieldCommissions !== 0 ? bondCashYieldRealizedPnl / Math.abs(bondCashYieldCommissions) : 0;
  const bondCashYieldSymbolsLabel = bondCashYieldStats.map((row) => row.symbol).join(', ') ?? 'SGOV / IB01';
  const bondCashYieldDetailRows = useMemo(() => ['SGOV', 'IB01'].map((symbol) => stats.bySymbol.find((row) => row.symbol.toUpperCase() === symbol) ?? {
    symbol,
    realizedPnl: 0,
    commissions: 0,
    trades: 0,
  }), [stats.bySymbol]);
  const positionSummary = useMemo(() => stats.positions.map((position) => `${position.symbol}: ${money(position.unrealizedPnl)}`).join(' · '), [stats.positions]);
  const totalPositionValue = useMemo(() => stats.positions.reduce((total, position) => total + Math.abs(position.value), 0), [stats.positions]);
  const winningOpenPositions = useMemo(() => stats.positions.filter((position) => position.unrealizedPnl > 0), [stats.positions]);
  const losingOpenPositions = useMemo(() => stats.positions.filter((position) => position.unrealizedPnl < 0), [stats.positions]);
  const largestOpenGain = useMemo(() => [...stats.positions].sort((a, b) => b.unrealizedPnl - a.unrealizedPnl)[0] ?? null, [stats.positions]);
  const largestOpenLoss = useMemo(() => [...stats.positions].sort((a, b) => a.unrealizedPnl - b.unrealizedPnl)[0] ?? null, [stats.positions]);
  const largestPosition = useMemo(() => [...stats.positions].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0] ?? null, [stats.positions]);
  const totalCombinedPnl = stats.totalRealizedPnl + stats.totalUnrealizedPnl;
  const openPositionCostBasis = useMemo(() => stats.positions.reduce((total, position) => total + Math.abs(position.costBasis), 0), [stats.positions]);
  const openPositionReturn = openPositionCostBasis ? stats.totalUnrealizedPnl / openPositionCostBasis : 0;
  const unrealizedPnlShare = totalCombinedPnl ? stats.totalUnrealizedPnl / totalCombinedPnl : 0;
  const totalTradeVolume = useMemo(() => stats.bySymbol.reduce((total, row) => total + row.totalIn + row.totalOut, 0), [stats.bySymbol]);
  const commissionDragPct = totalTradeVolume ? Math.abs(stats.totalCommissions) / totalTradeVolume : 0;
  const commissionToPnlPct = stats.totalRealizedPnl ? Math.abs(stats.totalCommissions) / Math.abs(stats.totalRealizedPnl) : 0;
  const commissionMonthlyRows = useMemo(() => {
    const sorted = [...stats.byMonth].sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12).sort((a, b) => a.month.localeCompare(b.month));
    const totalAbs = sorted.reduce((total, row) => total + Math.abs(row.commissions), 0);
    return sorted.map((row) => ({
      month: row.month,
      label: dateMonthLabel(`${row.month}-01`),
      commissions: row.commissions,
      trades: row.trades,
      sharePct: totalAbs ? Math.abs(row.commissions) / totalAbs : 0,
    }));
  }, [stats.byMonth]);
  const commission12MonthTotal = useMemo(() => commissionMonthlyRows.reduce((total, row) => total + row.commissions, 0), [commissionMonthlyRows]);
  const totalAssetClassContribution = useMemo(() => stats.byAssetClass.reduce((total, row) => total + Math.abs(row.value), 0), [stats.byAssetClass]);
  const assetClassContributionRows = useMemo(() => stats.byAssetClass.map((row, index) => ({
    ...row,
    color: ['#22d3ee', '#a78bfa', '#34d399', '#fb7185', '#fbbf24'][index % 5],
    percent: totalAssetClassContribution ? Math.abs(row.value) / totalAssetClassContribution : 0,
  })), [stats.byAssetClass, totalAssetClassContribution]);
  const winningSymbolRows = useMemo(() => stats.bySymbol.filter((row) => row.result === 'WIN'), [stats.bySymbol]);
  const losingSymbolRows = useMemo(() => stats.bySymbol.filter((row) => row.result === 'LOSS').sort((a, b) => a.realizedPnl - b.realizedPnl), [stats.bySymbol]);
  const leaderboardRows = useMemo(() => [...stats.bySymbol].sort((a, b) => Math.abs(b.realizedPnl) - Math.abs(a.realizedPnl)), [stats.bySymbol]);
  const selectedPortfolioCurve = useMemo(() => stats.portfolioCurve.filter((point) => (!effectiveBenchmarkStartDate || point.date >= effectiveBenchmarkStartDate) && (!effectiveBenchmarkEndDate || point.date <= effectiveBenchmarkEndDate)), [stats.portfolioCurve, effectiveBenchmarkStartDate, effectiveBenchmarkEndDate]);
  const selectedNavCurve = useMemo(() => navCurve.filter((point) => (!effectiveBenchmarkStartDate || point.date >= effectiveBenchmarkStartDate) && (!effectiveBenchmarkEndDate || point.date <= effectiveBenchmarkEndDate)), [navCurve, effectiveBenchmarkStartDate, effectiveBenchmarkEndDate]);
  const basePortfolioPnl = useMemo(() => [...stats.portfolioCurve].reverse().find((point) => effectiveBenchmarkStartDate && point.date < effectiveBenchmarkStartDate)?.portfolio ?? 0, [stats.portfolioCurve, effectiveBenchmarkStartDate]);
  const benchmarkDates = useMemo(() => hasActualNavCurve ? selectedNavCurve.map((point) => point.date) : selectedPortfolioCurve.map((point) => point.date), [hasActualNavCurve, selectedNavCurve, selectedPortfolioCurve]);
  const navBenchmarkBase = useMemo(() => effectiveBenchmarkStartDate ? navValueForDate(navRows, effectiveBenchmarkStartDate) : navCurve[0]?.value ?? null, [effectiveBenchmarkStartDate, navRows, navCurve]);
  const cashTransactionFlowRows = useMemo(() => cashTransactionFlowRowsFromRows(cashRows), [cashRows]);
  const navCashFlowRows = useMemo(() => cashTransactionFlowRows.length ? cashTransactionFlowRows : navCashFlowRowsFromRows(navRows), [cashTransactionFlowRows, navRows]);
  const curveCashFlowByDate = useMemo(() => cashFlowByCurveDate(navCashFlowRows, navCurve.map((point) => point.date)), [navCashFlowRows, navCurve]);
  const benchmarkCashFlowByDate = useMemo(() => cashFlowByCurveDate(
    navCashFlowRows.filter((row) => (!effectiveBenchmarkStartDate || row.date >= effectiveBenchmarkStartDate) && (!effectiveBenchmarkEndDate || row.date <= effectiveBenchmarkEndDate)),
    selectedNavCurve.map((point) => point.date),
  ), [navCashFlowRows, effectiveBenchmarkStartDate, effectiveBenchmarkEndDate, selectedNavCurve]);
  const nasdaqByDate = useMemo(() => benchmarkReturnsFromStart(benchmarkDates, benchmarks.nasdaq, effectiveBenchmarkStartDate), [benchmarkDates, benchmarks.nasdaq, effectiveBenchmarkStartDate]);
  const sp500ByDate = useMemo(() => benchmarkReturnsFromStart(benchmarkDates, benchmarks.sp500, effectiveBenchmarkStartDate), [benchmarkDates, benchmarks.sp500, effectiveBenchmarkStartDate]);
  const ytdBenchmarkData = useMemo(() => {
    let cumulativeBenchmarkCashFlow = 0;
    return hasActualNavCurve ? selectedNavCurve.map((point) => {
      cumulativeBenchmarkCashFlow += benchmarkCashFlowByDate.get(point.date) ?? 0;
      return {
        date: point.date,
        portfolio: navBenchmarkBase ? Number((((point.value - navBenchmarkBase - cumulativeBenchmarkCashFlow) / navBenchmarkBase) * 100).toFixed(2)) : 0,
        nasdaq: nasdaqByDate.get(point.date),
        sp500: sp500ByDate.get(point.date),
      };
    }) : selectedPortfolioCurve.map((point) => ({
      date: point.date,
      portfolio: benchmarkStartingNav ? Number((((point.portfolio - basePortfolioPnl) / benchmarkStartingNav) * 100).toFixed(2)) : 0,
      nasdaq: nasdaqByDate.get(point.date),
      sp500: sp500ByDate.get(point.date),
    }));
  }, [hasActualNavCurve, selectedNavCurve, navBenchmarkBase, benchmarkCashFlowByDate, nasdaqByDate, sp500ByDate, selectedPortfolioCurve, benchmarkStartingNav, basePortfolioPnl]);
  const benchmarkMonthTicks = useMemo(() => ytdBenchmarkData.reduce<string[]>((ticks, point) => {
    const monthKey = point.date.slice(0, 7);
    const previousTick = ticks[ticks.length - 1];
    if (!previousTick || previousTick.slice(0, 7) !== monthKey) ticks.push(point.date);
    return ticks;
  }, []), [ytdBenchmarkData]);
  const equityCurveData = useMemo(() => {
    const curveStartDate = effectiveBenchmarkStartDate || DEFAULT_BENCHMARK_START_DATE;
    const rawCurve = hasActualNavCurve ? navCurve.map((point) => ({
      date: point.date,
      equity: Number(point.value.toFixed(2)),
      realizedPnl: point.change,
      cashFlow: curveCashFlowByDate.get(point.date) ?? 0,
    })) : stats.portfolioCurve.map((point) => ({
      date: point.date,
      equity: Number((riskStartingNav + point.portfolio).toFixed(2)),
      realizedPnl: point.portfolio,
      cashFlow: 0,
    }));
    return rawCurve.filter((point) => point.date >= curveStartDate);
  }, [hasActualNavCurve, navCurve, curveCashFlowByDate, stats.portfolioCurve, riskStartingNav, effectiveBenchmarkStartDate]);
  const riskStartDate = useMemo(() => effectiveBenchmarkStartDate && effectiveBenchmarkStartDate > DEFAULT_BENCHMARK_START_DATE ? effectiveBenchmarkStartDate : DEFAULT_BENCHMARK_START_DATE, [effectiveBenchmarkStartDate]);
  const riskEquityCurveData = useMemo(() => equityCurveData.filter((point) => (!riskStartDate || point.date >= riskStartDate) && (!effectiveBenchmarkEndDate || point.date <= effectiveBenchmarkEndDate)), [equityCurveData, riskStartDate, effectiveBenchmarkEndDate]);
  const equityMonthTicks = useMemo(() => equityCurveData.reduce<string[]>((ticks, point) => {
    const monthKey = point.date.slice(0, 7);
    const previousTick = ticks[ticks.length - 1];
    if (!previousTick || previousTick.slice(0, 7) !== monthKey) ticks.push(point.date);
    return ticks;
  }, []), [equityCurveData]);
  const trendPnlLabel = hasActualNavCurve ? 'Change in NAV' : 'Realized P/L';
  const monthlyPnlChartData = useMemo(() => hasActualNavCurve ? Array.from(navCurve.reduce((monthlyMap, row) => {
    const key = row.date.slice(0, 7);
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + row.change);
    return monthlyMap;
  }, new Map<string, number>()).entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, realizedPnl]) => ({
    month,
    label: dateMonthLabel(`${month}-01`),
    realizedPnl,
  })) : [...stats.byMonth].sort((a, b) => a.month.localeCompare(b.month)).map((row) => ({
    month: row.month,
    label: dateMonthLabel(`${row.month}-01`),
    realizedPnl: row.realizedPnl,
  })), [hasActualNavCurve, navCurve, stats.byMonth]);
  const weeklyTrendSource = useMemo(() => hasActualNavCurve ? navCurve.map((row) => ({ date: row.date, value: row.change })) : stats.byDay.map((row) => ({ date: row.date, value: row.realizedPnl })), [hasActualNavCurve, navCurve, stats.byDay]);
  const weeklyPnlChartData = useMemo(() => Array.from(weeklyTrendSource.reduce((weeklyMap, row) => {
    const key = weekStartKey(row.date);
    weeklyMap.set(key, (weeklyMap.get(key) ?? 0) + row.value);
    return weeklyMap;
  }, new Map<string, number>()).entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([week, realizedPnl]) => ({ week, label: `Wk ${week.slice(5)}`, realizedPnl })), [weeklyTrendSource]);
  const latestBenchmarkPoint = useMemo(() => [...ytdBenchmarkData].reverse().find((point) => point.portfolio !== undefined || point.nasdaq !== undefined || point.sp500 !== undefined), [ytdBenchmarkData]);
  const benchmarkSummaryCards = [
    { label: 'Portfolio', value: latestBenchmarkPoint?.portfolio, color: 'text-cyan-200', border: 'border-cyan-300/25', background: 'bg-cyan-300/10' },
    { label: 'NASDAQ', value: latestBenchmarkPoint?.nasdaq, color: 'text-violet-200', border: 'border-violet-300/25', background: 'bg-violet-300/10' },
    { label: 'S&P 500', value: latestBenchmarkPoint?.sp500, color: 'text-emerald-200', border: 'border-emerald-300/25', background: 'bg-emerald-300/10' },
  ];
  const riskMetrics = calculateRiskMetrics(riskEquityCurveData);
  const riskPeriodLabel = riskEquityCurveData.length ? `${riskEquityCurveData[0].date} – ${riskEquityCurveData[riskEquityCurveData.length - 1].date}` : 'No risk period data';
  const maxDrawdownHoldings = riskMetrics.maxDrawdownTroughDate ? holdingsOnDate(stats.trades, riskMetrics.maxDrawdownTroughDate).slice(0, 10) : [];
  const rawMaxDrawdownValue = riskMetrics.maxDrawdownPeakRawEquity && riskMetrics.maxDrawdownTroughRawEquity ? (riskMetrics.maxDrawdownPeakRawEquity - riskMetrics.maxDrawdownTroughRawEquity) / riskMetrics.maxDrawdownPeakRawEquity : 0;
  const vixData = marketReference?.vix?.data;
  const fearGreedData = marketReference?.fearGreed?.data;
  const baseAaiiData = marketReference?.aaii?.data;
  const aaiiSentimentRows = useMemo(() => mergeAaiiSentimentRows(baseAaiiData?.history ?? [], aaiiManualRows), [baseAaiiData?.history, aaiiManualRows]);
  const aaiiLatestManualOverride = aaiiManualRows.some((row) => row.weekEnding === aaiiSentimentRows[0]?.weekEnding);
  const aaiiData = baseAaiiData && aaiiSentimentRows.length ? { ...baseAaiiData, ...aaiiSentimentRows[0], history: aaiiSentimentRows } : baseAaiiData;
  const aaiiLatestTotal = aaiiData ? aaiiData.bullish + aaiiData.neutral + aaiiData.bearish : 0;
  const aaiiBullishWidth = aaiiData && aaiiLatestTotal ? (aaiiData.bullish / aaiiLatestTotal) * 100 : 0;
  const aaiiNeutralWidth = aaiiData && aaiiLatestTotal ? (aaiiData.neutral / aaiiLatestTotal) * 100 : 0;
  const aaiiBearishWidth = aaiiData && aaiiLatestTotal ? (aaiiData.bearish / aaiiLatestTotal) * 100 : 0;
  const vixMoodClassName = !vixData ? 'text-slate-400' : vixData.value < 16 ? 'text-emerald-300' : vixData.value <= 24 ? 'text-amber-300' : 'text-rose-300';
  const fearGreedMoodClassName = !fearGreedData ? 'text-slate-400' : fearGreedData.value < 25 ? 'text-rose-400' : fearGreedData.value < 45 ? 'text-orange-300' : fearGreedData.value <= 55 ? 'text-amber-300' : fearGreedData.value <= 75 ? 'text-lime-300' : 'text-emerald-300';
  const databaseDateRange = tradeDateRange(stats.trades);
  const latestCashDate = useMemo(() => cashRows.map((row) => cashTransactionDate(row)).filter(Boolean).sort().pop() ?? '', [cashRows]);
  const latestDatabaseEndDate = [databaseDateRange.to, navCurveLastDate, latestCashDate].filter(Boolean).sort().pop() ?? '';
  const displayedDatabaseFrom = databaseDateRange.from && databaseDateRange.from < DEFAULT_BENCHMARK_START_DATE ? DEFAULT_BENCHMARK_START_DATE : databaseDateRange.from;
  const databaseDays = calendarDaysInclusive(displayedDatabaseFrom, latestDatabaseEndDate);
  const databaseRangeLabel = displayedDatabaseFrom && latestDatabaseEndDate ? `${displayedDatabaseFrom} – ${latestDatabaseEndDate}` : 'No trade dates loaded';
  const reviewPeriodLabel = databaseDays ? `${databaseRangeLabel} · ${databaseDays.toLocaleString()} days` : databaseRangeLabel;
  const latestDownloadedNav = latestNavValue(navRows);
  const curveStartDate = effectiveBenchmarkStartDate || DEFAULT_BENCHMARK_START_DATE;
  const firstDownloadedNav = navCurve.find((point) => point.date >= curveStartDate) ?? null;
  const navReturnPct = firstDownloadedNav && latestDownloadedNav ? latestDownloadedNav.value / firstDownloadedNav.value - 1 : null;
  const downloadedCashFlow = cumulativeCashTransactionFlow(cashRows) ?? cumulativeNavCashFlow(navRows);
  const estimatedNavFromPositions = navEstimateFromPositions(stats.positions);
  const currentAccountValue = latestDownloadedNav?.value ?? estimatedNavFromPositions;
  const currentAccountValueSource = latestDownloadedNav ? `Downloaded NAV row ${latestDownloadedNav.date}` : estimatedNavFromPositions ? 'Estimated from open positions % NAV' : 'No NAV estimate available';
  const signedOpenPositionValue = stats.positions.reduce((total, position) => total + position.value, 0);
  const estimatedResidualValue = currentAccountValue !== null && currentAccountValue !== undefined ? currentAccountValue - signedOpenPositionValue : null;
  const navCashBalance = useMemo(() => latestNavCashBalance(navRows), [navRows]);
  const cashBalanceValue = navCashBalance?.value ?? estimatedResidualValue;
  const cashBalanceSource = navCashBalance ? `IBKR NAV cash field · ${navCashBalance.date}` : estimatedResidualValue !== null ? 'Estimated as NAV − open positions value' : 'No cash balance available';
  const openPortfolioRows: Position[] = [
    ...stats.positions,
  ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const openPortfolioTotalValue = currentAccountValue ?? totalPositionValue;
  const cashFlowValue = downloadedCashFlow?.value ?? null;
  const cashFlowSource = downloadedCashFlow ? `${downloadedCashFlow.rows.length} dated Cash Transactions withdrawal rows through ${downloadedCashFlow.date}` : 'No IBKR Cash Transactions withdrawal rows available';
  const cashFlowDetailRows = useMemo(() => cashTransactionWithdrawalDetailRows(cashRows), [cashRows]);
  const withholdingRefundRows = useMemo(() => withholdingTaxRefundDetailRows(cashRows, 12), [cashRows]);
  const riskCashFlowNote = downloadedCashFlow ? `Cash-flow adjusted using ${downloadedCashFlow.rows.length} dated withdrawal rows from Cash Transactions.` : 'No dated cash-flow rows are available for cash-flow-adjusted risk metrics.';
  const cashInsights = cashTransactionInsights(cashRows);
  const feeDragToNavPct = currentAccountValue ? Math.abs(cashInsights.totalCashDrag) / currentAccountValue : 0;
  const feeDragToRealizedPnlPct = stats.totalRealizedPnl ? Math.abs(cashInsights.totalCashDrag) / Math.abs(stats.totalRealizedPnl) : 0;
  const activeTheme = themePresets.find((theme) => theme.id === themeId) ?? themePresets[0];
  const resetAaiiDraft = () => {
    setAaiiDraftWeekEnding('');
    setAaiiDraftBullish('');
    setAaiiDraftNeutral('');
    setAaiiDraftBearish('');
  };
  const editAaiiRow = (row: AaiiSentimentRow) => {
    setAaiiDraftWeekEnding(toAaiiDateInputValue(row.weekEnding));
    setAaiiDraftBullish(String(row.bullish));
    setAaiiDraftNeutral(String(row.neutral));
    setAaiiDraftBearish(String(row.bearish));
    setShowAaiiEditor(true);
  };
  const saveAaiiManualRow = () => {
    const bullish = Number(aaiiDraftBullish);
    const neutral = Number(aaiiDraftNeutral);
    const bearish = Number(aaiiDraftBearish);
    if (!aaiiDraftWeekEnding || !Number.isFinite(bullish) || !Number.isFinite(neutral) || !Number.isFinite(bearish)) {
      window.alert('Please enter a date plus valid bullish, neutral, and bearish percentages.');
      return;
    }
    setAaiiManualRows((currentRows) => normalizeAaiiManualRows([
      ...currentRows.filter((row) => row.weekEnding !== aaiiDraftWeekEnding),
      { weekEnding: aaiiDraftWeekEnding, bullish, neutral, bearish },
    ]).slice(0, AAII_HISTORY_LIMIT));
    resetAaiiDraft();
    setShowAaiiEditor(false);
  };
  const removeAaiiManualRow = (weekEnding: string) => {
    if (!window.confirm(`Remove the manual AAII row for ${weekEnding}?`)) return;
    setAaiiManualRows((currentRows) => currentRows.filter((row) => row.weekEnding !== weekEnding));
  };
  const clearDashboardData = () => {
    if (!window.confirm('Clear all imported dashboard data from this browser? Theme, portrait, and display name will be kept.')) return;
    localStorage.removeItem(STORAGE_KEY);
    setRows([]);
    setPositions([]);
    setNavRows([]);
    setCashRows([]);
    setDataSource('empty');
    setStartingNav(DEFAULT_INITIAL_FUNDING);
    setInitialFunding(DEFAULT_INITIAL_FUNDING);
    setImportStatus('Dashboard data cleared. Import a CSV, JSON backup, or IBKR Flex data to start again.');
    setBackupStatus('');
    setShowSettings(false);
  };

  return (
    <DashboardErrorBoundary>
      <main className={`min-h-screen px-4 py-6 sm:px-6 lg:px-8 ${activeTheme.className}`} style={{ ...activeTheme.style, background: 'var(--dashboard-bg)' }}>
      <div className="mx-auto max-w-[96rem] space-y-8">
        <SettingsModal
          open={showSettings}
          themeId={themeId}
          portraitDataUrl={portraitDataUrl}
          displayName={displayName}
          dashboardVersion={DASHBOARD_VERSION}
          changelog={changelogText}
          backupStatus={backupStatus}
          isBackingUpProject={isBackingUpProject}
          storageUsage={storageUsage}
          onRefreshStorageUsage={refreshStorageUsage}
          onBackupProject={backupProjectFolder}
          onClearData={clearDashboardData}
          onCancel={() => setShowSettings(false)}
          onSave={(settings) => {
            setThemeId(settings.themeId);
            setPortraitDataUrl(settings.portraitDataUrl);
            setDisplayName(settings.displayName);
            setShowSettings(false);
          }}
        />
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--dashboard-panel)] shadow-2xl shadow-black/30 backdrop-blur">
          <div className="grid gap-0 lg:grid-cols-[1fr_25rem]">
            <div className="p-7 sm:p-9">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-sm font-medium text-cyan-200">
                <ShieldCheck size={16} /> IBKR 365-day trade review
                </div>
                <button className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.1]" type="button" onClick={() => setShowSettings(true)}>
                  <Settings size={17} />
                  Settings
                </button>
              </div>
              <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white md:text-6xl">Trading Performance Command Center</h1>
                  {displayName && <p className="mt-4 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">Welcome back, {displayName}</p>}
                  <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">A structured IBKR review dashboard for realized P/L, payoff ratio, profit factor, winners and losers, symbol concentration, monthly consistency, costs, and benchmark comparison.</p>
                </div>
                <div className="h-36 w-36 shrink-0 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-2 shadow-2xl shadow-black/30">
                  {portraitDataUrl ? <img className="h-full w-full rounded-[1.5rem] object-cover" src={portraitDataUrl} alt="Dashboard portrait" /> : <div className="flex h-full w-full items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 text-center text-xs leading-5 text-slate-500">Add portrait in Settings</div>}
                </div>
              </div>
              <div className="mt-7 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-slate-500">Data source</p>
                  <p className="mt-1 font-semibold text-white">{dataSource === 'empty' ? 'No data loaded' : dataSource === 'ibkr' ? 'IBKR Flex sync' : 'CSV upload'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-slate-500">Review period</p>
                  <p className="mt-1 font-semibold text-white">{reviewPeriodLabel}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-slate-500">Rows loaded</p>
                  <p className="mt-1 font-semibold text-white">{rows.length} trades</p>
                </div>
              </div>
              {dataSource === 'empty' && (
                <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100">
                  No trade data is loaded yet. Sync IBKR Flex, upload CSV, or import a JSON backup to begin.
                </div>
              )}
              <div id="market-reference" className="mt-5 scroll-mt-24 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Market reference data</p>
                    <p className="mt-1 text-sm text-slate-400">{marketReferenceStatus}</p>
                  </div>
                  <p className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs font-semibold text-violet-100">Macro context</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <StatCard title="VIX Index" value={vixData ? vixData.value.toFixed(2) : 'N/A'} sub={vixData ? `${vixData.value < 16 ? 'Calm / risk-on' : vixData.value <= 24 ? 'Neutral / watchful' : 'Fear / stress'} · ${vixData.symbol} · ${vixData.date}` : marketReference?.vix?.error || 'Loading CBOE VIX from Yahoo Finance'} icon={Activity} valueClassName={vixMoodClassName} subClassName={vixMoodClassName} detail={<div><p>VIX is the CBOE volatility index and reflects expected S&P 500 volatility over the next 30 days.</p><p className="mt-2 font-semibold text-white">Color emotion guide</p><div className="mt-2 space-y-2"><p><span className="font-bold text-emerald-300">Green</span> = VIX below 16, calmer / more risk-on market emotion.</p><p><span className="font-bold text-amber-300">Yellow</span> = VIX 16 to 24, neutral or watchful market emotion.</p><p><span className="font-bold text-rose-300">Red</span> = VIX above 24, fear / stress market emotion.</p></div><p className="mt-2 font-semibold text-white">How to use it</p><p>When VIX is rising, breakouts can fail faster and position sizing should usually be more conservative. When VIX is low, complacency risk can build, so avoid over-leverage.</p><p className="mt-2">Source symbol: INDEXCBOE: VIX / Yahoo `^VIX`.</p></div>} />
                  <StatCard title="CNN Fear & Greed" value={fearGreedData ? `${fearGreedData.value.toFixed(1)}` : 'N/A'} sub={fearGreedData ? `${fearGreedData.rating} · Previous close ${fearGreedData.previousClose ?? 'N/A'} · 1 week ${fearGreedData.previous1Week ?? 'N/A'}` : marketReference?.fearGreed?.error || 'Loading CNN Fear & Greed Index'} icon={ShieldCheck} valueClassName={fearGreedMoodClassName} subClassName={fearGreedMoodClassName} detail={<div><p>CNN Fear & Greed summarizes multiple market sentiment inputs into a 0-100 score.</p><p className="mt-2 font-semibold text-white">5-level color emotion guide</p><div className="mt-2 space-y-2"><p><span className="font-bold text-rose-400">Deep red</span> = below 25, extreme fear / strong risk-off emotion.</p><p><span className="font-bold text-orange-300">Orange</span> = 25 to 44, fear / cautious market emotion.</p><p><span className="font-bold text-amber-300">Yellow</span> = 45 to 55, neutral market emotion.</p><p><span className="font-bold text-lime-300">Light green</span> = 56 to 75, greed / risk-on market emotion.</p><p><span className="font-bold text-emerald-300">Deep green</span> = above 75, extreme greed / stretched risk-on emotion.</p></div><p className="mt-2">Previous month: {fearGreedData?.previous1Month ?? 'N/A'} · Previous year: {fearGreedData?.previous1Year ?? 'N/A'}</p></div>} />
                </div>
                <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">AAII Investor Sentiment Survey</p>
                      <p className="mt-1 text-xs text-slate-400">{aaiiData ? `Week ending ${aaiiData.weekEnding}${aaiiLatestManualOverride ? ' · manual override' : marketReference?.aaii?.cached ? ` · cached/fallback data (${marketReference.aaii.error})` : ''}` : marketReference?.aaii?.error || 'Loading AAII weekly sentiment survey'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                    <button className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-300/20" type="button" onClick={() => {
                      resetAaiiDraft();
                      setShowAaiiEditor((isOpen) => !isOpen);
                    }}>{showAaiiEditor ? 'Hide editor' : 'Manual update'}</button>
                    {aaiiData && (
                      <a className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/20" href={aaiiData.sourceUrl} target="_blank" rel="noreferrer">AAII source</a>
                    )}
                    </div>
                  </div>
                  {showAaiiEditor && (
                    <div className="mb-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3">
                      <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
                        <input className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white outline-none focus:border-emerald-300/50" type="date" value={aaiiDraftWeekEnding} onChange={(event) => setAaiiDraftWeekEnding(event.target.value)} />
                        <input className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white outline-none focus:border-emerald-300/50" type="number" step="0.1" min="0" max="100" placeholder="Bullish %" value={aaiiDraftBullish} onChange={(event) => setAaiiDraftBullish(event.target.value)} />
                        <input className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white outline-none focus:border-emerald-300/50" type="number" step="0.1" min="0" max="100" placeholder="Neutral %" value={aaiiDraftNeutral} onChange={(event) => setAaiiDraftNeutral(event.target.value)} />
                        <input className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white outline-none focus:border-emerald-300/50" type="number" step="0.1" min="0" max="100" placeholder="Bearish %" value={aaiiDraftBearish} onChange={(event) => setAaiiDraftBearish(event.target.value)} />
                        <button className="rounded-xl bg-emerald-300 px-3 py-2 text-xs font-black text-slate-950 hover:bg-emerald-200" type="button" onClick={saveAaiiManualRow}>Save</button>
                      </div>
                      <p className="mt-2 text-xs text-emerald-50/70">Manual rows are saved in this browser and override fetched/fallback AAII rows with the same date.</p>
                    </div>
                  )}
                  {aaiiData ? (
                  <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-emerald-300/10 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">Bullish</p>
                          <p className="mt-2 text-4xl font-black text-emerald-300">{aaiiData.bullish.toFixed(1)}%</p>
                        </div>
                        <div className="rounded-2xl bg-slate-300/10 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Neutral</p>
                          <p className="mt-2 text-4xl font-black text-slate-200">{aaiiData.neutral.toFixed(1)}%</p>
                        </div>
                        <div className="rounded-2xl bg-rose-300/10 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-200">Bearish</p>
                          <p className="mt-2 text-4xl font-black text-rose-300">{aaiiData.bearish.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                          <span>Sentiment spread</span>
                          <span>Bull-Bear spread {(aaiiData.bullish - aaiiData.bearish).toFixed(1)} pts</span>
                        </div>
                        <div className="flex h-8 overflow-hidden rounded-full border border-white/10 bg-white/5">
                          <div className="flex items-center justify-center bg-emerald-400/80 text-xs font-bold text-emerald-950" style={{ width: `${aaiiBullishWidth}%` }}>{aaiiData.bullish.toFixed(1)}%</div>
                          <div className="flex items-center justify-center bg-slate-300/80 text-xs font-bold text-slate-950" style={{ width: `${aaiiNeutralWidth}%` }}>{aaiiData.neutral.toFixed(1)}%</div>
                          <div className="flex items-center justify-center bg-rose-400/80 text-xs font-bold text-rose-950" style={{ width: `${aaiiBearishWidth}%` }}>{aaiiData.bearish.toFixed(1)}%</div>
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-2xl border border-white/10">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-white/5 text-slate-300">
                            <tr>
                              <th className="px-3 py-2">Week Ending</th>
                              <th className="px-3 py-2 text-right text-emerald-300">Bullish</th>
                              <th className="px-3 py-2 text-right text-slate-300">Neutral</th>
                              <th className="px-3 py-2 text-right text-rose-300">Bearish</th>
                              <th className="px-3 py-2 text-right">Manual</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10 text-slate-200">
                            {aaiiSentimentRows.slice(0, 4).map((row) => (
                              <tr key={row.weekEnding} className="hover:bg-white/[0.03]">
                                <td className="px-3 py-2 font-semibold text-white">{row.weekEnding}</td>
                                <td className="px-3 py-2 text-right font-semibold text-emerald-300">{row.bullish.toFixed(1)}%</td>
                                <td className="px-3 py-2 text-right font-semibold text-slate-300">{row.neutral.toFixed(1)}%</td>
                                <td className="px-3 py-2 text-right font-semibold text-rose-300">{row.bearish.toFixed(1)}%</td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex justify-end gap-1">
                                    <button className="rounded-lg px-2 py-1 text-[0.7rem] font-semibold text-cyan-100 hover:bg-cyan-300/10" type="button" onClick={() => editAaiiRow(row)}>Edit</button>
                                    {aaiiManualRows.some((manualRow) => manualRow.weekEnding === row.weekEnding) && <button className="rounded-lg px-2 py-1 text-[0.7rem] font-semibold text-rose-100 hover:bg-rose-300/10" type="button" onClick={() => removeAaiiManualRow(row.weekEnding)}>Remove</button>}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Historical averages</p>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-xl bg-emerald-300/10 p-3">
                            <p className="text-xs text-emerald-200">Bullish</p>
                            <p className="mt-1 text-lg font-black text-emerald-300">{aaiiData.historicalAverages.bullish.toFixed(1)}%</p>
                          </div>
                          <div className="rounded-xl bg-slate-300/10 p-3">
                            <p className="text-xs text-slate-300">Neutral</p>
                            <p className="mt-1 text-lg font-black text-slate-200">{aaiiData.historicalAverages.neutral.toFixed(1)}%</p>
                          </div>
                          <div className="rounded-xl bg-rose-300/10 p-3">
                            <p className="text-xs text-rose-200">Bearish</p>
                            <p className="mt-1 text-lg font-black text-rose-300">{aaiiData.historicalAverages.bearish.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Historical view</p>
                        <div className="mt-3 space-y-3">
                          {aaiiData.oneYearHighs.map((row) => (
                            <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
                              <div>
                                <p className="text-sm font-semibold text-white">1-Year {row.label} High</p>
                                <p className="text-xs text-slate-400">Week Ending {row.weekEnding}</p>
                              </div>
                              <p className={`text-xl font-black ${row.label === 'Bullish' ? 'text-emerald-300' : row.label === 'Neutral' ? 'text-slate-200' : 'text-rose-300'}`}>{row.value.toFixed(1)}%</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">{marketReference?.aaii?.error || 'AAII sentiment data is not available yet. The dashboard will keep VIX and CNN working independently.'}</div>
                  )}
                </div>
              </div>
              <div id="portfolio-snapshot" className="mt-5 scroll-mt-24 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Portfolio snapshot</p>
                    <p className="mt-1 text-sm text-slate-400">Quick context for the current accumulated database.</p>
                  </div>
                  <p className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">Long-term mode</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl bg-white/[0.05] p-4">
                    <p className="text-xs text-slate-500">Trade Total P/L</p>
                    <p className={`mt-1 text-xl font-bold ${totalCombinedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(totalCombinedPnl)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.05] p-4">
                    <p className="text-xs text-slate-500">Realized P/L</p>
                    <p className={`mt-1 text-xl font-bold ${stats.totalRealizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(stats.totalRealizedPnl)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.05] p-4">
                    <p className="text-xs text-slate-500">Win Rate</p>
                    <p className="mt-1 text-xl font-bold text-white">{percent(stats.winRate)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.05] p-4">
                    <p className="text-xs text-slate-500">Current Account Value</p>
                    <p className="mt-1 text-xl font-bold text-white">{currentAccountValue === null ? 'N/A' : money(currentAccountValue)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Open portfolio</p>
                    <p className="mt-1 text-sm text-slate-400">Stocks on hand, live exposure, unrealized result, and portfolio weight.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {cashBalanceValue !== null && cashBalanceValue !== undefined && (
                      <p className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100" title={cashBalanceSource}>Cash {money(cashBalanceValue)}</p>
                    )}
                    <p className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">{openPortfolioRows.length} open holdings</p>
                  </div>
                </div>
                <div className="mt-4 max-h-80 overflow-auto rounded-2xl border border-white/10">
                  <table className="w-full min-w-[42rem] text-left text-xs">
                    <thead className="bg-white/[0.06] text-slate-400">
                      <tr>
                        <th className="px-3 py-3">Symbol</th>
                        <th className="px-3 py-3 text-right">Qty</th>
                        <th className="px-3 py-3 text-right">Market Value</th>
                        <th className="px-3 py-3 text-right">Unrealized P/L</th>
                        <th className="px-3 py-3 text-right">Return</th>
                        <th className="px-3 py-3 text-right">Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-slate-200">
                      {openPortfolioRows.length ? openPortfolioRows.map((position) => {
                        const positionReturn = position.costBasis ? position.unrealizedPnl / Math.abs(position.costBasis) : 0;
                        const positionWeight = openPortfolioTotalValue ? Math.abs(position.value) / openPortfolioTotalValue : 0;
                        return (
                          <tr key={`${position.symbol}-${position.quantity}-${position.value}`} className="hover:bg-white/[0.03]">
                            <td className="px-3 py-3 font-semibold text-white">{position.symbol}</td>
                            <td className="px-3 py-3 text-right">{position.quantity.toLocaleString()}</td>
                            <td className="px-3 py-3 text-right">{money(position.value)}</td>
                            <td className={`px-3 py-3 text-right font-semibold ${position.unrealizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(position.unrealizedPnl)}</td>
                            <td className={`px-3 py-3 text-right font-semibold ${positionReturn >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{percent(positionReturn)}</td>
                            <td className="px-3 py-3 text-right">{percent(positionWeight)}</td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td className="px-3 py-4 text-center text-slate-500" colSpan={6}>No open positions loaded.</td>
                        </tr>
                      )}
                      {cashBalanceValue !== null && cashBalanceValue !== undefined && (
                        <tr className="bg-cyan-300/5">
                          <td className="px-3 py-3 font-semibold text-cyan-100" title={cashBalanceSource}>Cash</td>
                          <td className="px-3 py-3 text-right text-slate-500">-</td>
                          <td className={`px-3 py-3 text-right font-semibold ${cashBalanceValue >= 0 ? 'text-cyan-100' : 'text-rose-300'}`}>{money(cashBalanceValue)}</td>
                          <td className="px-3 py-3 text-right text-slate-500">-</td>
                          <td className="px-3 py-3 text-right text-slate-500">-</td>
                          <td className="px-3 py-3 text-right">{openPortfolioTotalValue ? percent(Math.abs(cashBalanceValue) / openPortfolioTotalValue) : '-'}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <aside id="data-import" className="scroll-mt-24 border-t border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/40 p-6 lg:border-l lg:border-t-0">
              <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5 shadow-xl shadow-emerald-950/30">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">Secure sync</p>
                <h2 className="mt-2 text-2xl font-bold text-white">Download trades from IBKR</h2>
                <p className="mt-2 text-sm leading-6 text-emerald-50/70">Uses your local backend. The Flex token is read from `.env` and never exposed in browser code.</p>
                <p className="mt-3 rounded-2xl border border-emerald-200/20 bg-emerald-200/10 px-3 py-2 text-xs leading-5 text-emerald-50/80">Long-term mode: each sync/upload is merged into saved history and duplicate trades are skipped. Open positions remain the latest snapshot.</p>
                <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-4 text-base font-bold text-slate-950 shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60" type="button" disabled={isImporting} onClick={importFromIbkr}>
                  <ShieldCheck size={20} />
                  {isImporting ? 'Syncing IBKR...' : 'Sync IBKR Flex Now'}
                </button>
                {(isImporting || importProgress !== null || importStatus) && (
                  <div className="mt-4 rounded-2xl border border-emerald-200/20 bg-slate-950/35 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Sync status</p>
                      {importProgress !== null && <p className="text-sm font-bold text-emerald-100">{importProgress}%</p>}
                    </div>
                    {importProgress !== null && (
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-emerald-300 transition-all duration-500" style={{ width: `${importProgress}%` }} />
                      </div>
                    )}
                    <p className="mt-3 text-sm leading-6 text-emerald-50/90">{isImporting && importProgressMessage ? importProgressMessage : importStatus}</p>
                    {isImporting && <p className="mt-2 text-xs leading-5 text-emerald-50/60">Estimated progress only. IBKR does not stream exact completion status while generating the Flex statement.</p>}
                  </div>
                )}
                {syncDiff && !isImporting && (
                  <div className="mt-4 rounded-2xl border border-cyan-200/25 bg-cyan-300/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">What changed since last sync</p>
                      <button type="button" className="text-xs text-cyan-100/70 transition hover:text-white" onClick={() => setSyncDiff(null)}>Dismiss</button>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm leading-6 text-cyan-50 sm:grid-cols-2">
                      <div><span className="text-cyan-100/70">New trades</span><span className="ml-2 font-semibold text-white">{syncDiff.tradesAdded.toLocaleString()}</span></div>
                      <div><span className="text-cyan-100/70">New NAV rows</span><span className="ml-2 font-semibold text-white">{syncDiff.navRowsAdded.toLocaleString()}</span></div>
                      <div><span className="text-cyan-100/70">New cash rows</span><span className="ml-2 font-semibold text-white">{syncDiff.cashRowsAdded.toLocaleString()}</span></div>
                      {syncDiff.navDelta !== null && (
                        <div><span className="text-cyan-100/70">NAV change</span><span className={`ml-2 font-semibold ${syncDiff.navDelta >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>{money(syncDiff.navFrom ?? 0)} → {money(syncDiff.navTo ?? 0)} ({syncDiff.navDelta >= 0 ? '+' : ''}{money(syncDiff.navDelta)})</span></div>
                      )}
                      {syncDiff.newDividends > 0 && <div><span className="text-cyan-100/70">Dividends booked</span><span className="ml-2 font-semibold text-emerald-200">{money(syncDiff.newDividends)}</span></div>}
                      {syncDiff.newWithholdingTax < 0 && <div><span className="text-cyan-100/70">Withholding tax</span><span className="ml-2 font-semibold text-rose-200">{money(syncDiff.newWithholdingTax)}</span></div>}
                      {syncDiff.newInterest !== 0 && <div><span className="text-cyan-100/70">Interest (net)</span><span className={`ml-2 font-semibold ${syncDiff.newInterest >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>{money(syncDiff.newInterest)}</span></div>}
                      {syncDiff.newDeposits > 0 && <div><span className="text-cyan-100/70">Deposits</span><span className="ml-2 font-semibold text-emerald-200">{money(syncDiff.newDeposits)}</span></div>}
                      {syncDiff.newWithdrawals < 0 && <div><span className="text-cyan-100/70">Withdrawals</span><span className="ml-2 font-semibold text-rose-200">{money(syncDiff.newWithdrawals)}</span></div>}
                    </div>
                    <p className="mt-3 text-xs text-cyan-100/60">Captured at {new Date(syncDiff.capturedAt).toLocaleString()}. Only this session.</p>
                  </div>
                )}
              </div>
              <label className={`mt-4 flex cursor-pointer items-center gap-4 rounded-3xl border border-dashed border-cyan-300/30 bg-cyan-300/10 p-5 transition ${isCsvImporting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-cyan-300/20'}`}>
                <div className="rounded-2xl bg-cyan-300/10 p-3 text-cyan-200">
                  {isCsvImporting ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                  ) : (
                    <Upload />
                  )}
                </div>
                <div>
                  <span className="block font-semibold text-white">{isCsvImporting ? 'Processing CSV...' : 'Upload CSV instead'}</span>
                  <span className="mt-1 block text-sm text-slate-400">{isCsvImporting ? 'Please wait' : 'Manual fallback import'}</span>
                </div>
                <input className="hidden" type="file" accept=".csv,text/csv" disabled={isCsvImporting} onChange={(event: ChangeEvent<HTMLInputElement>) => event.target.files?.[0] && handleFile(event.target.files[0])} />
              </label>
              <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.05] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Current saved database</p>
                <div className="mt-3 space-y-3 text-sm">
                  <label className="block">
                    <span className="text-slate-500">Initial funding assumption</span>
                    <input className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-cyan-300" type="number" value={initialFunding} onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      const value = Number(event.target.value);
                      setInitialFunding(value);
                      setStartingNav(value);
                    }} />
                  </label>
                  <div>
                    <p className="text-slate-500">Accumulated trading period</p>
                    <p className="font-semibold text-white">{databaseRangeLabel}</p>
                    {databaseDays > 0 && <p className="mt-1 text-xs text-slate-500">{databaseDays.toLocaleString()} calendar days</p>}
                    {databaseDateRange.from && databaseDateRange.from < DEFAULT_BENCHMARK_START_DATE && <p className="mt-1 text-xs text-slate-500">Displayed from investment start date.</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-white/[0.05] p-3">
                      <p className="text-slate-500">Orders / Fills</p>
                      <p className="mt-1 text-lg font-bold text-white">{stats.totalOrders} / {stats.totalExecutions}</p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.05] p-3">
                      <p className="text-slate-500">Open</p>
                      <p className="mt-1 text-lg font-bold text-white">{stats.positionsCount}</p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.05] p-3">
                      <p className="text-slate-500">NAV</p>
                      <p className="mt-1 text-lg font-bold text-white">{navRows.length}</p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.05] p-3">
                      <p className="text-slate-500">Cash Transactions</p>
                      <p className="mt-1 text-lg font-bold text-white">{cashRows.length}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-4">
                <p className="font-semibold text-white">Backup / restore dashboard data</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="rounded-2xl bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20" type="button" onClick={exportDashboardData}>
                    Export JSON
                  </button>
                  <button className="rounded-2xl bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20" type="button" onClick={exportDashboardPdf}>
                    Export PDF
                  </button>
                  <label className="col-span-2 cursor-pointer rounded-2xl bg-cyan-300/10 px-4 py-3 text-center text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20">
                    Import JSON Backup
                    <input className="hidden" type="file" accept="application/json,.json" onChange={(event: ChangeEvent<HTMLInputElement>) => event.target.files?.[0] && importDashboardBackup(event.target.files[0])} />
                  </label>
                </div>
              </div>
            </aside>
          </div>
        </header>

        <DashboardStickyNav />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Total Realized P/L" value={money(stats.totalRealizedPnl)} sub={`${stats.totalExecutions} fills from ${stats.totalOrders} orders`} icon={TrendingUp} positive={stats.totalRealizedPnl >= 0} detail={<div><p>Closed profit/loss from completed execution fills. This is the cleanest measure of what your trading process has already locked in.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Total Realized P/L = sum of `FifoPnlRealized` / `Realized P/L` across fills.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>Compare this with commissions, cycle win rate, and cycle payoff ratio. A positive realized P/L with weak payoff may still be fragile; a negative realized P/L with strong open gains means current risk is still unresolved.</p><p className="mt-2">Orders: {stats.totalOrders}</p><p>Fills analyzed: {stats.totalExecutions}</p></div>} />
          <StatCard title="Unrealized P/L" value={stats.positionsCount ? money(stats.totalUnrealizedPnl) : 'N/A'} sub={stats.positionsCount ? `${stats.positionsCount} open positions ${stats.positions[0]?.source === 'INFERRED_FROM_TRADES' ? 'inferred from trades' : 'from IBKR'}${positionSummary ? ` · ${positionSummary}` : ''}` : 'No open positions detected'} icon={WalletCards} positive={stats.positionsCount ? stats.totalUnrealizedPnl >= 0 : undefined} detail={<div><p>Profit/loss still exposed to market movement. Unlike realized P/L, this can change quickly and should be reviewed with VIX, concentration, and position size.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Uses `FifoPnlUnrealized` / `Unrealized P/L` when available. Otherwise falls back to Position Value - Cost Basis Money.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>If unrealized P/L is a large share of total P/L, your result depends heavily on current open risk. Check whether gains are protected and whether losses have a clear invalidation point.</p><p className="mt-2">Open positions: {stats.positionsCount}</p><p>{positionSummary || 'No position breakdown available.'}</p></div>} />
          <StatCard title="Bond Yield Profit : Commission" value={bondCashYieldStats.length ? `${bondCashYieldProfitCommissionRatio.toFixed(2)}x` : 'N/A'} sub={bondCashYieldStats.length ? `${money(bondCashYieldRealizedPnl)} profit / ${money(Math.abs(bondCashYieldCommissions))} commission · ${bondCashYieldSymbolsLabel}` : 'No SGOV / IB01 trades loaded'} icon={BarChart3} positive={bondCashYieldProfitCommissionRatio >= 1} detail={<div><p>Measures whether bond/cash-yield activity is adding meaningful return after transaction costs.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Bond yield ratio = SGOV + IB01 realized P/L / absolute SGOV + IB01 commissions.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>A low ratio means bond/cash-yield trades may be too small/frequent relative to fees. A high ratio means the bond/cash-yield allocation is working without excessive friction.</p><p className="mt-2">Symbols included: {bondCashYieldSymbolsLabel}</p><div className="mt-3 overflow-hidden rounded-xl border border-white/10"><table className="w-full text-left text-xs"><thead className="bg-white/[0.06] text-slate-400"><tr><th className="px-3 py-2">Symbol</th><th className="px-3 py-2 text-right">Trades</th><th className="px-3 py-2 text-right">Realized P/L</th><th className="px-3 py-2 text-right">Commission</th></tr></thead><tbody className="divide-y divide-white/10">{bondCashYieldDetailRows.map((row) => <tr key={row.symbol}><td className="px-3 py-2 font-semibold text-white">{row.symbol}</td><td className="px-3 py-2 text-right">{row.trades}</td><td className={`px-3 py-2 text-right font-semibold ${row.realizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(row.realizedPnl)}</td><td className="px-3 py-2 text-right text-slate-300">{money(Math.abs(row.commissions))}</td></tr>)}<tr className="bg-white/[0.04] font-semibold"><td className="px-3 py-2 text-white">Total</td><td className="px-3 py-2 text-right">{bondCashYieldStats.reduce((total, row) => total + row.trades, 0)}</td><td className={`px-3 py-2 text-right ${bondCashYieldRealizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{bondCashYieldStats.length ? money(bondCashYieldRealizedPnl) : 'N/A'}</td><td className="px-3 py-2 text-right text-slate-300">{bondCashYieldStats.length ? money(Math.abs(bondCashYieldCommissions)) : 'N/A'}</td></tr></tbody></table></div></div>} />
          <StatCard title="Cycle Win Rate" value={percent(stats.winRate)} sub={`${stats.winners.length} winning cycles / ${stats.losers.length} losing cycles, ex-bond yield`} icon={Target} detail={<div><p>Shows how often closed trade cycles make money. It does not measure how large wins are versus losses.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Cycle Win Rate = winning cycles / realized non-zero cycles, excluding SGOV, IB01, and breakeven cycles.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>A high cycle win rate can still lose money if average losses are much larger than wins. A lower cycle win rate can be excellent if payoff ratio is strong.</p><p className="mt-2">Winning cycles: {stats.winners.length}</p><p>Losing cycles: {stats.losers.length}</p></div>} />
          <StatCard title="Cycle Payoff Ratio" value={`${stats.profitLossRatio.toFixed(2)}x`} sub={`Ex-bond yield average winning cycle ${money(stats.averageWinner)} / losing cycle ${money(stats.averageLoser)}`} icon={BarChart3} detail={<div><p>Compares the average size of your winning cycles with the average size of your losing cycles.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Cycle Payoff Ratio = average winning cycle / average losing cycle, excluding SGOV and IB01.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>Above 1.0 means winning cycles are larger than losing cycles on average. If cycle win rate is below 50%, you usually need a higher payoff ratio to maintain positive expectancy.</p><p className="mt-2">Average winner: {money(stats.averageWinner)}</p><p>Average loser: {money(stats.averageLoser)}</p></div>} />
          <StatCard title="Cycle Profit Factor" value={`${stats.profitFactor.toFixed(2)}x`} sub={`Ex-bond yield expectancy ${money(stats.expectancy)} per closed cycle`} icon={Activity} positive={stats.profitFactor >= 1} detail={<div><p>Summarizes whether total winning cycles are large enough to cover total losing cycles.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Cycle Profit Factor = gross winning-cycle profit / absolute gross losing-cycle loss, excluding SGOV and IB01.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>Above 1.0 is profitable before considering future risk. Above 1.5 is generally healthier. Below 1.0 means losing cycles are larger than winning cycles in aggregate.</p><p className="mt-2">Expectancy per closed cycle: {money(stats.expectancy)}</p></div>} />
        </div>

        <div id="risk-metrics" className="grid scroll-mt-24 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Sharpe Ratio" value={`${riskMetrics.sharpeRatio.toFixed(2)}`} sub={hasActualNavCurve ? `NAV returns, cash-flow adjusted · ${riskPeriodLabel}` : `Fallback equity · ${riskPeriodLabel}`} icon={LineChart} positive={riskMetrics.sharpeRatio >= 1} detail={<div><p>Risk-adjusted return using the selected review-period equity curve.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Sharpe = (average daily cash-flow-adjusted return / daily return standard deviation) × √252.</p><p className="mt-2 font-semibold text-white">Cash-flow impact</p><p>{riskCashFlowNote}</p><p className="mt-2 font-semibold text-white">How to use it</p><p>Higher is better. When downloaded NAV and Cash Transactions deposits/withdrawals are available, account transfers are removed from daily return so they do not distort volatility.</p><p className="mt-2">Risk period: {riskPeriodLabel}</p><p>Equity source: {hasActualNavCurve ? `Downloaded NAV rows in period (${riskEquityCurveData.length})` : `Starting NAV ${money(riskStartingNav)} + realized P/L`}</p></div>} />
          <StatCard title="Max Drawdown" value={`${(riskMetrics.maxDrawdown * 100).toFixed(2)}%`} sub={hasActualNavCurve ? `NAV drawdown, cash-flow adjusted · ${riskPeriodLabel}` : `Fallback equity decline · ${riskPeriodLabel}`} icon={TrendingDown} positive={false} detail={<div><p>Shows the largest equity decline from a previous high point inside the selected review period.</p><p className="mt-2 font-semibold text-white">When it happened</p><p>Peak: {riskMetrics.maxDrawdownPeakDate || 'N/A'} · {riskMetrics.maxDrawdownPeakEquity ? money(riskMetrics.maxDrawdownPeakEquity) : 'N/A'}</p><p>Trough: {riskMetrics.maxDrawdownTroughDate || 'N/A'} · {riskMetrics.maxDrawdownTroughEquity ? money(riskMetrics.maxDrawdownTroughEquity) : 'N/A'}</p><p className="mt-2 font-semibold text-white">Estimated holdings on trough date</p>{maxDrawdownHoldings.length ? <div className="mt-2 overflow-hidden rounded-xl border border-white/10"><table className="w-full text-left text-xs"><thead className="bg-white/5 text-slate-400"><tr><th className="px-2 py-2">Symbol</th><th className="px-2 py-2">Asset</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Est. Value</th></tr></thead><tbody className="divide-y divide-white/10">{maxDrawdownHoldings.map((holding) => <tr key={holding.symbol}><td className="px-2 py-2 font-semibold text-white">{holding.symbol}</td><td className="px-2 py-2">{holding.assetClass || '-'}</td><td className="px-2 py-2 text-right">{holding.quantity.toLocaleString()}</td><td className="px-2 py-2 text-right">{money(holding.estimatedValue)}</td></tr>)}</tbody></table></div> : <p>No reconstructed holdings found from trades on this date.</p>}<p className="mt-2 text-xs text-slate-400">Holdings are reconstructed from trade quantities up to the trough date and valued using the latest trade price available by that date, so they are estimates rather than official historical positions.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Drawdown = (peak cash-flow-adjusted equity - current cash-flow-adjusted equity) / peak cash-flow-adjusted equity.</p><p className="mt-2 font-semibold text-white">Cash-flow impact</p><p>{riskCashFlowNote}</p><p className="mt-2">Risk period: {riskPeriodLabel}</p><p>Equity source: {hasActualNavCurve ? `Downloaded NAV rows in period (${riskEquityCurveData.length})` : `Starting NAV ${money(riskStartingNav)} + cumulative realized P/L`}</p></div>} />
          <StatCard title="Trade Total P/L" value={money(totalCombinedPnl)} sub={`${money(stats.totalRealizedPnl)} realized + ${money(stats.totalUnrealizedPnl)} unrealized`} icon={Award} positive={totalCombinedPnl >= 0} detail={<div><p>Combines locked-in trade performance with current open-position performance. This is trade-based, while the equity curve and risk metrics use account NAV when available.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Trade Total P/L = realized P/L + unrealized P/L.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>If most trade P/L is unrealized, the result is not yet banked. Pair this with VIX and open concentration to decide whether to reduce, hedge, or let positions run.</p><p className="mt-2">Unrealized share: {(unrealizedPnlShare * 100).toFixed(1)}%</p></div>} />
          <StatCard title="Open Risk Concentration" value={largestPosition ? `${largestPosition.symbol}` : 'N/A'} sub={largestPosition ? `Largest open exposure ${money(Math.abs(largestPosition.value))}${totalPositionValue ? ` / ${((Math.abs(largestPosition.value) / totalPositionValue) * 100).toFixed(1)}% of open exposure` : ''}` : 'No open position exposure'} icon={Target} positive={largestPosition ? Math.abs(largestPosition.value) / (totalPositionValue || 1) < 0.35 : undefined} detail={<div><p>Shows whether one open position dominates your current exposure.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Concentration = largest absolute position value / total absolute open position value.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>High concentration is not automatically bad, but it means one symbol can drive portfolio outcome. Review catalyst risk, stop level, and whether exposure is correlated with other holdings.</p><p className="mt-2">{largestPosition ? `${largestPosition.symbol}: ${money(Math.abs(largestPosition.value))}` : 'No open positions loaded.'}</p></div>} />
          <StatCard title="Open Position Return" value={stats.positionsCount ? `${(openPositionReturn * 100).toFixed(2)}%` : 'N/A'} sub={stats.positionsCount ? `${money(stats.totalUnrealizedPnl)} unrealized / ${money(openPositionCostBasis)} cost basis` : 'No open position cost basis'} icon={WalletCards} positive={stats.positionsCount ? openPositionReturn >= 0 : undefined} detail={<div><p>Measures the return of currently open positions relative to their cost basis.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Open Position Return = total unrealized P/L / absolute open position cost basis.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>A strong positive value may justify taking partial profit if market sentiment is stretched. A negative value should be reviewed against original thesis and max-loss rules.</p><p className="mt-2">Cost basis: {money(openPositionCostBasis)}</p></div>} />
          <StatCard title="Net Deposits / Withdrawals" value={cashFlowValue === null ? 'N/A' : money(cashFlowValue)} sub={downloadedCashFlow ? `Cumulative Cash Transactions withdrawals through ${downloadedCashFlow.date}` : 'No IBKR Cash Transactions withdrawals loaded'} icon={TrendingDown} positive={undefined} detail={<div><p>Uses dated IBKR Cash Transactions rows where Type is Deposits/Withdrawals and Amount is negative.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Net deposits / withdrawals = cumulative sum of parsed withdrawal amounts converted to base currency using FXRateToBase.</p><p className="mt-2 font-semibold text-white">Important note</p><p>Negative values mean net withdrawals. Initial cash receipt funding deposits are excluded from this card and the cash-flow-adjusted risk metrics.</p><p className="mt-2">Source: {cashFlowSource}</p><p className="mt-2">Current account value source: {currentAccountValueSource}</p><p className="mt-3 font-semibold text-white">Withdrawal breakdown</p>{cashFlowDetailRows.length ? <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-white/10"><table className="w-full text-left text-xs"><thead className="bg-white/5 text-slate-400"><tr><th className="px-2 py-2">Date</th><th className="px-2 py-2">Currency</th><th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2 text-right">Base (USD)</th><th className="px-2 py-2">Description</th></tr></thead><tbody className="divide-y divide-white/10">{cashFlowDetailRows.map((row, index) => (<tr key={`${row.date}-${index}-${row.amount}`}><td className="px-2 py-2 font-semibold text-white">{row.date}</td><td className="px-2 py-2">{row.currency || '-'}</td><td className="px-2 py-2 text-right text-rose-300">{row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="px-2 py-2 text-right text-rose-300">{money(row.value)}</td><td className="px-2 py-2 text-slate-400">{row.description || '-'}</td></tr>))}<tr className="bg-white/[0.06]"><td className="px-2 py-2 font-semibold text-white" colSpan={3}>Total</td><td className="px-2 py-2 text-right font-bold text-rose-300">{money(cashFlowValue ?? 0)}</td><td className="px-2 py-2"></td></tr></tbody></table></div> : <p className="mt-2 text-slate-400">No withdrawal rows parsed from Cash Transactions.</p>}</div>} />
        </div>

        <div className="rounded-3xl border border-white/10 bg-[var(--dashboard-card)] p-5 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">Max Drawdown Audit</p>
              <h3 className="mt-1 text-xl font-bold text-white">{riskMetrics.maxDrawdownPeakDate || 'N/A'} → {riskMetrics.maxDrawdownTroughDate || 'N/A'}</h3>
              <p className="mt-2 text-sm text-slate-300">Raw NAV drawdown {rawMaxDrawdownValue ? `${(rawMaxDrawdownValue * 100).toFixed(2)}%` : 'N/A'} becomes cash-flow-adjusted drawdown {(riskMetrics.maxDrawdown * 100).toFixed(2)}%.</p>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-slate-400">Raw NAV</p>
                <p className="font-semibold text-white">{money(riskMetrics.maxDrawdownPeakRawEquity)} → {money(riskMetrics.maxDrawdownTroughRawEquity)}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-slate-400">Withdrawals inside path</p>
                <p className="font-semibold text-rose-300">{money(riskMetrics.maxDrawdownCashFlowDuringDrawdown)}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-slate-400">Adjusted equity</p>
                <p className="font-semibold text-cyan-200">{money(riskMetrics.maxDrawdownPeakEquity)} → {money(riskMetrics.maxDrawdownTroughEquity)}</p>
              </div>
            </div>
          </div>
        </div>

        <Section title="Cash Income & Cost Leakage" subtitle="Uses full IBKR Cash Transactions to track dividend income, withholding tax, interest, and non-trading fee drag.">
          <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard title="Gross Dividends" value={money(cashInsights.grossDividends)} sub={`Net after withholding ${money(cashInsights.netDividends)}`} icon={WalletCards} positive={cashInsights.grossDividends > 0} detail={<div><p>Total positive Cash Transactions where Type is Dividends.</p><p className="mt-2">Gross dividends: {money(cashInsights.grossDividends)}</p><p>Withholding tax: {money(cashInsights.withholdingTax)}</p><p>Net dividends: {money(cashInsights.netDividends)}</p></div>} />
            <StatCard title="Withholding Tax Rate" value={`${(cashInsights.effectiveWithholdingTaxRate * 100).toFixed(1)}%`} sub={`${money(cashInsights.withholdingTax)} tax / ${money(cashInsights.grossDividends)} gross dividends`} icon={ShieldCheck} positive={cashInsights.effectiveWithholdingTaxRate < 0.25} detail={<div><p>Effective withholding tax rate based on Cash Transactions.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Absolute withholding tax / gross dividends.</p></div>} />
            <StatCard title="Withholding Tax Refunded" value={money(cashInsights.withholdingTaxRefunds)} sub={cashInsights.withholdingTaxGross < 0 ? `${((cashInsights.withholdingTaxRefunds / Math.abs(cashInsights.withholdingTaxGross)) * 100).toFixed(1)}% of ${money(Math.abs(cashInsights.withholdingTaxGross))} gross withheld` : 'No gross withholding tax recorded'} icon={ShieldCheck} positive={cashInsights.withholdingTaxRefunds > 0} detail={<div><p>Sum of positive Cash Transactions rows where Type is Withholding Tax. These are refunds, reversals, or treaty rate adjustments returned to your account after IBKR initially withheld dividend tax.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Refunded = Σ Withholding Tax rows with positive amount, converted to base currency using FXRateToBase.</p><p className="mt-2 font-semibold text-white">Breakdown</p><p>Gross withheld (negative rows): {money(cashInsights.withholdingTaxGross)}</p><p>Refunded (positive rows): {money(cashInsights.withholdingTaxRefunds)}</p><p>Net withholding tax: {money(cashInsights.withholdingTax)}</p><p className="mt-3 font-semibold text-white">Refund rows · past 12 months</p>{withholdingRefundRows.length ? <div className="mt-2 overflow-hidden rounded-xl border border-white/10"><table className="w-full text-left text-xs"><thead className="bg-white/5 text-slate-400"><tr><th className="px-2 py-2">Date</th><th className="px-2 py-2">Symbol</th><th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2">Currency</th><th className="px-2 py-2 text-right">Base (USD)</th></tr></thead><tbody className="divide-y divide-white/10">{withholdingRefundRows.map((row, index) => (<tr key={`${row.date}-${row.symbol}-${index}`}><td className="px-2 py-2 font-medium text-white" title={row.description || undefined}>{row.date}</td><td className="px-2 py-2 text-slate-200">{row.symbol || '-'}</td><td className="px-2 py-2 text-right text-emerald-300">{row.amount.toFixed(2)}</td><td className="px-2 py-2 text-slate-300">{row.currency || '-'}</td><td className="px-2 py-2 text-right font-semibold text-emerald-300">{money(row.value)}</td></tr>))}<tr className="bg-white/[0.04] font-semibold"><td className="px-2 py-2 text-white" colSpan={4}>Total ({withholdingRefundRows.length} rows)</td><td className="px-2 py-2 text-right text-emerald-300">{money(withholdingRefundRows.reduce((total, row) => total + row.value, 0))}</td></tr></tbody></table></div> : <p className="mt-2 text-slate-400">No withholding tax refunds detected in the past 12 months.</p>}<p className="mt-3 font-semibold text-white">How to use it</p><p>Track refunds against the gross withheld amount to confirm treaty rates are being applied. If refunds are zero but gross withholding is non-zero, your broker may not be claiming treaty relief for you.</p></div>} />
            <StatCard title="Fee Drag" value={money(cashInsights.totalCashDrag)} sub={`${(feeDragToNavPct * 100).toFixed(2)}% of NAV · ${(feeDragToRealizedPnlPct * 100).toFixed(1)}% of realized P/L`} icon={TrendingDown} positive={cashInsights.totalCashDrag >= 0} detail={<div><p>Non-trading cash leakage from withholding tax, broker interest paid, and other fees.</p><p className="mt-2">Broker interest paid: {money(cashInsights.brokerInterestPaid)}</p><p>Other fees: {money(cashInsights.otherFees)}</p><p>Withholding tax: {money(cashInsights.withholdingTax)}</p><p>Total cash drag: {money(cashInsights.totalCashDrag)}</p></div>} />
            <StatCard title="Interest & Other Fees" value={money(cashInsights.interest + cashInsights.otherFees)} sub={`${money(cashInsights.interest)} interest + ${money(cashInsights.otherFees)} other fees`} icon={Activity} positive={cashInsights.interest + cashInsights.otherFees >= 0} detail={<div><p>Summarizes interest received/paid and other platform or dividend-related fees from Cash Transactions.</p><p className="mt-2">Interest net: {money(cashInsights.interest)}</p><p>Other fees net: {money(cashInsights.otherFees)}</p><p>Negative values indicate cash leakage.</p></div>} />
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">Monthly Cash Income & Drag</h3>
                <p className="text-sm text-slate-400">Dividends, interest, withholding tax, and other fees by month.</p>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={cashInsights.monthlyRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
                  <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px' }} formatter={(value) => money(Number(value ?? 0))} />
                  <Bar dataKey="dividends" stackId="cash" fill="#34d399" name="Dividends" />
                  <Bar dataKey="interest" stackId="cash" fill="#22d3ee" name="Interest" />
                  <Bar dataKey="withholdingTax" stackId="cash" fill="#fb7185" name="Withholding Tax" />
                  <Bar dataKey="otherFees" stackId="cash" fill="#f59e0b" name="Other Fees" />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Section>

        <div className="space-y-6">
          <Section title="Open Positions Insight" subtitle="Uses Open Positions data to explain current exposure, unrealized P/L, concentration, and option details.">
            <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <StatCard title="Open Exposure" value={money(totalPositionValue)} sub={`${stats.positionsCount} open positions by absolute market value`} icon={WalletCards} />
              <StatCard title="Total Unrealized P/L" value={stats.positionsCount ? money(stats.totalUnrealizedPnl) : 'N/A'} sub={stats.positionsCount ? `${percent(openPositionReturn)} on ${money(openPositionCostBasis)} cost basis` : 'No open positions'} icon={WalletCards} positive={stats.positionsCount ? stats.totalUnrealizedPnl >= 0 : undefined} detail={<div><p>Sum of unrealized P/L across all currently open positions.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Total Unrealized P/L = Σ (mark price − cost basis) × signed quantity, per open position.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>Positive means the open book is in profit before commissions/taxes; negative means it is in drawdown. Compare with the Open Position Return % to see how much capital is deployed against this result.</p><p className="mt-2">Cost basis deployed: {money(openPositionCostBasis)}</p><p>Open Position Return: {percent(openPositionReturn)}</p></div>} />
              <StatCard title="Winning Open Positions" value={`${winningOpenPositions.length}`} sub={largestOpenGain ? `Largest gain ${largestOpenGain.symbol}: ${money(largestOpenGain.unrealizedPnl)}` : 'No open gains'} icon={TrendingUp} positive />
              <StatCard title="Losing Open Positions" value={`${losingOpenPositions.length}`} sub={largestOpenLoss ? `Largest loss ${largestOpenLoss.symbol}: ${money(largestOpenLoss.unrealizedPnl)}` : 'No open losses'} icon={TrendingDown} positive={false} />
              <StatCard title="Largest Position" value={largestPosition ? largestPosition.symbol : 'N/A'} sub={largestPosition ? `${money(Math.abs(largestPosition.value))}${largestPosition.percentOfNav ? ` / ${largestPosition.percentOfNav.toFixed(2)}% NAV` : ''}` : 'No open position data'} icon={Target} />
              <StatCard title="Option Positions" value={`${stats.positions.filter((position) => position.assetClass.toUpperCase() === 'OPT').length}`} sub="Open option contracts detected" icon={Activity} />
            </div>
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="min-w-[76rem] w-full text-left text-sm">
                <thead className="bg-white/5 text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Symbol</th>
                    <th className="px-4 py-3">Underlying</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Side</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Mark</th>
                    <th className="px-4 py-3 text-right">Value</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                    <th className="px-4 py-3 text-right">Unrealized P/L</th>
                    <th className="px-4 py-3 text-right">% NAV</th>
                    <th className="px-4 py-3">Open Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-slate-200">
                  {openPortfolioRows.map((position) => (
                    <tr key={`${position.symbol}-${position.openDate}`} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium text-white">{position.symbol}</td>
                      <td className="px-4 py-3">{position.underlyingSymbol || '-'}</td>
                      <td className="px-4 py-3">{`${position.assetClass}${position.putCall ? ` ${position.putCall}` : ''}${position.strike ? ` ${position.strike}` : ''}${position.expiry ? ` ${position.expiry}` : ''}`}</td>
                      <td className="px-4 py-3">{position.side || (position.quantity >= 0 ? 'Long' : 'Short')}</td>
                      <td className="px-4 py-3 text-right">{position.quantity}</td>
                      <td className="px-4 py-3 text-right">{money(position.closePrice)}</td>
                      <td className="px-4 py-3 text-right">{money(position.value)}</td>
                      <td className="px-4 py-3 text-right">{money(position.costBasis)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${position.unrealizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(position.unrealizedPnl)}</td>
                      <td className="px-4 py-3 text-right">{position.percentOfNav ? `${position.percentOfNav.toFixed(2)}%` : '-'}</td>
                      <td className="px-4 py-3">{position.openDate || '-'}</td>
                    </tr>
                  ))}
                  {cashBalanceValue !== null && cashBalanceValue !== undefined && (
                    <tr className="bg-cyan-300/5" title={cashBalanceSource}>
                      <td className="px-4 py-3 font-medium text-cyan-100">Cash</td>
                      <td className="px-4 py-3">-</td>
                      <td className="px-4 py-3">CASH</td>
                      <td className="px-4 py-3">-</td>
                      <td className="px-4 py-3 text-right">-</td>
                      <td className="px-4 py-3 text-right">-</td>
                      <td className={`px-4 py-3 text-right font-semibold ${cashBalanceValue >= 0 ? 'text-cyan-100' : 'text-rose-300'}`}>{money(cashBalanceValue)}</td>
                      <td className="px-4 py-3 text-right">-</td>
                      <td className="px-4 py-3 text-right">-</td>
                      <td className="px-4 py-3 text-right">{currentAccountValue ? `${(Math.abs(cashBalanceValue) / currentAccountValue * 100).toFixed(2)}%` : '-'}</td>
                      <td className="px-4 py-3">{navCashBalance?.date || '-'}</td>
                    </tr>
                  )}
                  {!openPortfolioRows.length && (
                    <tr>
                      <td className="px-4 py-5 text-slate-400" colSpan={11}>No open positions loaded. Add Open Positions to the Flex Query or upload a CSV containing that section.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Equity Curve & P/L Trend" subtitle={hasActualNavCurve ? 'Daily account NAV plus weekly and monthly Change in NAV bars for actual account growth and volatility.' : 'Daily equity curve plus weekly and monthly realized P/L bars for growth trend and volatility.'}>
            <div className="space-y-5">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3">
                  <p className="font-semibold text-white">Equity Curve</p>
                  <p className="mt-1 text-sm text-slate-400">{hasActualNavCurve ? `Uses downloaded Net Asset Value rows from the CSV${navReturnPct !== null ? ` · total NAV return ${(navReturnPct * 100).toFixed(2)}%` : ''}.` : 'Starting NAV plus cumulative realized P/L. Daily trade data still drives the line.'}</p>
                </div>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={equityCurveData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" ticks={equityMonthTicks} tickFormatter={dateMonthLabel} minTickGap={12} />
                      <YAxis stroke="#94a3b8" tickFormatter={(value) => money(Number(value))} width={86} />
                      <Tooltip formatter={(value, name) => [name === 'Equity' ? money(Number(value)) : money(Number(value)), name]} contentStyle={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} />
                      <Line type="monotone" dataKey="equity" name="Equity" stroke="#22d3ee" strokeWidth={3} dot={false} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3">
                  <p className="font-semibold text-white">Monthly {trendPnlLabel}</p>
                  <p className="mt-1 text-sm text-slate-400">Positive months in green, losing months in red.</p>
                </div>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={monthlyPnlChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="label" stroke="#94a3b8" minTickGap={8} />
                      <YAxis stroke="#94a3b8" tickFormatter={(value) => money(Number(value))} width={76} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.06)' }} formatter={(value) => [money(Number(value)), `Monthly ${trendPnlLabel}`]} labelFormatter={(_, payload) => payload?.[0]?.payload?.month ? `${dateMonthLabel(`${payload[0].payload.month}-01`)} · ${money(Number(payload[0].payload.realizedPnl))}` : ''} contentStyle={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} />
                      <Bar dataKey="realizedPnl" name={`Monthly ${trendPnlLabel}`} radius={[8, 8, 8, 8]} activeBar={{ stroke: '#f8fafc', strokeWidth: 2 }}>
                        {monthlyPnlChartData.map((row) => <Cell key={row.month} fill={row.realizedPnl >= 0 ? '#34d399' : '#fb7185'} />)}
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-3">
                <p className="font-semibold text-white">Recent Weekly {trendPnlLabel}</p>
                <p className="mt-1 text-sm text-slate-400">Last 12 trading weeks, grouped by Monday week start.</p>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={weeklyPnlChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="label" stroke="#94a3b8" minTickGap={8} />
                    <YAxis stroke="#94a3b8" tickFormatter={(value) => money(Number(value))} width={76} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.06)' }} formatter={(value) => [money(Number(value)), `Weekly ${trendPnlLabel}`]} labelFormatter={(_, payload) => payload?.[0]?.payload?.week ? `Week of ${payload[0].payload.week} · ${money(Number(payload[0].payload.realizedPnl))}` : ''} contentStyle={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} />
                    <Bar dataKey="realizedPnl" name={`Weekly ${trendPnlLabel}`} radius={[8, 8, 8, 8]} activeBar={{ stroke: '#f8fafc', strokeWidth: 2 }}>
                      {weeklyPnlChartData.map((row) => <Cell key={row.week} fill={row.realizedPnl >= 0 ? '#34d399' : '#fb7185'} />)}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Section>

          <Section title="Period Benchmark Comparison" subtitle="Choose ALL records or a custom date range. Portfolio return is cash-flow adjusted and rebased to the selected period.">
            <p className="mb-4 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm leading-6 text-slate-300">{benchmarkStatus}</p>
            <div className="mb-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
              <label>
                Period
                <select className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-cyan-300" value={benchmarkRangeMode} onChange={(event: ChangeEvent<HTMLSelectElement>) => setBenchmarkRangeMode(event.target.value as 'all' | 'custom')}>
                  <option className="bg-slate-950" value="all">ALL records ({allBenchmarkStartDate || '-'} to {allBenchmarkEndDate || '-'})</option>
                  <option className="bg-slate-950" value="custom">Custom date range</option>
                </select>
              </label>
              <label>
                Portfolio starting NAV / funding basis
                <input className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-cyan-300 disabled:opacity-70" type="number" value={benchmarkStartingNav} disabled={downloadedStartingNav !== null} onChange={(event: ChangeEvent<HTMLInputElement>) => setStartingNav(Number(event.target.value))} />
              </label>
              {benchmarkRangeMode === 'custom' && (
                <label>
                  From date
                  <input className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-cyan-300" type="date" value={benchmarkFromDate} min={allBenchmarkStartDate} max={allBenchmarkEndDate} onChange={(event: ChangeEvent<HTMLInputElement>) => setBenchmarkFromDate(event.target.value)} />
                </label>
              )}
              {benchmarkRangeMode === 'custom' && (
                <label>
                  To date
                  <input className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-cyan-300" type="date" value={benchmarkToDate || allBenchmarkEndDate} min={allBenchmarkStartDate} max={allBenchmarkEndDate} onChange={(event: ChangeEvent<HTMLInputElement>) => setBenchmarkToDate(event.target.value)} />
                </label>
              )}
            </div>
            <p className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs leading-5 text-slate-400">
              {downloadedStartingNav !== null ? `Using downloaded IBKR total assets/NAV ${money(downloadedStartingNav)} for ${effectiveBenchmarkStartDate}. Portfolio benchmark return removes deposits/withdrawals inside the selected period.` : 'No downloaded IBKR NAV row found for this period. Add an Equity Summary / Net Asset Value section to the Flex Query, or use the manual starting NAV fallback.'}
            </p>
            <div className="mb-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Investment-period return snapshot</p>
                  <p className="mt-1 text-sm text-slate-400">Since {effectiveBenchmarkStartDate || DEFAULT_BENCHMARK_START_DATE} through {effectiveBenchmarkEndDate || 'latest available date'}</p>
                </div>
                <p className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">Started investing 01-Jul-2025</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {benchmarkSummaryCards.map((card) => (
                  <div key={card.label} className={`rounded-2xl border ${card.border} ${card.background} p-5 shadow-lg shadow-black/10`}>
                    <p className="text-sm font-semibold text-slate-300">{card.label}</p>
                    <p className={`mt-2 text-4xl font-black tracking-tight ${card.color}`}>{card.value === undefined ? 'N/A' : benchmarkPercent(card.value)}</p>
                    <p className="mt-2 text-xs text-slate-400">{card.label === 'Portfolio' && hasActualNavCurve ? 'Cash-flow-adjusted period return' : 'Period return'}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-[26rem]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={ytdBenchmarkData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" ticks={benchmarkMonthTicks} tickFormatter={dateMonthLabel} minTickGap={18} />
                  <YAxis stroke="#94a3b8" tickFormatter={benchmarkPercent} />
                  <Tooltip formatter={(value, name) => [benchmarkPercent(value), name]} contentStyle={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} />
                  <Line type="monotone" dataKey="portfolio" name="Portfolio" stroke="#22d3ee" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="nasdaq" name="NASDAQ" stroke="#a78bfa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="sp500" name="S&P 500" stroke="#34d399" strokeWidth={2} dot={false} />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title="Top Winning Symbols" subtitle="Aggregated by symbol using total realized P/L, not individual execution rows.">
            <div className="mb-4 flex justify-end">
              <button className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-white/[0.1]" type="button" onClick={() => setShowAllWinningSymbols((value) => !value)}>{showAllWinningSymbols ? 'Show top 8' : `Show full list (${winningSymbolRows.length})`}</button>
            </div>
            <SymbolTable rows={(showAllWinningSymbols ? winningSymbolRows : winningSymbolRows.slice(0, 8))} cycles={stats.tradeCycles} showRank />
          </Section>

          <Section title="Top Losing Symbols" subtitle="Aggregated by symbol so split executions do not overstate a single loss.">
            <div className="mb-4 flex justify-end">
              <button className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-white/[0.1]" type="button" onClick={() => setShowAllLosingSymbols((value) => !value)}>{showAllLosingSymbols ? 'Show top 8' : `Show full list (${losingSymbolRows.length})`}</button>
            </div>
            <SymbolTable rows={(showAllLosingSymbols ? losingSymbolRows : losingSymbolRows.slice(0, 8))} cycles={stats.tradeCycles} showRank />
          </Section>

          <Section title="Symbol Leaderboard" subtitle="Largest symbol-level impacts by absolute realized P/L, including cycle win rate and commission drag.">
            <div className="mb-4 flex justify-end">
              <button className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-white/[0.1]" type="button" onClick={() => setShowAllLeaderboard((value) => !value)}>{showAllLeaderboard ? 'Show top 12' : `Show full list (${leaderboardRows.length})`}</button>
            </div>
            <SymbolTable rows={(showAllLeaderboard ? leaderboardRows : leaderboardRows.slice(0, 12))} cycles={stats.tradeCycles} showRank />
          </Section>

          <Section title="Monthly P/L Calendar" subtitle="Default shows the current month. Click a date to review daily realized P/L and trade details.">
            <MonthlyPnlCalendar month={selectedMonth} dailyStats={stats.byDay} trades={stats.trades} onPrevious={() => setSelectedMonth((month) => shiftMonth(month, -1))} onNext={() => setSelectedMonth((month) => shiftMonth(month, 1))} />
          </Section>

          <Section title="Asset Class Realized P/L Contribution" subtitle="Shows realized P/L by asset class. SGOV and IB01 are separated from STOCK so bond/cash-yield trades are shown independently.">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="h-96 lg:h-[24rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={assetClassContributionRows}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={70}
                      outerRadius={120}
                      paddingAngle={4}
                    >
                      {assetClassContributionRows.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value) => [money(Number(value)), 'Realized P/L']} contentStyle={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Asset Class</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-right">%</th>
                      <th className="px-4 py-3 text-right">Fills</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-slate-200">
                    {assetClassContributionRows.map((row) => (
                      <tr key={row.name}>
                        <td className="px-4 py-3 font-semibold text-white"><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ background: row.color }} />{row.name}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${row.value >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(row.value)}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{(row.percent * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right text-slate-400">{row.trades}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Cost & Execution Review" subtitle="Checks whether friction costs and execution behavior are hurting performance.">
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard title="Total Commissions" value={money(stats.totalCommissions)} sub={`${(commissionDragPct * 100).toFixed(3)}% of gross traded value`} icon={TrendingDown} positive={stats.totalCommissions >= 0} detail={<div><p>Compares total transaction costs against the total value you traded, so you can see how much friction your activity carries.</p><p className="mt-2 font-semibold text-white">Gross traded value vs commissions</p><div className="mt-2 overflow-hidden rounded-xl border border-white/10"><table className="w-full text-left text-xs"><tbody className="divide-y divide-white/10"><tr><td className="px-3 py-2 text-slate-400">Total gross traded value</td><td className="px-3 py-2 text-right font-semibold text-white">{money(totalTradeVolume)}</td></tr><tr><td className="px-3 py-2 text-slate-400">Total commissions</td><td className="px-3 py-2 text-right font-semibold text-rose-300">{money(stats.totalCommissions)}</td></tr><tr><td className="px-3 py-2 text-slate-400">Commission drag</td><td className="px-3 py-2 text-right font-semibold text-white">{(commissionDragPct * 100).toFixed(3)}%</td></tr></tbody></table></div><p className="mt-2 font-semibold text-white">Formula</p><p>Gross traded value = sum of buy value (totalIn) + sell value (totalOut) across all symbols. Commission drag = absolute total commissions / gross traded value.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>Lower drag means fewer dollars lost to fees per dollar traded. High drag often signals overtrading or position sizes too small relative to per-trade cost.</p><p className="mt-2">Commissions vs realized P/L: {(commissionToPnlPct * 100).toFixed(2)}%</p></div>} />
              <StatCard title="Commission / Realized P/L" value={`${(commissionToPnlPct * 100).toFixed(1)}%`} sub="Absolute commission divided by absolute realized P/L" icon={BarChart3} positive={commissionToPnlPct <= 0.1} detail={<div><p>Commission / Realized P/L = |total commissions| / |total realized P/L|.</p><p className="mt-2 font-semibold text-white">Past 12 months commission breakdown</p>{commissionMonthlyRows.length ? <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-white/10"><table className="w-full text-left text-xs"><thead className="bg-white/5 text-slate-400"><tr><th className="px-2 py-2">Month</th><th className="px-2 py-2 text-right">Trades</th><th className="px-2 py-2 text-right">Commission (USD)</th><th className="px-2 py-2 text-right">% of 12M Total</th></tr></thead><tbody className="divide-y divide-white/10">{commissionMonthlyRows.map((row) => (<tr key={row.month}><td className="px-2 py-2 font-semibold text-white">{row.label}</td><td className="px-2 py-2 text-right">{row.trades.toLocaleString()}</td><td className={`px-2 py-2 text-right font-semibold ${row.commissions >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(row.commissions)}</td><td className="px-2 py-2 text-right">{percent(row.sharePct)}</td></tr>))}<tr className="bg-white/[0.06]"><td className="px-2 py-2 font-semibold text-white">12M Total</td><td className="px-2 py-2 text-right font-semibold text-white">{commissionMonthlyRows.reduce((total, row) => total + row.trades, 0).toLocaleString()}</td><td className={`px-2 py-2 text-right font-bold ${commission12MonthTotal >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(commission12MonthTotal)}</td><td className="px-2 py-2 text-right font-semibold text-white">100.0%</td></tr></tbody></table></div> : <p className="mt-2 text-slate-400">No monthly commission data available.</p>}<p className="mt-3 text-xs text-slate-400">Shares are computed against the sum of absolute monthly commissions over the displayed window.</p></div>} />
              <StatCard title="Largest Winning Trade Cycle" value={largestWinningCycle ? money(largestWinningCycle.realizedPnl) : '-'} sub={largestWinningCycle ? `${largestWinningCycle.symbol} · ${largestWinningCycle.trades} trades · ${splitTradeDateTime(largestWinningCycle.start).date} – ${splitTradeDateTime(largestWinningCycle.end).date}` : 'No winning cycle'} icon={TrendingUp} positive detail={tradeCycleDetail(largestWinningCycle)} />
              <StatCard title="Largest Losing Trade Cycle" value={largestLosingCycle ? money(largestLosingCycle.realizedPnl) : '-'} sub={largestLosingCycle ? `${largestLosingCycle.symbol} · ${largestLosingCycle.trades} trades · ${splitTradeDateTime(largestLosingCycle.start).date} – ${splitTradeDateTime(largestLosingCycle.end).date}` : 'No losing cycle'} icon={TrendingDown} positive={false} detail={tradeCycleDetail(largestLosingCycle)} />
            </div>
          </Section>
        </div>

        <Section title="Unrealized P/L Note" subtitle="True unrealized P/L is calculated only from open-position data.">
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm leading-7 text-amber-50">
            The dashboard first uses IBKR open-position rows when available. If your file only has Trades, it reconstructs open lots from unmatched buy/sell quantities and marks them using the latest `ClosePrice` in the CSV. This is an inferred unrealized P/L estimate from the report snapshot, not a live market value.
          </div>
        </Section>

      </div>
    </main>
    </DashboardErrorBoundary>
  );
}
