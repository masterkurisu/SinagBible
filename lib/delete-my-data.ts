import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearBibleApiMemoryCaches } from "@/lib/bible-api-service";
import { clearLocalEntriesMemoryCache, deleteAllJournalImages } from "@/lib/journal-local";
import { ONBOARDING_DONE_STORAGE_KEY, publishOnboardingState } from "@/lib/onboarding-storage";
import { clearReaderLastPositionMemoryCache } from "@/lib/reader-last-position";

/**
 * Hard-delete local app data for account/data deletion compliance.
 * App Store Review Guideline 5.1.1 and Google Play data deletion policy require this in-app flow.
 */
export async function deleteAllUserData(): Promise<void> {
  await AsyncStorage.clear();
  await deleteAllJournalImages();
  clearLocalEntriesMemoryCache();
  clearReaderLastPositionMemoryCache();
  clearBibleApiMemoryCaches();
  await AsyncStorage.removeItem(ONBOARDING_DONE_STORAGE_KEY);
  publishOnboardingState(false);
}
