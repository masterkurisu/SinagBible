import { getSearchResultsForTranslation, overlayQueryBypassesBookScope, type TranslationSearchOptions } from "@sinag-bible/core/bible-translations";
import { getTestament } from "@sinag-bible/core/bible-meta";
import { getVagueKeywordMaxPerBook } from "@sinag-bible/core/search-keyword-popular";
import { lookupNamedPassage } from "@sinag-bible/core/search-named-passages";
import { parseStrongsQuery } from "@sinag-bible/core/search-strongs-index";
import type { SearchResult, TranslationSearchOutcome } from "@sinag-bible/types";
import { fetchYvpBookNav, fetchYvpChapter } from "@/lib/youversion-api";
import { getChapterSync } from "@/lib/chapter-store";
import { yvpPassageToBibleChapter } from "@/lib/yvp-chapter-payload";
import type { YvpPassage } from "@/lib/youversion-api";
import {
  lookupYvpKeywordPostingsForQuery,
  yvpIndexHasCoverage,
  type YvpKeywordPosting,
} from "@/lib/yvp-keyword-index";

const YVP_HYDRATE_CONCURRENCY = 4;
const NATIVE_SEARCH_MAX_RESULTS = 20;

type ChapterKey = `${string}:${number}`;

function chapterKey(bookSlug: string, chapterNumber: number): ChapterKey {
  return `${bookSlug}:${chapterNumber}`;
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      if (current == null) continue;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

function isLikelyBookOpener(results: SearchResult[]): boolean {
  return (
    results.length > 0 &&
    results.length <= 2 &&
    results.every((row) => row.chapterNumber === 1 && row.verseNumber === 1)
  );
}

function shouldUseNativeYvpIndex(
  translationId: string,
  query: string,
  kjvOutcome: TranslationSearchOutcome,
): boolean {
  const q = query.trim();
  if (!q || /\d/.test(q)) return false;
  if (lookupNamedPassage(q)) return false;
  if (parseStrongsQuery(q)) return false;
  if (isLikelyBookOpener(kjvOutcome.results)) return false;
  return yvpIndexHasCoverage(translationId, q);
}

function neighborVerseFromList(verses: string[] | undefined, verseNumber: number): string | undefined {
  if (!verses || verseNumber < 1) return undefined;
  const next = verses[verseNumber]?.trim();
  if (next) return next;
  if (verseNumber > 1) {
    const prev = verses[verseNumber - 2]?.trim();
    if (prev) return prev;
  }
  return undefined;
}

function withNeighborVerse(row: SearchResult, verses: string[]): SearchResult {
  const neighborVerseText = neighborVerseFromList(verses, row.verseNumber);
  return neighborVerseText ? { ...row, neighborVerseText } : row;
}

function capNativePostings(
  query: string,
  postings: YvpKeywordPosting[],
  bookScopeSlug?: string,
): YvpKeywordPosting[] {
  const scoped = bookScopeSlug?.trim();
  const applyScope = Boolean(scoped) && !overlayQueryBypassesBookScope(query);
  const source = applyScope ? postings.filter((row) => row.bookSlug === scoped) : postings;
  const maxPerBook = applyScope ? NATIVE_SEARCH_MAX_RESULTS : getVagueKeywordMaxPerBook(query);
  const nt = source.filter((row) => getTestament(row.bookSlug) === "new");
  const ot = source.filter((row) => getTestament(row.bookSlug) !== "new");
  const interleaved: YvpKeywordPosting[] = [];
  const limit = Math.max(nt.length, ot.length);
  for (let i = 0; i < limit; i++) {
    if (nt[i]) interleaved.push(nt[i]!);
    if (ot[i]) interleaved.push(ot[i]!);
  }

  const out: YvpKeywordPosting[] = [];
  const perBook = new Map<string, number>();
  const seen = new Set<string>();
  for (const row of interleaved) {
    if (out.length >= NATIVE_SEARCH_MAX_RESULTS) break;
    const key = `${row.bookSlug}:${row.chapterNumber}:${row.verseNumber}`;
    if (seen.has(key)) continue;
    const used = perBook.get(row.bookSlug) ?? 0;
    if (used >= maxPerBook) continue;
    seen.add(key);
    perBook.set(row.bookSlug, used + 1);
    out.push(row);
  }
  return out;
}

async function searchYvpNativeIndex(
  bibleId: number,
  translationId: string,
  query: string,
  bookScopeSlug?: string,
): Promise<SearchResult[]> {
  const postings = capNativePostings(
    query,
    lookupYvpKeywordPostingsForQuery(translationId, query),
    bookScopeSlug,
  );
  if (postings.length === 0) return [];

  const nav = await fetchYvpBookNav(bibleId).catch(() => []);
  const navBySlug = new Map(nav.map((item) => [item.slug, item]));
  const results: SearchResult[] = [];

  for (const posting of postings) {
    let stored;
    try {
      stored = getChapterSync(translationId, posting.bookSlug, posting.chapterNumber);
    } catch {
      continue;
    }
    if (stored?.source !== "yvp") continue;
    try {
      const chapter = yvpPassageToBibleChapter(
        posting.bookSlug,
        posting.chapterNumber,
        stored.payload as YvpPassage,
      );
      const verseText = chapter.verses[posting.verseNumber - 1]?.trim();
      if (!verseText) continue;
      results.push(
        withNeighborVerse(
          {
            bookName: chapter.bookName || navBySlug.get(posting.bookSlug)?.name || posting.bookSlug,
            bookSlug: posting.bookSlug,
            chapterNumber: posting.chapterNumber,
            verseNumber: posting.verseNumber,
            verseText,
          },
          chapter.verses,
        ),
      );
    } catch {
      /* skip chapters that no longer parse */
    }
  }

  return results;
}

type HydrateOutcome = {
  results: SearchResult[];
  failedHydrationCount: number;
};

/**
 * Replace KJV verse text with the active YouVersion translation by fetching only the
 * chapters referenced in the search hits (not the full ~1 189-chapter corpus).
 */
async function hydrateSearchResultsForYvp(
  bibleId: number,
  results: SearchResult[],
  signal?: AbortSignal,
): Promise<HydrateOutcome> {
  if (results.length === 0) return { results: [], failedHydrationCount: 0 };

  const nav = await fetchYvpBookNav(bibleId);
  if (signal?.aborted) return { results: [], failedHydrationCount: 0 };
  const navBySlug = new Map(nav.map((item) => [item.slug, item]));

  const byChapter = new Map<ChapterKey, SearchResult[]>();
  for (const result of results) {
    const key = chapterKey(result.bookSlug, result.chapterNumber);
    const group = byChapter.get(key);
    if (group) group.push(result);
    else byChapter.set(key, [result]);
  }

  const hydratedByKey = new Map<string, SearchResult>();
  let failedHydrationCount = 0;

  await runPool([...byChapter.entries()], YVP_HYDRATE_CONCURRENCY, async ([key, items]) => {
    if (signal?.aborted) return;

    const [bookSlug, chapterStr] = key.split(":");
    const chapterNumber = Number(chapterStr);
    if (!bookSlug || !Number.isFinite(chapterNumber) || chapterNumber < 1) return;

    try {
      const chapter = await fetchYvpChapter(bibleId, bookSlug, chapterNumber);
      if (signal?.aborted) return;
      const bookName =
        chapter.bookName?.trim() ||
        navBySlug.get(bookSlug)?.name ||
        items[0]?.bookName ||
        bookSlug;

      for (const item of items) {
        const verseText = chapter.verses[item.verseNumber - 1]?.trim();
        if (!verseText) continue;
        hydratedByKey.set(`${item.bookSlug}:${item.chapterNumber}:${item.verseNumber}`, {
          ...withNeighborVerse(
            {
              bookName,
              bookSlug: item.bookSlug,
              chapterNumber: item.chapterNumber,
              verseNumber: item.verseNumber,
              verseText,
            },
            chapter.verses,
          ),
        });
      }
    } catch {
      if (signal?.aborted) return;
      failedHydrationCount += 1;
    }
  });

  if (signal?.aborted) return { results: [], failedHydrationCount: 0 };

  const hydrated: SearchResult[] = [];
  for (const item of results) {
    const row = hydratedByKey.get(`${item.bookSlug}:${item.chapterNumber}:${item.verseNumber}`);
    if (row) hydrated.push(row);
  }
  return { results: hydrated, failedHydrationCount };
}

/**
 * YouVersion (NIV, etc.) search without building the full chapter corpus.
 * Uses KJV to resolve references and keyword hits, then hydrates matching verses from YVP
 * unless the incremental native index already covers the query tokens.
 */
export async function getSearchResultsForYvpTranslation(
  bibleId: number,
  query: string,
  options?: TranslationSearchOptions,
): Promise<TranslationSearchOutcome> {
  const translationId = `yvp:${bibleId}`;
  const kjvOutcome = await getSearchResultsForTranslation("KJV", query, options);
  if (options?.signal?.aborted) {
    return { ...kjvOutcome, results: [], failedHydrationCount: 0 };
  }

  if (shouldUseNativeYvpIndex(translationId, query, kjvOutcome)) {
    const nativeResults = await searchYvpNativeIndex(
      bibleId,
      translationId,
      query,
      options?.bookScopeSlug,
    );
    if (options?.signal?.aborted) {
      return { ...kjvOutcome, results: [], failedHydrationCount: 0 };
    }
    if (nativeResults.length > 0) {
      return { ...kjvOutcome, results: nativeResults, failedHydrationCount: 0 };
    }
  }

  if (kjvOutcome.results.length === 0) {
    return { ...kjvOutcome, failedHydrationCount: 0 };
  }

  const hydrated = await hydrateSearchResultsForYvp(bibleId, kjvOutcome.results, options?.signal);
  return { ...kjvOutcome, results: hydrated.results, failedHydrationCount: hydrated.failedHydrationCount };
}
