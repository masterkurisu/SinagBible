/**
 * KJV Bible data module — pure business logic, no framework dependencies.
 * This module is safe to use on the server (or in Node scripts) but imports
 * the full 4.5 MB KJV JSON, so it must NOT be bundled into client code.
 *
 * Next.js apps: import via a server-only wrapper that adds `import "server-only"`.
 * Expo apps: call these functions from API routes or background tasks only.
 */
import type {
  BibleBookNavItem,
  BibleChapter,
  SearchResult,
  BookSuggestion,
} from "@sinag-bible/types";
import { kjvData } from "./kjv-data";
export { kjvData };

// Re-export BookSuggestion so consumers don't need @sinag-bible/types separately.
export type { BibleBookNavItem, BibleChapter, SearchResult, BookSuggestion };

const normalizeBookSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

export const bookNav: BibleBookNavItem[] = kjvData.books.map((book) => ({
  name: book.name,
  slug: normalizeBookSlug(book.name),
  chapterCount: book.chapters.length,
}));

export function getTranslation(): string {
  return kjvData.translation;
}

export function getBookNav(): BibleBookNavItem[] {
  return bookNav;
}

export function getChapterBySlug(
  bookSlug: string,
  chapterNumber: number,
): BibleChapter | null {
  const bookIndex = bookNav.findIndex((book) => book.slug === bookSlug);
  if (bookIndex === -1 || !Number.isInteger(chapterNumber) || chapterNumber < 1) {
    return null;
  }

  const book = kjvData.books[bookIndex];
  const verses = book.chapters[chapterNumber - 1];
  if (!verses) {
    return null;
  }

  return {
    bookName: book.name,
    bookSlug: bookNav[bookIndex].slug,
    chapterNumber,
    verses,
  };
}

/**
 * Get verse text for a passage (e.g. "John 3:16" or "Genesis 1:1-3").
 * Returns null if book/chapter/verse not found or passage has no verse part.
 */
export function getVersePreview(
  bookSlug: string,
  chapter: number,
  verseStart: number | null,
  verseEnd: number | null,
): string | null {
  if (verseStart == null || verseStart < 1) return null;
  const ch = getChapterBySlug(bookSlug, chapter);
  if (!ch || !ch.verses.length) return null;
  const end = verseEnd != null && verseEnd >= verseStart ? verseEnd : verseStart;
  const startIdx = verseStart - 1;
  const endIdx = Math.min(end, ch.verses.length) - 1;
  if (startIdx > endIdx) return null;
  const slice = ch.verses.slice(startIdx, endIdx + 1);
  return slice.join(" ").trim() || null;
}

/** Normalize search query: trim, lowercase, and fix space after colon in verse refs. */
export function normalizeSearchQuery(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s*:\s+/g, ":");
}
