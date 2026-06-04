import eulaRaw from '../../legal/EULA.md?raw';
import privacyRaw from '../../legal/PRIVACY.md?raw';
import disclaimerRaw from '../../legal/DISCLAIMER.md?raw';
import { APP_NAME, APP_SUPPORT_EMAIL, APP_WEBSITE } from '../appMetadata';

// These values are substituted into the EULA, Privacy Policy, and Disclaimer at
// render time (tokens use the {{key}} syntax). Brand fields come from the single
// source of truth in appMetadata.ts.
export const LEGAL_INFO = {
  appName: APP_NAME,
  sellerName: 'Max Shing',
  supportEmail: APP_SUPPORT_EMAIL,
  website: APP_WEBSITE,
  jurisdiction: 'Hong Kong',
  lastUpdated: '2026-06-05',
} as const;

export type LegalDocId = 'eula' | 'privacy' | 'disclaimer';

export type LegalDoc = {
  id: LegalDocId;
  title: string;
  body: string;
};

function fillTokens(template: string): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = (LEGAL_INFO as Record<string, string>)[key];
    return value ?? match;
  });
}

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  disclaimer: { id: 'disclaimer', title: 'Not Financial Advice', body: fillTokens(disclaimerRaw) },
  eula: { id: 'eula', title: 'End User License Agreement', body: fillTokens(eulaRaw) },
  privacy: { id: 'privacy', title: 'Privacy Policy', body: fillTokens(privacyRaw) },
};

export const LEGAL_DOC_ORDER: LegalDocId[] = ['disclaimer', 'eula', 'privacy'];
