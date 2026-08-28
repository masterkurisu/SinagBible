import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearBibleApiMemoryCaches } from "@/lib/bible-api-service";
import { resetChapterDatabase } from "@/lib/chapter-db";
import { deleteJournalDatabase } from "@/lib/journal-db";
import { deleteAllJournalImages, prepareJournalStorageForWipe } from "@/lib/journal-local";
import { ONBOARDING_DONE_STORAGE_KEY, publishOnboardingState } from "@/lib/onboarding-storage";
import { resetPinnedTranslationsPrefetchSession } from "@/lib/pinned-translations-prefetch";
import { clearReaderLastPositionMemoryCache } from "@/lib/reader-last-position";
import { clearTranslationDownloadSession } from "@/lib/translation-download";
import { clearReaderChapterStorageCache } from "@/lib/use-reader-storage";

/**
 * Hard-delete local app data for account/data deletion compliance.
 * App Store Review Guideline 5.1.1 and Google Play data deletion policy require this in-app flow.
 */
export async function deleteAllUserData(): Promise<void> {
  try {
    clearBibleApiMemoryCaches();
    resetPinnedTranslationsPrefetchSession();
    clearTranslationDownloadSession();
    clearReaderLastPositionMemoryCache();
    clearReaderChapterStorageCache();

    await prepareJournalStorageForWipe();
    await deleteAllJournalImages();
    await deleteJournalDatabase();
    await AsyncStorage.clear();
    await resetChapterDatabase();

    await AsyncStorage.removeItem(ONBOARDING_DONE_STORAGE_KEY);
    publishOnboardingState(false);
  } catch (error) {
    if (__DEV__) {
      console.error("[delete-my-data] failed", error);
    }
    throw error;
  }
}
