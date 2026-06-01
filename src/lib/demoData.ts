import type { RawCash, RawNav, RawPosition, RawTrade } from '../types';

// Deterministic demo data for the dashboard "Demo" mode.
//
// Goals (per product requirements):
//  - Replace every real, personal or sensitive figure with believable DEMO data.
//  - Use a FIXED dataset (no Math.random at runtime) so the demo looks identical
//    every time it is shown.
//  - Keep the numbers internally consistent: the fake portfolio's unrealized P/L,
//    largest exposure, account value, cash balance and equity curve all reconcile,
//    so a viewer perceives a coherent, realistic account.
//  - NASDAQ / S&P 500 benchmark lines keep using the real downloaded data, so the
//    demo equity curve is generated over the same trading dates supplied by the caller.

export type DemoRawData = {
  rows: RawTrade[];
  positions: RawPosition[];
  navRows: RawNav[];
  cashRows: RawCash[];
};

const ACCOUNT_ID = 'U7654321';
const STARTING_NAV = 100000;
const GROSS_END_NAV = 148000; // investment value before the mid-year withdrawal
const WITHDRAWAL_AMOUNT = 10000; // one demo cash withdrawal mid-period
const ENDING_NAV = GROSS_END_NAV - WITHDRAWAL_AMOUNT; // 138,000 final account value

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

