import type { DashboardStats, RawCash, RawNav } from '../types';
import { dateMonthLabel } from './formatters';

export const numberFromRaw = (value: unknown) => {
  const parsed = Number(String(value ?? '').replace(/[$,%\s]/g, '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const rawDateKey = (value: unknown) => {
  const datePart = String(value ?? '').split(';')[0];
  if (/^\d{8}$/.test(datePart)) return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
  return datePart.slice(0, 10);
};

export const valueByAliases = (row: RawNav | RawCash, aliases: string[]) => {
  const canonicalAliases = aliases.map((alias) => alias.replace(/[^a-z0-9]/gi, '').toLowerCase());
  return Object.entries(row).find(([key]) => canonicalAliases.includes(key.replace(/[^a-z0-9]/gi, '').toLowerCase()))?.[1];
};

export const navDateAliases = ['Report Date', 'ReportDate', 'Date', 'date', 'To Date', 'ToDate'];
export const navFromDateAliases = ['From Date', 'FromDate'];
export const navValueAliases = ['Total', 'total', 'EndingValue', 'Ending Value', 'Net Asset Value(NAV) in base', 'Net Asset Value', 'NetAssetValue', 'netAssetValue', 'Total Equity', 'TotalEquity', 'Equity With Loan Value', 'EquityWithLoanValue'];
export const navStartingValueAliases = ['StartingValue', 'Starting Value'];
export const navChangeAliases = ['Change in NAV', 'ChangeInNAV', 'Change NAV'];
export const navCashFlowAliases = ['DepositsWithdrawals'];
export const navCashBalanceAliases = ['cash', 'Cash', 'CashBalance', 'Cash Balance', 'Total Cash', 'TotalCash', 'CashStock', 'cashStock', 'Cash & Equivalents', 'CashAndEquivalents'];

export const latestNavCashBalance = (navRows: RawNav[]) => {
  const dated = navRows
    .map((row) => ({ row, date: rawDateKey(valueByAliases(row, navDateAliases)) }))
    .filter((entry) => entry.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let index = dated.length - 1; index >= 0; index -= 1) {
    const rawCash = valueByAliases(dated[index].row, navCashBalanceAliases);
    if (rawCash === undefined || rawCash === null || String(rawCash).trim() === '') continue;
    const cashValue = numberFromRaw(rawCash);
    if (Number.isFinite(cashValue)) return { date: dated[index].date, value: cashValue };
  }
  return null;
};

const navPointFromRow = (row: RawNav) => {
  const date = rawDateKey(valueByAliases(row, navDateAliases));
  const value = numberFromRaw(valueByAliases(row, navValueAliases));
  const explicitChangeValue = valueByAliases(row, navChangeAliases);
  const hasExplicitChange = explicitChangeValue !== undefined && explicitChangeValue !== null && String(explicitChangeValue).trim() !== '';
  const explicitChange = numberFromRaw(explicitChangeValue);
  const startingValue = numberFromRaw(valueByAliases(row, navStartingValueAliases));
  const change = explicitChange || (value && startingValue ? value - startingValue : 0);
  return { date, value, change, hasExplicitChange, startingValue };
};

const navCurveFromRows = (navRows: RawNav[]) => navRows
  .map(navPointFromRow)
  .filter((row) => row.date && row.value > 0)
  .reduce((byDate, row) => byDate.set(row.date, row), new Map<string, ReturnType<typeof navPointFromRow>>());

export const sortedNavCurveFromRows = (navRows: RawNav[]) => Array.from(navCurveFromRows(navRows).values())
  .sort((a, b) => a.date.localeCompare(b.date))
  .map((row, index, rows) => ({
    ...row,
    change: row.hasExplicitChange || index === 0 ? row.change : row.value - rows[index - 1].value,
  }));

export const navValueForDate = (navRows: RawNav[], date: string) => {
  const candidates = sortedNavCurveFromRows(navRows);
  return [...candidates].reverse().find((row) => row.date <= date)?.value ?? null;
};

// Opening NAV at the start of `date`: the close of the prior NAV day (which is the
// open of `date`). If `date` is on/before the earliest NAV row, use that row's
// StartingValue (the original funding basis) when present, else its close.
export const navOpenValueForDate = (navRows: RawNav[], date: string) => {
  const curve = sortedNavCurveFromRows(navRows);
  if (!curve.length) return null;
  const index = curve.findIndex((row) => row.date >= date);
  if (index === -1) return curve[curve.length - 1].value;
  if (index > 0) return curve[index - 1].value;
  const first = curve[0];
  return first.startingValue && first.startingValue > 0 ? first.startingValue : first.value;
};

export const latestNavValue = (navRows: RawNav[]) => {
  const candidates = sortedNavCurveFromRows(navRows);
  return candidates[candidates.length - 1] ?? null;
};

export const navCashFlowRowsFromRows = (navRows: RawNav[]) => Array.from(navRows
  .map((row) => {
    const rawValue = valueByAliases(row, navCashFlowAliases);
    const date = rawDateKey(valueByAliases(row, navDateAliases) ?? valueByAliases(row, navFromDateAliases));
    return {
      date,
      value: numberFromRaw(rawValue),
      rawValue,
    };
  })
  .filter((row) => row.date && row.rawValue !== undefined && row.rawValue !== null && String(row.rawValue).trim() !== '')
  .reduce((byDate, row) => byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.value), new Map<string, number>())
  .entries())
  .map(([date, value]) => ({ date, value }))
  .sort((a, b) => a.date.localeCompare(b.date));

export const cumulativeNavCashFlow = (navRows: RawNav[]) => {
  const rows = navCashFlowRowsFromRows(navRows);
  if (!rows.length) return null;
  return {
    date: rows[rows.length - 1].date,
    value: rows.reduce((total, row) => total + row.value, 0),
    rows,
  };
};

export const withholdingTaxRefundDetailRows = (cashRows: RawCash[], monthsWindow = 12) => {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsWindow);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  return cashRows
    .map((row) => {
      const type = String(valueByAliases(row, ['Type']) ?? '').trim();
      const rawValue = valueByAliases(row, ['Amount']);
      const amount = numberFromRaw(rawValue);
      const fxRateToBase = numberFromRaw(valueByAliases(row, ['FXRateToBase'])) || 1;
      const date = rawDateKey(valueByAliases(row, ['SettleDate']) ?? valueByAliases(row, ['Date/Time']) ?? valueByAliases(row, ['ReportDate']));
      const currency = String(valueByAliases(row, ['Currency', 'currency']) ?? '').trim();
      const symbol = String(valueByAliases(row, ['Symbol', 'symbol']) ?? '').trim();
      const description = String(valueByAliases(row, ['Description', 'description']) ?? '').trim();
      return {
        date,
        amount,
        currency,
        symbol,
        description,
        fxRateToBase,
        value: amount * fxRateToBase,
        rawValue,
        type,
      };
    })
    .filter((row) => row.date && row.type === 'Withholding Tax' && row.amount > 0 && row.date >= cutoffKey)
    .sort((a, b) => b.date.localeCompare(a.date));
};

