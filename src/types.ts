export type RawTrade = Record<string, string | number | null | undefined>;
export type RawPosition = Record<string, string | number | null | undefined>;
export type RawNav = Record<string, string | number | null | undefined>;
export type RawCash = Record<string, string | number | null | undefined>;

export type Trade = {
  accountId: string;
  currency: string;
  assetClass: string;
  subCategory: string;
  symbol: string;
  description: string;
  tradeId: string;
  orderId: string;
  executionId: string;
  date: string;
  tradeDate: string;
  transactionType: string;
  exchange: string;
  quantity: number;
  price: number;
  closePrice: number;
  tradeMoney: number;
  proceeds: number;
  taxes: number;
  commission: number;
  netCash: number;
  costBasis: number;
  realizedPnl: number;
  mtmPnl: number;
  buySell: string;
  orderType: string;
  isApiOrder: string;
};

export type SymbolStats = {
  symbol: string;
  trades: number;
  orders: number;
  executions: number;
  quantity: number;
  totalIn: number;
  totalOut: number;
  netTradeMoney: number;
  realizedPnl: number;
  mtmPnl: number;
  commissions: number;
  netCash: number;
  winRate: number;
  result: 'WIN' | 'LOSS' | 'BREAKEVEN';
};

export type MonthlyStats = {
  month: string;
  realizedPnl: number;
  mtmPnl: number;
  commissions: number;
  trades: number;
};

export type DailyStats = {
  date: string;
  realizedPnl: number;
  trades: number;
};

export type Position = {
  accountId: string;
  currency: string;
  assetClass: string;
  subCategory: string;
  symbol: string;
  underlyingSymbol: string;
  description: string;
  quantity: number;
  costBasis: number;
  closePrice: number;
  value: number;
  unrealizedPnl: number;
  percentOfNav: number;
  side: string;
  openDate: string;
  expiry: string;
  strike: number;
  putCall: string;
  multiplier: number;
  source?: 'IBKR_POSITION' | 'INFERRED_FROM_TRADES';
};

export type TradeCycle = {
  symbol: string;
  start: string;
  end: string;
  trades: number;
  orders: number;
  executions: number;
  shares: number;
  buyQuantity: number;
  sellQuantity: number;
  averageBuyPrice: number;
  averageSellPrice: number;
  totalIn: number;
  totalOut: number;
  commissions: number;
  realizedPnl: number;
  result: 'WIN' | 'LOSS' | 'BREAKEVEN';
};

export type DashboardStats = {
  trades: Trade[];
  totalTrades: number;
  totalOrders: number;
  totalExecutions: number;
  totalRealizedPnl: number;
  totalMtmPnl: number;
  totalUnrealizedPnl: number;
  positions: Position[];
  positionsCount: number;
  totalCommissions: number;
  totalTaxes: number;
  totalNetCash: number;
  winners: TradeCycle[];
  losers: TradeCycle[];
  winningSymbols: number;
  losingSymbols: number;
  breakevenSymbols: number;
  winRate: number;
  averageWinner: number;
  averageLoser: number;
  profitLossRatio: number;
  profitFactor: number;
  expectancy: number;
  largestWinner: TradeCycle | null;
  largestLoser: TradeCycle | null;
  bySymbol: SymbolStats[];
  byMonth: MonthlyStats[];
  byDay: DailyStats[];
  tradeCycles: TradeCycle[];
  byAssetClass: { name: string; value: number; trades: number }[];
  portfolioCurve: { date: string; portfolio: number }[];
  benchmark: { name: string; returnPct: number }[];
};
