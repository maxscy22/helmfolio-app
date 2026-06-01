// Figure-level paywall primitives.
//
// Design goal: keep the premium visual LAYOUT visible (titles, labels, axes,
// table headers, chart shape) so the dashboard still looks rich and enticing to
// unpaid users, while the CRITICAL FIGURES are blurred, non-selectable, and act
// as a click target that opens the Pro paywall modal. This is UX-only pressure —
// real enforcement stays in the backend requireLicense middleware.

import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

// Blurs a single inline figure (a number, %, money, ratio) and turns it into a
// click target for the paywall. The blurred content itself is select-none +
// pointer-events-none so it cannot be copied or inspected by selecting text.
export function LockedValue({
  locked,
  onUnlock,
  children,
  placeholder,
  iconSize = 14,
  blur = '6px',
}: {
  locked: boolean;
  onUnlock?: () => void;
  children: ReactNode;
  placeholder?: ReactNode;
  iconSize?: number;
  blur?: string;
}) {
  if (!locked) return <>{children}</>;
  return (
    <span
      className="relative inline-flex cursor-pointer items-center gap-1 align-middle"
      role="button"
      tabIndex={0}
      title="Activate Pro to reveal"
      onClick={(event) => {
        event.stopPropagation();
        onUnlock?.();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onUnlock?.();
        }
      }}
    >
      <span className="pointer-events-none select-none" style={{ filter: `blur(${blur})` }} aria-hidden="true">
        {placeholder ?? children}
      </span>
      <Lock size={iconSize} className="shrink-0 text-amber-300/90" aria-hidden="true" />
    </span>
  );
}

// Blurs an entire region (chart, table body, card group) behind a subtle,
// centered "Activate Pro" pill — intentionally small, not a giant overlay block.
export function LockedOverlay({
  locked,
  onUnlock,
  children,
  label = 'Activate Pro to reveal',
  blur = '10px',
  className = '',
}: {
  locked: boolean;
  onUnlock?: () => void;
  children: ReactNode;
  label?: string;
  blur?: string;
  className?: string;
}) {
  if (!locked) return <>{children}</>;
  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none select-none" style={{ filter: `blur(${blur})` }} aria-hidden="true">
        {children}
      </div>
      <button
        type="button"
        onClick={onUnlock}
        aria-label={label}
        className="absolute inset-0 z-10 flex items-center justify-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-amber-100 shadow-lg shadow-black/30 backdrop-blur-sm transition hover:bg-slate-950/85">
          <Lock size={15} /> {label}
        </span>
      </button>
    </div>
  );
}

// A subtle inline hint placed near a Pro/Mixed section header.
export function ProHint({ onUnlock, className = '' }: { onUnlock?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onUnlock}
      className={`inline-flex items-center gap-1 text-xs font-semibold text-amber-200/90 transition hover:text-amber-100 ${className}`}
    >
      <Lock size={12} /> Activate Pro to reveal locked figures
    </button>
  );
}