// All dated "Deposits/Withdrawals" Cash Transactions rows in base currency, BOTH
// signs (deposits positive, withdrawals negative). Shared by the withdrawals-only
// summary card and the cash-flow-adjusted risk/return metrics.
const cashTransactionDepositWithdrawalRows = (cashRows: RawCash[]) => cashRows
  .map((row) => {
    const type = String(valueByAliases(row, ['Type']) ?? '').trim();
    const rawValue = valueByAliases(row, ['Amount']);
    const amount = numberFromRaw(rawValue);
    const fxRateToBase = numberFromRaw(valueByAliases(row, ['FXRateToBase'])) || 1;
    const date = rawDateKey(valueByAliases(row, ['SettleDate']) ?? valueByAliases(row, ['Date/Time']) ?? valueByAliases(row, ['ReportDate']));
    const currency = String(valueByAliases(row, ['Currency', 'currency']) ?? '').trim();
    const description = String(valueByAliases(row, ['Description', 'description']) ?? '').trim();
    return {
      date,
      amount,
      currency,
      description,
      fxRateToBase,
      value: amount * fxRateToBase,
      rawValue,
      type,
    };
  })
  .filter((row) => row.date && row.type.toLowerCase() === 'deposits/withdrawals' && row.rawValue !== undefined && row.rawValue !== null && String(row.rawValue).trim() !== '');

// Withdrawals only (amount < 0). Drives the "Net Deposits / Withdrawals" summary
// card, which intentionally reports withdrawals (capital taken out).
export const cashTransactionWithdrawalDetailRows = (cashRows: RawCash[]) => cashTransactionDepositWithdrawalRows(cashRows)
  .filter((row) => row.amount < 0)
  .sort((a, b) => a.date.localeCompare(b.date));

export const cashTransactionFlowRowsFromRows = (cashRows: RawCash[]) => Array.from(cashTransactionWithdrawalDetailRows(cashRows)
  .reduce((byDate, row) => byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.value), new Map<string, number>())
  .entries())
  .map(([date, value]) => ({ date, value }))
  .sort((a, b) => a.date.localeCompare(b.date));

// Net external cash flow per date including BOTH deposits and withdrawals. This is
// the correct input for cash-flow-adjusted RETURN/RISK metrics: a mid-period
// deposit must be neutralized just like a withdrawal so it does not show up as a
// fake gain. (Initial funding deposits are excluded by the caller, which only
// applies flows that fall AFTER the analysis start/baseline date.)
export const cashTransactionNetFlowRowsFromRows = (cashRows: RawCash[]) => Array.from(cashTransactionDepositWithdrawalRows(cashRows)
  .filter((row) => row.amount !== 0)
  .reduce((byDate, row) => byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.value), new Map<string, number>())
  .entries())
  .map(([date, value]) => ({ date, value }))
  .sort((a, b) => a.date.localeCompare(b.date));

