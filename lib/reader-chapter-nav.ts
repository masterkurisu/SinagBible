import type { BibleBookNavItem, BibleChapter } from "@sinag-bible/types";

export type ChapterNavTarget = { slug: string; chapter: number };

export function getReaderChapterNeighbors(
  books: BibleBookNavItem[],
  chapter: Pick<BibleChapter, "bookSlug" | "chapterNumber">,
  chapterNumber: number,
): { prevChapter: ChapterNavTarget | null; nextChapter: ChapterNavTarget | null } {
  const bookIndex = books.findIndex((b) => b.slug === chapter.bookSlug);
  const currentBook = books[bookIndex];
  const prevChapter: ChapterNavTarget | null =
    chapterNumber > 1
      ? { slug: chapter.bookSlug, chapter: chapterNumber - 1 }
      : bookIndex > 0
        ? { slug: books[bookIndex - 1]!.slug, chapter: books[bookIndex - 1]!.chapterCount }
        : null;
  const nextChapter: ChapterNavTarget | null =
    currentBook && chapterNumber < currentBook.chapterCount
      ? { slug: chapter.bookSlug, chapter: chapterNumber + 1 }
      : bookIndex < books.length - 1
        ? { slug: books[bookIndex + 1]!.slug, chapter: 1 }
        : null;
  return { prevChapter, nextChapter };
}

function chapterTargetKey(target: ChapterNavTarget): string {
  return `${target.slug}:${target.chapter}`;
}

/** Collects up to `depth` chapters in each direction for prefetching. */
export function collectPrefetchChapterTargets(
  books: BibleBookNavItem[],
  bookSlug: string,
  chapterNumber: number,
  depth: number,
): ChapterNavTarget[] {
  if (depth < 1 || books.length === 0) return [];

  const seen = new Set<string>([`${bookSlug}:${chapterNumber}`]);
  const targets: ChapterNavTarget[] = [];

  let slug = bookSlug;
  let chapter = chapterNumber;
  for (let i = 0; i < depth; i++) {
    const { nextChapter } = getReaderChapterNeighbors(
      books,
      { bookSlug: slug, chapterNumber: chapter },
      chapter,
    );
    if (!nextChapter || seen.has(chapterTargetKey(nextChapter))) break;
    seen.add(chapterTargetKey(nextChapter));
    targets.push(nextChapter);
    slug = nextChapter.slug;
    chapter = nextChapter.chapter;
  }

  slug = bookSlug;
  chapter = chapterNumber;
  for (let i = 0; i < depth; i++) {
    const { prevChapter } = getReaderChapterNeighbors(
      books,
      { bookSlug: slug, chapterNumber: chapter },
      chapter,
    );
    if (!prevChapter || seen.has(chapterTargetKey(prevChapter))) break;
    seen.add(chapterTargetKey(prevChapter));
    targets.push(prevChapter);
    slug = prevChapter.slug;
    chapter = prevChapter.chapter;
  }

  return targets;
}
