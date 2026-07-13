/**
 * Temporary dev flags — flip to `true`, reload the app, then test the tour.
 * All flags are no-ops in production (`__DEV__` is false).
 *
 * Quick start:
 * - `forceAppIntro` — first-launch slide deck (OnboardingContainer)
 * - `forceAllFeatures` — every feature tour below (reader, journal, forms, …)
 * - Or set individual `features.*` flags for one tour at a time.
 */
export const ONBOARDING_DEBUG = {
  /** App intro slides shown before the main tabs. */
  forceAppIntro: false,

  /** Re-run every feature tour; clears saved completion on startup. */
  forceAllFeatures: false,

  /**
   * Per-screen tours (ignored when `forceAllFeatures` is true).
   * reader — reader tab coach marks (book, settings, verse selection, …)
   * readerSettings — settings row tooltips (reserved; long-press today)
   * readerActionBar — verse action bar (highlight, copy, journal, …)
   * readerBookPicker — book/chapter picker tooltips
   * journal — journal list tab tour
   * journalEditor — new/edit entry form coach marks
   * journalDetail — entry detail share/export tour
   */
  features: {
    reader: false,
    readerSettings: true,
    readerActionBar: false,
    readerBookPicker: true,
    journal: false,
    journalEditor: true,
    journalDetail: true,
  },
} as const;

export type OnboardingDebugFeaturePage = keyof typeof ONBOARDING_DEBUG.features;

const ALL_FEATURE_PAGES = Object.keys(ONBOARDING_DEBUG.features) as OnboardingDebugFeaturePage[];

/** Dev-only: re-show the app intro on next launch. */
export const ONBOARDING_DEBUG_FORCE_APP_INTRO = __DEV__ && ONBOARDING_DEBUG.forceAppIntro;

/** Dev-only: any feature tour should re-run (and not persist completion). */
export function onboardingDebugForcedFeaturePages(): ReadonlySet<OnboardingDebugFeaturePage> {
  if (!__DEV__) return new Set();
  if (ONBOARDING_DEBUG.forceAllFeatures) return new Set(ALL_FEATURE_PAGES);
  return new Set(
    ALL_FEATURE_PAGES.filter((page) => ONBOARDING_DEBUG.features[page]),
  );
}

/** @deprecated Use `onboardingDebugForcedFeaturePages().size > 0`. */
export const FEATURE_ONBOARDING_DEBUG_FORCE_ALL =
  onboardingDebugForcedFeaturePages().size > 0;
