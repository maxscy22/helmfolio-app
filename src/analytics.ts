import type { DailyStats, DashboardStats, MonthlyStats, Position, RawPosition, RawTrade, SymbolStats, Trade, TradeCycle } from './types';

const canonicalKey = (key: string): string => key.replace(/^\uFEFF/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

const valueFor = (row: RawTrade, keys: string[]): string | number | null | undefined => {
  const entries = Object.entries(row);
  const aliases = keys.map(canonicalKey);
  return entries.find(([key]) => aliases.includes(canonicalKey(key)))?.[1];
};

const field = (row: RawTrade, keys: string[]): string => String(valueFor(row, keys) ?? '').trim();

const numberField = (row: RawTrade, keys: string[]): number => {
  const raw = String(valueFor(row, keys) ?? '').replace(/[$,%\s]/g, '').replace(/,/g, '');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDateValue = (rawDate: string): number => {
  const [datePart, timePart = ''] = String(rawDate || '').split(';');
  if (/^\d{8}$/.test(datePart)) {
    return new Date(
      Number(datePart.slice(0, 4)),
      Number(datePart.slice(4, 6)) - 1,
      Number(datePart.slice(6, 8)),
      Number(timePart.slice(0, 2) || 0),
      Number(timePart.slice(2, 4) || 0),
      Number(timePart.slice(4, 6) || 0),
    ).getTime();
  }
  const value = new Date(datePart).getTime();
  return Number.isFinite(value) ? value : 0;
};

const tradeDateValue = (trade: Trade): number => {
  return parseDateValue(trade.date || trade.tradeDate);
};

const normalizedId = (value: string): string => String(value || '').trim().replace(/\.0$/, '');

const orderIdentity = (trade: Trade): string => {
  const explicitOrderId = normalizedId(trade.orderId);
  if (explicitOrderId) return `order|${explicitOrderId}`;
  const dateKey = trade.date || trade.tradeDate;
  return [
    'derived-order',
    trade.accountId,
    trade.symbol,
    tradeSide(trade),
    dateKey,
    trade.orderType,
    Math.abs(trade.quantity),
    trade.price,
  ].join('|');
};

const countOrders = (trades: Trade[]): number => new Set(trades.map(orderIdentity)).size;

const tradeSide = (trade: Trade): 'BUY' | 'SELL' | 'UNKNOWN' => {
  const side = trade.buySell.toUpperCase();
  if (side === 'BUY' || side === 'SELL') return side;
  if (trade.quantity > 0) return 'BUY';
  if (trade.quantity < 0) return 'SELL';
  return 'UNKNOWN';
};

const tradeCashAmount = (trade: Trade): number => Math.abs(trade.tradeMoney || trade.quantity * trade.price);

const assetClassLabel = (assetClass: string): string => {
  const value = assetClass.toUpperCase();
  if (value === 'STK') return 'STOCK';
  if (value === 'OPT') return 'OPTION';
  if (value === 'CASH') return 'CASH / FX';
  if (value === 'FUT') return 'FUTURE';
  if (value === 'BOND') return 'BOND';
  return assetClass || 'Unknown';
};

const numberValue = (value: unknown): number => {
  if (value === undefined || value === null || value === '') return 0;
  return Number(String(value).replace(/,/g, '')) || 0;
};

const bondCashYieldSymbols = new Set(['SGOV', 'IB01']);
const isBondCashYieldSymbol = (symbol: string) => bondCashYieldSymbols.has(symbol.toUpperCase());

const assetContributionLabel = (trade: Trade): string => {
  if (isBondCashYieldSymbol(trade.symbol)) return trade.symbol.toUpperCase();
  return assetClassLabel(trade.assetClass);
};

export const normalizeTrade = (row: RawTrade): Trade => ({
  accountId: field(row, ['Account ID', 'AccountID', 'ClientAccountID', 'accountId']),
  currency: field(row, ['Currency', 'CurrencyPrimary', 'currency']),
  assetClass: field(row, ['Asset Class', 'AssetCategory', 'assetCategory']),
  subCategory: field(row, ['Sub Category', 'SubCategory', 'subCategory']),
  symbol: field(row, ['Symbol', 'symbol']) || field(row, ['Underlying Symbol', 'UnderlyingSymbol', 'underlyingSymbol']) || 'UNKNOWN',
  description: field(row, ['Description', 'description']),
  tradeId: field(row, ['Trade ID', 'TradeID', 'tradeID']),
  orderId: field(row, ['Order ID', 'OrderID', 'IB Order ID', 'IBOrderID', 'ibOrderId', 'Order Reference', 'OrderReference', 'orderReference', 'Order Ref', 'OrderRef']),
  executionId: field(row, ['Execution ID', 'ExecutionID', 'Exec ID', 'ExecID', 'execId', 'Execution', 'execution']),
  date: field(row, ['Date/Time', 'DateTime', 'dateTime']),
  tradeDate: field(row, ['Trade Date', 'TradeDate', 'tradeDate']) || field(row, ['Report Date', 'ReportDate', 'reportDate']),
  transactionType: field(row, ['Transaction Type', 'TransactionType', 'transactionType']),
  exchange: field(row, ['Exchange', 'exchange']),
  quantity: numberField(row, ['Quantity', 'Qty', 'quantity']),
  price: numberField(row, ['TradePrice', 'Trade Price', 'tradePrice']),
  closePrice: numberField(row, ['ClosePrice', 'Close Price', 'closePrice']),
  tradeMoney: numberField(row, ['Trade Money', 'TradeMoney', 'tradeMoney']),
  proceeds: numberField(row, ['Proceeds', 'proceeds']),
  taxes: numberField(row, ['Taxes', 'taxes']),
  commission: numberField(row, ['IB Commission', 'IBCommission', 'ibCommission']),
  netCash: numberField(row, ['Net Cash', 'NetCash', 'netCash']),
  costBasis: numberField(row, ['Cost Basis', 'CostBasis', 'cost']),
  realizedPnl: numberField(row, ['Realized P/L', 'RealizedPL', 'FifoPnlRealized', 'FIFO PnL Realized', 'fifoPnlRealized']),
  mtmPnl: numberField(row, ['MTM P/L', 'MTMPL', 'MtmPnl', 'mtmPnl']),
  buySell: field(row, ['Buy/Sell', 'BuySell', 'buySell']),
  orderType: field(row, ['Order Type', 'OrderType', 'orderType']),
  isApiOrder: field(row, ['Is API Order', 'IsAPIOrder', 'isAPIOrder']),
});

export const normalizePosition = (row: RawPosition): Position => {
  const quantity = numberField(row, ['Quantity', 'quantity', 'Position', 'position', 'Open Quantity', 'OpenQuantity', 'openQuantity']);
  const costBasis = numberField(row, ['Cost Basis', 'CostBasis', 'costBasis', 'cost', 'Cost Basis Money', 'CostBasisMoney', 'costBasisMoney']);
  const closePrice = numberField(row, ['Close Price', 'ClosePrice', 'closePrice', 'Mark Price', 'MarkPrice', 'markPrice', 'Current Price', 'CurrentPrice', 'currentPrice']);
  const value = numberField(row, ['Value', 'value', 'Market Value', 'MarketValue', 'marketValue', 'Position Value', 'PositionValue', 'positionValue']);
  const explicitUnrealizedValue = valueFor(row, ['Unrealized P/L', 'UnrealizedPL', 'Unrealized PnL', 'UnrealizedPnL', 'unrealizedPnl', 'FIFO PnL Unrealized', 'FifoPnlUnrealized', 'fifoPnlUnrealized', 'MTM P/L', 'MTMPL', 'MtmPnl', 'mtmPnl']);
  const explicitUnrealized = numberField(row, ['Unrealized P/L', 'UnrealizedPL', 'Unrealized PnL', 'UnrealizedPnL', 'unrealizedPnl', 'FIFO PnL Unrealized', 'FifoPnlUnrealized', 'fifoPnlUnrealized', 'MTM P/L', 'MTMPL', 'MtmPnl', 'mtmPnl']);
  const computedUnrealized = value && costBasis ? value - costBasis : closePrice && costBasis && quantity ? quantity * closePrice - costBasis : 0;
  return {
    accountId: field(row, ['Account ID', 'AccountID', 'accountId', 'acctId']),
    currency: field(row, ['Currency', 'currency']),
    assetClass: field(row, ['Asset Class', 'AssetCategory', 'assetCategory']),
    subCategory: field(row, ['Sub Category', 'SubCategory', 'subCategory']),
    symbol: field(row, ['Symbol', 'symbol', 'Underlying Symbol', 'UnderlyingSymbol', 'underlyingSymbol']) || 'UNKNOWN',
    underlyingSymbol: field(row, ['Underlying Symbol', 'UnderlyingSymbol', 'underlyingSymbol']),
    description: field(row, ['Description', 'description']),
    quantity,
    costBasis,
    closePrice,
    value,
    unrealizedPnl: explicitUnrealizedValue === null || explicitUnrealizedValue === undefined || String(explicitUnrealizedValue).trim() === '' ? computedUnrealized : explicitUnrealized,
    percentOfNav: numberField(row, ['Percent of NAV', 'PercentOfNAV', 'percentOfNav']),
    side: field(row, ['Side', 'side']),
    openDate: field(row, ['Open Date Time', 'OpenDateTime', 'openDateTime', 'Open Date', 'OpenDate']),
    expiry: field(row, ['Expiry', 'expiry']),
    strike: numberField(row, ['Strike', 'strike']),
    putCall: field(row, ['Put/Call', 'PutCall', 'putCall']),
    multiplier: numberField(row, ['Multiplier', 'multiplier']),
    source: 'IBKR_POSITION',
  };
};

const sum = <T>(items: T[], selector: (item: T) => number): number => items.reduce((total, item) => total + selector(item), 0);

const round = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const groupBy = <T>(items: T[], keySelector: (item: T) => string): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();
  items.forEach((item) => {
    const key = keySelector(item) || 'Unknown';
    const group = grouped.get(key);
    if (group) {
      group.push(item);
    } else {
      grouped.set(key, [item]);
    }
  });
  return grouped;
};

const monthKey = (trade: Trade): string => {
  const value = parseDateValue(trade.tradeDate || trade.date);
  if (!value) return 'Unknown';
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const dateKey = (trade: Trade): string => {
  const rawDate = trade.tradeDate || trade.date;
  const datePart = rawDate.split(';')[0];
  if (/^\d{8}$/.test(datePart)) return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
  const value = parseDateValue(rawDate);
  if (!value) return 'Unknown';
  const date = new Date(value);
  return date.toISOString().slice(0, 10);
};

const buildTradeCycles = (trades: Trade[]): TradeCycle[] => {
  const cycles: TradeCycle[] = [];
  Array.from(groupBy(trades, (trade) => trade.symbol)).forEach(([symbol, symbolTrades]) => {
    const ordered = [...symbolTrades].sort((a, b) => tradeDateValue(a) - tradeDateValue(b));
    let runningQuantity = 0;
    let cycleRows: Trade[] = [];
    ordered.forEach((trade) => {
      cycleRows = [...cycleRows, trade];
      runningQuantity += trade.quantity;
      if (Math.abs(runningQuantity) < 0.000001) {
        const buyRows = cycleRows.filter((row) => tradeSide(row) === 'BUY');
        const sellRows = cycleRows.filter((row) => tradeSide(row) === 'SELL');
        const buyQuantity = round(sum(buyRows, (row) => Math.abs(row.quantity)));
        const sellQuantity = round(sum(sellRows, (row) => Math.abs(row.quantity)));
        const totalIn = round(sum(buyRows, tradeCashAmount));
        const totalOut = round(sum(sellRows, tradeCashAmount));
        const realizedPnl = round(sum(cycleRows, (row) => row.realizedPnl));
        cycles.push({
          symbol,
          start: cycleRows[0]?.date || cycleRows[0]?.tradeDate || '',
          end: cycleRows[cycleRows.length - 1]?.date || cycleRows[cycleRows.length - 1]?.tradeDate || '',
          trades: cycleRows.length,
          orders: countOrders(cycleRows),
          executions: cycleRows.length,
          shares: buyQuantity,
          buyQuantity,
          sellQuantity,
          averageBuyPrice: buyQuantity ? round(sum(buyRows, (row) => Math.abs(row.quantity) * row.price) / buyQuantity) : 0,
          averageSellPrice: sellQuantity ? round(sum(sellRows, (row) => Math.abs(row.quantity) * row.price) / sellQuantity) : 0,
          totalIn,
          totalOut,
          commissions: round(sum(cycleRows, (row) => row.commission)),
          realizedPnl,
          result: realizedPnl > 0 ? 'WIN' : realizedPnl < 0 ? 'LOSS' : 'BREAKEVEN',
        });
        cycleRows = [];
      }
    });
  });
  return cycles;
};

const inferPositionsFromTrades = (trades: Trade[]): Position[] => {
  const inferred: Position[] = [];
  Array.from(groupBy(trades, (trade) => trade.symbol)).forEach(([symbol, symbolTrades]) => {
    const ordered = [...symbolTrades].sort((a, b) => tradeDateValue(a) - tradeDateValue(b));
    const lastTrade = ordered[ordered.length - 1];
    if (!lastTrade || lastTrade.assetClass.toUpperCase() === 'CASH') return;

    const lots: { quantity: number; price: number }[] = [];
    ordered.forEach((trade) => {
      let remainingQuantity = trade.quantity;
      while (Math.abs(remainingQuantity) > 0.000001 && lots.length && Math.sign(lots[0].quantity) !== Math.sign(remainingQuantity)) {
        const lot = lots[0];
        const closedQuantity = Math.min(Math.abs(lot.quantity), Math.abs(remainingQuantity));
        lot.quantity += Math.sign(remainingQuantity) * closedQuantity;
        remainingQuantity -= Math.sign(remainingQuantity) * closedQuantity;
        if (Math.abs(lot.quantity) <= 0.000001) lots.shift();
      }
      if (Math.abs(remainingQuantity) > 0.000001) {
        lots.push({ quantity: remainingQuantity, price: trade.price });
      }
    });

    const quantity = round(sum(lots, (lot) => lot.quantity));
    const closePrice = lastTrade.closePrice || lastTrade.price || 0;
    if (!quantity || !closePrice) return;
    const costBasis = round(sum(lots, (lot) => lot.quantity * lot.price));
    const value = round(quantity * closePrice);
    const unrealizedPnl = value - costBasis;
    inferred.push({
      accountId: lastTrade.accountId,
      currency: lastTrade.currency,
      assetClass: lastTrade.assetClass,
      subCategory: lastTrade.subCategory,
      symbol,
      underlyingSymbol: '',
      description: lastTrade.description,
      quantity,
      costBasis,
      closePrice,
      value,
      unrealizedPnl: round(unrealizedPnl),
      percentOfNav: 0,
      side: quantity > 0 ? 'Long' : 'Short',
      openDate: '',
      expiry: '',
      strike: 0,
      putCall: '',
      multiplier: 0,
      source: 'INFERRED_FROM_TRADES',
    });
  });
  return inferred;
};

export const calculateDashboardStats = (rawRows: RawTrade[], rawPositions: RawPosition[] = []): DashboardStats => {
  const trades = rawRows.map(normalizeTrade).filter((trade) => trade.symbol !== 'UNKNOWN' && trade.symbol.toLowerCase() !== 'symbol');
  const importedPositions = rawPositions.map(normalizePosition).filter((position) => position.symbol !== 'UNKNOWN' && position.quantity !== 0);
  const positions = importedPositions.length ? importedPositions : inferPositionsFromTrades(trades);
  const sortedTrades = [...trades].sort((a, b) => tradeDateValue(a) - tradeDateValue(b));
  const tradeCycles = buildTradeCycles(trades);
  const realizedCycles = tradeCycles.filter((cycle) => !isBondCashYieldSymbol(cycle.symbol) && cycle.realizedPnl !== 0);
  const winners = realizedCycles.filter((cycle) => cycle.realizedPnl > 0);
  const losers = realizedCycles.filter((cycle) => cycle.realizedPnl < 0);
  const grossProfit = sum(winners, (cycle) => cycle.realizedPnl);
  const grossLoss = Math.abs(sum(losers, (cycle) => cycle.realizedPnl));
  const averageWinner = winners.length ? grossProfit / winners.length : 0;
  const averageLoser = losers.length ? grossLoss / losers.length : 0;
  const winRate = realizedCycles.length ? winners.length / realizedCycles.length : 0;
  const bySymbol: SymbolStats[] = Array.from(groupBy(trades, (trade) => trade.symbol)).map(([symbol, symbolTrades]) => {
    const symbolRealizedCycles = tradeCycles.filter((cycle) => cycle.symbol === symbol && cycle.realizedPnl !== 0);
    const symbolWinners = symbolRealizedCycles.filter((cycle) => cycle.realizedPnl > 0).length;
    const realizedPnl = round(sum(symbolTrades, (trade) => trade.realizedPnl));
    const totalIn = round(sum(symbolTrades.filter((trade) => tradeSide(trade) === 'BUY'), tradeCashAmount));
    const totalOut = round(sum(symbolTrades.filter((trade) => tradeSide(trade) === 'SELL'), tradeCashAmount));
    return {
      symbol,
      trades: symbolTrades.length,
      orders: countOrders(symbolTrades),
      executions: symbolTrades.length,
      quantity: round(sum(symbolTrades, (trade) => Math.abs(trade.quantity))),
      totalIn,
      totalOut,
      netTradeMoney: round(totalIn - totalOut),
      realizedPnl,
      mtmPnl: round(sum(symbolTrades, (trade) => trade.mtmPnl)),
      commissions: round(sum(symbolTrades, (trade) => trade.commission)),
      netCash: round(sum(symbolTrades, (trade) => trade.netCash)),
      winRate: symbolRealizedCycles.length ? symbolWinners / symbolRealizedCycles.length : 0,
      result: realizedPnl > 0 ? 'WIN' : realizedPnl < 0 ? 'LOSS' : 'BREAKEVEN',
    };
  });
  const winningSymbols = bySymbol.filter((symbol) => symbol.result === 'WIN').length;
  const losingSymbols = bySymbol.filter((symbol) => symbol.result === 'LOSS').length;
  const breakevenSymbols = bySymbol.filter((symbol) => symbol.result === 'BREAKEVEN').length;
  const byMonth: MonthlyStats[] = Array.from(groupBy(sortedTrades, monthKey)).map(([month, monthTrades]) => ({
    month,
    realizedPnl: round(sum(monthTrades, (trade) => trade.realizedPnl)),
    mtmPnl: round(sum(monthTrades, (trade) => trade.mtmPnl)),
    commissions: round(sum(monthTrades, (trade) => trade.commission)),
    trades: monthTrades.length,
  }));
  const byDay: DailyStats[] = Array.from(groupBy(sortedTrades, dateKey)).map(([date, dayTrades]) => ({
    date,
    realizedPnl: round(sum(dayTrades, (trade) => trade.realizedPnl)),
    trades: dayTrades.length,
  })).sort((a, b) => a.date.localeCompare(b.date));
  const byAssetClass = Array.from(groupBy(trades, assetContributionLabel)).map(([name, classTrades]) => ({
    name,
    value: round(sum(classTrades, (trade) => trade.realizedPnl)),
    trades: classTrades.length,
  }));
  let cumulativePortfolioPnl = 0;
  const portfolioCurve = Array.from(groupBy(sortedTrades.filter((trade) => trade.realizedPnl !== 0), dateKey))
    .map(([date, dayTrades]) => ({ date, realizedPnl: sum(dayTrades, (trade) => trade.realizedPnl) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => {
      cumulativePortfolioPnl += point.realizedPnl;
      return { date: point.date, portfolio: round(cumulativePortfolioPnl) };
    });

  return {
    trades: sortedTrades,
    totalTrades: trades.length,
    totalOrders: countOrders(trades),
    totalExecutions: trades.length,
    totalRealizedPnl: round(sum(trades, (trade) => trade.realizedPnl)),
    totalMtmPnl: round(sum(trades, (trade) => trade.mtmPnl)),
    totalUnrealizedPnl: round(sum(positions, (position) => position.unrealizedPnl)),
    positions,
    positionsCount: positions.length,
    totalCommissions: round(sum(trades, (trade) => trade.commission)),
    totalTaxes: round(sum(trades, (trade) => trade.taxes)),
    totalNetCash: round(sum(trades, (trade) => trade.netCash)),
    winners: winners.sort((a, b) => b.realizedPnl - a.realizedPnl),
    losers: losers.sort((a, b) => a.realizedPnl - b.realizedPnl),
    winningSymbols,
    losingSymbols,
    breakevenSymbols,
    winRate,
    averageWinner: round(averageWinner),
    averageLoser: round(averageLoser),
    profitLossRatio: averageLoser ? round(averageWinner / averageLoser) : 0,
    profitFactor: grossLoss ? round(grossProfit / grossLoss) : 0,
    expectancy: round(winRate * averageWinner - (1 - winRate) * averageLoser),
    largestWinner: winners[0] ?? null,
    largestLoser: losers[0] ?? null,
    bySymbol: bySymbol.sort((a, b) => b.realizedPnl - a.realizedPnl),
    byMonth,
    byDay,
    tradeCycles,
    byAssetClass,
    portfolioCurve,
    benchmark: [
      { name: 'Your realized P/L', returnPct: 0 },
      { name: 'NASDAQ', returnPct: 0 },
      { name: 'S&P 500', returnPct: 0 },
    ],
  };
};