export const cumulativeCashTransactionFlow = (cashRows: RawCash[]) => {
  const rows = cashTransactionFlowRowsFromRows(cashRows);
  if (!rows.length) return null;
  return {
    date: rows[rows.length - 1].date,
    value: rows.reduce((total, row) => total + row.value, 0),
    rows,
  };
};

export const cashFlowByCurveDate = (cashFlowRows: { date: string; value: number }[], curveDates: string[]) => cashFlowRows
  .reduce((byDate, row) => {
    const targetDate = curveDates.find((date) => date >= row.date);
    if (!targetDate) return byDate;
    byDate.set(targetDate, (byDate.get(targetDate) ?? 0) + row.value);
    return byDate;
  }, new Map<string, number>());

export const cashTransactionAmountInBase = (row: RawCash) => {
  const amount = numberFromRaw(valueByAliases(row, ['Amount']));
  const fxRateToBase = numberFromRaw(valueByAliases(row, ['FXRateToBase'])) || 1;
  return amount * fxRateToBase;
};

export const cashTransactionDate = (row: RawCash) => rawDateKey(valueByAliases(row, ['SettleDate']) ?? valueByAliases(row, ['Date/Time']) ?? valueByAliases(row, ['ReportDate']));

export const cashTransactionType = (row: RawCash) => String(valueByAliases(row, ['Type']) ?? '').trim();

export const cashTransactionInsights = (cashRows: RawCash[]) => {
  const rows = cashRows
    .map((row) => ({
      date: cashTransactionDate(row),
      month: cashTransactionDate(row).slice(0, 7),
      type: cashTransactionType(row),
      amount: cashTransactionAmountInBase(row),
    }))
    .filter((row) => row.date && row.type);
  const grossDividends = rows.filter((row) => row.type === 'Dividends' && row.amount > 0).reduce((total, row) => total + row.amount, 0);
  const withholdingTaxRows = rows.filter((row) => row.type === 'Withholding Tax');
  const withholdingTaxGross = withholdingTaxRows.filter((row) => row.amount < 0).reduce((total, row) => total + row.amount, 0);
  const withholdingTaxRefunds = withholdingTaxRows.filter((row) => row.amount > 0).reduce((total, row) => total + row.amount, 0);
  const withholdingTax = withholdingTaxGross + withholdingTaxRefunds;
  const netDividends = grossDividends + withholdingTax;
  const interest = rows.filter((row) => row.type.toLowerCase().includes('interest')).reduce((total, row) => total + row.amount, 0);
  const brokerInterestPaid = rows.filter((row) => row.type === 'Broker Interest Paid').reduce((total, row) => total + row.amount, 0);
  const otherFees = rows.filter((row) => row.type === 'Other Fees').reduce((total, row) => total + row.amount, 0);
  const dividendFees = rows.filter((row) => row.type === 'Other Fees' && row.amount < 0).reduce((total, row) => total + row.amount, 0);
  const totalCashDrag = brokerInterestPaid + otherFees + withholdingTax;
  const monthlyRows = Array.from(rows.reduce((byMonth, row) => {
    if (!row.month) return byMonth;
    const current = byMonth.get(row.month) ?? { month: row.month, label: dateMonthLabel(`${row.month}-01`), dividends: 0, interest: 0, withholdingTax: 0, otherFees: 0 };
    if (row.type === 'Dividends') current.dividends += row.amount;
    if (row.type.toLowerCase().includes('interest')) current.interest += row.amount;
    if (row.type === 'Withholding Tax') current.withholdingTax += row.amount;
    if (row.type === 'Other Fees') current.otherFees += row.amount;
    byMonth.set(row.month, current);
    return byMonth;
  }, new Map<string, { month: string; label: string; dividends: number; interest: number; withholdingTax: number; otherFees: number }>()).values()).sort((a, b) => a.month.localeCompare(b.month));
  return {
    grossDividends,
    withholdingTax,
    withholdingTaxGross,
    withholdingTaxRefunds,
    netDividends,
    effectiveWithholdingTaxRate: grossDividends ? Math.abs(withholdingTax) / grossDividends : 0,
    interest,
    brokerInterestPaid,
    otherFees,
    dividendFees,
    totalCashDrag,
    monthlyRows,
  };
};

export const navEstimateFromPositions = (positions: DashboardStats['positions']) => {
  const estimates = positions
    .filter((position) => Math.abs(position.value) > 0 && Math.abs(position.percentOfNav) > 0)
    .map((position) => Math.abs(position.value) / (Math.abs(position.percentOfNav) / 100))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!estimates.length) return null;
  return estimates[Math.floor(estimates.length / 2)];
};
