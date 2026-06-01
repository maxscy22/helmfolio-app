import { describe, expect, it } from 'vitest';
import {
  cashTransactionNetFlowRowsFromRows,
  cashTransactionWithdrawalDetailRows,
} from './cashFlow';
import { calculateRiskMetrics } from './risk';
import type { RawCash } from '../types';

const makeCash = (overrides: Partial<Record<string, unknown>> = {}): RawCash => ({
  Type: 'Deposits/Withdrawals',
  Amount: 0,
  FXRateToBase: 1,
  SettleDate: '20250101',
  Currency: 'USD',
  Description: '',
  ...overrides,
} as unknown as RawCash);

describe('cash-flow adjustment source (deposits + withdrawals)', () => {
  it('net flow rows include BOTH deposits (positive) and withdrawals (negative)', () => {
    const rows: RawCash[] = [
      makeCash({ SettleDate: '20250110', Amount: 10000 }), // deposit
      makeCash({ SettleDate: '20250215', Amount: -4000 }), // withdrawal
    ];
    expect(cashTransactionNetFlowRowsFromRows(rows)).toEqual([
      { date: '2025-01-10', value: 10000 },
      { date: '2025-02-15', value: -4000 },
    ]);
  });

  it('aggregates multiple same-day flows into a single net value', () => {
    const rows: RawCash[] = [
      makeCash({ SettleDate: '20250110', Amount: 10000 }),
      makeCash({ SettleDate: '20250110', Amount: -2500 }),
    ];
    expect(cashTransactionNetFlowRowsFromRows(rows)).toEqual([{ date: '2025-01-10', value: 7500 }]);
  });

  it('converts non-base-currency deposits using FXRateToBase', () => {
    const rows: RawCash[] = [makeCash({ SettleDate: '20250110', Amount: 1000, Currency: 'EUR', FXRateToBase: 1.1 })];
    expect(cashTransactionNetFlowRowsFromRows(rows)).toEqual([{ date: '2025-01-10', value: 1100 }]);
  });

  it('REGRESSION: withdrawal-only detail rows still exclude deposits', () => {
    const rows: RawCash[] = [
      makeCash({ SettleDate: '20250110', Amount: 10000 }), // deposit must be ignored here
      makeCash({ SettleDate: '20250215', Amount: -4000 }),
    ];
    const withdrawals = cashTransactionWithdrawalDetailRows(rows);
    expect(withdrawals).toHaveLength(1);
    expect(withdrawals[0].amount).toBe(-4000);
  });
});

describe('a mid-period deposit must not inflate the cash-flow-adjusted return', () => {
  // Pure-trading baseline: +2% then -1% (no external cash flow).
  const noDeposit = calculateRiskMetrics([
    { date: '2025-01-01', equity: 100000, cashFlow: 0 },
    { date: '2025-01-02', equity: 102000, cashFlow: 0 },
    { date: '2025-01-03', equity: 100980, cashFlow: 0 },
  ]);

  it('feeding the deposit as cashFlow neutralizes it (Sharpe matches the no-deposit case)', () => {
    // Same +2% / -1% trading path, but +50,000 deposited on day 2 (raw equity jumps).
    const withDeposit = calculateRiskMetrics([
      { date: '2025-01-01', equity: 100000, cashFlow: 0 },
      { date: '2025-01-02', equity: 152000, cashFlow: 50000 }, // 102000 + 50000 deposit
      { date: '2025-01-03', equity: 150480, cashFlow: 0 }, // 152000 * 0.99
    ]);
    expect(withDeposit.sharpeRatio).toBeCloseTo(noDeposit.sharpeRatio, 5);
  });

  it('NOT feeding the deposit (the old withdrawal-only behaviour) inflates the return', () => {
    // Identical raw equities, but the deposit is dropped (cashFlow = 0) — the day-2
    // jump is mistaken for a +52% trading gain.
    const naive = calculateRiskMetrics([
      { date: '2025-01-01', equity: 100000, cashFlow: 0 },
      { date: '2025-01-02', equity: 152000, cashFlow: 0 },
      { date: '2025-01-03', equity: 150480, cashFlow: 0 },
    ]);
    expect(naive.sharpeRatio).not.toBeCloseTo(noDeposit.sharpeRatio, 2);
  });
});
