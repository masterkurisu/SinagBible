import {
  getBookNavForTranslation,
  getChapterBySlugForTranslation,
  getExternalApiId,
  isTranslationId,
  type TranslationId,
} from "@sinag-bible/core/bible-translations";
import { getUsfmBookId } from "@sinag-bible/core";
import type { BibleBookNavItem, BibleChapter } from "@sinag-bible/types";
import { apiChapterToBibleChapter, fetchChapter as fetchApiChapter, fetchTranslationBookNav } from "@/lib/bible-api-service";
import {
  getCachedReaderChapter,
  readerChapterCacheKey,
  setCachedReaderChapter,
} from "@/lib/reader-chapter-cache";
import { collectPrefetchChapterTargets } from "@/lib/reader-chapter-nav";
import {
  fetchYvpBookNav,
  fetchYvpChapter,
  isYvpTranslationId,
  parseYvpBibleId,
} from "@/lib/youversion-api";

/** Chapters prefetched when a translation is pinned or selected for offline reading. */
export const TRANSLATION_OFFLINE_PREFETCH_DEPTH = 2;

/** KJV uses bundled JSON; API-backed translations load one chapter at a time. */
export function readerUsesPerChapterFetch(translationId: string): boolean {
  if (translationId === "KJV") return false;
  return isTranslationId(translationId) || isYvpTranslationId(translationId);
}

/**
 * Prefetches the current chapter (plus neighbors) and book navigation so pinned or
 * selected translations load instantly from AsyncStorage on chapter changes.
 */
export function prefetchTranslationChaptersForReader(
  translationId: string,
  bookSlug: string,
  chapterNumber: number,
  books: BibleBookNavItem[] | null | undefined,
  depth = TRANSLATION_OFFLINE_PREFETCH_DEPTH,
): void {
  if (translationId === "KJV") return;

  primeReaderChapterFetch(translationId, { slug: bookSlug, chapter: chapterNumber }, books);

  if (books && books.length > 0) {
    for (const target of collectPrefetchChapterTargets(books, bookSlug, chapterNumber, depth)) {
      primeReaderChapterFetch(translationId, target, books);
    }
    return;
  }

  const yvpBibleId = parseYvpBibleId(translationId);
  if (yvpBibleId != null) {
    void fetchYvpBookNav(yvpBibleId).catch(() => {
      /* prefetch is best-effort */
    });
    return;
  }

  const apiId = isTranslationId(translationId)
    ? getExternalApiId(translationId as TranslationId)
    : translationId;
  void fetchTranslationBookNav(apiId).catch(() => {
    /* prefetch is best-effort */
  });
}

export function primeReaderChapterFetch(
  translationId: string,
  target: { slug: string; chapter: number } | null | undefined,
  books?: BibleBookNavItem[] | null,
): void {
  if (!target || translationId === "KJV") return;

  const cacheKey = readerChapterCacheKey(translationId, target.slug, target.chapter);
  if (!getCachedReaderChapter(cacheKey)) {
    void (async () => {
      try {
        const chapter = await fetchReaderChapterContent(translationId, target.slug, target.chapter);
        if (!chapter || getCachedReaderChapter(cacheKey)) return;
        const nav =
          books && books.length > 0
            ? books
            : await resolveReaderBooksForTranslation(translationId, null);
        setCachedReaderChapter(cacheKey, {
          resolvedTranslationId: translationId,
          books: nav,
          chapter,
        });
      } catch {
        /* prefetch is best-effort */
      }
    })();
  }

  const yvpBibleId = parseYvpBibleId(translationId);
  if (yvpBibleId != null) {
    void fetchYvpChapter(yvpBibleId, target.slug, target.chapter).catch(() => {
      /* prefetch is best-effort */
    });
    return;
  }
  const usfm = getUsfmBookId(target.slug);
  if (!usfm) return;
  const apiId = isTranslationId(translationId)
    ? getExternalApiId(translationId as TranslationId)
    : translationId;
  void fetchApiChapter(apiId, usfm, target.chapter).catch(() => {
    /* prefetch is best-effort */
  });
}

export async function fetchReaderChapterContent(
  translationId: string,
  bookSlug: string,
  chapterNumber: number,
): Promise<BibleChapter | null> {
  if (translationId === "KJV") {
    return getChapterBySlugForTranslation("KJV", bookSlug, chapterNumber);
  }

  const yvpBibleId = parseYvpBibleId(translationId);
  if (yvpBibleId != null) {
    try {
      return await fetchYvpChapter(yvpBibleId, bookSlug, chapterNumber);
    } catch {
      return null;
    }
  }

  const usfm = getUsfmBookId(bookSlug);
  if (!usfm) return null;

  const apiId = isTranslationId(translationId)
    ? getExternalApiId(translationId as TranslationId)
    : translationId;

  try {
    const apiResult = await fetchApiChapter(apiId, usfm, chapterNumber);
    return apiChapterToBibleChapter(bookSlug, apiResult);
  } catch {
    if (isTranslationId(translationId)) {
      return getChapterBySlugForTranslation(translationId, bookSlug, chapterNumber);
    }
    return null;
  }
}

export async function resolveReaderBooksForTranslation(
  translationId: string,
  cachedBooks: BibleBookNavItem[] | null,
): Promise<BibleBookNavItem[]> {
  if (cachedBooks && cachedBooks.length > 0) return cachedBooks;
  const yvpBibleId = parseYvpBibleId(translationId);
  if (yvpBibleId != null) {
    try {
      return await fetchYvpBookNav(yvpBibleId);
    } catch {
      return getBookNavForTranslation("KJV");
    }
  }
  if (isTranslationId(translationId)) {
    return getBookNavForTranslation(translationId);
  }
  try {
    return await fetchTranslationBookNav(translationId);
  } catch {
    return getBookNavForTranslation("KJV");
  }
}
