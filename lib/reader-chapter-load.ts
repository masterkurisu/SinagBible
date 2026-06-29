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

/** KJV uses bundled JSON; every other known translation loads one chapter at a time via the API. */
export function readerUsesPerChapterFetch(translationId: string): boolean {
  return translationId !== "KJV" && isTranslationId(translationId);
}

export function primeReaderChapterFetch(
  translationId: string,
  target: { slug: string; chapter: number } | null | undefined,
): void {
  if (!target || translationId === "KJV") return;
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
  if (isTranslationId(translationId)) {
    return getBookNavForTranslation(translationId);
  }
  try {
    return await fetchTranslationBookNav(translationId);
  } catch {
    return getBookNavForTranslation("KJV");
  }
}
