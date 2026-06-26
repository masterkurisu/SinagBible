import type { BibleBookNavItem, BibleChapter } from "@sinag-bible/types";

export type ReaderChapterPayload = {
  resolvedTranslationId: string;
  books: BibleBookNavItem[];
  chapter: BibleChapter;
};

const memCache = new Map<string, ReaderChapterPayload>();

export function readerChapterCacheKey(
  translationId: string,
  bookSlug: string,
  chapterNumber: number,
): string {
  return `${translationId}:${bookSlug}:${chapterNumber}`;
}

export function getCachedReaderChapter(key: string): ReaderChapterPayload | undefined {
  return memCache.get(key);
}

export function setCachedReaderChapter(key: string, payload: ReaderChapterPayload): void {
  memCache.set(key, payload);
}
