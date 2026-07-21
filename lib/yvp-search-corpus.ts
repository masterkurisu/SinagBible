import type { SearchTranslationContext } from "@sinag-bible/core/bible-translations";
import { buildBookNavForTranslationData } from "@sinag-bible/core/bible-translations";
import { evictVagueKeywordIndex } from "@sinag-bible/core/vague-keyword-index";
import { LruMap } from "@sinag-bible/core/lru-map";
import type { KJVData } from "@sinag-bible/types";
import {
  fetchYvpBookNav,
  fetchYvpChapter,
  formatYvpTranslationId,
} from "@/lib/youversion-api";

type TranslationData = KJVData;

const YVP_SEARCH_CONTEXT_CACHE_MAX = 2;
const yvpSearchContextCache = new LruMap<number, Promise<SearchTranslationContext>>(
  YVP_SEARCH_CONTEXT_CACHE_MAX,
);
const yvpSearchContextBuilds = new Map<number, Promise<SearchTranslationContext>>();
/** Keep low — YouVersion rate-limits bulk passage fetches (HTTP 429). */
const YVP_SEARCH_CORPUS_CONCURRENCY = 2;
const YVP_SEARCH_CORPUS_REQUEST_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function evictYvpSearchCaches(bibleId: number): void {
  evictVagueKeywordIndex(formatYvpTranslationId(bibleId));
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

async function buildYvpSearchTranslationContext(bibleId: number): Promise<SearchTranslationContext> {
  const nav = await fetchYvpBookNav(bibleId);
  const books: TranslationData["books"] = nav.map((item) => ({
    name: item.name,
    chapters: Array.from({ length: item.chapterCount }, () => [] as string[]),
  }));

  type ChapterTask = { bookIndex: number; chapterNumber: number; bookSlug: string };
  const tasks: ChapterTask[] = [];
  for (let bookIndex = 0; bookIndex < nav.length; bookIndex++) {
    const item = nav[bookIndex]!;
    for (let chapterNumber = 1; chapterNumber <= item.chapterCount; chapterNumber++) {
      tasks.push({ bookIndex, chapterNumber, bookSlug: item.slug });
    }
  }

  await runPool(tasks, YVP_SEARCH_CORPUS_CONCURRENCY, async ({ bookIndex, chapterNumber, bookSlug }) => {
    try {
      const chapter = await fetchYvpChapter(bibleId, bookSlug, chapterNumber);
      books[bookIndex]!.chapters[chapterNumber - 1] = chapter.verses;
      const localizedName = chapter.bookName?.trim();
      if (localizedName) {
        books[bookIndex]!.name = localizedName;
      }
    } catch {
      /* skip chapters that fail (rate limit, network) — search uses the rest */
    } finally {
      await sleep(YVP_SEARCH_CORPUS_REQUEST_DELAY_MS);
    }
  });

  const data: TranslationData = {
    translation: formatYvpTranslationId(bibleId),
    books,
  };
  const resolvedNav = await buildBookNavForTranslationData(data);
  return {
    searchKey: formatYvpTranslationId(bibleId),
    data,
    nav: resolvedNav,
  };
}

/** Loads all YVP chapters once per Bible id so keyword search uses the active translation text. */
export function getYvpSearchTranslationContext(bibleId: number): Promise<SearchTranslationContext> {
  const cached = yvpSearchContextCache.get(bibleId);
  if (cached) return cached;

  let inflight = yvpSearchContextBuilds.get(bibleId);
  if (!inflight) {
    inflight = buildYvpSearchTranslationContext(bibleId)
      .then((ctx) => {
        yvpSearchContextCache.set(bibleId, Promise.resolve(ctx), evictYvpSearchCaches);
        return ctx;
      })
      .finally(() => {
        yvpSearchContextBuilds.delete(bibleId);
      });
    yvpSearchContextBuilds.set(bibleId, inflight);
  }

  return inflight;
}

export function warmYvpSearchTranslationContext(bibleId: number): void {
  void getYvpSearchTranslationContext(bibleId).catch(() => {
    /* warm-up is best-effort */
  });
}

/** Dev/diagnostic — current YVP search corpus cache entry count. */
export function getYvpSearchContextCacheSize(): number {
  return yvpSearchContextCache.size;
}
