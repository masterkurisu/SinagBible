import AsyncStorage from "@react-native-async-storage/async-storage";

/** AsyncStorage keys for per-screen first-use feature tours. */
export const FEATURE_ONBOARDING_STORAGE_KEYS = {
  reader: "sb:featureOnboarding:reader:v1",
  readerSettings: "sb:featureOnboarding:readerSettings:v1",
} as const;

export type FeatureOnboardingPage = keyof typeof FEATURE_ONBOARDING_STORAGE_KEYS;

export async function isFeatureOnboardingDone(page: FeatureOnboardingPage): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(FEATURE_ONBOARDING_STORAGE_KEYS[page]);
    return v === "true";
  } catch {
    return false;
  }
}

export async function markFeatureOnboardingDone(page: FeatureOnboardingPage): Promise<void> {
  try {
    await AsyncStorage.setItem(FEATURE_ONBOARDING_STORAGE_KEYS[page], "true");
  } catch {
    // ignore
  }
}
