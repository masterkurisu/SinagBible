import { getSearchResultsForTranslation } from "@sinag-bible/core/bible-translations";
import type { SearchResult, TranslationSearchOutcome } from "@sinag-bible/types";
import { fetchYvpBookNav, fetchYvpChapter } from "@/lib/youversion-api";

const YVP_HYDRATE_CONCURRENCY = 4;

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

/**
 * Replace KJV verse text with the active YouVersion translation by fetching only the
 * chapters referenced in the search hits (not the full ~1 189-chapter corpus).
 */
async function hydrateSearchResultsForYvp(
  bibleId: number,
  results: SearchResult[],
): Promise<SearchResult[]> {
  if (results.length === 0) return [];

  const nav = await fetchYvpBookNav(bibleId);
  const navBySlug = new Map(nav.map((item) => [item.slug, item]));

  const byChapter = new Map<ChapterKey, SearchResult[]>();
  for (const result of results) {
    const key = chapterKey(result.bookSlug, result.chapterNumber);
    const group = byChapter.get(key);
    if (group) group.push(result);
    else byChapter.set(key, [result]);
  }

  const hydratedByKey = new Map<string, SearchResult>();

  await runPool([...byChapter.entries()], YVP_HYDRATE_CONCURRENCY, async ([key, items]) => {
    const [bookSlug, chapterStr] = key.split(":");
    const chapterNumber = Number(chapterStr);
    if (!bookSlug || !Number.isFinite(chapterNumber) || chapterNumber < 1) return;

    try {
      const chapter = await fetchYvpChapter(bibleId, bookSlug, chapterNumber);
      const bookName =
        chapter.bookName?.trim() ||
        navBySlug.get(bookSlug)?.name ||
        items[0]?.bookName ||
        bookSlug;

      for (const item of items) {
        const verseText = chapter.verses[item.verseNumber - 1]?.trim();
        if (!verseText) continue;
        hydratedByKey.set(
          `${item.bookSlug}:${item.chapterNumber}:${item.verseNumber}`,
          {
            bookName,
            bookSlug: item.bookSlug,
            chapterNumber: item.chapterNumber,
            verseNumber: item.verseNumber,
            verseText,
          },
        );
      }
    } catch {
      /* skip chapters that fail (rate limit, network) */
    }
  });

  const hydrated: SearchResult[] = [];
  for (const item of results) {
    const row = hydratedByKey.get(`${item.bookSlug}:${item.chapterNumber}:${item.verseNumber}`);
    if (row) hydrated.push(row);
  }
  return hydrated;
}

/**
 * YouVersion (NIV, etc.) search without building the full chapter corpus.
 * Uses KJV to resolve references and keyword hits, then hydrates matching verses from YVP.
 */
export async function getSearchResultsForYvpTranslation(
  bibleId: number,
  query: string,
): Promise<TranslationSearchOutcome> {
  const kjvOutcome = await getSearchResultsForTranslation("KJV", query);
  if (kjvOutcome.results.length === 0) {
    return kjvOutcome;
  }

  const results = await hydrateSearchResultsForYvp(bibleId, kjvOutcome.results);
  return { ...kjvOutcome, results };
}
