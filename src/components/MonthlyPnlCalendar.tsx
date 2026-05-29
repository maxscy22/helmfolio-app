import { useEffect, useState } from 'react';
import type { DashboardStats, Trade } from '../types';
import { money } from '../lib/formatters';
import { tradeDateKey, tradeSideLabel } from '../lib/trades';

type CalendarDay = {
  date: string;
  day: number;
  inMonth: boolean;
  realizedPnl: number;
  trades: number;
};

const monthLabel = (month: string) => {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(year, monthIndex - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const buildCalendarWeeks = (month: string, dailyStats: DashboardStats['byDay']): CalendarDay[][] => {
  const [year, monthIndex] = month.split('-').map(Number);
  const firstDay = new Date(year, monthIndex - 1, 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());
  const dailyMap = new Map(dailyStats.map((day) => [day.date, day]));
  return Array.from({ length: 6 }, (_, weekIndex) => Array.from({ length: 7 }, (_, dayIndex) => {
    const date = new Date(start);
    date.setDate(start.getDate() + weekIndex * 7 + dayIndex);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const stat = dailyMap.get(dateKey);
    return {
      date: dateKey,
      day: date.getDate(),
      inMonth: date.getMonth() === monthIndex - 1,
      realizedPnl: stat?.realizedPnl ?? 0,
      trades: stat?.trades ?? 0,
    };
  }));
};

export function MonthlyPnlCalendar({ month, dailyStats, trades, onPrevious, onNext }: { month: string; dailyStats: DashboardStats['byDay']; trades: Trade[]; onPrevious: () => void; onNext: () => void }) {
  const weeks = buildCalendarWeeks(month, dailyStats);
  const monthStats = dailyStats.filter((day) => day.date.startsWith(month));
  const monthTotal = monthStats.reduce((total, day) => total + day.realizedPnl, 0);
  const monthTrades = monthStats.reduce((total, day) => total + day.trades, 0);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ x: 320, y: 180 });
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const activeTrades = activeDate ? trades.filter((trade) => tradeDateKey(trade) === activeDate) : [];
  const activeDayPnl = activeTrades.reduce((total, trade) => total + trade.realizedPnl, 0);
  const centerTradeDetailPopover = () => {
    const width = 608;
    const height = 480;
    setPopoverPosition({
      x: Math.max(16, Math.round((window.innerWidth - width) / 2)),
      y: Math.max(16, Math.round((window.innerHeight - height) / 2)),
    });
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
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold text-white">{monthLabel(month)}</h3>
          <p className={`mt-1 text-sm font-semibold ${monthTotal >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            Monthly realized P/L {money(monthTotal)} · {monthTrades} fills
          </p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20" type="button" onClick={onPrevious}>Previous month</button>
          <button className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20" type="button" onClick={onNext}>Next month</button>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_8rem] gap-2 text-xs">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Weekly P/L'].map((label) => (
          <div key={label} className="rounded-xl bg-white/[0.05] px-3 py-2 font-semibold text-slate-300">{label}</div>
        ))}
        {weeks.map((week, weekIndex) => {
          const weekTotal = week.reduce((total, day) => total + (day.inMonth ? day.realizedPnl : 0), 0);
          return (
            <div key={`week-${weekIndex}`} className="contents">
              {week.map((day) => (
                <div
                  key={day.date}
                  className={`min-h-24 rounded-2xl border p-3 ${day.trades ? 'cursor-pointer hover:bg-white/[0.08]' : ''} ${day.inMonth ? 'border-white/10 bg-white/[0.04]' : 'border-white/5 bg-white/[0.015] opacity-40'}`}
                  role={day.trades ? 'button' : undefined}
                  tabIndex={day.trades ? 0 : undefined}
                  onClick={() => {
                    if (!day.trades) return;
                    setActiveDate(day.date);
                    centerTradeDetailPopover();
                  }}
                  onKeyDown={(event) => {
                    if (!day.trades || (event.key !== 'Enter' && event.key !== ' ')) return;
                    event.preventDefault();
                    setActiveDate(day.date);
                    centerTradeDetailPopover();
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-300">{day.day}</span>
                    {!!day.trades && <span className="rounded-full bg-cyan-300/10 px-2 py-0.5 text-[0.65rem] text-cyan-200">{day.trades}</span>}
                  </div>
                  <p className={`mt-4 text-sm font-bold ${day.realizedPnl > 0 ? 'text-emerald-300' : day.realizedPnl < 0 ? 'text-rose-300' : 'text-slate-500'}`}>{day.realizedPnl ? money(day.realizedPnl) : '-'}</p>
                  <p className="mt-1 text-[0.65rem] text-slate-500">Daily realized P/L</p>
                </div>
              ))}
              <div className={`flex min-h-24 flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.06] p-3 font-bold ${weekTotal >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                <span>{money(weekTotal)}</span>
                <span className="mt-1 text-[0.65rem] font-medium text-slate-400">Week {weekIndex + 1}</span>
              </div>
            </div>
          );
        })}
      </div>
      {activeDate && (
        <div
          className="fixed z-50 max-h-[30rem] w-[38rem] overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950/95 shadow-2xl shadow-black/40 backdrop-blur"
          style={{ left: popoverPosition.x, top: popoverPosition.y }}
        >
          <div
            className="flex cursor-move items-center justify-between border-b border-white/10 bg-cyan-300/10 px-4 py-3"
            onMouseDown={(event) => setDragOffset({ x: event.clientX - popoverPosition.x, y: event.clientY - popoverPosition.y })}
          >
            <div>
              <p className="font-semibold text-white">{activeDate} fill details</p>
              <p className={`text-xs font-semibold ${activeDayPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                Daily realized P/L {money(activeDayPnl)} · {activeTrades.length} fills
              </p>
            </div>
            <button className="rounded-lg px-2 py-1 text-sm text-slate-300 hover:bg-white/10 hover:text-white" type="button" onClick={() => setActiveDate(null)}>Close</button>
          </div>
          <div className="max-h-[24rem] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-3 py-2">Side</th>
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Realized P/L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-200">
                {activeTrades.map((trade, index) => (
                  <tr key={`${trade.tradeId}-${trade.symbol}-${index}`}>
                    <td className={`px-3 py-2 font-semibold ${tradeSideLabel(trade) === 'BUY' ? 'text-cyan-300' : tradeSideLabel(trade) === 'SELL' ? 'text-amber-300' : 'text-slate-300'}`}>{tradeSideLabel(trade)}</td>
                    <td className="px-3 py-2 font-medium text-white">{trade.symbol}</td>
                    <td className="px-3 py-2 text-right">{trade.quantity}</td>
                    <td className="px-3 py-2 text-right">{trade.price.toFixed(2)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${trade.realizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(trade.realizedPnl)}</td>
                  </tr>
                ))}
                {!activeTrades.length && (
                  <tr>
                    <td className="px-3 py-4 text-slate-400" colSpan={5}>No fills found for this date.</td>
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
