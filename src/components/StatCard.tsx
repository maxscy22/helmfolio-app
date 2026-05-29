import { Activity } from 'lucide-react';
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
};

export function StatCard({ title, value, sub, icon: Icon, positive, detail, valueClassName, subClassName }: StatCardProps) {
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
    if (!detail) return;
    centerDetail();
    setShowDetail(true);
  };

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
    <div className={`rounded-3xl border border-white/10 bg-[var(--dashboard-card)] p-5 shadow-2xl shadow-black/20 backdrop-blur ${detail ? 'cursor-pointer transition hover:border-cyan-300/30' : ''}`} role={detail ? 'button' : undefined} tabIndex={detail ? 0 : undefined} onClick={openDetail} onKeyDown={(event) => {
      if (!detail) return;
      if (event.key === 'Enter' || event.key === ' ') openDetail();
    }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className={`mt-2 text-3xl font-bold ${valueClassName ?? (positive === undefined ? 'text-white' : positive ? 'text-emerald-300' : 'text-rose-300')}`}>{value}</p>
          <p className={`mt-2 text-sm ${subClassName ?? 'text-slate-400'}`}>{sub}</p>
        </div>
        <button
          className={`rounded-2xl bg-cyan-400/10 p-3 text-cyan-300 ${detail ? 'cursor-pointer hover:bg-cyan-400/20' : ''}`}
          type="button"
          aria-label={detail ? `Show ${title} details` : `${title} icon`}
          onClick={(event) => {
            event.stopPropagation();
            openDetail();
          }}
        >
          <Icon size={22} />
        </button>
      </div>
      {detail && showDetail && createPortal(
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
