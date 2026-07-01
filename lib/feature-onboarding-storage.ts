import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Dev-only: always re-run these tours and skip persisting completion.
 * Trim this list as each tour is finalized.
 */
export const FEATURE_ONBOARDING_FORCE_PAGES: ReadonlySet<FeatureOnboardingPage> = __DEV__
  ? new Set<FeatureOnboardingPage>(["readerSettings"])
  : new Set();

/**
 * Dev-only: treat these tours as completed (suppress onboarding).
 */
export const FEATURE_ONBOARDING_SKIP_PAGES: ReadonlySet<FeatureOnboardingPage> = __DEV__
  ? new Set<FeatureOnboardingPage>(["reader", "readerActionBar"])
  : new Set();

/** @deprecated Use `FEATURE_ONBOARDING_FORCE_PAGES` — true when any page is forced. */
export const FEATURE_ONBOARDING_FORCE_ALL = FEATURE_ONBOARDING_FORCE_PAGES.size > 0;

/** AsyncStorage keys for per-screen first-use feature tours. */
export const FEATURE_ONBOARDING_STORAGE_KEYS = {
  reader: "sb:featureOnboarding:reader:v1",
  readerSettings: "sb:featureOnboarding:readerSettings:v1",
  readerActionBar: "sb:featureOnboarding:readerActionBar:v1",
  readerBookPicker: "sb:featureOnboarding:readerBookPicker:v1",
  journal: "sb:featureOnboarding:journal:v1",
  journalEditor: "sb:featureOnboarding:journalEditor:v1",
  journalDetail: "sb:featureOnboarding:journalDetail:v1",
} as const;

export type FeatureOnboardingPage = keyof typeof FEATURE_ONBOARDING_STORAGE_KEYS;

export function isFeatureOnboardingForced(page: FeatureOnboardingPage): boolean {
  return FEATURE_ONBOARDING_FORCE_PAGES.has(page);
}

export function isFeatureOnboardingSkipped(page: FeatureOnboardingPage): boolean {
  return FEATURE_ONBOARDING_SKIP_PAGES.has(page);
}

export async function isFeatureOnboardingDone(page: FeatureOnboardingPage): Promise<boolean> {
  if (isFeatureOnboardingSkipped(page)) return true;
  if (isFeatureOnboardingForced(page)) return false;
  try {
    const v = await AsyncStorage.getItem(FEATURE_ONBOARDING_STORAGE_KEYS[page]);
    return v === "true";
  } catch {
    return false;
  }
}

/** Prerequisite checks (e.g. reader before action bar). */
export async function isFeatureOnboardingPrerequisiteDone(
  page: FeatureOnboardingPage,
): Promise<boolean> {
  if (isFeatureOnboardingSkipped(page)) return true;
  if (isFeatureOnboardingForced(page)) return true;
  return isFeatureOnboardingDone(page);
}

export async function markFeatureOnboardingDone(page: FeatureOnboardingPage): Promise<void> {
  if (isFeatureOnboardingForced(page) || isFeatureOnboardingSkipped(page)) return;
  try {
    await AsyncStorage.setItem(FEATURE_ONBOARDING_STORAGE_KEYS[page], "true");
  } catch {
    // ignore
  }
}
