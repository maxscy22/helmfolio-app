import { describe, expect, it } from 'vitest';
import { calculateDashboardStats } from './analytics';
import type { RawTrade } from './types';

const makeTrade = (overrides: Partial<Record<string, unknown>> = {}): RawTrade => ({
  AccountID: 'TEST',
  Currency: 'USD',
  AssetCategory: 'STK',
  Symbol: 'AAPL',
  TradeID: String(Math.random()),
  OrderID: String(Math.random()),
  ExecutionID: String(Math.random()),
  'Date/Time': '20250101;100000',
  TradeDate: '20250101',
  Quantity: 0,
  TradePrice: 0,
  ClosePrice: 0,
  TradeMoney: 0,
  Taxes: 0,
  IBCommission: -1,
  NetCash: 0,
  CostBasis: 0,
  RealizedPL: 0,
  MTMPL: 0,
  'Buy/Sell': '',
  OrderType: 'LMT',
  ...overrides,
} as unknown as RawTrade);

describe('calculateDashboardStats', () => {
  it('returns empty stats for empty input', () => {
    const stats = calculateDashboardStats([], []);
    expect(stats.totalTrades).toBe(0);
    expect(stats.tradeCycles).toEqual([]);
    expect(stats.winners).toEqual([]);
    expect(stats.losers).toEqual([]);
    expect(stats.winRate).toBe(0);
    expect(stats.profitFactor).toBe(0);
  });

  it('closes a cycle when running quantity returns to zero and records a winner', () => {
    const trades: RawTrade[] = [
      makeTrade({ Symbol: 'AAPL', 'Date/Time': '20250101;100000', Quantity: 100, TradePrice: 150, TradeMoney: 15000, 'Buy/Sell': 'BUY', RealizedPL: 0 }),
      makeTrade({ Symbol: 'AAPL', 'Date/Time': '20250115;100000', Quantity: -100, TradePrice: 160, TradeMoney: 16000, 'Buy/Sell': 'SELL', RealizedPL: 1000 }),
    ];
    const stats = calculateDashboardStats(trades, []);
    expect(stats.tradeCycles).toHaveLength(1);
    expect(stats.tradeCycles[0].symbol).toBe('AAPL');
    expect(stats.tradeCycles[0].realizedPnl).toBe(1000);
    expect(stats.tradeCycles[0].buyQuantity).toBe(100);
    expect(stats.tradeCycles[0].sellQuantity).toBe(100);
    expect(stats.tradeCycles[0].result).toBe('WIN');
    expect(stats.winners).toHaveLength(1);
    expect(stats.losers).toHaveLength(0);
    expect(stats.winRate).toBe(1);
  });

  it('does NOT close a cycle on partial sell (running quantity > 0)', () => {
    const trades: RawTrade[] = [
      makeTrade({ Symbol: 'NVDA', 'Date/Time': '20250101;100000', Quantity: 100, TradePrice: 500, TradeMoney: 50000, 'Buy/Sell': 'BUY' }),
      makeTrade({ Symbol: 'NVDA', 'Date/Time': '20250115;100000', Quantity: -50, TradePrice: 600, TradeMoney: 30000, 'Buy/Sell': 'SELL', RealizedPL: 5000 }),
    ];
    const stats = calculateDashboardStats(trades, []);
    expect(stats.tradeCycles).toHaveLength(0);
    expect(stats.winners).toHaveLength(0);
    expect(stats.losers).toHaveLength(0);
    expect(stats.totalRealizedPnl).toBe(5000);
  });

  it('treats SGOV/IB01 bond-cash-yield cycles as excluded from winners/losers ranking', () => {
    const trades: RawTrade[] = [
      makeTrade({ Symbol: 'SGOV', 'Date/Time': '20250101;100000', Quantity: 100, TradePrice: 100, TradeMoney: 10000, 'Buy/Sell': 'BUY' }),
      makeTrade({ Symbol: 'SGOV', 'Date/Time': '20250201;100000', Quantity: -100, TradePrice: 100.5, TradeMoney: 10050, 'Buy/Sell': 'SELL', RealizedPL: 50 }),
      makeTrade({ Symbol: 'AAPL', 'Date/Time': '20250101;100000', Quantity: 100, TradePrice: 150, TradeMoney: 15000, 'Buy/Sell': 'BUY' }),
      makeTrade({ Symbol: 'AAPL', 'Date/Time': '20250115;100000', Quantity: -100, TradePrice: 145, TradeMoney: 14500, 'Buy/Sell': 'SELL', RealizedPL: -500 }),
    ];
    const stats = calculateDashboardStats(trades, []);
    expect(stats.tradeCycles).toHaveLength(2);
    expect(stats.winners).toHaveLength(0);
    expect(stats.losers).toHaveLength(1);
    expect(stats.losers[0].symbol).toBe('AAPL');
    expect(stats.losers[0].realizedPnl).toBe(-500);
  });

  it('sorts winners by descending realized P/L and losers by ascending realized P/L', () => {
    const trades: RawTrade[] = [
      makeTrade({ Symbol: 'A', 'Date/Time': '20250101;100000', Quantity: 10, TradePrice: 10, TradeMoney: 100, 'Buy/Sell': 'BUY' }),
      makeTrade({ Symbol: 'A', 'Date/Time': '20250102;100000', Quantity: -10, TradePrice: 11, TradeMoney: 110, 'Buy/Sell': 'SELL', RealizedPL: 10 }),
      makeTrade({ Symbol: 'B', 'Date/Time': '20250101;100000', Quantity: 10, TradePrice: 10, TradeMoney: 100, 'Buy/Sell': 'BUY' }),
      makeTrade({ Symbol: 'B', 'Date/Time': '20250102;100000', Quantity: -10, TradePrice: 20, TradeMoney: 200, 'Buy/Sell': 'SELL', RealizedPL: 100 }),
      makeTrade({ Symbol: 'C', 'Date/Time': '20250101;100000', Quantity: 10, TradePrice: 10, TradeMoney: 100, 'Buy/Sell': 'BUY' }),
      makeTrade({ Symbol: 'C', 'Date/Time': '20250102;100000', Quantity: -10, TradePrice: 5, TradeMoney: 50, 'Buy/Sell': 'SELL', RealizedPL: -50 }),
      makeTrade({ Symbol: 'D', 'Date/Time': '20250101;100000', Quantity: 10, TradePrice: 10, TradeMoney: 100, 'Buy/Sell': 'BUY' }),
      makeTrade({ Symbol: 'D', 'Date/Time': '20250102;100000', Quantity: -10, TradePrice: 8, TradeMoney: 80, 'Buy/Sell': 'SELL', RealizedPL: -20 }),
    ];
    const stats = calculateDashboardStats(trades, []);
    expect(stats.winners.map((w) => w.symbol)).toEqual(['B', 'A']);
    expect(stats.losers.map((l) => l.symbol)).toEqual(['C', 'D']);
    expect(stats.winners[0].realizedPnl).toBe(100);
    expect(stats.losers[0].realizedPnl).toBe(-50);
  });

  it('aggregates monthly stats with realized P/L and commission sums', () => {
    const trades: RawTrade[] = [
      makeTrade({ Symbol: 'AAPL', 'Date/Time': '20250115;100000', TradeDate: '20250115', Quantity: 100, TradePrice: 150, TradeMoney: 15000, 'Buy/Sell': 'BUY', IBCommission: -1 }),
      makeTrade({ Symbol: 'AAPL', 'Date/Time': '20250120;100000', TradeDate: '20250120', Quantity: -100, TradePrice: 160, TradeMoney: 16000, 'Buy/Sell': 'SELL', IBCommission: -1, RealizedPL: 1000 }),
      makeTrade({ Symbol: 'MSFT', 'Date/Time': '20250215;100000', TradeDate: '20250215', Quantity: 50, TradePrice: 400, TradeMoney: 20000, 'Buy/Sell': 'BUY', IBCommission: -2 }),
      makeTrade({ Symbol: 'MSFT', 'Date/Time': '20250228;100000', TradeDate: '20250228', Quantity: -50, TradePrice: 420, TradeMoney: 21000, 'Buy/Sell': 'SELL', IBCommission: -2, RealizedPL: 1000 }),
    ];
    const stats = calculateDashboardStats(trades, []);
    const jan = stats.byMonth.find((row) => row.month === '2025-01');
    const feb = stats.byMonth.find((row) => row.month === '2025-02');
    expect(jan?.realizedPnl).toBe(1000);
    expect(jan?.commissions).toBe(-2);
    expect(feb?.realizedPnl).toBe(1000);
    expect(feb?.commissions).toBe(-4);
    expect(stats.totalCommissions).toBe(-6);
  });

  it('treats multiple buys followed by a single equal-quantity sell as one cycle', () => {
    const trades: RawTrade[] = [
      makeTrade({ Symbol: 'TSLA', 'Date/Time': '20250101;100000', Quantity: 50, TradePrice: 200, TradeMoney: 10000, 'Buy/Sell': 'BUY' }),
      makeTrade({ Symbol: 'TSLA', 'Date/Time': '20250105;100000', Quantity: 50, TradePrice: 210, TradeMoney: 10500, 'Buy/Sell': 'BUY' }),
      makeTrade({ Symbol: 'TSLA', 'Date/Time': '20250120;100000', Quantity: -100, TradePrice: 220, TradeMoney: 22000, 'Buy/Sell': 'SELL', RealizedPL: 1500 }),
    ];
    const stats = calculateDashboardStats(trades, []);
    expect(stats.tradeCycles).toHaveLength(1);
    expect(stats.tradeCycles[0].trades).toBe(3);
    expect(stats.tradeCycles[0].buyQuantity).toBe(100);
    expect(stats.tradeCycles[0].sellQuantity).toBe(100);
    expect(stats.tradeCycles[0].realizedPnl).toBe(1500);
  });

  it('computes profit factor and payoff ratio correctly with mixed winners and losers', () => {
    const trades: RawTrade[] = [
      makeTrade({ Symbol: 'A', 'Date/Time': '20250101;100000', Quantity: 10, TradePrice: 100, TradeMoney: 1000, 'Buy/Sell': 'BUY' }),
      makeTrade({ Symbol: 'A', 'Date/Time': '20250110;100000', Quantity: -10, TradePrice: 110, TradeMoney: 1100, 'Buy/Sell': 'SELL', RealizedPL: 100 }),
      makeTrade({ Symbol: 'B', 'Date/Time': '20250101;100000', Quantity: 10, TradePrice: 100, TradeMoney: 1000, 'Buy/Sell': 'BUY' }),
      makeTrade({ Symbol: 'B', 'Date/Time': '20250110;100000', Quantity: -10, TradePrice: 95, TradeMoney: 950, 'Buy/Sell': 'SELL', RealizedPL: -50 }),
    ];
    const stats = calculateDashboardStats(trades, []);
    expect(stats.winners).toHaveLength(1);
    expect(stats.losers).toHaveLength(1);
    expect(stats.winRate).toBe(0.5);
    expect(stats.profitFactor).toBe(2);
    expect(stats.profitLossRatio).toBe(2);
  });
});
