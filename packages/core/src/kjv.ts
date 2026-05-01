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

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

const MAX_FUZZY_BOOK_DISTANCE = 3;

/** If the query looks like a misspelled book name, return the closest match. */
export function getClosestBookSuggestion(query: string): BookSuggestion | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const firstWord = q.split(/\s+/)[0] ?? q;

  let best: BookSuggestion | null = null;

  for (const book of bookNav) {
    const nameLower = book.name.toLowerCase();
    const dFull = levenshtein(q, nameLower);
    const dFirst = levenshtein(firstWord, nameLower);
    const d = Math.min(dFull, dFirst);
    if (d > MAX_FUZZY_BOOK_DISTANCE) continue;
    if (best && d >= best.distance) continue;

    const correctedQuery =
      firstWord.length < q.length
        ? nameLower + q.slice(firstWord.length)
        : nameLower;
    best = { bookName: book.name, distance: d, correctedQuery };
  }

  return best;
}

const MAX_SEARCH_RESULTS = 80;

export function getSearchResults(query: string): SearchResult[] {
  const q = normalizeSearchQuery(query);
  if (!q) return [];

  const results: SearchResult[] = [];

  for (let bookIndex = 0; bookIndex < kjvData.books.length; bookIndex++) {
    const book = kjvData.books[bookIndex];
    const nav = bookNav[bookIndex];
    const bookNameLower = book.name.toLowerCase();

    for (let ch = 0; ch < book.chapters.length; ch++) {
      const chapterNumber = ch + 1;
      const verses = book.chapters[ch];
      if (!verses) continue;

      const bookChapterLabel = `${bookNameLower} ${chapterNumber}`;

      for (let v = 0; v < verses.length; v++) {
        if (results.length >= MAX_SEARCH_RESULTS) return results;

        const verseNumber = v + 1;
        const verseText = verses[v] ?? "";
        const verseTextLower = verseText.toLowerCase();

        const matchesReference =
          bookNameLower.includes(q) ||
          bookChapterLabel.startsWith(q) ||
          `${bookNameLower} ${chapterNumber}` === q ||
          `${bookNameLower} ${chapterNumber}:${verseNumber}` === q;

        const matchesText = verseTextLower.includes(q);

        if (matchesReference || matchesText) {
          results.push({
            bookName: book.name,
            bookSlug: nav.slug,
            chapterNumber,
            verseNumber,
            verseText,
          });
        }
      }
    }
  }

  return results;
}
