import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Dev-only: re-show every feature onboarding tour and skip persisting completion.
 * Set back to `false` before release.
 */
export const FEATURE_ONBOARDING_FORCE_ALL = __DEV__ && true;

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

export async function isFeatureOnboardingDone(page: FeatureOnboardingPage): Promise<boolean> {
  if (FEATURE_ONBOARDING_FORCE_ALL) return false;
  try {
    const v = await AsyncStorage.getItem(FEATURE_ONBOARDING_STORAGE_KEYS[page]);
    return v === "true";
  } catch {
    return false;
  }
}

/** Prerequisite checks (e.g. reader before action bar) — bypass storage when force-all is on. */
export async function isFeatureOnboardingPrerequisiteDone(
  page: FeatureOnboardingPage,
): Promise<boolean> {
  if (FEATURE_ONBOARDING_FORCE_ALL) return true;
  return isFeatureOnboardingDone(page);
}

export async function markFeatureOnboardingDone(page: FeatureOnboardingPage): Promise<void> {
  if (FEATURE_ONBOARDING_FORCE_ALL) return;
  try {
    await AsyncStorage.setItem(FEATURE_ONBOARDING_STORAGE_KEYS[page], "true");
  } catch {
    // ignore
  }
}
