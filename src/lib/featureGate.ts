// Maps a verified license state to feature availability (UX layer only).
//
// IMPORTANT: This never grants access to data on its own — the backend
// requireLicense middleware independently verifies the token before serving
// premium endpoints. featureGate only decides what the UI shows/enables so the
// experience matches what the server will actually allow.

import { LICENSE_LAPSED_MESSAGE, type LicenseState } from './license';
import { PREMIUM_FEATURES, type PremiumFeature } from './licenseConfig';

export type { PremiumFeature } from './licenseConfig';

// Pro tier (valid license) or 'unsupported' (browser dev) unlock everything.
export const isProEntitled = (state: LicenseState): boolean =>
  state.tier === 'pro' || state.status === 'unsupported';

export const isFeatureEnabled = (state: LicenseState, feature: PremiumFeature): boolean => {
  if (!PREMIUM_FEATURES.includes(feature)) return true; // free feature
  return isProEntitled(state);
};

// Human-readable status line for the license badge / settings panel.
export const licenseSummary = (state: LicenseState): string => {
  switch (state.status) {
    case 'active':
      // Online re-verification still happens silently in the background; we don't
      // surface the countdown to paying users (it looks petty / distrustful).
      return 'Pro license active.';
    case 'expired':
      return 'Your license needs to re-verify online. Connect to the internet to continue using Pro features.';
    case 'lapsed':
      return LICENSE_LAPSED_MESSAGE;
    case 'invalid':
      return 'The stored license could not be verified on this device. Please re-activate.';
    case 'unsupported':
      return 'Development mode: all features unlocked.';
    case 'none':
    default:
      return 'Free plan. Activate a license to unlock IBKR sync, benchmarks, and risk analytics.';
  }
};
