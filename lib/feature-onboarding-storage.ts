import AsyncStorage from "@react-native-async-storage/async-storage";
import { onboardingDebugForcedFeaturePages } from "@/lib/onboarding-debug";

/**
 * Temporary kill switch for in-app coachmarks and spotlights (reader, journal,
 * book picker, action bar, and the intro privacy spotlight).
 *
 * Flip to `false` when tours are ready to ship again. Dev force flags in
 * `lib/onboarding-debug.ts` still take precedence so a single tour can be
 * tested while this is true. Does not hide the first-launch intro slides.
 */
export const FEATURE_ONBOARDING_DISABLED = true;

/**
 * Dev-only: always re-run these tours and skip persisting completion.
 * Populated from `lib/onboarding-debug.ts` — edit flags there.
 */
export const FEATURE_ONBOARDING_FORCE_PAGES: ReadonlySet<FeatureOnboardingPage> =
  onboardingDebugForcedFeaturePages();

/**
 * Dev-only: treat these tours as completed (suppress onboarding).
 * Forced pages take precedence over skip.
 */
export const FEATURE_ONBOARDING_SKIP_PAGES: ReadonlySet<FeatureOnboardingPage> = __DEV__
  ? new Set<FeatureOnboardingPage>()
  : new Set();

/** @deprecated Use `FEATURE_ONBOARDING_FORCE_PAGES` — true when any page is forced. */
export const FEATURE_ONBOARDING_FORCE_ALL = FEATURE_ONBOARDING_FORCE_PAGES.size > 0;

/** @deprecated Use `FEATURE_ONBOARDING_FORCE_ALL` from onboarding-debug. */
export { FEATURE_ONBOARDING_DEBUG_FORCE_ALL } from "@/lib/onboarding-debug";

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

/** Saved step index when a multi-step tour was interrupted mid-way. */
const FEATURE_ONBOARDING_PROGRESS_KEYS: Partial<Record<FeatureOnboardingPage, string>> = {
  reader: "sb:featureOnboarding:readerProgress:v1",
};

/** Session cache — avoids re-showing a tour after completion if storage hiccups. */
const featureOnboardingDoneMemory = new Set<FeatureOnboardingPage>();

export function isFeatureOnboardingForced(page: FeatureOnboardingPage): boolean {
  return FEATURE_ONBOARDING_FORCE_PAGES.has(page);
}

export function isFeatureOnboardingSkipped(page: FeatureOnboardingPage): boolean {
  if (FEATURE_ONBOARDING_DISABLED) return true;
  return FEATURE_ONBOARDING_SKIP_PAGES.has(page);
}

export async function isFeatureOnboardingDone(page: FeatureOnboardingPage): Promise<boolean> {
  if (isFeatureOnboardingForced(page)) return false;
  if (featureOnboardingDoneMemory.has(page)) return true;
  if (isFeatureOnboardingSkipped(page)) return true;
  try {
    const v = await AsyncStorage.getItem(FEATURE_ONBOARDING_STORAGE_KEYS[page]);
    if (v === "true") {
      featureOnboardingDoneMemory.add(page);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function getFeatureOnboardingProgress(page: FeatureOnboardingPage): Promise<number> {
  const progressKey = FEATURE_ONBOARDING_PROGRESS_KEYS[page];
  if (!progressKey) return 0;
  try {
    const raw = await AsyncStorage.getItem(progressKey);
    if (raw == null) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  } catch {
    return 0;
  }
}

export async function setFeatureOnboardingProgress(
  page: FeatureOnboardingPage,
  stepIndex: number,
): Promise<void> {
  const progressKey = FEATURE_ONBOARDING_PROGRESS_KEYS[page];
  if (!progressKey || stepIndex < 0) return;
  if (isFeatureOnboardingForced(page) || isFeatureOnboardingSkipped(page)) return;
  try {
    await AsyncStorage.setItem(progressKey, String(stepIndex));
  } catch {
    // ignore
  }
}

export async function clearFeatureOnboardingProgress(page: FeatureOnboardingPage): Promise<void> {
  const progressKey = FEATURE_ONBOARDING_PROGRESS_KEYS[page];
  if (!progressKey) return;
  try {
    await AsyncStorage.removeItem(progressKey);
  } catch {
    // ignore
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
  featureOnboardingDoneMemory.add(page);
  try {
    await AsyncStorage.setItem(FEATURE_ONBOARDING_STORAGE_KEYS[page], "true");
    await clearFeatureOnboardingProgress(page);
  } catch {
    // ignore
  }
}

/** Clear in-memory completion cache (e.g. on dev force-reset). */
export function resetFeatureOnboardingMemory(): void {
  featureOnboardingDoneMemory.clear();
}

/** Remove all saved feature-tour completion + progress from AsyncStorage. */
export async function resetAllFeatureOnboardingStorage(): Promise<void> {
  resetFeatureOnboardingMemory();
  const keys = [
    ...Object.values(FEATURE_ONBOARDING_STORAGE_KEYS),
    ...Object.values(FEATURE_ONBOARDING_PROGRESS_KEYS),
  ];
  try {
    await AsyncStorage.multiRemove(keys);
  } catch {
    // ignore
  }
}
