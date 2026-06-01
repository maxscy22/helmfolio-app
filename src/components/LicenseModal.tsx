import { KeyRound, ShieldCheck, ShieldAlert, ExternalLink, Check, Lock, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { APP_NAME, APP_SUPPORT_EMAIL, APP_WEBSITE } from '../appMetadata';
import { licenseSummary } from '../lib/featureGate';
import type { LicenseState } from '../lib/license';

type LicenseModalProps = {
  open: boolean;
  state: LicenseState;
  onActivate: (key: string) => Promise<LicenseState>;
  onDeactivate: () => Promise<void>;
  onClose: () => void;
};

export function LicenseModal({ open, state, onActivate, onDeactivate, onClose }: LicenseModalProps) {
  const [licenseKey, setLicenseKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error' | 'neutral'>('neutral');
  const [showActivate, setShowActivate] = useState(false);

  useEffect(() => {
    if (open) {
      setLicenseKey('');
      setMessage('');
      setMessageTone('neutral');
      setShowActivate(false);
    }
  }, [open]);

  if (!open) return null;

  const isActive = state.status === 'active';

  // Free vs Pro value comparison shown on the paywall. Mirrors the real feature
  // gate (PREMIUM_FEATURES + lockFigures): core P/L is free, advanced analytics,
  // IBKR sync, benchmarks, risk metrics, and PDF export are Pro. Market sentiment
  // (VIX, Fear & Greed, AAII) is intentionally FREE, so it is not listed here.
  const comparisonRows: { label: string; free: 'yes' | 'no' | 'locked'; pro: 'yes' }[] = [
    { label: 'CSV & manual import + core P/L', free: 'yes', pro: 'yes' },
    { label: 'Market sentiment — VIX, Fear & Greed, AAII', free: 'yes', pro: 'yes' },
    { label: 'IBKR one-click auto-sync', free: 'no', pro: 'yes' },
    { label: 'Risk metrics — Sharpe, max drawdown', free: 'no', pro: 'yes' },
    { label: 'Benchmark vs NASDAQ & S&P 500', free: 'no', pro: 'yes' },
    { label: 'Advanced KPIs — win rate, payoff, profit factor', free: 'locked', pro: 'yes' },
    { label: 'Themed PDF report export', free: 'no', pro: 'yes' },
  ];
  const cell = (value: 'yes' | 'no' | 'locked') =>
    value === 'yes' ? <Check size={16} className="text-emerald-300" /> :
    value === 'locked' ? <Lock size={14} className="text-amber-300/80" /> :
    <span className="text-slate-600">—</span>;

  const handleActivate = async () => {
    setBusy(true);
    setMessage('');
    try {
      const result = await onActivate(licenseKey);
      const succeeded = result.status === 'active';
      setMessage(result.message || (succeeded ? 'License activated successfully — Pro features are now unlocked.' : 'Activation failed.'));
      setMessageTone(succeeded ? 'success' : 'error');
      if (succeeded) setLicenseKey('');
    } finally {
      setBusy(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm('Deactivate this device? You can re-activate later with the same key.')) return;
    setBusy(true);
    setMessage('');
    try {
      await onDeactivate();
      setMessage('License deactivated on this device.');
      setMessageTone('neutral');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 px-4 backdrop-blur">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-cyan-300/10 px-6 py-5">
          <div className="flex items-center gap-3">
            {isActive ? <ShieldCheck className="text-emerald-300" size={22} /> : <ShieldAlert className="text-amber-300" size={22} />}
            <div>
              <h2 className="text-lg font-bold text-white">{isActive ? 'License' : 'Unlock Helmfolio Pro'}</h2>
              <p className="text-xs text-slate-400">{isActive ? 'Manage your Pro license on this device.' : 'See everything your trading data is telling you.'}</p>
            </div>
          </div>
          <button className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-300 hover:bg-white/10" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${isActive ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-50' : 'border-amber-300/20 bg-amber-300/10 text-amber-50'}`}>
            {licenseSummary(state)}
          </div>

          {isActive ? (
            <div className="space-y-3">
              {state.claims?.sub && (
                <p className="text-xs text-slate-400">
                  Key: <span className="font-mono text-slate-200">{`${state.claims.sub.slice(0, 6)}...${state.claims.sub.slice(-4)}`}</span>
                </p>
              )}
              <button
                className="w-full rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/20 disabled:opacity-60"
                type="button"
                disabled={busy}
                onClick={handleDeactivate}
              >
                {busy ? 'Working...' : 'Deactivate this device'}
              </button>
              <p className="text-xs leading-5 text-amber-200/90">
                Moving to a new PC? Remember to click Deactivate here first! Your license allows 2 active devices, so freeing this seat lets you activate on another machine.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <div className="grid grid-cols-[1fr_3rem_3rem] items-center gap-x-3 bg-white/[0.04] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <span>What you unlock</span>
                  <span className="text-center">Free</span>
                  <span className="text-center text-cyan-200">Pro</span>
                </div>
                <div className="divide-y divide-white/5">
                  {comparisonRows.map((row) => (
                    <div key={row.label} className="grid grid-cols-[1fr_3rem_3rem] items-center gap-x-3 px-4 py-2.5 text-sm">
                      <span className="text-slate-200">{row.label}</span>
                      <span className="flex justify-center">{cell(row.free)}</span>
                      <span className="flex justify-center">{cell(row.pro)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-center">
                <p className="text-sm font-semibold text-white">Unlock the full performance desk</p>
                <p className="mt-1 text-xs leading-5 text-cyan-100/80">Pays for itself with one better decision.<br />2 devices · works offline · 100% local &amp; private.</p>
              </div>

              <a
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
                href={`${APP_WEBSITE}/#pricing`}
                target="_blank"
                rel="noreferrer"
              >
                See plans &amp; upgrade <ExternalLink size={15} />
              </a>

              {showActivate ? (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <label className="block text-sm font-semibold text-slate-200" htmlFor="license-key">Enter your license key</label>
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                    <KeyRound size={16} className="text-cyan-200" />
                    <input
                      id="license-key"
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                      placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                      value={licenseKey}
                      onChange={(event) => setLicenseKey(event.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <button
                    className="w-full rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    disabled={busy || !licenseKey.trim()}
                    onClick={handleActivate}
                  >
                    {busy ? 'Activating...' : 'Activate license'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full text-center text-sm font-semibold text-slate-400 transition hover:text-slate-200"
                  onClick={() => setShowActivate(true)}
                >
                  Already have a license key? Activate it
                </button>
              )}
            </div>
          )}

          {message && (
            <p className={`rounded-2xl border px-4 py-3 text-xs leading-5 ${messageTone === 'success' ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : messageTone === 'error' ? 'border-rose-300/30 bg-rose-300/10 text-rose-100' : 'border-white/10 bg-white/[0.06] text-slate-200'}`}>{message}</p>
          )}

          <p className="flex flex-wrap items-center justify-center gap-1.5 text-center text-xs leading-5 text-slate-400">
            <Mail size={13} className="text-cyan-200" />
            Questions about your license or a purchase? Email
            <a className="font-semibold text-cyan-200 hover:text-cyan-100" href={`mailto:${APP_SUPPORT_EMAIL}?subject=${encodeURIComponent(`${APP_NAME} license support`)}`} target="_blank" rel="noreferrer">{APP_SUPPORT_EMAIL}</a>
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
