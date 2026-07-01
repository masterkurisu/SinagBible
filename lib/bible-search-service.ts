import {
  getSearchResultsForTranslation,
  isTranslationId,
  resolveSearchTranslationContext,
  searchLoadedTranslation,
  warmTranslationSearchCache,
  type TranslationId,
} from "@sinag-bible/core/bible-translations";
import type { TranslationSearchOutcome } from "@sinag-bible/types";
import { parseYvpBibleId, isYvpTranslationId } from "@/lib/youversion-api";
import {
  getYvpSearchTranslationContext,
  warmYvpSearchTranslationContext,
} from "@/lib/yvp-search-corpus";

const FALLBACK_TRANSLATION: TranslationId = "KJV";

/**
 * Bible search for whichever translation the reader is using — bundled, helloao API,
 * or YouVersion (NIV, etc.).
 */
export async function getSearchResultsForReaderTranslation(
  translationId: string,
  query: string,
): Promise<TranslationSearchOutcome> {
  const trimmed = translationId.trim();
  if (!trimmed) {
    return getSearchResultsForTranslation(FALLBACK_TRANSLATION, query);
  }

  if (isYvpTranslationId(trimmed)) {
    const bibleId = parseYvpBibleId(trimmed);
    if (bibleId == null) {
      return getSearchResultsForTranslation(FALLBACK_TRANSLATION, query);
    }
    const ctx = await getYvpSearchTranslationContext(bibleId);
    return searchLoadedTranslation(ctx, query);
  }

  if (isTranslationId(trimmed.toUpperCase())) {
    return getSearchResultsForTranslation(trimmed.toUpperCase() as TranslationId, query);
  }

  const ctx = await resolveSearchTranslationContext(trimmed);
  return searchLoadedTranslation(ctx, query);
}

/** Preload search data/index for the active reader translation. */
export function warmReaderTranslationSearchCache(translationId: string): void {
  const trimmed = translationId.trim();
  if (!trimmed) {
    warmTranslationSearchCache(FALLBACK_TRANSLATION);
    return;
  }

  if (isYvpTranslationId(trimmed)) {
    const bibleId = parseYvpBibleId(trimmed);
    if (bibleId != null) {
      warmYvpSearchTranslationContext(bibleId);
    }
    return;
  }

  warmTranslationSearchCache(trimmed);
}