// Small deterministic PRNG (mulberry32). Seeded once so output is stable forever.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pad = (value: number) => String(value).padStart(2, '0');
const toIsoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const addDays = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// IBKR-style option label, e.g. "17JUL26".
const optionDateLabel = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${pad(day)}${MONTHS[month - 1]}${String(year).slice(-2)}`;
};

// Build a fallback list of weekday trading dates if the caller has no benchmark dates yet.
const fallbackTradingDates = (): string[] => {
  const dates: string[] = [];
  const start = new Date('2025-07-01T00:00:00');
  const today = new Date();
  const cursor = new Date(start);
  while (cursor <= today) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) dates.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates.length >= 2 ? dates : [toIsoDate(start), toIsoDate(today)];
};

// ---------------------------------------------------------------------------
// Open positions: a hand-tuned, fully self-consistent fake portfolio.
// value = quantity * closePrice * multiplier
// unrealizedPnl = (closePrice - avgCost) * quantity * multiplier
// costBasisMoney = avgCost * quantity * multiplier
// ---------------------------------------------------------------------------

type PositionSpec = {
  symbol: string;
  assetClass: 'STK' | 'OPT';
  description: string;
  quantity: number;
  avgCost: number;
  closePrice: number;
  multiplier: number;
  // Fraction (0..1) of the data range at which the position was opened.
  openFrac: number;
  strike?: number;
  putCall?: 'C' | 'P';
  // For options: how many calendar days AFTER the latest data date the contract
  // expires. Kept in the future so live, unexpired contracts never look stale.
  expiryDaysAfterEnd?: number;
};

const POSITION_SPECS: PositionSpec[] = [
  { symbol: 'NVDA', assetClass: 'STK', description: 'NVIDIA CORP', quantity: 120, avgCost: 118.0, closePrice: 178.5, multiplier: 1, openFrac: 0.05 },
  { symbol: 'AAPL', assetClass: 'STK', description: 'APPLE INC', quantity: 90, avgCost: 205.0, closePrice: 228.4, multiplier: 1, openFrac: 0.1 },
  { symbol: 'MSFT', assetClass: 'STK', description: 'MICROSOFT CORP', quantity: 38, avgCost: 402.0, closePrice: 478.2, multiplier: 1, openFrac: 0.2 },
  { symbol: 'AMZN', assetClass: 'STK', description: 'AMAZON.COM INC', quantity: 80, avgCost: 168.0, closePrice: 192.3, multiplier: 1, openFrac: 0.3 },
  { symbol: 'GOOGL', assetClass: 'STK', description: 'ALPHABET INC-CL A', quantity: 75, avgCost: 158.0, closePrice: 174.6, multiplier: 1, openFrac: 0.42 },
  { symbol: 'META', assetClass: 'STK', description: 'META PLATFORMS INC-CLASS A', quantity: 18, avgCost: 498.0, closePrice: 560.1, multiplier: 1, openFrac: 0.55 },
  { symbol: 'TSLA', assetClass: 'STK', description: 'TESLA INC', quantity: 35, avgCost: 250.0, closePrice: 214.3, multiplier: 1, openFrac: 0.68 },
  { symbol: 'SPY', assetClass: 'OPT', description: 'SPY', quantity: 5, avgCost: 8.2, closePrice: 11.4, multiplier: 100, openFrac: 0.74, strike: 600, putCall: 'C', expiryDaysAfterEnd: 86 },
  { symbol: 'QQQ', assetClass: 'OPT', description: 'QQQ', quantity: 3, avgCost: 6.5, closePrice: 4.8, multiplier: 100, openFrac: 0.82, strike: 470, putCall: 'P', expiryDaysAfterEnd: 51 },
];

const buildPositions = (dates: string[]): { positions: RawPosition[]; totalValue: number } => {
  const lastDate = dates[dates.length - 1];
  const lastIndex = dates.length - 1;
  const computed = POSITION_SPECS.map((spec) => {
    const value = round2(spec.quantity * spec.closePrice * spec.multiplier);
    const costBasisMoney = round2(spec.avgCost * spec.quantity * spec.multiplier);
    const unrealized = round2((spec.closePrice - spec.avgCost) * spec.quantity * spec.multiplier);
    const openDate = dates[Math.min(lastIndex, Math.max(0, Math.floor(spec.openFrac * lastIndex)))];
    const expiry = spec.assetClass === 'OPT' && spec.expiryDaysAfterEnd ? addDays(lastDate, spec.expiryDaysAfterEnd) : '';
    const description = spec.assetClass === 'OPT'
      ? `${spec.symbol} ${optionDateLabel(expiry)} ${spec.strike} ${spec.putCall === 'P' ? 'PUT' : 'CALL'}`
      : spec.description;
    return { spec, value, costBasisMoney, unrealized, openDate, expiry, description };
  });
  const totalValue = round2(computed.reduce((sum, item) => sum + item.value, 0));
  const positions: RawPosition[] = computed.map(({ spec, value, costBasisMoney, unrealized, openDate, expiry, description }) => ({
    ClientAccountID: ACCOUNT_ID,
    AccountID: ACCOUNT_ID,
    CurrencyPrimary: 'USD',
    Currency: 'USD',
    AssetCategory: spec.assetClass,
    AssetClass: spec.assetClass,
    SubCategory: spec.assetClass === 'OPT' ? (spec.putCall === 'P' ? 'P' : 'C') : 'COMMON',
    Symbol: spec.symbol,
    UnderlyingSymbol: spec.assetClass === 'OPT' ? spec.symbol : '',
    Description: description,
    Quantity: spec.quantity,
    CostBasisMoney: costBasisMoney,
    CostBasisPrice: spec.avgCost,
    MarkPrice: spec.closePrice,
    ClosePrice: spec.closePrice,
    PositionValue: value,
    FifoPnlUnrealized: unrealized,
    PercentOfNAV: round2((value / ENDING_NAV) * 100),
    Side: spec.quantity >= 0 ? 'Long' : 'Short',
    OpenDateTime: openDate,
    Expiry: expiry,
    Strike: spec.strike ?? '',
    'Put/Call': spec.putCall ?? '',
    Multiplier: spec.multiplier,
    ReportDate: lastDate,
  }));
  return { positions, totalValue };
};

// ---------------------------------------------------------------------------
// Closed trade cycles -> drive realized P/L, win rate, profit factor, calendar.
// These are independent of the open positions above (like the IBKR Trades vs
// Open Positions sections), and are generated deterministically.
// ---------------------------------------------------------------------------

type TradingSymbol = { symbol: string; assetClass: 'STK' | 'OPT'; base: number; cycles: number; multiplier: number };

const TRADING_SYMBOLS: TradingSymbol[] = [
  { symbol: 'NVDA', assetClass: 'STK', base: 140, cycles: 6, multiplier: 1 },
  { symbol: 'AAPL', assetClass: 'STK', base: 215, cycles: 5, multiplier: 1 },
  { symbol: 'MSFT', assetClass: 'STK', base: 430, cycles: 5, multiplier: 1 },
  { symbol: 'AMZN', assetClass: 'STK', base: 180, cycles: 5, multiplier: 1 },
  { symbol: 'GOOGL', assetClass: 'STK', base: 165, cycles: 4, multiplier: 1 },
  { symbol: 'META', assetClass: 'STK', base: 530, cycles: 4, multiplier: 1 },
  { symbol: 'TSLA', assetClass: 'STK', base: 235, cycles: 5, multiplier: 1 },
  { symbol: 'AMD', assetClass: 'STK', base: 165, cycles: 4, multiplier: 1 },
  { symbol: 'SPY', assetClass: 'OPT', base: 9.5, cycles: 4, multiplier: 100 },
  { symbol: 'QQQ', assetClass: 'OPT', base: 7.5, cycles: 3, multiplier: 100 },
];

const buildTrades = (dates: string[]): RawTrade[] => {
  const rand = mulberry32(0x5eed1234);
  const rows: RawTrade[] = [];
  const n = dates.length;
  let tradeSeq = 1000;
  let orderSeq = 5000;
  let execSeq = 9000;

  TRADING_SYMBOLS.forEach((sym) => {
    for (let c = 0; c < sym.cycles; c += 1) {
      const openIndex = Math.min(n - 2, Math.floor(rand() * (n * 0.8)));
      const holdDays = 3 + Math.floor(rand() * 22);
      const closeIndex = Math.min(n - 1, openIndex + holdDays);
      const openDate = dates[openIndex];
      const closeDate = dates[closeIndex];

      const lotBase = sym.assetClass === 'OPT' ? 2 + Math.floor(rand() * 8) : 10 + Math.floor(rand() * 11) * 10;
      const quantity = lotBase;
      const entry = round2(sym.base * (0.9 + rand() * 0.2));
      // Slight positive bias -> ~57% winners, profit factor near ~1.8.
      const ret = (rand() - 0.42) * 0.18;
      const exit = round2(entry * (1 + ret));
      const commission = round2(Math.max(1, quantity * (sym.assetClass === 'OPT' ? 0.65 : 0.005)));
      const grossPnl = (exit - entry) * quantity * sym.multiplier;
      const realized = round2(grossPnl - commission * 2);

      const buyMoney = round2(entry * quantity * sym.multiplier);
      const sellMoney = round2(exit * quantity * sym.multiplier);

      const orderId = (orderSeq += 1);
      rows.push({
        ClientAccountID: ACCOUNT_ID,
        AccountID: ACCOUNT_ID,
        CurrencyPrimary: 'USD',
        AssetCategory: sym.assetClass,
        Symbol: sym.symbol,
        Description: sym.symbol,
        TradeID: (tradeSeq += 1),
        IBOrderID: orderId,
        OrderID: orderId,
        ExecID: `DEMO-${(execSeq += 1)}`,
        'Date/Time': `${openDate};100000`,
        TradeDate: openDate,
        ReportDate: openDate,
        TransactionType: 'ExchTrade',
        'Buy/Sell': 'BUY',
        Quantity: quantity,
        TradePrice: entry,
        TradeMoney: buyMoney,
        Proceeds: -buyMoney,
        IBCommission: -commission,
        NetCash: round2(-buyMoney - commission),
        CostBasis: buyMoney,
        FifoPnlRealized: 0,
        MtmPnl: 0,
        OrderType: 'LMT',
        IsAPIOrder: 'Y',
      });

      const orderId2 = (orderSeq += 1);
      rows.push({
        ClientAccountID: ACCOUNT_ID,
        AccountID: ACCOUNT_ID,
        CurrencyPrimary: 'USD',
        AssetCategory: sym.assetClass,
        Symbol: sym.symbol,
        Description: sym.symbol,
        TradeID: (tradeSeq += 1),
        IBOrderID: orderId2,
        OrderID: orderId2,
        ExecID: `DEMO-${(execSeq += 1)}`,
        'Date/Time': `${closeDate};150000`,
        TradeDate: closeDate,
        ReportDate: closeDate,
        TransactionType: 'ExchTrade',
        'Buy/Sell': 'SELL',
        Quantity: -quantity,
        TradePrice: exit,
        TradeMoney: sellMoney,
        Proceeds: sellMoney,
        IBCommission: -commission,
        NetCash: round2(sellMoney - commission),
        CostBasis: buyMoney,
        FifoPnlRealized: realized,
        MtmPnl: 0,
        OrderType: 'LMT',
        IsAPIOrder: 'Y',
      });
    }
  });

  return rows.sort((a, b) => String(a.TradeDate).localeCompare(String(b.TradeDate)));
};

// ---------------------------------------------------------------------------
// NAV equity curve over the supplied trading dates.
// Endpoints are pinned exactly (start = STARTING_NAV, end = ENDING_NAV) and a
// single mid-period withdrawal step is applied so it shows up as cash-flow, not
// a drawdown. The latest NAV equals the demo account value (positions + cash).
// ---------------------------------------------------------------------------

const buildNavRows = (dates: string[]): { navRows: RawNav[]; withdrawalDate: string } => {
  const rand = mulberry32(0xa11ce777);
  const n = dates.length;
  const withdrawalIndex = Math.max(1, Math.floor(n * 0.55));
  const withdrawalDate = dates[withdrawalIndex];

  // Standard-normal sample via Box-Muller, fed by the deterministic PRNG.
  const gaussian = () => {
    const u1 = Math.max(rand(), 1e-9);
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  // Generate realistic daily log-returns: ~1.6% daily volatility (typical for a
  // concentrated mega-cap tech book) plus a deliberate correction window so the
  // curve has a genuine drawdown rather than a suspiciously straight line.
  const DAILY_VOL = 0.016;
  const correctionStart = Math.floor(n * 0.34);
  const correctionEnd = Math.floor(n * 0.45);
  const rawReturns: number[] = [0];
  for (let i = 1; i < n; i += 1) {
    let r = gaussian() * DAILY_VOL;
    if (i >= correctionStart && i <= correctionEnd) r -= 0.0075; // sustained sell-off
    rawReturns.push(r);
  }

  // Shift every daily return by a constant so the compounded series hits the
  // exact gross endpoint (preserves volatility + drawdown shape).
  const targetLogGrowth = Math.log(GROSS_END_NAV / STARTING_NAV);
  const rawLogGrowth = rawReturns.reduce((sum, value) => sum + value, 0);
  const drift = (targetLogGrowth - rawLogGrowth) / (n - 1);

  let grossValue = STARTING_NAV;
  const navRows: RawNav[] = dates.map((date, i) => {
    if (i > 0) grossValue *= Math.exp(rawReturns[i] + drift);
    const navValue = round2(grossValue - (i >= withdrawalIndex ? WITHDRAWAL_AMOUNT : 0));
    const cash = round2(navValue * 0.18);
    return {
      ClientAccountID: ACCOUNT_ID,
      ReportDate: date,
      Total: navValue,
      Cash: cash,
      Stock: round2(navValue - cash),
      Currency: 'USD',
    };
  });

  return { navRows, withdrawalDate };
};

// ---------------------------------------------------------------------------
// Cash transactions: dividends, withholding tax, interest, fees and one
// withdrawal. Deterministic monthly values.
// ---------------------------------------------------------------------------

const buildCashRows = (dates: string[], withdrawalDate: string): RawCash[] => {
  const rows: RawCash[] = [];
  const monthSet = Array.from(new Set(dates.map((date) => date.slice(0, 7)))).sort();
  const dividendSymbols = ['AAPL', 'MSFT', 'AMZN'];

  monthSet.forEach((month, index) => {
    const settle = `${month}-15`;
    // Dividends (steady, mildly growing) with associated withholding tax + a small ADR fee.
    const dividend = round2(180 + index * 12 + (index % 3) * 35);
    rows.push({
      ClientAccountID: ACCOUNT_ID,
      Currency: 'USD',
      FXRateToBase: 1,
      Type: 'Dividends',
      Amount: dividend,
      SettleDate: settle,
      'Date/Time': `${settle};000000`,
      Symbol: dividendSymbols[index % dividendSymbols.length],
      Description: `${dividendSymbols[index % dividendSymbols.length]} CASH DIVIDEND`,
    });
    rows.push({
      ClientAccountID: ACCOUNT_ID,
      Currency: 'USD',
      FXRateToBase: 1,
      Type: 'Withholding Tax',
      Amount: round2(-dividend * 0.15),
      SettleDate: settle,
      'Date/Time': `${settle};000000`,
      Symbol: dividendSymbols[index % dividendSymbols.length],
      Description: 'WITHHOLDING @ 15%',
    });
    // Credit interest received on idle cash.
    rows.push({
      ClientAccountID: ACCOUNT_ID,
      Currency: 'USD',
      FXRateToBase: 1,
      Type: 'Credit Interest',
      Amount: round2(38 + index * 4),
      SettleDate: `${month}-28`,
      'Date/Time': `${month}-28;000000`,
      Symbol: '',
      Description: 'USD CREDIT INT',
    });
    // Broker interest paid + other fees (cash drag).
    rows.push({
      ClientAccountID: ACCOUNT_ID,
      Currency: 'USD',
      FXRateToBase: 1,
      Type: 'Broker Interest Paid',
      Amount: round2(-(12 + (index % 4) * 6)),
      SettleDate: `${month}-28`,
      'Date/Time': `${month}-28;000000`,
      Symbol: '',
      Description: 'USD DEBIT INT',
    });
    rows.push({
      ClientAccountID: ACCOUNT_ID,
      Currency: 'USD',
      FXRateToBase: 1,
      Type: 'Other Fees',
      Amount: round2(-(8 + (index % 2) * 5)),
      SettleDate: `${month}-20`,
      'Date/Time': `${month}-20;000000`,
      Symbol: '',
      Description: 'SNAPSHOT MKT DATA FEE',
    });
  });

  // Single demo withdrawal that matches the NAV step.
  rows.push({
    ClientAccountID: ACCOUNT_ID,
    Currency: 'USD',
    FXRateToBase: 1,
    Type: 'Deposits/Withdrawals',
    Amount: -WITHDRAWAL_AMOUNT,
    SettleDate: withdrawalDate,
    'Date/Time': `${withdrawalDate};000000`,
    Symbol: '',
    Description: 'DISBURSEMENT INITIATED BY DEMO USER',
  });

  return rows;
};

let cachedKey = '';
let cachedData: DemoRawData | null = null;

/**
 * Build the full deterministic demo dataset over the supplied trading dates
 * (typically the real benchmark dates so NASDAQ / S&P 500 lines line up).
 * Result is memoised by the date range so repeated calls are cheap and stable.
 */
export const buildDemoData = (benchmarkDates?: string[]): DemoRawData => {
  const dates = benchmarkDates && benchmarkDates.length >= 2 ? [...benchmarkDates].sort() : fallbackTradingDates();
  const key = `${dates[0]}_${dates[dates.length - 1]}_${dates.length}`;
  if (cachedData && cachedKey === key) return cachedData;

  const { positions } = buildPositions(dates);
  const rows = buildTrades(dates);
  const { navRows, withdrawalDate } = buildNavRows(dates);
  const cashRows = buildCashRows(dates, withdrawalDate);

  cachedKey = key;
  cachedData = { rows, positions, navRows, cashRows };
  return cachedData;
};

export const DEMO_ENDING_NAV = ENDING_NAV;
export const DEMO_STARTING_NAV = STARTING_NAV;
