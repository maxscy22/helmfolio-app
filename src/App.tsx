import { Component, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ChangeEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Award, BarChart3, BookOpen, Eye, EyeOff, LineChart, Lock, Play, Settings, ShieldAlert, ShieldCheck, Target, TrendingDown, TrendingUp, Upload, WalletCards, X } from 'lucide-react';
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
import { buildDemoData, DEMO_STARTING_NAV } from './lib/demoData';
import { APP_NAME, APP_SUPPORT_EMAIL, APP_TAGLINE, DASHBOARD_VERSION } from './appMetadata';
import { parseIbkrCsv } from './csvImport';
import { StatCard } from './components/StatCard';
import { MonthlyPnlCalendar } from './components/MonthlyPnlCalendar';
import { SettingsModal } from './components/SettingsModal';
import { SymbolTable } from './components/SymbolTable';
import {
  cashFlowByCurveDate,
  cashTransactionAmountInBase,
  cashTransactionDate,
  cashTransactionNetFlowRowsFromRows,
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
  navOpenValueForDate,
  navValueForDate,
  numberFromRaw,
  rawDateKey,
  sortedNavCurveFromRows,
  valueByAliases,
} from './lib/cashFlow';
import { money, priceMoney, percent, benchmarkPercent, dateMonthLabel, compactDateLabel, daysBetween } from './lib/formatters';
import { apiFetch, dashboardStorage, exportDashboardDataFile, hasSecureCredentialStore, importDashboardDataFile, revealDataFolder, revealIbkrCredentials } from './lib/api';
import { activateLicense, deactivateLicense, loadLicenseState, renewLicenseIfNeeded, type LicenseState } from './lib/license';
import { isProEntitled, licenseSummary } from './lib/featureGate';
import { LicenseModal } from './components/LicenseModal';
import { LegalModal } from './components/LegalModal';
import { LEGAL_INFO, type LegalDocId } from './lib/legalConfig';
import { exportElementToPdf } from './lib/exportPdf';
import { LockedValue, LockedOverlay, ProHint } from './components/Locked';
import {
  AAII_HISTORY_LIMIT,
  AAII_MANUAL_KEY,
  type AaiiSentimentRow,
  type BrowserStorageUsage,
  cashDedupKey,
  cleanSavedImportStatus,
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
import type { DashboardStats, DailyStats, MonthlyStats, Position, RawCash, RawNav, RawPosition, RawTrade, SymbolStats, Trade, TradeCycle } from './types';
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

const safeMoney = (value: number, privacyMode: boolean) => {
  if (privacyMode) return '****';
  return money(value);
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

// Figure-level paywall: section titles/subtitles stay visible to entice unpaid
// users; only the critical FIGURES inside are blurred via LockedValue /
// LockedOverlay (see components/Locked.tsx). Pass `hint` to render a single
// subtle "Activate Pro" link in the header. This is UX pressure only — real
// enforcement stays in the backend requireLicense middleware.
function Section({ title, subtitle, children, id, hint = false, onUnlock }: { title: string; subtitle: string; children: ReactNode; id?: string; hint?: boolean; onUnlock?: () => void }) {
  const anchorId = id ?? sectionSlug(title);
  return (
    <section id={anchorId} className="scroll-mt-24 rounded-3xl border border-white/10 bg-[var(--dashboard-section)] p-6 shadow-2xl shadow-black/20">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
        {hint && <ProHint onUnlock={onUnlock} className="mt-1" />}
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
    <nav data-pdf-hide className="sticky top-0 z-30 -mx-4 mb-2 border-b border-white/10 bg-[var(--dashboard-panel)]/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto flex max-w-[96rem] gap-2 overflow-x-auto pb-1 text-sm">
        {stickyNavLinks.map((link) => (
          <a key={link.href} href={link.href} className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-semibold text-slate-200 transition hover:bg-white/[0.12] hover:text-white">{link.label}</a>
        ))}
      </div>
    </nav>
  );
}


function TradeTable({ trades, isPrivacyMode }: { trades: Trade[]; isPrivacyMode: boolean }) {
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
              <td className={`px-4 py-3 text-right font-semibold ${trade.realizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{safeMoney(trade.realizedPnl, isPrivacyMode)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TradeCycleTable({ rows, isPrivacyMode }: { rows: TradeCycle[]; isPrivacyMode: boolean }) {
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
              <td className="px-4 py-3 text-right">{safeMoney(row.totalIn, isPrivacyMode)}</td>
              <td className="px-4 py-3 text-right">{safeMoney(row.totalOut, isPrivacyMode)}</td>
              <td className={`px-4 py-3 font-semibold ${row.result === 'WIN' ? 'text-emerald-300' : row.result === 'LOSS' ? 'text-rose-300' : 'text-slate-300'}`}>{row.result}</td>
              <td className={`px-4 py-3 text-right font-semibold ${row.realizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{safeMoney(row.realizedPnl, isPrivacyMode)}</td>
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
  const [startingNav, setStartingNav] = useState(() => persistedSettings.manualStartingNav ?? persistedData?.initialFunding ?? DEFAULT_INITIAL_FUNDING);
  // When false, the starting NAV / funding basis auto-derives from the downloaded
  // NAV on the benchmark From-date. When true, the user's manual value wins.
  const [useManualStartingNav, setUseManualStartingNav] = useState(() => persistedSettings.useManualStartingNav);
  // Whether the auto funding basis uses the From-date's opening NAV (prior-day
  // close) or that day's closing NAV.
  const [startingNavBasis, setStartingNavBasis] = useState<'open' | 'close'>(() => persistedSettings.startingNavBasis);
  const [initialFunding, setInitialFunding] = useState(() => persistedData?.initialFunding ?? DEFAULT_INITIAL_FUNDING);
  const [benchmarkRangeMode, setBenchmarkRangeMode] = useState<'all' | 'portfolio' | 'custom'>(() => persistedSettings.benchmarkRangeMode);
  const [benchmarkFromDate, setBenchmarkFromDate] = useState(() => persistedSettings.benchmarkFromDate);
  const [benchmarkToDate, setBenchmarkToDate] = useState(() => persistedSettings.benchmarkToDate);
  const [portfolioStartDate, setPortfolioStartDate] = useState<string>(() => persistedSettings.portfolioStartDate ?? '');
  // Period selectors for the Monthly / Weekly Change-in-NAV bar charts (view-only, not persisted).
  const [monthlyTrendRange, setMonthlyTrendRange] = useState<12 | 24 | 'all'>(12);
  const [weeklyTrendRange, setWeeklyTrendRange] = useState<12 | 26 | 'all'>(12);
  const [cashTrendRange, setCashTrendRange] = useState<12 | 24 | 'all'>(12);
  const [showAllWinningSymbols, setShowAllWinningSymbols] = useState(false);
  const [showAllLosingSymbols, setShowAllLosingSymbols] = useState(false);
  const [showAllLeaderboard, setShowAllLeaderboard] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [importStatus, setImportStatus] = useState(() => persistedData ? `${cleanSavedImportStatus(persistedData.importStatus)} Restored from your ${hasSecureCredentialStore() ? 'saved app data' : "browser's saved data"} at ${new Date(persistedData.savedAt).toLocaleString()}.` : '');
  const [syncDiff, setSyncDiff] = useState<SyncDiff | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [importProgressMessage, setImportProgressMessage] = useState('');
  const [isCsvImporting, setIsCsvImporting] = useState(false);
  const [themeId, setThemeId] = useState<string>(() => persistedSettings.themeId ?? 'command');
  const [portraitDataUrl, setPortraitDataUrl] = useState<string>(() => persistedSettings.portraitDataUrl ?? '');
  const [displayName, setDisplayName] = useState<string>(() => persistedSettings.displayName ?? '');
  const [showSettings, setShowSettings] = useState(false);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [licenseState, setLicenseState] = useState<LicenseState>({ status: 'none', tier: 'free' });
  const [showLicense, setShowLicense] = useState(false);
  // Controls the top-of-dashboard banner that proactively tells a paying user
  // their Pro access just dropped (the term lapsed, or the offline grace window
  // expired). Without this, the downgrade to Free is completely silent.
  const [licenseNoticeDismissed, setLicenseNoticeDismissed] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const dashboardRef = useRef<HTMLElement>(null);
  // Latest license state, kept in a ref so the window 'online' listener always
  // re-validates against the current state without re-subscribing.
  const licenseStateRef = useRef<LicenseState>(licenseState);
  licenseStateRef.current = licenseState;
  const isPro = isProEntitled(licenseState);
  // DEV-ONLY: in `npm run dev` the browser is treated as Pro, so locked figures
  // never show. This toggle forces the free-tier (locked) look so both visual
  // states can be reviewed side-by-side. It is compiled out of production builds.
  const [forceLockPreview, setForceLockPreview] = useState(false);
  const lockFigures = !isPro || (import.meta.env.DEV && forceLockPreview);
  const openPaywall = () => setShowLicense(true);
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
  // In Demo mode we swap the real, sensitive data for a single deterministic,
  // internally-consistent fake dataset and feed it through the exact same
  // analytics pipeline. This guarantees every figure (unrealized P/L, largest
  // exposure, account value, equity curve, win rate, cash insights...) reconciles
  // with the fake portfolio, while the real NASDAQ / S&P 500 benchmarks are kept.
  const demoData = useMemo(
    () => (isDemoMode ? buildDemoData(benchmarks.nasdaq.map((point) => point.date)) : null),
    [isDemoMode, benchmarks.nasdaq],
  );
  // Paid (activated) users work with their real account, so Demo mode and its
  // button are hidden for them. Defensively exit demo if a free user activates
  // while previewing it, so they are never left stuck on the sample dataset.
  useEffect(() => {
    if (licenseState.status === 'active' && isDemoMode) setIsDemoMode(false);
  }, [licenseState.status, isDemoMode]);
  const sourceRows = demoData ? demoData.rows : rows;
  const sourcePositions = demoData ? demoData.positions : positions;
  const sourceNavRows = demoData ? demoData.navRows : navRows;
  const sourceCashRows = demoData ? demoData.cashRows : cashRows;
  // Mask personal identity in demo mode so screenshots never leak the real owner.
  const effectiveDisplayName = isDemoMode ? 'Alex Carter' : displayName;
  const effectivePortraitDataUrl = isDemoMode ? '' : portraitDataUrl;
  const stats: DashboardStats = useMemo(() => {
    const calculated = calculateDashboardStats(sourceRows, sourcePositions);
    return {
      ...calculated,
      benchmark: [
        { name: 'Your portfolio', returnPct: 0 },
        { name: 'NASDAQ', returnPct: benchmarks.nasdaq[benchmarks.nasdaq.length - 1]?.returnPct ?? 0 },
        { name: 'S&P 500', returnPct: benchmarks.sp500[benchmarks.sp500.length - 1]?.returnPct ?? 0 },
      ],
    };
  }, [sourceRows, sourcePositions, benchmarks]);
  // In demo mode the sync-status log describes the demo dataset (and matches the
  // 9 demo positions) instead of leaking the real IBKR sync message.
  const effectiveImportStatus = isDemoMode
    ? `Demo data active — open positions snapshot replaced with ${stats.positionsCount} current positions; ${sourceRows.length.toLocaleString()} sample trades, ${sourceNavRows.length.toLocaleString()} NAV snapshots and ${sourceCashRows.length.toLocaleString()} cash transactions loaded. No real IBKR account is connected.`
    : importStatus;
  const navCurve = useMemo(() => sortedNavCurveFromRows(sourceNavRows), [sourceNavRows]);
  const hasActualNavCurve = useMemo(() => navCurve.length >= 2, [navCurve]);

  const allBenchmarkStartDate = (hasActualNavCurve ? navCurve[0]?.date : stats.portfolioCurve[0]?.date) ?? '';
  // Master "portfolio start date": the user's manual override, or auto = earliest
  // imported data date. Anchors returns, risk metrics, the equity/database window,
  // and the benchmark window unless a custom benchmark range overrides it.
  const effectivePortfolioStartDate = portfolioStartDate || allBenchmarkStartDate;
  const navCurveLastDate = navCurve[navCurve.length - 1]?.date ?? '';
  const portfolioCurveLastDate = stats.portfolioCurve[stats.portfolioCurve.length - 1]?.date ?? '';
  const allBenchmarkEndDate = [navCurveLastDate, portfolioCurveLastDate].filter(Boolean).sort().pop() ?? '';
  const effectiveBenchmarkStartDate = benchmarkRangeMode === 'custom'
    ? (benchmarkFromDate || effectivePortfolioStartDate)
    : benchmarkRangeMode === 'portfolio'
      ? effectivePortfolioStartDate
      : allBenchmarkStartDate;
  const effectiveBenchmarkEndDate = benchmarkRangeMode === 'custom' && benchmarkToDate ? benchmarkToDate : allBenchmarkEndDate;
  // Downloaded NAV on the benchmark From-date — either the opening NAV (close of
  // the prior NAV day / earliest row's funding StartingValue) or that day's
  // closing NAV, depending on the chosen basis. This is the default funding basis.
  const downloadedStartingNav = useMemo(() => {
    if (!effectiveBenchmarkStartDate) return null;
    const raw = startingNavBasis === 'close'
      ? navValueForDate(sourceNavRows, effectiveBenchmarkStartDate)
      : navOpenValueForDate(sourceNavRows, effectiveBenchmarkStartDate);
    return raw === null ? null : Number(raw.toFixed(2));
  }, [effectiveBenchmarkStartDate, sourceNavRows, startingNavBasis]);
  // Closing NAV on the portfolio start date (after any funding that day), used to
  // display the locked "Initial funding assumption". Updates live with the date.
  const portfolioStartNav = useMemo(() => {
    if (!effectivePortfolioStartDate) return null;
    const raw = navValueForDate(sourceNavRows, effectivePortfolioStartDate);
    return raw === null ? null : Number(raw.toFixed(2));
  }, [effectivePortfolioStartDate, sourceNavRows]);
  const autoStartingNav = downloadedStartingNav ?? startingNav;
  // Manual override always wins when the user enables it; otherwise auto-derive.
  const benchmarkStartingNav = useManualStartingNav ? startingNav : autoStartingNav;
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
      dashboardStorage.setItem(STORAGE_KEY, JSON.stringify({
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
    dashboardStorage.setItem(SETTINGS_KEY, JSON.stringify({
      themeId,
      portraitDataUrl,
      displayName,
      benchmarkRangeMode,
      benchmarkFromDate,
      benchmarkToDate,
      startingNavBasis,
      useManualStartingNav,
      manualStartingNav: startingNav,
      portfolioStartDate,
    }));
  }, [themeId, portraitDataUrl, displayName, benchmarkRangeMode, benchmarkFromDate, benchmarkToDate, startingNavBasis, useManualStartingNav, startingNav, portfolioStartDate]);

  useEffect(() => {
    dashboardStorage.setItem(AAII_MANUAL_KEY, JSON.stringify(aaiiManualRows));
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

  // Load the license token, prime apiFetch, and silently renew when near expiry.
  // Also re-validate the moment the network returns so an 'expired' token (whose
  // offline grace lapsed while offline) recovers to Pro automatically — or flips
  // to the explicit 'lapsed' state if the license term has genuinely ended.
  useEffect(() => {
    let cancelled = false;
    const applyRenewal = async (state: LicenseState) => {
      const renewed = await renewLicenseIfNeeded(state);
      if (!cancelled && renewed) setLicenseState(renewed);
    };
    loadLicenseState().then(async (state) => {
      if (cancelled) return;
      setLicenseState(state);
      await applyRenewal(state);
    });
    const handleOnline = () => { void applyRenewal(licenseStateRef.current); };
    window.addEventListener('online', handleOnline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Re-arm the lapse/expiry banner each time the license drops out of Pro
  // (term lapsed, or offline grace expired) so a previously-dismissed notice
  // reappears on a fresh downgrade, but stays dismissed within the same state.
  useEffect(() => {
    if (licenseState.status === 'lapsed' || licenseState.status === 'expired') {
      setLicenseNoticeDismissed(false);
    }
  }, [licenseState.status]);

  useEffect(() => {
    if (!isPro) {
      setBenchmarkStatus('Benchmarks are a Pro feature. Activate a license to unlock them.');
      return;
    }
    const loadBenchmarks = async () => {
      try {
        const params = new URLSearchParams();
        if (effectiveBenchmarkStartDate) params.set('start', effectiveBenchmarkStartDate);
        if (effectiveBenchmarkEndDate) params.set('end', effectiveBenchmarkEndDate);
        const response = await apiFetch(`/api/benchmarks/ytd?${params.toString()}`);
        const payload = await response.json();
        if (response.status === 402) {
          setLicenseState((current) => ({ ...current, tier: 'free', status: current.status === 'active' ? 'expired' : current.status }));
          setBenchmarkStatus('Benchmarks are a Pro feature. Activate a license to unlock them.');
          return;
        }
        if (!response.ok) throw new Error(payload.error ?? 'Failed to load Yahoo Finance benchmarks.');
        setBenchmarks(payload.benchmarks);
        setBenchmarkStatus(`Yahoo Finance benchmarks loaded for ${payload.startDate ?? 'YTD start'} to ${payload.endDate ?? 'today'}.`);
      } catch (error) {
        setBenchmarkStatus(error instanceof Error ? error.message : 'Failed to load Yahoo Finance benchmarks.');
      }
    };
    loadBenchmarks();
  }, [effectiveBenchmarkStartDate, effectiveBenchmarkEndDate, isPro]);

  useEffect(() => {
    // Market sentiment (VIX, Fear & Greed, AAII) is free, public macro data — it
    // is a free engagement hook, not a paywalled feature.
    const loadMarketReference = async () => {
      try {
        // No forced refresh: the backend serves its durable cache and only hits
        // AAII when a new weekly release is due (Thursdays), avoiding the frequent
        // requests that trip AAII's bot-protection and force a stale snapshot.
        const response = await apiFetch('/api/reference/market');
        // Market sentiment is a FREE, ungated endpoint, so no 402 handling is
        // needed here. Guard JSON parsing anyway in case a transient error
        // returns an empty body (avoids a raw "Unexpected end of JSON input").
        const payload = await response.json().catch(() => ({} as MarketReferenceData & { error?: string }));
        if (!response.ok) throw new Error(payload.error ?? 'Failed to load market reference data.');
        setMarketReference(payload);
        const loaded = [
          payload.vix?.data ? 'VIX' : null,
          payload.fearGreed?.data ? 'CNN Fear & Greed' : null,
          payload.aaii?.data ? 'AAII Sentiment' : null,
        ].filter(Boolean).join(', ');
        setMarketReferenceStatus(loaded ? `${loaded} loaded at ${new Date(payload.importedAt).toLocaleString()}.` : 'Market reference data is temporarily unavailable.');
      } catch (error) {
        console.error('Market reference load failed:', error);
        setMarketReferenceStatus('Market sentiment data is temporarily unavailable. Please try again later.');
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
    link.download = `${APP_NAME}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Capture the entire rendered dashboard to a PDF (a true screenshot of the
  // whole page), rather than a hand-built summary report.
  const exportDashboardPdf = async () => {
    if (lockFigures) { openPaywall(); return; }
    const element = dashboardRef.current;
    if (!element) return;
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    setImportStatus('Capturing dashboard to PDF...');
    try {
      const fileName = `stock-dashboard-for-ibkr-${new Date().toISOString().slice(0, 10)}.pdf`;
      const result = await exportElementToPdf(element, fileName);
      setImportStatus(result.ok ? 'Dashboard exported to PDF.' : (result.error ?? 'PDF export failed.'));
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Export the full dataset. In the desktop app this opens a native save dialog
  // and writes the electron-store data to JSON; in the browser it downloads a Blob.
  const handleExportData = async () => {
    const result = await exportDashboardDataFile();
    if (result === null) {
      exportDashboardData();
      return;
    }
    if (result.ok) setImportStatus(`Dashboard data exported to ${result.path}.`);
    else if (!result.canceled) setImportStatus(result.error ?? 'Export failed.');
  };

  // Desktop-only native import: pick a JSON backup, write it into the durable
  // store, then reload so the dashboard re-reads the imported data.
  const handleImportDataDesktop = async () => {
    const result = await importDashboardDataFile();
    if (result === null) return;
    if (result.ok) {
      setImportStatus('Dashboard data imported. Reloading...');
      window.location.reload();
    } else if (!result.canceled) {
      setImportStatus(result.error ?? 'Import failed.');
    }
  };

  const importFromIbkr = async () => {
    // IBKR sync is a Pro feature — prompt for a license instead of hitting the API.
    if (!isPro) {
      setShowLicense(true);
      return;
    }
    setIsImporting(true);
    setImportProgress(5);
    setImportProgressMessage('Starting secure backend sync...');
    setImportStatus('Requesting IBKR Flex statement from secure backend...');
    try {
      // In the desktop app, pull the OS-encrypted credentials and pass them per
      // request. In browser dev, this is null and the backend falls back to .env.
      const credentials = await revealIbkrCredentials();
      const response = await apiFetch('/api/ibkr/flex/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials ?? {}),
      });
      if (response.status === 402) {
        setLicenseState((current) => ({ ...current, tier: 'free', status: current.status === 'active' ? 'expired' : current.status }));
        setShowLicense(true);
        throw new Error('IBKR sync requires an active Pro license.');
      }
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
              <tr><td className="px-2 py-2 text-slate-400">Avg Buy / Sell Price</td><td className="px-2 py-2 text-white">{safeMoney(cycle.averageBuyPrice, isPrivacyMode)} / {safeMoney(cycle.averageSellPrice, isPrivacyMode)}</td></tr>
              <tr><td className="px-2 py-2 text-slate-400">Total In / Out</td><td className="px-2 py-2 text-white">{safeMoney(cycle.totalIn, isPrivacyMode)} / {safeMoney(cycle.totalOut, isPrivacyMode)}</td></tr>
              <tr><td className="px-2 py-2 text-slate-400">Commissions</td><td className={`px-2 py-2 font-semibold ${cycle.commissions >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{safeMoney(cycle.commissions, isPrivacyMode)}</td></tr>
              <tr><td className="px-2 py-2 text-slate-400">Realized P/L</td><td className={`px-2 py-2 font-bold ${cycle.realizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{safeMoney(cycle.realizedPnl, isPrivacyMode)} ({percent(grossPct)} of capital deployed)</td></tr>
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
  const positionSummary = useMemo(() => stats.positions.map((position) => `${position.symbol}: ${safeMoney(position.unrealizedPnl, isPrivacyMode)}`).join(' · '), [stats.positions, isPrivacyMode]);
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
  const navBenchmarkBase = useMemo(() => effectiveBenchmarkStartDate ? navValueForDate(sourceNavRows, effectiveBenchmarkStartDate) : navCurve[0]?.value ?? null, [effectiveBenchmarkStartDate, sourceNavRows, navCurve]);
  // Cash-flow adjustment source for RETURN/RISK metrics: BOTH deposits and
  // withdrawals, so a mid-period deposit is neutralized (not mistaken for a gain)
  // just like a withdrawal. Initial funding / pre-baseline flows are excluded
  // downstream (risk uses the period equity curve; benchmark filters > start date).
  const cashTransactionNetFlowRows = useMemo(() => cashTransactionNetFlowRowsFromRows(sourceCashRows), [sourceCashRows]);
  const navCashFlowRows = useMemo(() => cashTransactionNetFlowRows.length ? cashTransactionNetFlowRows : navCashFlowRowsFromRows(sourceNavRows), [cashTransactionNetFlowRows, sourceNavRows]);
  const curveCashFlowByDate = useMemo(() => cashFlowByCurveDate(navCashFlowRows, navCurve.map((point) => point.date)), [navCashFlowRows, navCurve]);
  const benchmarkCashFlowByDate = useMemo(() => cashFlowByCurveDate(
    navCashFlowRows.filter((row) => (!effectiveBenchmarkStartDate || row.date > effectiveBenchmarkStartDate) && (!effectiveBenchmarkEndDate || row.date <= effectiveBenchmarkEndDate)),
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
  // Equity Curve shows the FULL accumulated history (earliest data → latest),
  // intentionally decoupled from the benchmark From-date so the long-term curve
  // keeps growing regardless of the selected benchmark comparison period.
  const equityCurveData = useMemo(() => {
    return hasActualNavCurve ? navCurve.map((point) => ({
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
  }, [hasActualNavCurve, navCurve, curveCashFlowByDate, stats.portfolioCurve, riskStartingNav]);
  // The chart shows the curve from the portfolio start date onward (blank => earliest data).
  const displayedEquityCurveData = useMemo(() => equityCurveData.filter((point) => !effectivePortfolioStartDate || point.date >= effectivePortfolioStartDate), [equityCurveData, effectivePortfolioStartDate]);
  const riskStartDate = useMemo(() => effectiveBenchmarkStartDate && effectivePortfolioStartDate && effectiveBenchmarkStartDate > effectivePortfolioStartDate ? effectiveBenchmarkStartDate : effectivePortfolioStartDate, [effectiveBenchmarkStartDate, effectivePortfolioStartDate]);
  const riskEquityCurveData = useMemo(() => equityCurveData.filter((point) => (!riskStartDate || point.date >= riskStartDate) && (!effectiveBenchmarkEndDate || point.date <= effectiveBenchmarkEndDate)), [equityCurveData, riskStartDate, effectiveBenchmarkEndDate]);
  const equityMonthTicks = useMemo(() => displayedEquityCurveData.reduce<string[]>((ticks, point) => {
    const monthKey = point.date.slice(0, 7);
    const previousTick = ticks[ticks.length - 1];
    if (!previousTick || previousTick.slice(0, 7) !== monthKey) ticks.push(point.date);
    return ticks;
  }, []), [displayedEquityCurveData]);
  const trendPnlLabel = useMemo(() => {
    return hasActualNavCurve ? 'Change in NAV' : 'Realized P/L';
  }, [hasActualNavCurve]);
  // Full monthly series (oldest -> newest); the visible window is sliced below by monthlyTrendRange.
  const monthlyPnlChartDataFull = useMemo(() => {
    return hasActualNavCurve ? Array.from(navCurve.reduce((monthlyMap, row) => {
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
    }));
  }, [hasActualNavCurve, navCurve, stats.byMonth]);
  const monthlyPnlChartData = useMemo(() => monthlyTrendRange === 'all' ? monthlyPnlChartDataFull : monthlyPnlChartDataFull.slice(-monthlyTrendRange), [monthlyPnlChartDataFull, monthlyTrendRange]);
  const weeklyTrendSource = useMemo(() => {
    return hasActualNavCurve ? navCurve.map((row) => ({ date: row.date, value: row.change })) : stats.byDay.map((row) => ({ date: row.date, value: row.realizedPnl }));
  }, [hasActualNavCurve, navCurve, stats.byDay]);
  // Full weekly series (oldest -> newest); the visible window is sliced below by weeklyTrendRange.
  const weeklyPnlChartDataFull = useMemo(() => Array.from(weeklyTrendSource.reduce((weeklyMap, row) => {
    const key = weekStartKey(row.date);
    weeklyMap.set(key, (weeklyMap.get(key) ?? 0) + row.value);
    return weeklyMap;
  }, new Map<string, number>()).entries()).sort(([a], [b]) => a.localeCompare(b)).map(([week, realizedPnl]) => ({ week, label: `Wk ${week.slice(5)}`, realizedPnl })), [weeklyTrendSource]);
  const weeklyPnlChartData = useMemo(() => weeklyTrendRange === 'all' ? weeklyPnlChartDataFull : weeklyPnlChartDataFull.slice(-weeklyTrendRange), [weeklyPnlChartDataFull, weeklyTrendRange]);
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
  const latestCashDate = useMemo(() => sourceCashRows.map((row) => cashTransactionDate(row)).filter(Boolean).sort().pop() ?? '', [sourceCashRows]);
  const latestDatabaseEndDate = [databaseDateRange.to, navCurveLastDate, latestCashDate].filter(Boolean).sort().pop() ?? '';
  const displayedDatabaseFrom = databaseDateRange.from && effectivePortfolioStartDate && databaseDateRange.from < effectivePortfolioStartDate ? effectivePortfolioStartDate : databaseDateRange.from;
  const databaseDays = calendarDaysInclusive(displayedDatabaseFrom, latestDatabaseEndDate);
  const databaseRangeLabel = displayedDatabaseFrom && latestDatabaseEndDate ? `${displayedDatabaseFrom} – ${latestDatabaseEndDate}` : 'No trade dates loaded';
  const reviewPeriodLabel = databaseDays ? `${databaseRangeLabel} · ${databaseDays.toLocaleString()} days` : databaseRangeLabel;
  const latestDownloadedNav = latestNavValue(sourceNavRows);
  const curveStartDate = effectivePortfolioStartDate;
  const firstDownloadedNav = navCurve.find((point) => point.date >= curveStartDate) ?? null;
  const navReturnPct = firstDownloadedNav && latestDownloadedNav ? latestDownloadedNav.value / firstDownloadedNav.value - 1 : null;
  const downloadedCashFlow = cumulativeCashTransactionFlow(sourceCashRows) ?? cumulativeNavCashFlow(sourceNavRows);
  const estimatedNavFromPositions = navEstimateFromPositions(stats.positions);
  const currentAccountValue = useMemo(() => {
    return latestDownloadedNav?.value ?? estimatedNavFromPositions;
  }, [latestDownloadedNav, estimatedNavFromPositions]);
  const currentAccountValueSource = useMemo(() => {
    return latestDownloadedNav ? `Downloaded NAV row ${latestDownloadedNav.date}` : estimatedNavFromPositions ? 'Estimated from open positions % NAV' : 'No NAV estimate available';
  }, [latestDownloadedNav, estimatedNavFromPositions]);
  const signedOpenPositionValue = stats.positions.reduce((total, position) => total + position.value, 0);
  const estimatedResidualValue = currentAccountValue !== null && currentAccountValue !== undefined ? currentAccountValue - signedOpenPositionValue : null;
  const navCashBalance = useMemo(() => latestNavCashBalance(sourceNavRows), [sourceNavRows]);
  const cashBalanceValue = useMemo(() => {
    return navCashBalance?.value ?? estimatedResidualValue;
  }, [navCashBalance, estimatedResidualValue]);
  const cashBalanceSource = useMemo(() => {
    return navCashBalance ? `IBKR NAV cash field · ${navCashBalance.date}` : estimatedResidualValue !== null ? 'Estimated as NAV − open positions value' : 'No cash balance available';
  }, [navCashBalance, estimatedResidualValue]);
  const openPortfolioRows: Position[] = useMemo(() => {
    return [...stats.positions].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }, [stats.positions]);
  const openPortfolioTotalValue = currentAccountValue ?? totalPositionValue;
  const cashFlowValue = useMemo(() => {
    return downloadedCashFlow?.value ?? null;
  }, [downloadedCashFlow]);
  const cashFlowSource = useMemo(() => {
    return downloadedCashFlow ? `${downloadedCashFlow.rows.length} dated Cash Transactions withdrawal rows through ${downloadedCashFlow.date}` : 'No IBKR Cash Transactions withdrawal rows available';
  }, [downloadedCashFlow]);
  const cashFlowDetailRows = useMemo(() => cashTransactionWithdrawalDetailRows(sourceCashRows), [sourceCashRows]);
  const withholdingRefundRows = useMemo(() => withholdingTaxRefundDetailRows(sourceCashRows, 12), [sourceCashRows]);
  const riskCashFlowNote = downloadedCashFlow ? `Cash-flow adjusted using ${downloadedCashFlow.rows.length} dated withdrawal rows from Cash Transactions.` : 'No dated cash-flow rows are available for cash-flow-adjusted risk metrics.';
  const cashInsights = useMemo(() => cashTransactionInsights(sourceCashRows), [sourceCashRows]);
  // Visible window for the Monthly Cash Income & Drag chart (full series sliced by cashTrendRange).
  const cashMonthlyChartData = useMemo(() => cashTrendRange === 'all' ? cashInsights.monthlyRows : cashInsights.monthlyRows.slice(-cashTrendRange), [cashInsights.monthlyRows, cashTrendRange]);
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
    dashboardStorage.removeItem(STORAGE_KEY);
    setRows([]);
    setPositions([]);
    setNavRows([]);
    setCashRows([]);
    setDataSource('empty');
    setStartingNav(DEFAULT_INITIAL_FUNDING);
    setInitialFunding(DEFAULT_INITIAL_FUNDING);
    setImportStatus('Dashboard data cleared. Import a CSV, JSON backup, or IBKR Flex data to start again.');
    setShowSettings(false);
  };

  const handleActivateLicense = async (key: string) => {
    const result = await activateLicense(key);
    setLicenseState(result);
    return result;
  };

  const handleDeactivateLicense = async () => {
    const result = await deactivateLicense(licenseState);
    setLicenseState(result);
  };

  return (
    <DashboardErrorBoundary>
      <main ref={dashboardRef} className={`min-h-screen px-4 py-6 sm:px-6 lg:px-8 ${activeTheme.className}`} style={{ ...activeTheme.style, background: 'var(--dashboard-bg)' }}>
      <div className="mx-auto max-w-[96rem] space-y-8">
        <LicenseModal
          open={showLicense}
          state={licenseState}
          onActivate={handleActivateLicense}
          onDeactivate={handleDeactivateLicense}
          onClose={() => setShowLicense(false)}
        />
        <LegalModal
          open={legalDoc !== null}
          initialDoc={legalDoc ?? 'disclaimer'}
          onClose={() => setLegalDoc(null)}
        />
        {import.meta.env.DEV && (
          <button
            type="button"
            data-pdf-hide
            onClick={() => setForceLockPreview((value) => !value)}
            title="DEV ONLY: toggle the free-tier (locked figures) preview. Not included in production builds."
            className={`fixed bottom-4 right-4 z-[9997] inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold shadow-2xl shadow-black/40 transition ${forceLockPreview ? 'border-amber-300/40 bg-amber-300/20 text-amber-100 hover:bg-amber-300/30' : 'border-emerald-300/40 bg-emerald-300/15 text-emerald-100 hover:bg-emerald-300/25'}`}
          >
            {forceLockPreview ? 'DEV: Free view (locked) — click for Pro' : 'DEV: Pro view (unlocked) — click for Free'}
          </button>
        )}
        <SettingsModal
          open={showSettings}
          themeId={themeId}
          portraitDataUrl={portraitDataUrl}
          displayName={displayName}
          dashboardVersion={DASHBOARD_VERSION}
          changelog={changelogText}
          storageUsage={storageUsage}
          onRefreshStorageUsage={refreshStorageUsage}
          onOpenDataFolder={() => { void revealDataFolder(); }}
          onClearData={clearDashboardData}
          onOpenLegal={(doc) => setLegalDoc(doc)}
          onCancel={() => setShowSettings(false)}
          onSave={(settings) => {
            setThemeId(settings.themeId);
            setPortraitDataUrl(settings.portraitDataUrl);
            setDisplayName(settings.displayName);
            setShowSettings(false);
          }}
        />
        {(licenseState.status === 'lapsed' || licenseState.status === 'expired') && !licenseNoticeDismissed && (
          <div data-pdf-hide className="flex items-start gap-4 rounded-[1.5rem] border border-amber-300/30 bg-amber-400/10 px-5 py-4 shadow-xl shadow-amber-950/10">
            <ShieldAlert size={22} className="mt-0.5 shrink-0 text-amber-300" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-amber-100">
                {licenseState.status === 'lapsed' ? 'Your Pro license has ended' : 'Pro features are paused'}
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-50/85">{licenseSummary(licenseState)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="rounded-2xl bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-200"
                onClick={() => setShowLicense(true)}
              >
                {licenseState.status === 'lapsed' ? 'Renew Pro' : 'View license'}
              </button>
              <button
                type="button"
                aria-label="Dismiss"
                className="rounded-xl border border-amber-200/20 p-2 text-amber-100 transition hover:bg-amber-200/10"
                onClick={() => setLicenseNoticeDismissed(true)}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--dashboard-panel)] shadow-2xl shadow-black/30 backdrop-blur">
          <div className="grid gap-0 lg:grid-cols-[1fr_25rem]">
            <div className="p-7 sm:p-9">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-sm font-medium text-cyan-200">
                <ShieldCheck size={16} /> IBKR 365-day trade review
                </div>
                <div className="flex items-center gap-2">
                  {licenseState.status !== 'active' && (
                    <button className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.1]" type="button" onClick={() => setIsDemoMode(!isDemoMode)} title={isDemoMode ? 'Show real data' : 'Show demo data'}>
                      {isDemoMode ? <EyeOff size={17} /> : <Play size={17} />}
                      {isDemoMode ? 'Real Data' : 'Demo'}
                    </button>
                  )}
                  <button className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.1]" type="button" onClick={() => setIsPrivacyMode(!isPrivacyMode)} title={isPrivacyMode ? 'Show all figures' : 'Hide money figures for screenshots'}>
                    {isPrivacyMode ? <EyeOff size={17} /> : <Eye size={17} />}
                    {isPrivacyMode ? 'Unhide' : 'Privacy'}
                  </button>
                  <button
                    className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${isPro ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/20' : 'border-amber-300/30 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20'}`}
                    type="button"
                    onClick={() => setShowLicense(true)}
                  >
                    <ShieldCheck size={17} />
                    {isPro ? 'Pro' : 'Activate Pro'}
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.1]" type="button" onClick={() => setShowSettings(true)}>
                    <Settings size={17} />
                    Settings
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white md:text-6xl">{APP_NAME}</h1>
                  <p className="mt-3 max-w-3xl text-lg font-semibold text-cyan-200/90">{APP_TAGLINE}</p>
                  {effectiveDisplayName && <p className="mt-4 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">Welcome back, {effectiveDisplayName}</p>}
                  <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">A structured IBKR review dashboard for realized P/L, payoff ratio, profit factor, winners and losers, symbol concentration, monthly consistency, costs, and benchmark comparison.</p>
                </div>
                <div className="h-36 w-36 shrink-0 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-2 shadow-2xl shadow-black/30">
                  {effectivePortraitDataUrl ? <img className="h-full w-full rounded-[1.5rem] object-cover" src={effectivePortraitDataUrl} alt="Dashboard portrait" /> : <div className="flex h-full w-full items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 text-center text-xs leading-5 text-slate-500">{isDemoMode ? 'Demo portrait' : 'Add portrait in Settings'}</div>}
                </div>
              </div>
              <div className="mt-7 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-slate-500">Data source</p>
                  <p className="mt-1 font-semibold text-white">{isDemoMode ? 'Demo data (sample)' : dataSource === 'empty' ? 'No data loaded' : dataSource === 'ibkr' ? 'IBKR Flex sync' : 'CSV upload'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-slate-500">Review period</p>
                  <p className="mt-1 font-semibold text-white">{reviewPeriodLabel}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-slate-500">Rows loaded</p>
                  <p className="mt-1 font-semibold text-white">{sourceRows.length} trades</p>
                </div>
              </div>
              {isDemoMode && (
                <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm leading-6 text-cyan-100">
                  Demo mode is on. All financial, personal and portfolio figures shown are a fixed sample dataset, not your real account. Only the NASDAQ and S&P 500 benchmark lines use live market data. Click “Real Data” to exit.
                </div>
              )}
              {!isDemoMode && dataSource === 'empty' && (
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
                  <div className="flex flex-wrap items-center gap-2">
                    {fearGreedData && (
                      <a className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/20" href="https://www.cnn.com/markets/fear-and-greed" target="_blank" rel="noreferrer">CNN Fear &amp; Greed source</a>
                    )}
                    <p className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs font-semibold text-violet-100">Macro context</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <StatCard title="VIX Index" value={vixData ? vixData.value.toFixed(2) : 'N/A'} sub={vixData ? `${vixData.value < 16 ? 'Calm / risk-on' : vixData.value <= 24 ? 'Neutral / watchful' : 'Fear / stress'} · ${vixData.symbol} · ${vixData.date}` : marketReference?.vix?.error || 'Loading CBOE VIX from Yahoo Finance'} icon={Activity} valueClassName={vixMoodClassName} subClassName={vixMoodClassName} detail={<div><p>VIX is the CBOE volatility index and reflects expected S&P 500 volatility over the next 30 days.</p><p className="mt-2 font-semibold text-white">Color emotion guide</p><div className="mt-2 space-y-2"><p><span className="font-bold text-emerald-300">Green</span> = VIX below 16, calmer / more risk-on market emotion.</p><p><span className="font-bold text-amber-300">Yellow</span> = VIX 16 to 24, neutral or watchful market emotion.</p><p><span className="font-bold text-rose-300">Red</span> = VIX above 24, fear / stress market emotion.</p></div><p className="mt-2 font-semibold text-white">How to use it</p><p>When VIX is rising, breakouts can fail faster and position sizing should usually be more conservative. When VIX is low, complacency risk can build, so avoid over-leverage.</p><p className="mt-2">Source symbol: INDEXCBOE: VIX / Yahoo `^VIX`.</p></div>} />
                  <StatCard title="CNN Fear & Greed" value={fearGreedData ? `${fearGreedData.value.toFixed(1)}` : 'N/A'} sub={fearGreedData ? `${fearGreedData.rating} · Previous close ${fearGreedData.previousClose ?? 'N/A'} · 1 week ${fearGreedData.previous1Week ?? 'N/A'}` : marketReference?.fearGreed?.error || 'Loading CNN Fear & Greed Index'} icon={ShieldCheck} valueClassName={fearGreedMoodClassName} subClassName={fearGreedMoodClassName} detail={<div><p>CNN Fear & Greed summarizes multiple market sentiment inputs into a 0-100 score.</p><p className="mt-2 font-semibold text-white">5-level color emotion guide</p><div className="mt-2 space-y-2"><p><span className="font-bold text-rose-400">Deep red</span> = below 25, extreme fear / strong risk-off emotion.</p><p><span className="font-bold text-orange-300">Orange</span> = 25 to 44, fear / cautious market emotion.</p><p><span className="font-bold text-amber-300">Yellow</span> = 45 to 55, neutral market emotion.</p><p><span className="font-bold text-lime-300">Light green</span> = 56 to 75, greed / risk-on market emotion.</p><p><span className="font-bold text-emerald-300">Deep green</span> = above 75, extreme greed / stretched risk-on emotion.</p></div><p className="mt-2">Previous month: {fearGreedData?.previous1Month ?? 'N/A'} · Previous year: {fearGreedData?.previous1Year ?? 'N/A'}</p></div>} />
                </div>
                <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">AAII Investor Sentiment Survey</p>
                      <p className="mt-1 text-xs text-slate-400">{aaiiData ? `Week ending ${toAaiiDateInputValue(aaiiData.weekEnding)}${aaiiLatestManualOverride ? ' · manual override' : marketReference?.aaii?.cached ? ` · cached/fallback data (${marketReference.aaii.error})` : ''}` : marketReference?.aaii?.error || 'Loading AAII weekly sentiment survey'}</p>
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
                                <td className="px-3 py-2 font-semibold text-white">{toAaiiDateInputValue(row.weekEnding)}</td>
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
                                <p className="text-xs text-slate-400">Week Ending {toAaiiDateInputValue(row.weekEnding)}</p>
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
                    <p className={`mt-1 text-xl font-bold ${totalCombinedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{safeMoney(totalCombinedPnl, isPrivacyMode)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.05] p-4">
                    <p className="text-xs text-slate-500">Realized P/L</p>
                    <p className={`mt-1 text-xl font-bold ${stats.totalRealizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{safeMoney(stats.totalRealizedPnl, isPrivacyMode)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.05] p-4">
                    <p className="text-xs text-slate-500">Win Rate</p>
                    <p className="mt-1 text-xl font-bold text-white"><LockedValue locked={lockFigures} onUnlock={openPaywall}>{percent(stats.winRate)}</LockedValue></p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.05] p-4">
                    <p className="text-xs text-slate-500">Current Account Value</p>
                    <p className="mt-1 text-xl font-bold text-white">{currentAccountValue === null ? 'N/A' : safeMoney(currentAccountValue, isPrivacyMode)}</p>
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
                      <p className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100" title={cashBalanceSource}>Cash {safeMoney(cashBalanceValue, isPrivacyMode)}</p>
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
                            <td className="px-3 py-3 text-right">{safeMoney(position.value, isPrivacyMode)}</td>
                            <td className={`px-3 py-3 text-right font-semibold ${position.unrealizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{safeMoney(position.unrealizedPnl, isPrivacyMode)}</td>
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
                          <td className={`px-3 py-3 text-right font-semibold ${cashBalanceValue >= 0 ? 'text-cyan-100' : 'text-rose-300'}`}>{safeMoney(cashBalanceValue, isPrivacyMode)}</td>
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
                <p className="mt-2 text-sm leading-6 text-emerald-50/70">{hasSecureCredentialStore() ? 'Runs entirely on your computer. Your IBKR Flex token is encrypted by your operating system and never leaves your device.' : 'Uses your local backend. The Flex token is read from `.env` and never exposed in browser code.'}</p>
                <p className="mt-3 rounded-2xl border border-emerald-200/20 bg-emerald-200/10 px-3 py-2 text-xs leading-5 text-emerald-50/80">Long-term mode: each sync/upload is merged into saved history and duplicate trades are skipped. Open positions remain the latest snapshot.</p>
                <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-4 text-base font-bold text-slate-950 shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60" type="button" disabled={isImporting} onClick={importFromIbkr}>
                  <ShieldCheck size={20} />
                  {isImporting ? 'Syncing IBKR...' : 'Sync IBKR Flex Now'}
                </button>
                <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200/20 bg-emerald-200/5 px-4 py-2.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-200/10" type="button" onClick={() => setShowSettings(true)} title="Open Settings to enter your IBKR Flex token and Query ID">
                  <BookOpen size={14} />
                  Need a token? Set it up in Settings &rarr;
                </button>
                {(isImporting || importProgress !== null || effectiveImportStatus) && (
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
                    <p className="mt-3 text-sm leading-6 text-emerald-50/90">{isImporting && importProgressMessage ? importProgressMessage : effectiveImportStatus}</p>
                    {isImporting && <p className="mt-2 text-xs leading-5 text-emerald-50/60">Estimated progress only. IBKR does not stream exact completion status while generating the Flex statement.</p>}
                  </div>
                )}
                {syncDiff && !isImporting && !isDemoMode && (
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
                        <div><span className="text-cyan-100/70">NAV change</span><span className={`ml-2 font-semibold ${syncDiff.navDelta >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>{safeMoney(syncDiff.navFrom ?? 0, isPrivacyMode)} → {safeMoney(syncDiff.navTo ?? 0, isPrivacyMode)} ({syncDiff.navDelta >= 0 ? '+' : ''}{safeMoney(syncDiff.navDelta, isPrivacyMode)})</span></div>
                      )}
                      {syncDiff.newDividends > 0 && <div><span className="text-cyan-100/70">Dividends booked</span><span className="ml-2 font-semibold text-emerald-200">{safeMoney(syncDiff.newDividends, isPrivacyMode)}</span></div>}
                      {syncDiff.newWithholdingTax < 0 && <div><span className="text-cyan-100/70">Withholding tax</span><span className="ml-2 font-semibold text-rose-200">{safeMoney(syncDiff.newWithholdingTax, isPrivacyMode)}</span></div>}
                      {syncDiff.newInterest !== 0 && <div><span className="text-cyan-100/70">Interest (net)</span><span className={`ml-2 font-semibold ${syncDiff.newInterest >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>{safeMoney(syncDiff.newInterest, isPrivacyMode)}</span></div>}
                      {syncDiff.newDeposits > 0 && <div><span className="text-cyan-100/70">Deposits</span><span className="ml-2 font-semibold text-emerald-200">{safeMoney(syncDiff.newDeposits, isPrivacyMode)}</span></div>}
                      {syncDiff.newWithdrawals < 0 && <div><span className="text-cyan-100/70">Withdrawals</span><span className="ml-2 font-semibold text-rose-200">{safeMoney(syncDiff.newWithdrawals, isPrivacyMode)}</span></div>}
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
                    <input className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-cyan-300 disabled:opacity-60" type="number" value={isDemoMode ? DEMO_STARTING_NAV : hasActualNavCurve ? (portfolioStartNav ?? 0) : initialFunding} disabled={isDemoMode || hasActualNavCurve} onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      const value = Number(event.target.value);
                      setInitialFunding(value);
                      setStartingNav(value);
                    }} />
                    {hasActualNavCurve
                      ? <span className="mt-1 block text-xs text-slate-500">Auto-derived from your imported NAV as of your portfolio start date{effectivePortfolioStartDate ? ` (${effectivePortfolioStartDate})` : ''} — updates when you change that date.</span>
                      : <span className="mt-1 block text-xs text-slate-500">Enter the capital you had finished funding by your portfolio start date. Used as the baseline for returns and risk.</span>}
                  </label>
                  <label className="block">
                    <span className="text-slate-500">Portfolio start date</span>
                    <input className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-cyan-300 disabled:opacity-60" type="date" value={isDemoMode ? '' : portfolioStartDate} disabled={isDemoMode} onChange={(event: ChangeEvent<HTMLInputElement>) => setPortfolioStartDate(event.target.value)} />
                    <span className="mt-1 block text-xs text-slate-500">Tip: use the date you finished funding your account (after your last deposit), so returns and risk start from a fully-funded baseline.</span>
                    <span className="mt-1 block text-xs text-slate-500">{portfolioStartDate ? 'Returns, risk metrics, and charts are calculated from this date.' : 'Leave blank to auto-use your earliest imported date.'}{allBenchmarkStartDate ? ` Earliest data in your dataset: ${allBenchmarkStartDate}.` : ''}</span>
                  </label>
                  <div>
                    <p className="text-slate-500">Accumulated trading period</p>
                    <p className="font-semibold text-white">{databaseRangeLabel}</p>
                    {databaseDays > 0 && <p className="mt-1 text-xs text-slate-500">{databaseDays.toLocaleString()} calendar days</p>}
                    {databaseDateRange.from && effectivePortfolioStartDate && databaseDateRange.from < effectivePortfolioStartDate && <p className="mt-1 text-xs text-slate-500">Displayed from your portfolio start date.</p>}
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
                  <button className="rounded-2xl bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20" type="button" onClick={handleExportData}>
                    Export JSON
                  </button>
                  {lockFigures ? (
                    <button className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/20" type="button" title="Activate Pro to export the dashboard as PDF" onClick={openPaywall}>
                      <Lock size={14} /> Export PDF (Pro)
                    </button>
                  ) : (
                    <button className="rounded-2xl bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60" type="button" disabled={isExportingPdf} onClick={exportDashboardPdf}>
                      {isExportingPdf ? 'Exporting PDF...' : 'Export PDF'}
                    </button>
                  )}
                  {hasSecureCredentialStore() ? (
                    <button className="col-span-2 rounded-2xl bg-cyan-300/10 px-4 py-3 text-center text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20" type="button" onClick={handleImportDataDesktop}>
                      Import JSON Backup
                    </button>
                  ) : (
                    <label className="col-span-2 cursor-pointer rounded-2xl bg-cyan-300/10 px-4 py-3 text-center text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20">
                      Import JSON Backup
                      <input className="hidden" type="file" accept="application/json,.json" onChange={(event: ChangeEvent<HTMLInputElement>) => event.target.files?.[0] && importDashboardBackup(event.target.files[0])} />
                    </label>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </header>

        <DashboardStickyNav />

        {lockFigures && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Performance KPIs</p>
            <ProHint onUnlock={openPaywall} />
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Total Realized P/L" value={safeMoney(stats.totalRealizedPnl, isPrivacyMode)} sub={`${stats.totalExecutions} fills from ${stats.totalOrders} orders`} icon={TrendingUp} positive={stats.totalRealizedPnl >= 0} detail={<div><p>Closed profit/loss from completed execution fills. This is the cleanest measure of what your trading process has already locked in.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Total Realized P/L = sum of `FifoPnlRealized` / `Realized P/L` across fills.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>Compare this with commissions, cycle win rate, and cycle payoff ratio. A positive realized P/L with weak payoff may still be fragile; a negative realized P/L with strong open gains means current risk is still unresolved.</p><p className="mt-2">Orders: {stats.totalOrders}</p><p>Fills analyzed: {stats.totalExecutions}</p></div>} />
          <StatCard title="Unrealized P/L" value={stats.positionsCount ? safeMoney(stats.totalUnrealizedPnl, isPrivacyMode) : 'N/A'} sub={stats.positionsCount ? `${stats.positionsCount} open positions ${stats.positions[0]?.source === 'INFERRED_FROM_TRADES' ? 'inferred from trades' : 'from IBKR'}${positionSummary ? ` · ${positionSummary}` : ''}` : 'No open positions detected'} icon={WalletCards} positive={stats.positionsCount ? stats.totalUnrealizedPnl >= 0 : undefined} detail={<div><p>Profit/loss still exposed to market movement. Unlike realized P/L, this can change quickly and should be reviewed with VIX, concentration, and position size.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Uses `FifoPnlUnrealized` / `Unrealized P/L` when available. Otherwise falls back to Position Value - Cost Basis Money.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>If unrealized P/L is a large share of total P/L, your result depends heavily on current open risk. Check whether gains are protected and whether losses have a clear invalidation point.</p><p className="mt-2">Open positions: {stats.positionsCount}</p><p>{positionSummary || 'No position breakdown available.'}</p></div>} />
          <StatCard title="Bond Yield Profit : Commission" value={bondCashYieldStats.length ? `${bondCashYieldProfitCommissionRatio.toFixed(2)}x` : 'N/A'} sub={bondCashYieldStats.length ? `${safeMoney(bondCashYieldRealizedPnl, isPrivacyMode)} profit / ${safeMoney(Math.abs(bondCashYieldCommissions), isPrivacyMode)} commission · ${bondCashYieldSymbolsLabel}` : 'No SGOV / IB01 trades loaded'} icon={BarChart3} positive={bondCashYieldProfitCommissionRatio >= 1} detail={<div><p>Measures whether bond/cash-yield activity is adding meaningful return after transaction costs.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Bond yield ratio = SGOV + IB01 realized P/L / absolute SGOV + IB01 commissions.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>A low ratio means bond/cash-yield trades may be too small/frequent relative to fees. A high ratio means the bond/cash-yield allocation is working without excessive friction.</p><p className="mt-2">Symbols included: {bondCashYieldSymbolsLabel}</p><div className="mt-3 overflow-hidden rounded-xl border border-white/10"><table className="w-full text-left text-xs"><thead className="bg-white/[0.06] text-slate-400"><tr><th className="px-3 py-2">Symbol</th><th className="px-3 py-2 text-right">Trades</th><th className="px-3 py-2 text-right">Realized P/L</th><th className="px-3 py-2 text-right">Commission</th></tr></thead><tbody className="divide-y divide-white/10">{bondCashYieldDetailRows.map((row) => <tr key={row.symbol}><td className="px-3 py-2 font-semibold text-white">{row.symbol}</td><td className="px-3 py-2 text-right">{row.trades}</td><td className={`px-3 py-2 text-right font-semibold ${row.realizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(row.realizedPnl)}</td><td className="px-3 py-2 text-right text-slate-300">{money(Math.abs(row.commissions))}</td></tr>)}<tr className="bg-white/[0.04] font-semibold"><td className="px-3 py-2 text-white">Total</td><td className="px-3 py-2 text-right">{bondCashYieldStats.reduce((total, row) => total + row.trades, 0)}</td><td className={`px-3 py-2 text-right ${bondCashYieldRealizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{bondCashYieldStats.length ? money(bondCashYieldRealizedPnl) : 'N/A'}</td><td className="px-3 py-2 text-right text-slate-300">{bondCashYieldStats.length ? money(Math.abs(bondCashYieldCommissions)) : 'N/A'}</td></tr></tbody></table></div></div>} />
          <StatCard locked={lockFigures} onUnlock={openPaywall} title="Cycle Win Rate" value={percent(stats.winRate)} sub={`${stats.winners.length} winning cycles / ${stats.losers.length} losing cycles, ex-bond yield`} icon={Target} detail={<div><p>Shows how often closed trade cycles make money. It does not measure how large wins are versus losses.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Cycle Win Rate = winning cycles / realized non-zero cycles, excluding SGOV, IB01, and breakeven cycles.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>A high cycle win rate can still lose money if average losses are much larger than wins. A lower cycle win rate can be excellent if payoff ratio is strong.</p><p className="mt-2">Winning cycles: {stats.winners.length}</p><p>Losing cycles: {stats.losers.length}</p></div>} />
          <StatCard locked={lockFigures} onUnlock={openPaywall} title="Cycle Payoff Ratio" value={`${stats.profitLossRatio.toFixed(2)}x`} sub={`Ex-bond yield average winning cycle ${safeMoney(stats.averageWinner, isPrivacyMode)} / losing cycle ${safeMoney(stats.averageLoser, isPrivacyMode)}`} icon={BarChart3} detail={<div><p>Compares the average size of your winning cycles with the average size of your losing cycles.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Cycle Payoff Ratio = average winning cycle / average losing cycle, excluding SGOV and IB01.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>Above 1.0 means winning cycles are larger than losing cycles on average. If cycle win rate is below 50%, you usually need a higher payoff ratio to maintain positive expectancy.</p><p className="mt-2">Average winner: {safeMoney(stats.averageWinner, isPrivacyMode)}</p><p>Average loser: {safeMoney(stats.averageLoser, isPrivacyMode)}</p></div>} />
          <StatCard locked={lockFigures} onUnlock={openPaywall} title="Cycle Profit Factor" value={`${stats.profitFactor.toFixed(2)}x`} sub={`Ex-bond yield expectancy ${safeMoney(stats.expectancy, isPrivacyMode)} per closed cycle`} icon={Activity} positive={stats.profitFactor >= 1} detail={<div><p>Summarizes whether total winning cycles are large enough to cover total losing cycles.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Cycle Profit Factor = gross winning-cycle profit / absolute gross losing-cycle loss, excluding SGOV and IB01.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>Above 1.0 is profitable before considering future risk. Above 1.5 is generally healthier. Below 1.0 means losing cycles are larger than winning cycles in aggregate.</p><p className="mt-2">Expectancy per closed cycle: {safeMoney(stats.expectancy, isPrivacyMode)}</p></div>} />
        </div>

        {lockFigures && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Risk &amp; Drawdown</p>
            <ProHint onUnlock={openPaywall} />
          </div>
        )}
        <div id="risk-metrics" className="grid scroll-mt-24 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard locked={lockFigures} onUnlock={openPaywall} title="Sharpe Ratio" value={`${riskMetrics.sharpeRatio.toFixed(2)}`} sub={hasActualNavCurve ? `NAV returns, cash-flow adjusted · ${riskPeriodLabel}` : `Fallback equity · ${riskPeriodLabel}`} icon={LineChart} positive={riskMetrics.sharpeRatio >= 1} detail={<div><p>Risk-adjusted return using the selected review-period equity curve.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Sharpe = (average daily cash-flow-adjusted return / daily return standard deviation) × √252.</p><p className="mt-2 font-semibold text-white">Cash-flow impact</p><p>{riskCashFlowNote}</p><p className="mt-2 font-semibold text-white">How to use it</p><p>Higher is better. When downloaded NAV and Cash Transactions deposits/withdrawals are available, account transfers are removed from daily return so they do not distort volatility.</p><p className="mt-2">Risk period: {riskPeriodLabel}</p><p>Equity source: {hasActualNavCurve ? `Downloaded NAV rows in period (${riskEquityCurveData.length})` : `Starting NAV ${safeMoney(riskStartingNav, isPrivacyMode)} + realized P/L`}</p></div>} />
          <StatCard locked={lockFigures} onUnlock={openPaywall} title="Max Drawdown" value={`${(riskMetrics.maxDrawdown * 100).toFixed(2)}%`} sub={hasActualNavCurve ? `NAV drawdown, cash-flow adjusted · ${riskPeriodLabel}` : `Fallback equity decline · ${riskPeriodLabel}`} icon={TrendingDown} positive={false} detail={<div><p>Shows the largest equity decline from a previous high point inside the selected review period.</p><p className="mt-2 font-semibold text-white">When it happened</p><p>Peak: {riskMetrics.maxDrawdownPeakDate || 'N/A'} · {riskMetrics.maxDrawdownPeakEquity ? money(riskMetrics.maxDrawdownPeakEquity) : 'N/A'}</p><p>Trough: {riskMetrics.maxDrawdownTroughDate || 'N/A'} · {riskMetrics.maxDrawdownTroughEquity ? money(riskMetrics.maxDrawdownTroughEquity) : 'N/A'}</p><p className="mt-2 font-semibold text-white">Estimated holdings on trough date</p>{maxDrawdownHoldings.length ? <div className="mt-2 overflow-hidden rounded-xl border border-white/10"><table className="w-full text-left text-xs"><thead className="bg-white/5 text-slate-400"><tr><th className="px-2 py-2">Symbol</th><th className="px-2 py-2">Asset</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Est. Value</th></tr></thead><tbody className="divide-y divide-white/10">{maxDrawdownHoldings.map((holding) => <tr key={holding.symbol}><td className="px-2 py-2 font-semibold text-white">{holding.symbol}</td><td className="px-2 py-2">{holding.assetClass || '-'}</td><td className="px-2 py-2 text-right">{holding.quantity.toLocaleString()}</td><td className="px-2 py-2 text-right">{money(holding.estimatedValue)}</td></tr>)}</tbody></table></div> : <p>No reconstructed holdings found from trades on this date.</p>}<p className="mt-2 text-xs text-slate-400">Holdings are reconstructed from trade quantities up to the trough date and valued using the latest trade price available by that date, so they are estimates rather than official historical positions.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Drawdown = (peak cash-flow-adjusted equity - current cash-flow-adjusted equity) / peak cash-flow-adjusted equity.</p><p className="mt-2 font-semibold text-white">Cash-flow impact</p><p>{riskCashFlowNote}</p><p className="mt-2">Risk period: {riskPeriodLabel}</p><p>Equity source: {hasActualNavCurve ? `Downloaded NAV rows in period (${riskEquityCurveData.length})` : `Starting NAV ${money(riskStartingNav)} + cumulative realized P/L`}</p></div>} />
          <StatCard title="Trade Total P/L" value={safeMoney(totalCombinedPnl, isPrivacyMode)} sub={`${safeMoney(stats.totalRealizedPnl, isPrivacyMode)} realized + ${safeMoney(stats.totalUnrealizedPnl, isPrivacyMode)} unrealized`} icon={Award} positive={totalCombinedPnl >= 0} detail={<div><p>Combines locked-in trade performance with current open-position performance. This is trade-based, while the equity curve and risk metrics use account NAV when available.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Trade Total P/L = realized P/L + unrealized P/L.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>If most trade P/L is unrealized, the result is not yet banked. Pair this with VIX and open concentration to decide whether to reduce, hedge, or let positions run.</p><p className="mt-2">Unrealized share: {(unrealizedPnlShare * 100).toFixed(1)}%</p></div>} />
          <StatCard locked={lockFigures} onUnlock={openPaywall} title="Open Risk Concentration" value={largestPosition ? `${largestPosition.symbol}` : 'N/A'} sub={largestPosition ? `Largest open exposure ${safeMoney(Math.abs(largestPosition.value), isPrivacyMode)}${totalPositionValue ? ` / ${((Math.abs(largestPosition.value) / totalPositionValue) * 100).toFixed(1)}% of open exposure` : ''}` : 'No open position exposure'} icon={Target} positive={largestPosition ? Math.abs(largestPosition.value) / (totalPositionValue || 1) < 0.35 : undefined} detail={<div><p>Shows whether one open position dominates your current exposure.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Concentration = largest absolute position value / total absolute open position value.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>High concentration is not automatically bad, but it means one symbol can drive portfolio outcome. Review catalyst risk, stop level, and whether exposure is correlated with other holdings.</p><p className="mt-2">{largestPosition ? `${largestPosition.symbol}: ${safeMoney(Math.abs(largestPosition.value), isPrivacyMode)}` : 'No open positions loaded.'}</p></div>} />
          <StatCard title="Open Position Return" value={stats.positionsCount ? `${(openPositionReturn * 100).toFixed(2)}%` : 'N/A'} sub={stats.positionsCount ? `${safeMoney(stats.totalUnrealizedPnl, isPrivacyMode)} unrealized / ${safeMoney(openPositionCostBasis, isPrivacyMode)} cost basis` : 'No open position cost basis'} icon={WalletCards} positive={stats.positionsCount ? openPositionReturn >= 0 : undefined} detail={<div><p>Measures the return of currently open positions relative to their cost basis.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Open Position Return = total unrealized P/L / absolute open position cost basis.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>A strong positive value may justify taking partial profit if market sentiment is stretched. A negative value should be reviewed against original thesis and max-loss rules.</p><p className="mt-2">Cost basis: {safeMoney(openPositionCostBasis, isPrivacyMode)}</p></div>} />
          <StatCard locked={lockFigures} onUnlock={openPaywall} title="Net Deposits / Withdrawals" value={cashFlowValue === null ? 'N/A' : safeMoney(cashFlowValue, isPrivacyMode)} sub={downloadedCashFlow ? `Cumulative Cash Transactions withdrawals through ${downloadedCashFlow.date}` : 'No IBKR Cash Transactions withdrawals loaded'} icon={TrendingDown} positive={undefined} detail={<div><p>Uses dated IBKR Cash Transactions rows where Type is Deposits/Withdrawals and Amount is negative.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Net deposits / withdrawals = cumulative sum of parsed withdrawal amounts converted to base currency using FXRateToBase.</p><p className="mt-2 font-semibold text-white">Important note</p><p>Negative values mean net withdrawals. Initial cash receipt funding deposits are excluded from this card and the cash-flow-adjusted risk metrics.</p><p className="mt-2">Source: {cashFlowSource}</p><p className="mt-2">Current account value source: {currentAccountValueSource}</p><p className="mt-3 font-semibold text-white">Withdrawal breakdown</p>{cashFlowDetailRows.length ? <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-white/10"><table className="w-full text-left text-xs"><thead className="bg-white/5 text-slate-400"><tr><th className="px-2 py-2">Date</th><th className="px-2 py-2">Currency</th><th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2 text-right">Base (USD)</th><th className="px-2 py-2">Description</th></tr></thead><tbody className="divide-y divide-white/10">{cashFlowDetailRows.map((row, index) => (<tr key={`${row.date}-${index}-${row.amount}`}><td className="px-2 py-2 font-semibold text-white">{row.date}</td><td className="px-2 py-2">{row.currency || '-'}</td><td className="px-2 py-2 text-right text-rose-300">{row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="px-2 py-2 text-right text-rose-300">{money(row.value)}</td><td className="px-2 py-2 text-slate-400">{row.description || '-'}</td></tr>))}<tr className="bg-white/[0.06]"><td className="px-2 py-2 font-semibold text-white" colSpan={3}>Total</td><td className="px-2 py-2 text-right font-bold text-rose-300">{money(cashFlowValue ?? 0)}</td><td className="px-2 py-2"></td></tr></tbody></table></div> : <p className="mt-2 text-slate-400">No withdrawal rows parsed from Cash Transactions.</p>}</div>} />
        </div>

        <div className="rounded-3xl border border-white/10 bg-[var(--dashboard-card)] p-5 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">Max Drawdown Audit</p>
              <h3 className="mt-1 text-xl font-bold text-white">{riskMetrics.maxDrawdownPeakDate || 'N/A'} → {riskMetrics.maxDrawdownTroughDate || 'N/A'}</h3>
              <p className="mt-2 text-sm text-slate-300">Raw NAV drawdown <LockedValue locked={lockFigures} onUnlock={openPaywall} iconSize={12}>{rawMaxDrawdownValue ? `${(rawMaxDrawdownValue * 100).toFixed(2)}%` : 'N/A'}</LockedValue> becomes cash-flow-adjusted drawdown <LockedValue locked={lockFigures} onUnlock={openPaywall} iconSize={12}>{(riskMetrics.maxDrawdown * 100).toFixed(2)}%</LockedValue>.</p>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-slate-400">Raw NAV</p>
                <p className="font-semibold text-white"><LockedValue locked={lockFigures} onUnlock={openPaywall} iconSize={12}>{safeMoney(riskMetrics.maxDrawdownPeakRawEquity, isPrivacyMode)} → {safeMoney(riskMetrics.maxDrawdownTroughRawEquity, isPrivacyMode)}</LockedValue></p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-slate-400">Withdrawals inside path</p>
                <p className="font-semibold text-rose-300"><LockedValue locked={lockFigures} onUnlock={openPaywall} iconSize={12}>{safeMoney(riskMetrics.maxDrawdownCashFlowDuringDrawdown, isPrivacyMode)}</LockedValue></p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-slate-400">Adjusted equity</p>
                <p className="font-semibold text-cyan-200"><LockedValue locked={lockFigures} onUnlock={openPaywall} iconSize={12}>{safeMoney(riskMetrics.maxDrawdownPeakEquity, isPrivacyMode)} → {safeMoney(riskMetrics.maxDrawdownTroughEquity, isPrivacyMode)}</LockedValue></p>
              </div>
            </div>
          </div>
        </div>

        <Section hint={lockFigures} onUnlock={openPaywall} title="Cash Income & Cost Leakage" subtitle="Uses full IBKR Cash Transactions to track dividend income, withholding tax, interest, and non-trading fee drag.">
          <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard title="Gross Dividends" value={safeMoney(cashInsights.grossDividends, isPrivacyMode)} sub={`Net after withholding ${safeMoney(cashInsights.netDividends, isPrivacyMode)}`} icon={WalletCards} positive={cashInsights.grossDividends > 0} detail={<div><p>Total positive Cash Transactions where Type is Dividends.</p><p className="mt-2">Gross dividends: {safeMoney(cashInsights.grossDividends, isPrivacyMode)}</p><p>Withholding tax: {safeMoney(cashInsights.withholdingTax, isPrivacyMode)}</p><p>Net dividends: {safeMoney(cashInsights.netDividends, isPrivacyMode)}</p></div>} />
            <StatCard locked={lockFigures} onUnlock={openPaywall} title="Withholding Tax Rate" value={`${(cashInsights.effectiveWithholdingTaxRate * 100).toFixed(1)}%`} sub={`${safeMoney(cashInsights.withholdingTax, isPrivacyMode)} tax / ${safeMoney(cashInsights.grossDividends, isPrivacyMode)} gross dividends`} icon={ShieldCheck} positive={cashInsights.effectiveWithholdingTaxRate < 0.25} detail={<div><p>Effective withholding tax rate based on Cash Transactions.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Absolute withholding tax / gross dividends.</p></div>} />
            <StatCard locked={lockFigures} onUnlock={openPaywall} title="Withholding Tax Refunded" value={safeMoney(cashInsights.withholdingTaxRefunds, isPrivacyMode)} sub={cashInsights.withholdingTaxGross < 0 ? `${((cashInsights.withholdingTaxRefunds / Math.abs(cashInsights.withholdingTaxGross)) * 100).toFixed(1)}% of ${safeMoney(Math.abs(cashInsights.withholdingTaxGross), isPrivacyMode)} gross withheld` : 'No gross withholding tax recorded'} icon={ShieldCheck} positive={cashInsights.withholdingTaxRefunds > 0} detail={<div><p>Sum of positive Cash Transactions rows where Type is Withholding Tax. These are refunds, reversals, or treaty rate adjustments returned to your account after IBKR initially withheld dividend tax.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Refunded = Σ Withholding Tax rows with positive amount, converted to base currency using FXRateToBase.</p><p className="mt-2 font-semibold text-white">Breakdown</p><p>Gross withheld (negative rows): {money(cashInsights.withholdingTaxGross)}</p><p>Refunded (positive rows): {money(cashInsights.withholdingTaxRefunds)}</p><p>Net withholding tax: {money(cashInsights.withholdingTax)}</p><p className="mt-3 font-semibold text-white">Refund rows · past 12 months</p>{withholdingRefundRows.length ? <div className="mt-2 overflow-hidden rounded-xl border border-white/10"><table className="w-full text-left text-xs"><thead className="bg-white/5 text-slate-400"><tr><th className="px-2 py-2">Date</th><th className="px-2 py-2">Symbol</th><th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2">Currency</th><th className="px-2 py-2 text-right">Base (USD)</th></tr></thead><tbody className="divide-y divide-white/10">{withholdingRefundRows.map((row, index) => (<tr key={`${row.date}-${row.symbol}-${index}`}><td className="px-2 py-2 font-medium text-white" title={row.description || undefined}>{row.date}</td><td className="px-2 py-2 text-slate-200">{row.symbol || '-'}</td><td className="px-2 py-2 text-right text-emerald-300">{row.amount.toFixed(2)}</td><td className="px-2 py-2 text-slate-300">{row.currency || '-'}</td><td className="px-2 py-2 text-right font-semibold text-emerald-300">{money(row.value)}</td></tr>))}<tr className="bg-white/[0.04] font-semibold"><td className="px-2 py-2 text-white" colSpan={4}>Total ({withholdingRefundRows.length} rows)</td><td className="px-2 py-2 text-right text-emerald-300">{money(withholdingRefundRows.reduce((total, row) => total + row.value, 0))}</td></tr></tbody></table></div> : <p className="mt-2 text-slate-400">No withholding tax refunds detected in the past 12 months.</p>}<p className="mt-3 font-semibold text-white">How to use it</p><p>Track refunds against the gross withheld amount to confirm treaty rates are being applied. If refunds are zero but gross withholding is non-zero, your broker may not be claiming treaty relief for you.</p></div>} />
            <StatCard locked={lockFigures} onUnlock={openPaywall} title="Fee Drag" value={safeMoney(cashInsights.totalCashDrag, isPrivacyMode)} sub={`${(feeDragToNavPct * 100).toFixed(2)}% of NAV · ${(feeDragToRealizedPnlPct * 100).toFixed(1)}% of realized P/L`} icon={TrendingDown} positive={cashInsights.totalCashDrag >= 0} detail={<div><p>Non-trading cash leakage from withholding tax, broker interest paid, and other fees.</p><p className="mt-2">Broker interest paid: {safeMoney(cashInsights.brokerInterestPaid, isPrivacyMode)}</p><p>Other fees: {safeMoney(cashInsights.otherFees, isPrivacyMode)}</p><p>Withholding tax: {safeMoney(cashInsights.withholdingTax, isPrivacyMode)}</p><p>Total cash drag: {safeMoney(cashInsights.totalCashDrag, isPrivacyMode)}</p></div>} />
            <StatCard locked={lockFigures} onUnlock={openPaywall} title="Interest & Other Fees" value={safeMoney(cashInsights.interest + cashInsights.otherFees, isPrivacyMode)} sub={`${safeMoney(cashInsights.interest, isPrivacyMode)} interest + ${safeMoney(cashInsights.otherFees, isPrivacyMode)} other fees`} icon={Activity} positive={cashInsights.interest + cashInsights.otherFees >= 0} detail={<div><p>Summarizes interest received/paid and other platform or dividend-related fees from Cash Transactions.</p><p className="mt-2">Interest net: {safeMoney(cashInsights.interest, isPrivacyMode)}</p><p>Other fees net: {safeMoney(cashInsights.otherFees, isPrivacyMode)}</p><p>Negative values indicate cash leakage.</p></div>} />
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">Monthly Cash Income & Drag</h3>
                <p className="text-sm text-slate-400">Dividends, interest, withholding tax, and other fees by month.</p>
              </div>
              <div className="flex shrink-0 gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
                {([12, 24, 'all'] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setCashTrendRange(range)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${cashTrendRange === range ? 'bg-cyan-300 text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                  >
                    {range === 'all' ? 'All' : `${range}M`}
                  </button>
                ))}
              </div>
            </div>
            <LockedOverlay locked={lockFigures} onUnlock={openPaywall}>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={cashMonthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(value) => safeMoney(Number(value), isPrivacyMode)} />
                  <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px' }} formatter={(value) => safeMoney(Number(value ?? 0), isPrivacyMode)} />
                  <Bar dataKey="dividends" stackId="cash" fill="#34d399" name="Dividends" />
                  <Bar dataKey="interest" stackId="cash" fill="#22d3ee" name="Interest" />
                  <Bar dataKey="withholdingTax" stackId="cash" fill="#fb7185" name="Withholding Tax" />
                  <Bar dataKey="otherFees" stackId="cash" fill="#f59e0b" name="Other Fees" />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
            </LockedOverlay>
          </div>
        </Section>

        <div className="space-y-6">
          <Section title="Open Positions Insight" subtitle="Uses Open Positions data to explain current exposure, unrealized P/L, concentration, and option details.">
            <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <StatCard title="Open Exposure" value={safeMoney(totalPositionValue, isPrivacyMode)} sub={`${stats.positionsCount} open positions by absolute market value`} icon={WalletCards} />
              <StatCard title="Total Unrealized P/L" value={stats.positionsCount ? safeMoney(stats.totalUnrealizedPnl, isPrivacyMode) : 'N/A'} sub={stats.positionsCount ? `${percent(openPositionReturn)} on ${safeMoney(openPositionCostBasis, isPrivacyMode)} cost basis` : 'No open positions'} icon={WalletCards} positive={stats.positionsCount ? stats.totalUnrealizedPnl >= 0 : undefined} detail={<div><p>Sum of unrealized P/L across all currently open positions.</p><p className="mt-2 font-semibold text-white">Formula</p><p>Total Unrealized P/L = Σ (mark price − cost basis) × signed quantity, per open position.</p><p className="mt-2 font-semibold text-white">How to use it</p><p>Positive means the open book is in profit before commissions/taxes; negative means it is in drawdown. Compare with the Open Position Return % to see how much capital is deployed against this result.</p><p className="mt-2">Cost basis deployed: {safeMoney(openPositionCostBasis, isPrivacyMode)}</p><p>Open Position Return: {percent(openPositionReturn)}</p></div>} />
              <StatCard title="Winning Open Positions" value={`${winningOpenPositions.length}`} sub={largestOpenGain ? `Largest gain ${largestOpenGain.symbol}: ${safeMoney(largestOpenGain.unrealizedPnl, isPrivacyMode)}` : 'No open gains'} icon={TrendingUp} positive />
              <StatCard title="Losing Open Positions" value={`${losingOpenPositions.length}`} sub={largestOpenLoss ? `Largest loss ${largestOpenLoss.symbol}: ${safeMoney(largestOpenLoss.unrealizedPnl, isPrivacyMode)}` : 'No open losses'} icon={TrendingDown} positive={false} />
              <StatCard title="Largest Position" value={largestPosition ? largestPosition.symbol : 'N/A'} sub={largestPosition ? `${safeMoney(Math.abs(largestPosition.value), isPrivacyMode)}${largestPosition.percentOfNav ? ` / ${largestPosition.percentOfNav.toFixed(2)}% NAV` : ''}` : 'No open position data'} icon={Target} />
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
                    <th className="px-4 py-3 text-right">Market price</th>
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
                      <td className="px-4 py-3 text-right">{isPrivacyMode ? '****' : priceMoney(position.closePrice)}</td>
                      <td className="px-4 py-3 text-right">{safeMoney(position.value, isPrivacyMode)}</td>
                      <td className="px-4 py-3 text-right">{safeMoney(position.costBasis, isPrivacyMode)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${position.unrealizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{safeMoney(position.unrealizedPnl, isPrivacyMode)}</td>
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
                      <td className={`px-4 py-3 text-right font-semibold ${cashBalanceValue >= 0 ? 'text-cyan-100' : 'text-rose-300'}`}>{safeMoney(cashBalanceValue, isPrivacyMode)}</td>
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

          <Section hint={lockFigures} onUnlock={openPaywall} title="Equity Curve & P/L Trend" subtitle={hasActualNavCurve ? 'Daily account NAV plus weekly and monthly Change in NAV bars for actual account growth and volatility.' : 'Daily equity curve plus weekly and monthly realized P/L bars for growth trend and volatility.'}>
            <div className="space-y-5">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3">
                  <p className="font-semibold text-white">Equity Curve</p>
                  <p className="mt-1 text-sm text-slate-400">{hasActualNavCurve ? `Uses your imported daily Net Asset Value rows${navReturnPct !== null && effectivePortfolioStartDate ? ` · total NAV return ${(navReturnPct * 100).toFixed(2)}% since ${effectivePortfolioStartDate}` : ''}.` : 'Starting NAV plus cumulative realized P/L. Daily trade data still drives the line.'}</p>
                </div>
                <LockedOverlay locked={lockFigures} onUnlock={openPaywall}>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={displayedEquityCurveData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" ticks={equityMonthTicks} tickFormatter={dateMonthLabel} minTickGap={12} />
                      <YAxis stroke="#94a3b8" tickFormatter={(value) => safeMoney(Number(value), isPrivacyMode)} width={86} />
                      <Tooltip formatter={(value, name) => [name === 'Equity' ? safeMoney(Number(value), isPrivacyMode) : safeMoney(Number(value), isPrivacyMode), name]} contentStyle={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} />
                      <Line type="monotone" dataKey="equity" name="Equity" stroke="#22d3ee" strokeWidth={3} dot={false} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
                </LockedOverlay>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">Monthly {trendPnlLabel}</p>
                    <p className="mt-1 text-sm text-slate-400">Positive months in green, losing months in red.</p>
                  </div>
                  <div className="flex shrink-0 gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
                    {([12, 24, 'all'] as const).map((range) => (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setMonthlyTrendRange(range)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${monthlyTrendRange === range ? 'bg-cyan-300 text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                      >
                        {range === 'all' ? 'All' : `${range}M`}
                      </button>
                    ))}
                  </div>
                </div>
                <LockedOverlay locked={lockFigures} onUnlock={openPaywall}>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={monthlyPnlChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="label" stroke="#94a3b8" minTickGap={8} />
                      <YAxis stroke="#94a3b8" tickFormatter={(value) => safeMoney(Number(value), isPrivacyMode)} width={76} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.06)' }} formatter={(value) => [safeMoney(Number(value), isPrivacyMode), `Monthly ${trendPnlLabel}`]} labelFormatter={(_, payload) => payload?.[0]?.payload?.month ? `${dateMonthLabel(`${payload[0].payload.month}-01`)} · ${safeMoney(Number(payload[0].payload.realizedPnl), isPrivacyMode)}` : ''} contentStyle={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} />
                      <Bar dataKey="realizedPnl" name={`Monthly ${trendPnlLabel}`} radius={[8, 8, 8, 8]} activeBar={{ stroke: '#f8fafc', strokeWidth: 2 }}>
                        {monthlyPnlChartData.map((row) => <Cell key={row.month} fill={row.realizedPnl >= 0 ? '#34d399' : '#fb7185'} />)}
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
                </LockedOverlay>
              </div>
            </div>
            <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">Recent Weekly {trendPnlLabel}</p>
                  <p className="mt-1 text-sm text-slate-400">{weeklyTrendRange === 'all' ? 'All trading weeks' : `Last ${weeklyTrendRange} trading weeks`}, grouped by Monday week start.</p>
                </div>
                <div className="flex shrink-0 gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
                  {([12, 26, 'all'] as const).map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setWeeklyTrendRange(range)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${weeklyTrendRange === range ? 'bg-cyan-300 text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                    >
                      {range === 'all' ? 'All' : `${range}W`}
                    </button>
                  ))}
                </div>
              </div>
              <LockedOverlay locked={lockFigures} onUnlock={openPaywall}>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={weeklyPnlChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="label" stroke="#94a3b8" minTickGap={8} />
                    <YAxis stroke="#94a3b8" tickFormatter={(value) => money(Number(value))} width={76} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.06)' }} formatter={(value) => [safeMoney(Number(value), isPrivacyMode), `Weekly ${trendPnlLabel}`]} labelFormatter={(_, payload) => payload?.[0]?.payload?.week ? `Week of ${payload[0].payload.week} · ${safeMoney(Number(payload[0].payload.realizedPnl), isPrivacyMode)}` : ''} contentStyle={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} />
                    <Bar dataKey="realizedPnl" name={`Weekly ${trendPnlLabel}`} radius={[8, 8, 8, 8]} activeBar={{ stroke: '#f8fafc', strokeWidth: 2 }}>
                      {weeklyPnlChartData.map((row) => <Cell key={row.week} fill={row.realizedPnl >= 0 ? '#34d399' : '#fb7185'} />)}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
              </LockedOverlay>
            </div>
          </Section>

          <Section hint={lockFigures} onUnlock={openPaywall} title="Period Benchmark Comparison" subtitle="Start from your portfolio start date, ALL records, or a custom date range. Portfolio return is cash-flow adjusted and rebased to the selected period.">
            <p className="mb-4 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm leading-6 text-slate-300">{benchmarkStatus}</p>
            <div className="mb-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
              <label>
                Period
                <select className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-cyan-300" value={benchmarkRangeMode} onChange={(event: ChangeEvent<HTMLSelectElement>) => setBenchmarkRangeMode(event.target.value as 'all' | 'portfolio' | 'custom')}>
                  <option className="bg-slate-950" value="portfolio">Same as portfolio start date{effectivePortfolioStartDate ? ` (${effectivePortfolioStartDate} to ${allBenchmarkEndDate || '-'})` : ''}</option>
                  <option className="bg-slate-950" value="all">ALL records ({allBenchmarkStartDate || '-'} to {allBenchmarkEndDate || '-'})</option>
                  <option className="bg-slate-950" value="custom">Custom date range</option>
                </select>
              </label>
              <label>
                <span className="flex items-center justify-between gap-2">
                  Portfolio starting NAV / funding basis
                  <span className="inline-flex items-center gap-1 text-xs font-normal text-slate-400">
                    <input type="checkbox" className="accent-cyan-400" checked={useManualStartingNav} onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      const enabled = event.target.checked;
                      setUseManualStartingNav(enabled);
                      if (enabled) setStartingNav(Number((autoStartingNav ?? 0).toFixed(2)));
                    }} />
                    Manual override
                  </span>
                </span>
                {!useManualStartingNav && (
                  <span className="mt-1 inline-flex overflow-hidden rounded-lg border border-white/10 text-xs font-semibold">
                    <button type="button" className={`px-3 py-1 transition ${startingNavBasis === 'open' ? 'bg-cyan-300/20 text-cyan-100' : 'text-slate-400 hover:bg-white/5'}`} onClick={() => setStartingNavBasis('open')}>Opening value</button>
                    <button type="button" className={`px-3 py-1 transition ${startingNavBasis === 'close' ? 'bg-cyan-300/20 text-cyan-100' : 'text-slate-400 hover:bg-white/5'}`} onClick={() => setStartingNavBasis('close')}>Closing value</button>
                  </span>
                )}
                <input className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-cyan-300 disabled:opacity-70" type="number" step="0.01" value={useManualStartingNav ? startingNav : Number((benchmarkStartingNav ?? 0).toFixed(2))} disabled={!useManualStartingNav} onChange={(event: ChangeEvent<HTMLInputElement>) => setStartingNav(Number(Number(event.target.value).toFixed(2)))} />
                <span className="mt-1 block text-xs text-slate-500">{useManualStartingNav ? `Using your manual funding basis ${money(benchmarkStartingNav)}.` : `Auto: ${startingNavBasis === 'close' ? 'closing' : 'opening'} NAV ${money(benchmarkStartingNav)} on ${effectiveBenchmarkStartDate || effectivePortfolioStartDate}`}</span>
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
              {useManualStartingNav ? `Using your manual funding basis ${money(benchmarkStartingNav)}. Portfolio benchmark return removes deposits/withdrawals inside the selected period.` : downloadedStartingNav !== null ? `Using the ${startingNavBasis === 'close' ? 'closing' : 'opening'} IBKR NAV ${money(downloadedStartingNav)} on ${effectiveBenchmarkStartDate}. Portfolio benchmark return removes deposits/withdrawals inside the selected period.` : 'No downloaded IBKR NAV row found for this period. Add an Equity Summary / Net Asset Value section to the Flex Query, or enable Manual override to enter a starting NAV.'}
            </p>
            <div className="mb-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Investment-period return snapshot</p>
                  <p className="mt-1 text-sm text-slate-400">Since {effectiveBenchmarkStartDate || effectivePortfolioStartDate} through {effectiveBenchmarkEndDate || 'latest available date'}</p>
                </div>
                {effectivePortfolioStartDate && <p className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">Started investing {effectivePortfolioStartDate}</p>}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {benchmarkSummaryCards.map((card) => {
                  const cardLocked = lockFigures && card.label !== 'Portfolio';
                  return (
                  <div key={card.label} className={`rounded-2xl border ${card.border} ${card.background} p-5 shadow-lg shadow-black/10`}>
                    <p className="text-sm font-semibold text-slate-300">{card.label}</p>
                    <p className={`mt-2 text-4xl font-black tracking-tight ${card.color}`}>
                      <LockedValue locked={cardLocked} onUnlock={openPaywall}>{card.value === undefined ? 'N/A' : benchmarkPercent(card.value)}</LockedValue>
                    </p>
                    <p className="mt-2 text-xs text-slate-400">{card.label === 'Portfolio' && hasActualNavCurve ? 'Cash-flow-adjusted period return' : 'Period return'}</p>
                  </div>
                  );
                })}
              </div>
            </div>
            <LockedOverlay locked={lockFigures} onUnlock={openPaywall}>
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
            </LockedOverlay>
          </Section>

          <Section hint={lockFigures} onUnlock={openPaywall} title="Top Winning Symbols" subtitle="Aggregated by symbol using total realized P/L, not individual execution rows.">
            <div className="mb-4 flex justify-end">
              <button className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-white/[0.1]" type="button" onClick={() => setShowAllWinningSymbols((value) => !value)}>{showAllWinningSymbols ? 'Show top 8' : `Show full list (${winningSymbolRows.length})`}</button>
            </div>
            <SymbolTable rows={(showAllWinningSymbols ? winningSymbolRows : winningSymbolRows.slice(0, 8))} cycles={stats.tradeCycles} showRank isPrivacyMode={isPrivacyMode} locked={lockFigures} previewRowIndex={Math.min(8, winningSymbolRows.length) - 1} onUnlock={openPaywall} />
          </Section>

          <Section hint={lockFigures} onUnlock={openPaywall} title="Top Losing Symbols" subtitle="Aggregated by symbol so split executions do not overstate a single loss.">
            <div className="mb-4 flex justify-end">
              <button className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-white/[0.1]" type="button" onClick={() => setShowAllLosingSymbols((value) => !value)}>{showAllLosingSymbols ? 'Show top 8' : `Show full list (${losingSymbolRows.length})`}</button>
            </div>
            <SymbolTable rows={(showAllLosingSymbols ? losingSymbolRows : losingSymbolRows.slice(0, 8))} cycles={stats.tradeCycles} showRank isPrivacyMode={isPrivacyMode} locked={lockFigures} previewRowIndex={Math.min(8, losingSymbolRows.length) - 1} onUnlock={openPaywall} />
          </Section>

          <Section hint={lockFigures} onUnlock={openPaywall} title="Symbol Leaderboard" subtitle="Largest symbol-level impacts by absolute realized P/L, including cycle win rate and commission drag.">
            <div className="mb-4 flex justify-end">
              <button className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-white/[0.1]" type="button" onClick={() => setShowAllLeaderboard((value) => !value)}>{showAllLeaderboard ? 'Show top 12' : `Show full list (${leaderboardRows.length})`}</button>
            </div>
            <SymbolTable rows={(showAllLeaderboard ? leaderboardRows : leaderboardRows.slice(0, 12))} cycles={stats.tradeCycles} showRank isPrivacyMode={isPrivacyMode} locked={lockFigures} previewRowIndex={Math.min(12, leaderboardRows.length) - 1} onUnlock={openPaywall} />
          </Section>

          <Section hint={lockFigures} onUnlock={openPaywall} title="Monthly P/L Calendar" subtitle="Default shows the current month. Click a date to review daily realized P/L and trade details.">
            <MonthlyPnlCalendar month={selectedMonth} dailyStats={stats.byDay} trades={stats.trades} onPrevious={() => setSelectedMonth((month) => shiftMonth(month, -1))} onNext={() => setSelectedMonth((month) => shiftMonth(month, 1))} isPrivacyMode={isPrivacyMode} locked={lockFigures} onUnlock={openPaywall} />
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
                    <Tooltip formatter={(value) => [safeMoney(Number(value), isPrivacyMode), 'Realized P/L']} contentStyle={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} />
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
                        <td className={`px-4 py-3 text-right font-semibold ${row.value >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{safeMoney(row.value, isPrivacyMode)}</td>
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

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-xs leading-6 text-slate-400">
          <p>
            <span className="font-semibold text-slate-200">US Market Only:</span> Optimized exclusively for US Stocks &amp; ETFs (USD). Non-US exchanges and multi-currency tracking are not supported.
          </p>
        </div>

        <footer className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-xs leading-6 text-slate-400">
          <p>
            <span className="font-semibold text-slate-200">{LEGAL_INFO.appName}</span> is for informational and analytical purposes only and is{' '}
            <span className="font-semibold text-slate-200">not financial, investment, or tax advice</span>. Figures are estimates derived from data you import and may differ from your broker's official records. Not affiliated with Interactive Brokers.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <button className="font-semibold text-cyan-300 hover:text-cyan-200" type="button" onClick={() => setLegalDoc('disclaimer')}>Disclaimer</button>
            <button className="font-semibold text-cyan-300 hover:text-cyan-200" type="button" onClick={() => setLegalDoc('eula')}>License (EULA)</button>
            <button className="font-semibold text-cyan-300 hover:text-cyan-200" type="button" onClick={() => setLegalDoc('privacy')}>Privacy</button>
            <a className="font-semibold text-cyan-300 hover:text-cyan-200" href={`mailto:${APP_SUPPORT_EMAIL}?subject=${encodeURIComponent(`${APP_NAME} support (v${DASHBOARD_VERSION})`)}`} target="_blank" rel="noreferrer">Contact support</a>
          </div>
        </footer>

      </div>
    </main>
    </DashboardErrorBoundary>
  );
}
