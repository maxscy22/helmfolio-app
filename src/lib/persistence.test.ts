import { describe, expect, it } from 'vitest';
import { cleanSavedImportStatus } from './persistence';

// The status saved to disk must NOT keep growing one "Restored from ..." line
// per launch. cleanSavedImportStatus strips the trailing restore sentence(s)
// before re-saving; the regex must match the exact wording App.tsx generates
// for BOTH runtimes (desktop "saved app data", browser "browser's saved data").
describe('cleanSavedImportStatus — restore-suffix stripping', () => {
  const core = 'Merged 0 new trades from IBKR (1264 duplicates skipped). Imported at 2026/6/1 下午2:40:16.';

  it('strips a single desktop "saved app data" restore sentence', () => {
    const status = `${core} Restored from your saved app data at 2026/6/1 下午2:45:00.`;
    expect(cleanSavedImportStatus(status)).toBe(core);
  });

  it('strips a single browser "browser\'s saved data" restore sentence', () => {
    const status = `${core} Restored from your browser's saved data at 2026/6/1 下午2:45:00.`;
    expect(cleanSavedImportStatus(status)).toBe(core);
  });

  it('strips MANY accumulated restore sentences (the reported v1.0.6 bug)', () => {
    const status =
      `${core}` +
      ' Restored from your saved app data at 2026/6/1 下午2:45:00.' +
      ' Restored from your saved app data at 2026/6/1 下午3:11:16.' +
      ' Restored from your saved app data at 2026/6/1 下午10:37:03.';
    expect(cleanSavedImportStatus(status)).toBe(core);
  });

  it('also strips the legacy "this browser\'s saved data" wording', () => {
    const status = `${core} Restored from this browser's saved data at 2026/6/1 下午2:45:00.`;
    expect(cleanSavedImportStatus(status)).toBe(core);
  });

  it('leaves a status without any restore sentence untouched', () => {
    expect(cleanSavedImportStatus(core)).toBe(core);
  });
});
