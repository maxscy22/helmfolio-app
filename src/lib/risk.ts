export type BenchmarkPoint = {
  date: string;
  close?: number;
  returnPct: number;
};

export const benchmarkReturnsFromStart = (portfolioDates: string[], series: BenchmarkPoint[], startDate: string) => {
  const sortedSeries = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const basePoint = sortedSeries.find((point) => point.date >= startDate) ?? sortedSeries[0];
  let index = 0;
  let latestClose: number | undefined;
  return new Map(portfolioDates.map((date) => {
    while (index < sortedSeries.length && sortedSeries[index].date <= date) {
      latestClose = sortedSeries[index].close;
      index += 1;
    }
    return [date, basePoint?.close && latestClose ? Number(((latestClose / basePoint.close - 1) * 100).toFixed(2)) : undefined] as const;
  }));
};

export type RiskMetrics = {
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPeakDate: string;
  maxDrawdownTroughDate: string;
  maxDrawdownPeakEquity: number;
  maxDrawdownTroughEquity: number;
  maxDrawdownPeakRawEquity: number;
  maxDrawdownTroughRawEquity: number;
  maxDrawdownCashFlowDuringDrawdown: number;
};

export const calculateRiskMetrics = (equityCurve: { date?: string; equity: number; cashFlow?: number }[]): RiskMetrics => {
  if (!equityCurve.length || equityCurve[0].equity <= 0) return { sharpeRatio: 0, maxDrawdown: 0, maxDrawdownPeakDate: '', maxDrawdownTroughDate: '', maxDrawdownPeakEquity: 0, maxDrawdownTroughEquity: 0, maxDrawdownPeakRawEquity: 0, maxDrawdownTroughRawEquity: 0, maxDrawdownCashFlowDuringDrawdown: 0 };

  let previousEquity = equityCurve[0].equity;
  let cumulativeCashFlow = 0;
  let adjustedEquity = equityCurve[0].equity;
  let peakEquity = adjustedEquity;
  let peakDate = equityCurve[0].date ?? '';
  let peakRawEquity = equityCurve[0].equity;
  let peakCumulativeCashFlow = cumulativeCashFlow;
  let maxDrawdown = 0;
  let maxDrawdownPeakDate = '';
  let maxDrawdownTroughDate = '';
  let maxDrawdownPeakEquity = peakEquity;
  let maxDrawdownTroughEquity = adjustedEquity;
  let maxDrawdownPeakRawEquity = peakRawEquity;
  let maxDrawdownTroughRawEquity = equityCurve[0].equity;
  let maxDrawdownCashFlowDuringDrawdown = 0;
  const returns: number[] = [];

  for (const point of equityCurve.slice(1)) {
    const equity = point.equity;
    const cashFlow = point.cashFlow ?? 0;
    if (previousEquity > 0) {
      const dailyReturn = (equity - cashFlow) / previousEquity - 1;
      if (Number.isFinite(dailyReturn)) returns.push(dailyReturn);
    }
    cumulativeCashFlow += cashFlow;
    adjustedEquity = equity - cumulativeCashFlow;
    if (adjustedEquity > peakEquity) {
      peakEquity = adjustedEquity;
      peakDate = point.date ?? '';
      peakRawEquity = equity;
      peakCumulativeCashFlow = cumulativeCashFlow;
    }
    if (peakEquity > 0) {
      const drawdown = (peakEquity - adjustedEquity) / peakEquity;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPeakDate = peakDate;
        maxDrawdownTroughDate = point.date ?? '';
        maxDrawdownPeakEquity = peakEquity;
        maxDrawdownTroughEquity = adjustedEquity;
        maxDrawdownPeakRawEquity = peakRawEquity;
        maxDrawdownTroughRawEquity = equity;
        maxDrawdownCashFlowDuringDrawdown = cumulativeCashFlow - peakCumulativeCashFlow;
      }
    }
    previousEquity = equity;
  }

  if (returns.length < 2) return { sharpeRatio: 0, maxDrawdown, maxDrawdownPeakDate, maxDrawdownTroughDate, maxDrawdownPeakEquity, maxDrawdownTroughEquity, maxDrawdownPeakRawEquity, maxDrawdownTroughRawEquity, maxDrawdownCashFlowDuringDrawdown };

  const averageReturn = returns.reduce((total, value) => total + value, 0) / returns.length;
  const variance = returns.reduce((total, value) => total + Math.pow(value - averageReturn, 2), 0) / (returns.length - 1);
  const standardDeviation = Math.sqrt(variance);
  const sharpeRatio = standardDeviation > 0 ? (averageReturn / standardDeviation) * Math.sqrt(252) : 0;

  return {
    sharpeRatio: Number(sharpeRatio.toFixed(2)),
    maxDrawdown: Number(maxDrawdown.toFixed(4)),
    maxDrawdownPeakDate,
    maxDrawdownTroughDate,
    maxDrawdownPeakEquity,
    maxDrawdownTroughEquity,
    maxDrawdownPeakRawEquity,
    maxDrawdownTroughRawEquity,
    maxDrawdownCashFlowDuringDrawdown,
  };
};
