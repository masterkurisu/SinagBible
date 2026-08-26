import {
  getSearchResultsForTranslation,
  isTranslationId,
  resolveSearchTranslationContext,
  searchLoadedTranslation,
  warmTranslationSearchCache,
  type TranslationId,
  type TranslationSearchOptions,
} from "@sinag-bible/core/bible-translations";
import type { SearchResult, TranslationSearchOutcome } from "@sinag-bible/types";
import { parseYvpBibleId, isYvpTranslationId } from "@/lib/youversion-api";
import { getSearchResultsForYvpTranslation } from "@/lib/yvp-translation-search";
import {
  expandSearchQuerySynonyms,
  shouldExpandEnglishSearchSynonyms,
} from "@/lib/search-query-synonyms";
import { listStoredYvpChaptersForBooks } from "@/lib/chapter-store";
import { indexYvpStoredChapter } from "@/lib/yvp-keyword-index";
import { scheduleYvpSearchCorpusJob } from "@/lib/yvp-search-corpus";

const FALLBACK_TRANSLATION: TranslationId = "KJV";
const MERGED_SEARCH_MAX_RESULTS = 20;
/** Index already-cached chapters only. Do not prefetch these books for search. */
const YVP_SEARCH_WARM_BOOK_SLUGS = ["psalms", "john", "romans"] as const;

function emptyOutcome(query: string): TranslationSearchOutcome {
  return {
    results: [],
    bookSuggestion: null,
    nearbyBooks: [],
    effectiveQuery: query.trim(),
    failedHydrationCount: 0,
  };
}

function resultKey(row: SearchResult): string {
  return `${row.bookSlug}:${row.chapterNumber}:${row.verseNumber}`;
}

function mergeTranslationSearchOutcomes(
  outcomes: TranslationSearchOutcome[],
  originalQuery: string,
): TranslationSearchOutcome {
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  for (const outcome of outcomes) {
    for (const row of outcome.results) {
      const key = resultKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(row);
      if (results.length >= MERGED_SEARCH_MAX_RESULTS) break;
    }
    if (results.length >= MERGED_SEARCH_MAX_RESULTS) break;
  }

  const original = outcomes[outcomes.length - 1];
  const failedHydrationCount = outcomes.reduce(
    (sum, outcome) => sum + (outcome.failedHydrationCount ?? 0),
    0,
  );

  return {
    results,
    bookSuggestion: original?.bookSuggestion ?? null,
    nearbyBooks: original?.nearbyBooks ?? [],
    effectiveQuery: original?.effectiveQuery ?? originalQuery.trim(),
    ...(failedHydrationCount > 0 ? { failedHydrationCount } : {}),
  };
}

async function searchReaderTranslationOnce(
  translationId: string,
  query: string,
  options?: TranslationSearchOptions,
): Promise<TranslationSearchOutcome> {
  const trimmed = translationId.trim();
  if (!trimmed) {
    return getSearchResultsForTranslation(FALLBACK_TRANSLATION, query, options);
  }

  if (isYvpTranslationId(trimmed)) {
    const bibleId = parseYvpBibleId(trimmed);
    if (bibleId == null) {
      return getSearchResultsForTranslation(FALLBACK_TRANSLATION, query, options);
    }
    return getSearchResultsForYvpTranslation(bibleId, query, options);
  }

  if (isTranslationId(trimmed.toUpperCase())) {
    return getSearchResultsForTranslation(trimmed.toUpperCase() as TranslationId, query, options);
  }

  const ctx = await resolveSearchTranslationContext(trimmed);
  return searchLoadedTranslation(ctx, query, options);
}

/**
 * Bible search for whichever translation the reader is using — bundled, helloao API,
 * or YouVersion (NIV, etc.).
 */
export async function getSearchResultsForReaderTranslation(
  translationId: string,
  query: string,
  options?: TranslationSearchOptions,
): Promise<TranslationSearchOutcome> {
  if (options?.signal?.aborted) return emptyOutcome(query);

  const expansion =
    shouldExpandEnglishSearchSynonyms(translationId)
      ? expandSearchQuerySynonyms(query)
      : { canonical: null, searchQueries: query.trim() ? [query.trim()] : [] };

  if (expansion.searchQueries.length <= 1) {
    return searchReaderTranslationOnce(translationId, query, options);
  }

  const outcomes: TranslationSearchOutcome[] = [];
  for (const searchQuery of expansion.searchQueries) {
    if (options?.signal?.aborted) return emptyOutcome(query);
    outcomes.push(await searchReaderTranslationOnce(translationId, searchQuery, options));
  }
  return mergeTranslationSearchOutcomes(outcomes, query);
}

function warmYvpKeywordIndexFromStore(translationId: string): void {
  try {
    const chapters = listStoredYvpChaptersForBooks(translationId, YVP_SEARCH_WARM_BOOK_SLUGS);
    for (const chapter of chapters) {
      indexYvpStoredChapter(chapter);
    }
  } catch {
    /* chapter store may not be open yet */
  }
}

/** Preload search data/index for the active reader translation. */
export function warmReaderTranslationSearchCache(translationId: string): void {
  const trimmed = translationId.trim();
  if (!trimmed) {
    warmTranslationSearchCache(FALLBACK_TRANSLATION);
    return;
  }

  if (isYvpTranslationId(trimmed)) {
    // KJV index for hydrate fallback; native postings from already-cached chapters only.
    warmTranslationSearchCache(FALLBACK_TRANSLATION);
    warmYvpKeywordIndexFromStore(trimmed);
    scheduleYvpSearchCorpusJob(trimmed);
    return;
  }

  warmTranslationSearchCache(trimmed);
}
