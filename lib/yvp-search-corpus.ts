import type { SearchTranslationContext } from "@sinag-bible/core/bible-translations";
import { buildBookNavForTranslationData } from "@sinag-bible/core/bible-translations";
import type { KJVData } from "@sinag-bible/types";
import {
  fetchYvpBookNav,
  fetchYvpChapter,
  formatYvpTranslationId,
} from "@/lib/youversion-api";

type TranslationData = KJVData;

const yvpSearchContextCache = new Map<number, Promise<SearchTranslationContext>>();
const yvpSearchContextBuilds = new Map<number, Promise<SearchTranslationContext>>();

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

  await runPool(tasks, 10, async ({ bookIndex, chapterNumber, bookSlug }) => {
    const chapter = await fetchYvpChapter(bibleId, bookSlug, chapterNumber);
    books[bookIndex]!.chapters[chapterNumber - 1] = chapter.verses;
    const localizedName = chapter.bookName?.trim();
    if (localizedName) {
      books[bookIndex]!.name = localizedName;
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
        yvpSearchContextCache.set(bibleId, Promise.resolve(ctx));
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
