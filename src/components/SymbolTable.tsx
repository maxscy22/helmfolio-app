import { Award, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SymbolStats, TradeCycle } from '../types';
import { compactDateLabel, daysBetween, money, percent, priceMoney } from '../lib/formatters';

const safeMoney = (value: number, privacyMode: boolean) => {
  if (privacyMode) return '****';
  return money(value);
};

const safePriceMoney = (value: number, privacyMode: boolean) => {
  if (privacyMode) return '****';
  return priceMoney(value);
};

const rankStyle = (index: number) => {
  if (index === 0) return { label: '#1', className: 'text-amber-300', iconClassName: 'fill-amber-300/20 text-amber-300' };
  if (index === 1) return { label: '#2', className: 'text-slate-200', iconClassName: 'fill-slate-200/20 text-slate-200' };
  if (index === 2) return { label: '#3', className: 'text-orange-300', iconClassName: 'fill-orange-300/20 text-orange-300' };
  return { label: `#${index + 1}`, className: 'text-cyan-200', iconClassName: 'text-cyan-200' };
};

export function SymbolTable({ rows, showRank = false, cycles = [], isPrivacyMode = false, locked = false, previewRowIndex, onUnlock }: { rows: SymbolStats[]; showRank?: boolean; cycles?: TradeCycle[]; isPrivacyMode?: boolean; locked?: boolean; previewRowIndex?: number; onUnlock?: () => void }) {
  // In preview mode one row stays crisp and clickable (a free teaser), while the
  // more desirable top rows stay blurred behind the paywall. The caller passes a
  // FIXED index (the collapsed view's last row) so the revealed row does not jump
  // when the user expands the table via "Show full list". Clamped to the data so
  // it still works when the user has only a few symbols.
  const previewIndex = locked && previewRowIndex !== undefined && rows.length > 0 ? Math.min(previewRowIndex, rows.length - 1) : -1;
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ x: 320, y: 180 });
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const activeCycles = activeSymbol ? cycles.filter((cycle) => cycle.symbol === activeSymbol) : [];
  const cyclesForSymbol = (symbol: string) => cycles.filter((cycle) => cycle.symbol === symbol);
  const cycleAveragePrice = (symbolCycles: TradeCycle[], side: 'BUY' | 'SELL') => {
    const quantity = symbolCycles.reduce((total, cycle) => total + (side === 'BUY' ? cycle.buyQuantity : cycle.sellQuantity), 0);
    const value = symbolCycles.reduce((total, cycle) => total + (side === 'BUY' ? cycle.buyQuantity * cycle.averageBuyPrice : cycle.sellQuantity * cycle.averageSellPrice), 0);
    return quantity ? value / quantity : 0;
  };

  useEffect(() => {
    if (!dragOffset) return;
    const handleMouseMove = (event: MouseEvent) => setPopoverPosition({ x: event.clientX - dragOffset.x, y: event.clientY - dragOffset.y });
    const handleMouseUp = () => setDragOffset(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragOffset]);

  return (
    <div className="relative">
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-[76rem] w-full text-left text-sm">
          <thead className="bg-white/5 text-slate-300">
            <tr>
              {showRank && <th className="px-4 py-3">Rank</th>}
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Fills</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Avg Buy</th>
              <th className="px-4 py-3 text-right">Avg Sell</th>
              <th className="px-4 py-3 text-right">Total IN</th>
              <th className="px-4 py-3 text-right">Total OUT</th>
              <th className="px-4 py-3">Cycle Win Rate</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3 text-right">Realized P/L</th>
              <th className="px-4 py-3 text-right">Commission</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-slate-200">
            {rows.map((row, index) => {
              const rowCycles = cyclesForSymbol(row.symbol);
              const averageBuyPrice = cycleAveragePrice(rowCycles, 'BUY');
              const averageSellPrice = cycleAveragePrice(rowCycles, 'SELL');
              const rowLocked = locked && index !== previewIndex;
              return (
              <tr
                key={row.symbol}
                className={`hover:bg-white/[0.03] ${rowLocked ? 'cursor-pointer select-none' : ''}`}
                style={rowLocked ? { filter: 'blur(6px)' } : undefined}
                aria-hidden={rowLocked ? 'true' : undefined}
                onClick={rowLocked ? () => onUnlock?.() : undefined}
              >
                {showRank && (
                  <td className={`px-4 py-3 font-semibold ${rankStyle(index).className}`}>
                    <span className="inline-flex items-center gap-2">
                      {index < 3 && <Award size={18} className={rankStyle(index).iconClassName} />}
                      {rankStyle(index).label}
                    </span>
                  </td>
                )}
                <td className="px-4 py-3 font-medium text-white">
                  {row.symbol}
                  {locked && index === previewIndex && <span className="ml-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">Preview</span>}
                </td>
                <td className="px-4 py-3">{row.orders}</td>
                <td className="px-4 py-3">{row.executions}</td>
                <td className="px-4 py-3 text-right">{row.quantity.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{averageBuyPrice ? safePriceMoney(averageBuyPrice, isPrivacyMode) : '-'}</td>
                <td className="px-4 py-3 text-right">{averageSellPrice ? safePriceMoney(averageSellPrice, isPrivacyMode) : '-'}</td>
                <td className="px-4 py-3 text-right">{safeMoney(row.totalIn, isPrivacyMode)}</td>
                <td className="px-4 py-3 text-right">{safeMoney(row.totalOut, isPrivacyMode)}</td>
                <td
                  className={rowLocked ? 'px-4 py-3 text-cyan-200' : 'cursor-pointer px-4 py-3 text-cyan-200 underline decoration-cyan-300/40 underline-offset-4'}
                  onClick={(event) => {
                    if (rowLocked) { onUnlock?.(); return; }
                    const rect = event.currentTarget.getBoundingClientRect();
                    setActiveSymbol(row.symbol);
                    const centerX = (window.innerWidth - 1152) / 2;
                    const yBelow = rect.bottom + 10;
                    const maxY = window.innerHeight - 448 - 16;
                    setPopoverPosition({ x: centerX, y: Math.min(yBelow, maxY) });
                  }}
                >
                  {percent(row.winRate)}
                </td>
                <td className={`px-4 py-3 font-semibold ${row.result === 'WIN' ? 'text-emerald-300' : row.result === 'LOSS' ? 'text-rose-300' : 'text-slate-300'}`}>{row.result}</td>
                <td className={`px-4 py-3 text-right font-semibold ${row.realizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{safeMoney(row.realizedPnl, isPrivacyMode)}</td>
                <td className="px-4 py-3 text-right text-slate-400">{safeMoney(row.commissions, isPrivacyMode)}</td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>
      {locked && previewIndex === -1 && (
        <button
          type="button"
          onClick={onUnlock}
          aria-label="Activate Pro to reveal"
          className="absolute inset-0 z-20 flex items-center justify-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-amber-100 shadow-lg shadow-black/30 backdrop-blur-sm transition hover:bg-slate-950/85">
            <Lock size={15} /> Activate Pro to reveal
          </span>
        </button>
      )}
      {locked && previewIndex !== -1 && rows.length > 1 && (
        <button
          type="button"
          onClick={onUnlock}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/20"
        >
          <Lock size={15} /> Preview shows 1 of {rows.length} · Activate Pro to reveal the rest
        </button>
      )}
      {activeSymbol && (
        <div
          className="fixed z-50 max-h-[28rem] w-[72rem] overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950/95 shadow-2xl shadow-black/40 backdrop-blur"
          style={{ left: popoverPosition.x, top: popoverPosition.y }}
        >
          <div
            className="flex cursor-move items-center justify-between border-b border-white/10 bg-cyan-300/10 px-4 py-3"
            onMouseDown={(event) => setDragOffset({ x: event.clientX - popoverPosition.x, y: event.clientY - popoverPosition.y })}
          >
            <div>
              <p className="font-semibold text-white">{activeSymbol} cycle details</p>
              <p className="text-xs text-slate-400">Click Cycle Win Rate to open · {activeCycles.length} closed cycles</p>
            </div>
            <button className="rounded-lg px-2 py-1 text-sm text-slate-300 hover:bg-white/10 hover:text-white" type="button" onClick={() => setActiveSymbol(null)}>Close</button>
          </div>
          <div className="max-h-[22rem] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-3 py-2">Cycle</th>
                  <th className="px-3 py-2">Date In</th>
                  <th className="px-3 py-2">Date Out</th>
                  <th className="px-3 py-2 text-right">Held</th>
                  <th className="px-3 py-2 text-right">Orders</th>
                  <th className="px-3 py-2 text-right">Fills</th>
                  <th className="px-3 py-2 text-right">Buy Qty</th>
                  <th className="px-3 py-2 text-right">Sell Qty</th>
                  <th className="px-3 py-2 text-right">Avg Buy</th>
                  <th className="px-3 py-2 text-right">Avg Sell</th>
                  <th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2 text-right">P/L</th>
                  <th className="px-3 py-2 text-right">Return %</th>
                  <th className="px-3 py-2 text-right">Ann. Return %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-200">
                {activeCycles.map((cycle, index) => {
                  const holdingDays = daysBetween(cycle.start, cycle.end);
                  const returnPct = cycle.totalIn > 0 ? (cycle.realizedPnl / cycle.totalIn) * 100 : 0;
                  const annualizedReturnPct = holdingDays && holdingDays > 0 && cycle.totalIn > 0
                    ? (Math.pow(1 + cycle.realizedPnl / cycle.totalIn, 365 / holdingDays) - 1) * 100
                    : 0;
                  return (
                  <tr key={`${cycle.symbol}-${cycle.start}-${cycle.end}-${index}`}>
                    <td className="px-3 py-2">#{index + 1}</td>
                    <td className="px-3 py-2 font-medium text-white" title={cycle.start || undefined}>{compactDateLabel(cycle.start)}</td>
                    <td className="px-3 py-2 font-medium text-white" title={cycle.end || undefined}>{compactDateLabel(cycle.end)}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{holdingDays === null ? '-' : `${holdingDays}d`}</td>
                    <td className="px-3 py-2 text-right">{cycle.orders}</td>
                    <td className="px-3 py-2 text-right">{cycle.executions}</td>
                    <td className="px-3 py-2 text-right">{cycle.buyQuantity.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{cycle.sellQuantity.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{cycle.averageBuyPrice ? safePriceMoney(cycle.averageBuyPrice, isPrivacyMode) : '-'}</td>
                    <td className="px-3 py-2 text-right">{cycle.averageSellPrice ? safePriceMoney(cycle.averageSellPrice, isPrivacyMode) : '-'}</td>
                    <td className={`px-3 py-2 font-semibold ${cycle.result === 'WIN' ? 'text-emerald-300' : cycle.result === 'LOSS' ? 'text-rose-300' : 'text-slate-300'}`}>{cycle.result}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${cycle.realizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{safeMoney(cycle.realizedPnl, isPrivacyMode)}</td>
                    <td className={`px-3 py-2 text-right ${returnPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{returnPct.toFixed(2)}%</td>
                    <td className={`px-3 py-2 text-right ${annualizedReturnPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{holdingDays && holdingDays > 0 ? `${annualizedReturnPct.toFixed(2)}%` : '-'}</td>
                  </tr>
                );})}
                {!activeCycles.length && (
                  <tr>
                    <td className="px-3 py-4 text-slate-400" colSpan={14}>No closed cycles detected for this symbol.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
