import assert from 'node:assert/strict';
import { calculateDashboardStats } from '../src/analytics.ts';

const nearlyEqual = (actual, expected, tolerance = 0.01) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} to be within ${tolerance} of ${expected}`);
};

const trades = [
  { Symbol: 'AAA', TradeID: '1', TradeDate: '2026-01-02', Quantity: '10', TradePrice: '100', TradeMoney: '-1000', FifoPnlRealized: '0', IBCommission: '-1', 'Buy/Sell': 'BUY', AssetClass: 'STK' },
  { Symbol: 'AAA', TradeID: '2', TradeDate: '2026-01-03', Quantity: '-10', TradePrice: '110', TradeMoney: '1100', FifoPnlRealized: '100', IBCommission: '-1', 'Buy/Sell': 'SELL', AssetClass: 'STK' },
  { Symbol: 'BBB', TradeID: '3', TradeDate: '2026-01-04', Quantity: '5', TradePrice: '50', TradeMoney: '-250', FifoPnlRealized: '0', IBCommission: '-1', 'Buy/Sell': 'BUY', AssetClass: 'STK' },
  { Symbol: 'BBB', TradeID: '4', TradeDate: '2026-01-05', Quantity: '-5', TradePrice: '40', TradeMoney: '200', FifoPnlRealized: '-50', IBCommission: '-1', 'Buy/Sell': 'SELL', AssetClass: 'STK' },
];

const positions = [
  { Symbol: 'CCC', AssetClass: 'STK', Quantity: '20', MarkPrice: '12', PositionValue: '240', CostBasisMoney: '200', FifoPnlUnrealized: '40', PercentOfNAV: '4.5', Side: 'Long' },
];

const stats = calculateDashboardStats(trades, positions);

assert.equal(stats.totalTrades, 4);
nearlyEqual(stats.totalRealizedPnl, 50);
nearlyEqual(stats.totalUnrealizedPnl, 40);
nearlyEqual(stats.totalCommissions, -4);
assert.equal(stats.positionsCount, 1);
assert.equal(stats.tradeCycles.length, 2);
assert.equal(stats.winners.length, 1);
assert.equal(stats.losers.length, 1);
nearlyEqual(stats.winRate, 0.5);
nearlyEqual(stats.averageWinner, 100);
nearlyEqual(stats.averageLoser, 50);
nearlyEqual(stats.profitLossRatio, 2);
nearlyEqual(stats.profitFactor, 2);
nearlyEqual(stats.expectancy, 25);

console.log('Calculation verification passed.');
