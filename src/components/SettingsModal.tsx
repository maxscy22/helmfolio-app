import { Upload } from 'lucide-react';
import { useEffect, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import type { BrowserStorageUsage, PersistedDashboardSettings } from '../lib/persistence';
import { formatStorageMb } from '../lib/storage';
import { themePresets } from '../lib/themes';

type SettingsModalProps = {
  open: boolean;
  themeId: string;
  portraitDataUrl: string;
  displayName: string;
  dashboardVersion: string;
  changelog: string;
  backupStatus: string;
  isBackingUpProject: boolean;
  storageUsage: BrowserStorageUsage | null;
  onRefreshStorageUsage: () => void;
  onBackupProject: () => void;
  onClearData: () => void;
  onSave: (settings: PersistedDashboardSettings) => void;
  onCancel: () => void;
};

export function SettingsModal({ open, themeId, portraitDataUrl, displayName, dashboardVersion, changelog, backupStatus, isBackingUpProject, storageUsage, onRefreshStorageUsage, onBackupProject, onClearData, onSave, onCancel }: SettingsModalProps) {
  const [draftThemeId, setDraftThemeId] = useState(themeId);
  const [draftPortraitDataUrl, setDraftPortraitDataUrl] = useState(portraitDataUrl);
  const [draftDisplayName, setDraftDisplayName] = useState(displayName);

  useEffect(() => {
    if (!open) return;
    setDraftThemeId(themeId);
    setDraftPortraitDataUrl(portraitDataUrl);
    setDraftDisplayName(displayName);
  }, [open, themeId, portraitDataUrl, displayName]);

  if (!open) return null;

  const localStorageUsagePct = storageUsage && storageUsage.originQuotaBytes ? (storageUsage.localStorageBytes / storageUsage.originQuotaBytes) * 100 : null;
  const originUsagePct = storageUsage && storageUsage.originQuotaBytes && storageUsage.originUsageBytes !== null ? (storageUsage.originUsageBytes / storageUsage.originQuotaBytes) * 100 : null;

  const handlePortraitUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setDraftPortraitDataUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 px-4 backdrop-blur">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-cyan-300/10 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Display settings</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Theme and portrait</h2>
            <p className="mt-1 text-sm text-slate-400">Choose a visual style and upload a local portrait for the dashboard header.</p>
          </div>
          <button className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white" type="button" onClick={onCancel}>Close</button>
        </div>
        <div className="grid max-h-[68vh] gap-6 overflow-y-auto p-6 lg:grid-cols-[1fr_18rem]">
          <div>
            <p className="mb-3 font-semibold text-white">Theme</p>
            <div className="grid gap-3 md:grid-cols-2">
              {themePresets.map((theme) => (
                <button key={theme.id} className={`rounded-2xl border p-4 text-left transition ${draftThemeId === theme.id ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'}`} type="button" onClick={() => setDraftThemeId(theme.id)}>
                  <div className={`h-16 rounded-xl bg-gradient-to-br ${theme.previewClassName}`} />
                  <p className="mt-3 font-semibold text-white">{theme.name}</p>
                  <p className="mt-1 text-sm leading-5 text-slate-400">{theme.description}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-3 font-semibold text-white">Portrait</p>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <label className="mb-4 block">
                <span className="text-sm font-semibold text-slate-300">Display name</span>
                <input className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none focus:border-cyan-300" type="text" value={draftDisplayName} placeholder="Your name" onChange={(event: ChangeEvent<HTMLInputElement>) => setDraftDisplayName(event.target.value)} />
              </label>
              <div className="aspect-square overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06]">
                {draftPortraitDataUrl ? <img className="h-full w-full object-cover" src={draftPortraitDataUrl} alt="Dashboard portrait preview" /> : <div className="flex h-full w-full items-center justify-center text-center text-sm text-slate-500">No portrait uploaded</div>}
              </div>
              <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/20">
                <Upload size={16} />
                Upload portrait
                <input className="hidden" type="file" accept="image/*" onChange={handlePortraitUpload} />
              </label>
              {draftPortraitDataUrl && <button className="mt-2 w-full rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-semibold text-rose-100 hover:bg-rose-300/20" type="button" onClick={() => setDraftPortraitDataUrl('')}>Remove portrait</button>}
              <p className="mt-3 text-xs leading-5 text-slate-500">The image is saved locally in your browser storage only.</p>
            </div>
          </div>
          <div className="lg:col-span-2">
            <p className="mb-3 font-semibold text-white">Version, changelog, and project backup</p>
            <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-400">Dashboard version</p>
                    <p className="mt-1 text-2xl font-bold text-cyan-100">v{dashboardVersion}</p>
                  </div>
                  <p className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">Update this every change</p>
                </div>
                <pre className="mt-4 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-slate-300">{changelog}</pre>
              </div>
              <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                <p className="font-semibold text-white">Backup project folder</p>
                <p className="mt-2 text-sm leading-6 text-emerald-50/80">Copies project files to a folder you choose, such as your Unraid share. Excludes generated folders like `node_modules`, `dist`, `.git`, and `.vite`.</p>
                <button className="mt-4 w-full rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60" type="button" disabled={isBackingUpProject} onClick={onBackupProject}>
                  {isBackingUpProject ? 'Backing up...' : 'Backup Project Now'}
                </button>
                {backupStatus && <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-2 text-xs leading-5 text-emerald-50/90">{backupStatus}</p>}
              </div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <p className="mb-3 font-semibold text-white">Browser storage</p>
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold text-white">Saved dashboard size</p>
                  <p className="mt-2 text-sm leading-6 text-cyan-50/80">Use this as an early warning for when localStorage may become too small and IndexedDB/database migration is worth doing.</p>
                </div>
                <button className="shrink-0 rounded-2xl border border-cyan-200/30 bg-cyan-300/10 px-4 py-3 text-sm font-bold text-cyan-100 hover:bg-cyan-300/20" type="button" onClick={onRefreshStorageUsage}>
                  Refresh
                </button>
              </div>
              {storageUsage ? (
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/70">Dashboard data</p>
                    <p className="mt-2 text-xl font-bold text-white">{formatStorageMb(storageUsage.dashboardBytes)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/70">Settings</p>
                    <p className="mt-2 text-xl font-bold text-white">{formatStorageMb(storageUsage.settingsBytes)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/70">LocalStorage total</p>
                    <p className="mt-2 text-xl font-bold text-white">{formatStorageMb(storageUsage.localStorageBytes)}</p>
                    <p className="mt-1 text-xs text-cyan-50/60">{localStorageUsagePct === null ? 'Quota estimate unavailable' : `${localStorageUsagePct.toFixed(2)}% of browser origin quota`}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/70">Origin storage</p>
                    <p className="mt-2 text-xl font-bold text-white">{formatStorageMb(storageUsage.originUsageBytes)}</p>
                    <p className="mt-1 text-xs text-cyan-50/60">{storageUsage.originQuotaBytes === null ? 'Quota unavailable' : `${originUsagePct?.toFixed(2) ?? '0.00'}% of ${formatStorageMb(storageUsage.originQuotaBytes)}`}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-cyan-50/80">Storage usage will appear when this settings panel opens. Click refresh if needed.</p>
              )}
              <p className="mt-3 text-xs leading-5 text-cyan-50/60">Rule of thumb: if dashboard data approaches 4-5 MB, or imports feel slow, it is time to consider IndexedDB.</p>
              {storageUsage && <p className="mt-1 text-xs text-cyan-50/50">Updated {storageUsage.updatedAt}</p>}
            </div>
          </div>
          <div className="lg:col-span-2">
            <p className="mb-3 font-semibold text-rose-100">Danger Zone</p>
            <div className="rounded-3xl border border-rose-300/25 bg-rose-500/10 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-white">Clear dashboard data</p>
                  <p className="mt-2 text-sm leading-6 text-rose-50/80">Removes imported trades, open positions, NAV rows, and saved dashboard data from this browser. Theme, portrait, and display name are kept.</p>
                </div>
                <button className="shrink-0 rounded-2xl border border-rose-200/30 bg-rose-400 px-4 py-3 text-sm font-bold text-white hover:bg-rose-300 hover:text-rose-950" type="button" onClick={onClearData}>
                  Clear Data
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
          <button className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-white/[0.1]" type="button" onClick={onCancel}>Cancel</button>
          <button className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200" type="button" onClick={() => onSave({ themeId: draftThemeId, portraitDataUrl: draftPortraitDataUrl, displayName: draftDisplayName.trim() })}>Save settings</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
