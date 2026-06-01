import { Activity, Lock } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type StatCardProps = {
  title: string;
  value: string;
  sub: string;
  icon: typeof Activity;
  positive?: boolean;
  detail?: ReactNode;
  valueClassName?: string;
  subClassName?: string;
  locked?: boolean;
  onUnlock?: () => void;
};

export function StatCard({ title, value, sub, icon: Icon, positive, detail, valueClassName, subClassName, locked = false, onUnlock }: StatCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [detailPosition, setDetailPosition] = useState({ x: 320, y: 180 });
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

  const centerDetail = () => {
    const width = 520;
    const height = 320;
    setDetailPosition({
      x: Math.max(16, Math.round((window.innerWidth - width) / 2)),
      y: Math.max(16, Math.round((window.innerHeight - height) / 2)),
    });
  };

  const openDetail = () => {
    if (locked) {
      onUnlock?.();
      return;
    }
    if (!detail) return;
    centerDetail();
    setShowDetail(true);
  };

  const interactive = locked || Boolean(detail);

  useEffect(() => {
    if (!dragOffset) return;
    const handleMouseMove = (event: MouseEvent) => setDetailPosition({ x: event.clientX - dragOffset.x, y: event.clientY - dragOffset.y });
    const handleMouseUp = () => setDragOffset(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragOffset]);

  return (
    <div className={`rounded-3xl border border-white/10 bg-[var(--dashboard-card)] p-5 shadow-2xl shadow-black/20 backdrop-blur ${interactive ? 'cursor-pointer transition hover:border-cyan-300/30' : ''}`} role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined} onClick={openDetail} onKeyDown={(event) => {
      if (!interactive) return;
      if (event.key === 'Enter' || event.key === ' ') openDetail();
    }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          {locked ? (
            <p className={`mt-2 inline-flex items-center gap-1.5 text-3xl font-bold ${valueClassName ?? 'text-white'}`} title="Activate Pro to reveal">
              <span className="pointer-events-none select-none" style={{ filter: 'blur(7px)' }} aria-hidden="true">{value}</span>
              <Lock size={18} className="shrink-0 text-amber-300/90" aria-hidden="true" />
            </p>
          ) : (
            <p className={`mt-2 text-3xl font-bold ${valueClassName ?? (positive === undefined ? 'text-white' : positive ? 'text-emerald-300' : 'text-rose-300')}`}>{value}</p>
          )}
          {locked ? (
            <p className={`mt-2 text-sm ${subClassName ?? 'text-slate-400'}`}><span className="pointer-events-none select-none" style={{ filter: 'blur(4px)' }} aria-hidden="true">{sub}</span></p>
          ) : (
            <p className={`mt-2 text-sm ${subClassName ?? 'text-slate-400'}`}>{sub}</p>
          )}
        </div>
        <button
          className={`rounded-2xl bg-cyan-400/10 p-3 text-cyan-300 ${interactive ? 'cursor-pointer hover:bg-cyan-400/20' : ''}`}
          type="button"
          aria-label={locked ? `${title} is a Pro feature` : detail ? `Show ${title} details` : `${title} icon`}
          onClick={(event) => {
            event.stopPropagation();
            openDetail();
          }}
        >
          {locked ? <Lock size={22} className="text-amber-300/90" /> : <Icon size={22} />}
        </button>
      </div>
      {!locked && detail && showDetail && createPortal(
        <>
        <div className="fixed inset-0 z-[9998] bg-transparent" onClick={(event) => {
          event.stopPropagation();
          setShowDetail(false);
        }} />
        <div
          className="fixed z-[9999] w-[32.5rem] overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950/95 shadow-2xl shadow-black/40 backdrop-blur"
          style={{ left: detailPosition.x, top: detailPosition.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className="flex cursor-move items-center justify-between border-b border-white/10 bg-cyan-300/10 px-4 py-3"
            onMouseDown={(event) => {
              event.stopPropagation();
              setDragOffset({ x: event.clientX - detailPosition.x, y: event.clientY - detailPosition.y });
            }}
          >
            <p className="font-semibold text-white">{title} details</p>
            <button className="rounded-lg px-2 py-1 text-sm text-slate-300 hover:bg-white/10 hover:text-white" type="button" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => {
              event.stopPropagation();
              setShowDetail(false);
            }}>Close</button>
          </div>
          <div className="max-h-[22rem] overflow-y-auto p-4 text-sm leading-6 text-slate-300">{detail}</div>
        </div>
        </>,
        document.body,
      )}
    </div>
  );
}
