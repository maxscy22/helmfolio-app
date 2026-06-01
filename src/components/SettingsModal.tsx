import { BookOpen, KeyRound, LifeBuoy, Mail, RefreshCw, Scale, Upload } from 'lucide-react';
import { useEffect, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { APP_NAME, APP_SUPPORT_EMAIL } from '../appMetadata';
import type { BrowserStorageUsage, PersistedDashboardSettings } from '../lib/persistence';
import { LEGAL_DOCS, LEGAL_DOC_ORDER, type LegalDocId } from '../lib/legalConfig';
import { formatStorageMb } from '../lib/storage';
import { themePresets } from '../lib/themes';
import {
  checkForUpdates,
  clearIbkrCredentials,
  getIbkrCredentialStatus,
  hasSecureCredentialStore,
  isDesktopRuntime,
  saveIbkrCredentials,
  type IbkrCredentialStatus,
} from '../lib/api';

type SettingsModalProps = {
  open: boolean;
  themeId: string;
  portraitDataUrl: string;
  displayName: string;
  dashboardVersion: string;
  changelog: string;
  storageUsage: BrowserStorageUsage | null;
  onRefreshStorageUsage: () => void;
  onOpenDataFolder: () => void;
  onClearData: () => void;
  onOpenLegal: (doc: LegalDocId) => void;
  onSave: (settings: Pick<PersistedDashboardSettings, 'themeId' | 'portraitDataUrl' | 'displayName'>) => void;
  onCancel: () => void;
};

export function SettingsModal({ open, themeId, portraitDataUrl, displayName, dashboardVersion, changelog, storageUsage, onRefreshStorageUsage, onOpenDataFolder, onClearData, onOpenLegal, onSave, onCancel }: SettingsModalProps) {
  const [draftThemeId, setDraftThemeId] = useState(themeId);
  const [draftPortraitDataUrl, setDraftPortraitDataUrl] = useState(portraitDataUrl);
  const [draftDisplayName, setDraftDisplayName] = useState(displayName);

  const secureStoreAvailable = hasSecureCredentialStore();
  const [credentialStatus, setCredentialStatus] = useState<IbkrCredentialStatus | null>(null);
  const [draftToken, setDraftToken] = useState('');
  const [draftQueryId, setDraftQueryId] = useState('');
  const [credentialMessage, setCredentialMessage] = useState('');
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateMessage('');
    try {
      const result = await checkForUpdates();
      if (!result) {
        setUpdateMessage('Updates are only available in the installed desktop app.');
        return;
      }
      switch (result.status) {
        case 'available':
          setUpdateMessage(`Update available (v${result.version}). It's downloading in the background — you'll be prompted to restart when it's ready.`);
          break;
        case 'none':
          setUpdateMessage(`You're up to date (v${result.currentVersion ?? dashboardVersion}).`);
          break;
        case 'unsupported':
          setUpdateMessage(result.message ?? 'Updates are only available in the installed desktop app.');
          break;
        default:
          setUpdateMessage(result.message ?? 'Could not check for updates. Please try again later.');
      }
    } catch {
      setUpdateMessage('Could not check for updates. Please try again later.');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setDraftThemeId(themeId);
    setDraftPortraitDataUrl(portraitDataUrl);
    setDraftDisplayName(displayName);
  }, [open, themeId, portraitDataUrl, displayName]);

  useEffect(() => {
    if (!open || !secureStoreAvailable) return;
    let cancelled = false;
    setCredentialMessage('');
    setDraftToken('');
    getIbkrCredentialStatus()
      .then((status) => {
        if (cancelled || !status) return;
        setCredentialStatus(status);
        setDraftQueryId(status.queryId);
      })
      .catch(() => {
        if (!cancelled) setCredentialMessage('Could not read stored IBKR credentials.');
      });
    return () => {
      cancelled = true;
    };
  }, [open, secureStoreAvailable]);

  const handleSaveCredentials = async () => {
    setIsSavingCredentials(true);
    setCredentialMessage('');
    try {
      await saveIbkrCredentials({ token: draftToken, queryId: draftQueryId });
      const status = await getIbkrCredentialStatus();
      setCredentialStatus(status);
      setDraftToken('');
      setCredentialMessage('IBKR credentials saved securely (OS-encrypted).');
    } catch (error) {
      setCredentialMessage(error instanceof Error ? error.message : 'Failed to save IBKR credentials.');
    } finally {
      setIsSavingCredentials(false);
    }
  };

  const handleClearCredentials = async () => {
    setIsSavingCredentials(true);
    setCredentialMessage('');
    try {
      await clearIbkrCredentials();
      const status = await getIbkrCredentialStatus();
      setCredentialStatus(status);
      setDraftToken('');
      setDraftQueryId('');
      setCredentialMessage('Stored IBKR credentials cleared.');
    } catch (error) {
      setCredentialMessage(error instanceof Error ? error.message : 'Failed to clear IBKR credentials.');
    } finally {
      setIsSavingCredentials(false);
    }
  };

  if (!open) return null;

  const localStorageUsagePct = storageUsage && storageUsage.originQuotaBytes ? (storageUsage.localStorageBytes / storageUsage.originQuotaBytes) * 100 : null;

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
              <p className="mt-3 text-xs leading-5 text-slate-500">{secureStoreAvailable ? 'The image is saved locally on this computer only.' : 'The image is saved locally in your browser storage only.'}</p>
            </div>
          </div>
          <div className="lg:col-span-2">
            <p className="mb-3 font-semibold text-white">Version &amp; changelog</p>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <div>
                <p className="text-sm text-slate-400">Helmfolio version</p>
                <p className="mt-1 text-2xl font-bold text-cyan-100">v{dashboardVersion}</p>
              </div>
              <pre className="mt-4 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-slate-300">{changelog}</pre>
            </div>
          </div>
          <div className="lg:col-span-2">
            <p className="mb-3 flex items-center gap-2 font-semibold text-white"><KeyRound size={16} className="text-cyan-200" /> IBKR Flex Web Service credentials</p>
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-4">
              {secureStoreAvailable ? (
                <>
                  <p className="text-sm leading-6 text-cyan-50/80">
                    Your IBKR Flex token and Query ID are stored <span className="font-semibold text-white">encrypted by your operating system</span> (Electron safeStorage) and sent to the local backend only when you sync. They are never bundled in the app or written in plaintext.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-200">Flex token</span>
                      <input
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none focus:border-cyan-300"
                        type="password"
                        autoComplete="off"
                        value={draftToken}
                        placeholder={credentialStatus?.hasToken ? `Saved: ${credentialStatus.tokenMask} (leave blank to keep)` : 'Paste your IBKR Flex token'}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setDraftToken(event.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-200">Flex Query ID</span>
                      <input
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none focus:border-cyan-300"
                        type="text"
                        autoComplete="off"
                        value={draftQueryId}
                        placeholder="e.g. 123456"
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setDraftQueryId(event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      disabled={isSavingCredentials || (!draftToken && !draftQueryId)}
                      onClick={handleSaveCredentials}
                    >
                      {isSavingCredentials ? 'Saving...' : 'Save credentials'}
                    </button>
                    {credentialStatus?.hasToken && (
                      <button
                        className="rounded-2xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100 hover:bg-rose-400/20 disabled:opacity-60"
                        type="button"
                        disabled={isSavingCredentials}
                        onClick={handleClearCredentials}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {credentialStatus && !credentialStatus.encryptionAvailable && (
                    <p className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">OS-level encryption is unavailable on this machine, so credentials cannot be stored securely.</p>
                  )}
                  {credentialMessage && <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-2 text-xs leading-5 text-cyan-50/90">{credentialMessage}</p>}
                  <p className="mt-3 text-xs leading-5 text-cyan-50/60">Flex tokens expire periodically (about once a year). Regenerate one in the IBKR portal under Settings &rarr; Account Settings &rarr; Flex Web Service, then paste it here.</p>
                </>
              ) : (
                <p className="text-sm leading-6 text-cyan-50/80">In browser dev mode, IBKR credentials are read from the backend <code className="rounded bg-black/30 px-1">.env</code> file (<code className="rounded bg-black/30 px-1">IBKR_FLEX_TOKEN</code> / <code className="rounded bg-black/30 px-1">IBKR_FLEX_QUERY_ID</code>). The OS-encrypted credential store is available in the desktop app.</p>
              )}
              <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-cyan-100">
                  <BookOpen size={14} />
                  How to set up your IBKR Flex Token &amp; Query ID
                </summary>
                <div className="mt-3 space-y-2 text-xs leading-5 text-cyan-50/80">
                  <p>In the <span className="font-semibold text-white">IBKR Client Portal</span>, go to <span className="font-semibold text-white">Performance &amp; Reports &rarr; Flex Queries</span>. (Menu names may vary by IBKR version.)</p>
                  <ol className="ml-4 list-decimal space-y-1.5">
                    <li><span className="font-semibold text-white">Flex Web Service</span> &rarr; Configure &rarr; <span className="font-semibold text-white">Generate New Token</span> &rarr; copy it.</li>
                    <li>Under <span className="font-semibold text-white">Activity Flex Query</span>, click <span className="font-semibold text-white">+</span> and include these sections (check all sub-items): <span className="font-semibold text-white">Trades</span>, <span className="font-semibold text-white">Open Positions</span>, <span className="font-semibold text-white">Cash Transactions</span>, <span className="font-semibold text-white">Change in NAV</span>, <span className="font-semibold text-white">Net Asset Value (NAV) in Base</span>. <span className="text-cyan-50/60">(Corporate Actions optional.)</span></li>
                    <li>Set <span className="font-semibold text-white">Format = XML</span> (required), <span className="font-semibold text-white">Period = Last 365 Calendar Days</span>, <span className="font-semibold text-white">Date = yyyyMMdd</span>, <span className="font-semibold text-white">Time = HHmmss</span>, <span className="font-semibold text-white">Separator = ;</span>, then <span className="font-semibold text-white">Save</span>.</li>
                    <li>Open the saved query to find its numeric <span className="font-semibold text-white">Query ID</span> and copy it.</li>
                    <li>Paste the <span className="font-semibold text-white">Token</span> and <span className="font-semibold text-white">Query ID</span> above, save, then click <span className="font-semibold text-white">Sync IBKR Flex Now</span>.</li>
                  </ol>
                </div>
              </details>
            </div>
          </div>
          <div className="lg:col-span-2">
            <p className="mb-3 font-semibold text-white">{secureStoreAvailable ? 'Your local data' : 'Browser storage'}</p>
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold text-white">{secureStoreAvailable ? 'Everything stays on this computer' : 'Saved dashboard size'}</p>
                  <p className="mt-2 text-sm leading-6 text-cyan-50/80">{secureStoreAvailable ? 'Helmfolio is 100% local. Your trades, positions, and settings are stored only on this machine — never uploaded to any server. This is how much space your saved data uses.' : 'Use this as an early warning for when localStorage may become too small.'}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {secureStoreAvailable && (
                    <button className="rounded-2xl border border-cyan-200/30 bg-cyan-300/10 px-4 py-3 text-sm font-bold text-cyan-100 hover:bg-cyan-300/20" type="button" onClick={onOpenDataFolder}>
                      Open data folder
                    </button>
                  )}
                  <button className="rounded-2xl border border-cyan-200/30 bg-cyan-300/10 px-4 py-3 text-sm font-bold text-cyan-100 hover:bg-cyan-300/20" type="button" onClick={onRefreshStorageUsage}>
                    Refresh
                  </button>
                </div>
              </div>
              {storageUsage ? (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/70">Dashboard data</p>
                    <p className="mt-2 text-xl font-bold text-white">{formatStorageMb(storageUsage.dashboardBytes)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/70">Settings</p>
                    <p className="mt-2 text-xl font-bold text-white">{formatStorageMb(storageUsage.settingsBytes)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/70">{storageUsage.isDesktop ? 'Total saved' : 'LocalStorage total'}</p>
                    <p className="mt-2 text-xl font-bold text-white">{formatStorageMb(storageUsage.localStorageBytes)}</p>
                    {!storageUsage.isDesktop && <p className="mt-1 text-xs text-cyan-50/60">{localStorageUsagePct === null ? 'Quota estimate unavailable' : `${localStorageUsagePct.toFixed(2)}% of browser quota`}</p>}
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-cyan-50/80">Storage usage will appear when this panel opens. Click refresh if needed.</p>
              )}
              {storageUsage && <p className="mt-3 text-xs text-cyan-50/50">Updated {storageUsage.updatedAt}</p>}
            </div>
          </div>
          <div className="lg:col-span-2">
            <p className="mb-3 flex items-center gap-2 font-semibold text-white"><LifeBuoy size={16} className="text-cyan-200" /> Help &amp; support</p>
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-white">Need help or have a question?</p>
                  <p className="mt-2 text-sm leading-6 text-cyan-50/80">Email us and we'll get back to you. Please include your {APP_NAME} version ({dashboardVersion}) and a short description of the issue.</p>
                </div>
                <a
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
                  href={`mailto:${APP_SUPPORT_EMAIL}?subject=${encodeURIComponent(`${APP_NAME} support (v${dashboardVersion})`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Mail size={16} />
                  Contact support
                </a>
              </div>
              <p className="mt-3 text-xs leading-5 text-cyan-50/60">Or email <span className="font-semibold text-cyan-100">{APP_SUPPORT_EMAIL}</span> directly.</p>
              {isDesktopRuntime() && (
                <div className="mt-4 border-t border-cyan-300/15 pt-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-white">App updates</p>
                      <p className="mt-1 text-sm leading-6 text-cyan-50/80">You're on v{dashboardVersion}. Updates install automatically — you can also check now.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCheckForUpdates}
                      disabled={isCheckingUpdate}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-cyan-200/30 bg-cyan-300/10 px-4 py-3 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCw size={16} className={isCheckingUpdate ? 'animate-spin' : ''} />
                      {isCheckingUpdate ? 'Checking…' : 'Check for updates'}
                    </button>
                  </div>
                  {updateMessage && <p className="mt-3 text-xs leading-5 text-cyan-50/70">{updateMessage}</p>}
                </div>
              )}
            </div>
          </div>
          <div className="lg:col-span-2">
            <p className="mb-3 flex items-center gap-2 font-semibold text-white"><Scale size={16} className="text-cyan-200" /> Legal &amp; disclaimers</p>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm leading-6 text-slate-300">{LEGAL_DOCS.disclaimer.title}, license terms, and how your data is handled. This software is for informational purposes only and is <span className="font-semibold text-white">not financial advice</span>.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {LEGAL_DOC_ORDER.map((id) => (
                  <button key={id} className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/20" type="button" onClick={() => onOpenLegal(id)}>
                    {LEGAL_DOCS[id].title}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <p className="mb-3 font-semibold text-rose-100">Danger Zone</p>
            <div className="rounded-3xl border border-rose-300/25 bg-rose-500/10 p-4">
              <div className="flex flex-col gap-4 md:flex-row-reverse md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-white">Clear dashboard data</p>
                  <p className="mt-2 text-sm leading-6 text-rose-50/80">Removes imported trades, open positions, NAV rows, and saved dashboard data from {secureStoreAvailable ? 'this computer' : 'this browser'}. Theme, portrait, and display name are kept.</p>
                </div>
                <button className="shrink-0 self-start rounded-2xl border border-rose-200/30 bg-rose-400 px-4 py-3 text-sm font-bold text-white hover:bg-rose-300 hover:text-rose-950 md:self-center" type="button" onClick={onClearData}>
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
