export function verseTagChapterCacheKey(
  translation: string,
  bookSlug: string,
  chapter: number,
): string {
  return `${translation}:${bookSlug}:${chapter}`;
}

export type VerseTagChapterCache = {
  get: (translation: string, bookSlug: string, chapter: number) => number | null | undefined;
  set: (translation: string, bookSlug: string, chapter: number, verseCount: number | null) => void;
  has: (translation: string, bookSlug: string, chapter: number) => boolean;
};

/** Sync verse-count cache so composer validation does not wait on a cold chapter fetch. */
export function createVerseTagChapterCache(): VerseTagChapterCache {
  const counts = new Map<string, number | null>();
  return {
    get(translation, bookSlug, chapter) {
      const key = verseTagChapterCacheKey(translation, bookSlug, chapter);
      return counts.has(key) ? counts.get(key)! : undefined;
    },
    set(translation, bookSlug, chapter, verseCount) {
      counts.set(verseTagChapterCacheKey(translation, bookSlug, chapter), verseCount);
    },
    has(translation, bookSlug, chapter) {
      return counts.has(verseTagChapterCacheKey(translation, bookSlug, chapter));
    },
  };
}

export type VerseTagPrefetchTarget = {
  slug: string;
  translation: string;
  chapter: number;
};

/**
 * Prefetch on book-confirm, not after a completed insert.
 * Chapter 1 if none is typed yet; otherwise the typed chapter.
 */
export function resolveVerseTagPrefetchTarget(
  confirmedBook: { slug: string; translation: string } | null,
  chapter: number | null,
  commit: unknown,
): VerseTagPrefetchTarget | null {
  if (!confirmedBook || commit != null) return null;
  const chapterNumber = chapter != null && chapter >= 1 ? chapter : 1;
  return {
    slug: confirmedBook.slug,
    translation: confirmedBook.translation,
    chapter: chapterNumber,
  };
}
