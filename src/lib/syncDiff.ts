import type { RawCash } from '../types';
import { numberFromRaw, valueByAliases } from './cashFlow';

export type SyncDiff = {
  capturedAt: string;
  tradesAdded: number;
  navRowsAdded: number;
  cashRowsAdded: number;
  newDividends: number;
  newWithholdingTax: number;
  newInterest: number;
  newWithdrawals: number;
  newDeposits: number;
  navFrom: number | null;
  navTo: number | null;
  navDelta: number | null;
};

export const buildSyncDiff = (
  newIncomingTrades: number,
  newIncomingNavRows: number,
  newIncomingCashRows: number,
  newCashEntries: RawCash[],
  navFrom: number | null,
  navTo: number | null,
): SyncDiff => {
  const cashByType = (typeMatcher: (type: string) => boolean, signFilter: (amount: number) => boolean = () => true) => newCashEntries.reduce((total, row) => {
    const type = String(valueByAliases(row, ['Type']) ?? '').trim();
    const amount = numberFromRaw(valueByAliases(row, ['Amount']));
    const fxRateToBase = numberFromRaw(valueByAliases(row, ['FXRateToBase'])) || 1;
    if (!typeMatcher(type) || !signFilter(amount)) return total;
    return total + amount * fxRateToBase;
  }, 0);
  return {
    capturedAt: new Date().toISOString(),
    tradesAdded: newIncomingTrades,
    navRowsAdded: newIncomingNavRows,
    cashRowsAdded: newIncomingCashRows,
    newDividends: cashByType((type) => type === 'Dividends', (amount) => amount > 0),
    newWithholdingTax: cashByType((type) => type === 'Withholding Tax'),
    newInterest: cashByType((type) => type.toLowerCase().includes('interest')),
    newWithdrawals: cashByType((type) => type.toLowerCase() === 'deposits/withdrawals', (amount) => amount < 0),
    newDeposits: cashByType((type) => type.toLowerCase() === 'deposits/withdrawals', (amount) => amount > 0),
    navFrom,
    navTo,
    navDelta: navFrom !== null && navTo !== null ? navTo - navFrom : null,
  };
};
