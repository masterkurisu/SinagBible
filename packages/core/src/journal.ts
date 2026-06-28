import type { PassageReference } from "@sinag-bible/types";

export { BIBLE_BOOK_MISSPELLINGS, getPassageMisspellingSuggestion } from "./book-aliases";

/**
 * Parse a passage string like "John 3:16", "Romans 8", or "Genesis 1:1-3" into
 * a PassageReference. Returns null if empty or unparseable.
 */
export function parsePassageReference(passage: string): PassageReference | null {
  const raw = passage.trim();
  if (!raw) return null;

  const tokens = raw.split(/\s+/);
  if (tokens.length < 2) return null;

  const last = tokens[tokens.length - 1];
  const chapterVerseMatch = last.match(/^(\d+)(?::(\d+)(?:-(\d+))?)?$/);
  if (!chapterVerseMatch) return null;

  const chapter = parseInt(chapterVerseMatch[1], 10);
  const verseStart = chapterVerseMatch[2] ? parseInt(chapterVerseMatch[2], 10) : null;
  const verseEnd = chapterVerseMatch[3] ? parseInt(chapterVerseMatch[3], 10) : null;
  const bookPart = tokens.slice(0, -1).join(" ");
  const book = bookPart
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  if (!book || !Number.isInteger(chapter) || chapter < 1) return null;
  if (verseStart != null && (verseStart < 1 || (verseEnd != null && verseEnd < verseStart)))
    return null;

  return { book, chapter, verseStart, verseEnd };
}

export function parsePositiveInteger(value: string | null | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function formatBookLabel(book: string): string {
  if (!book) return "Unknown";
  return book
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatPassageReference({
  book,
  chapter,
  verseStart,
  verseEnd,
  bookDisplayLabel,
}: PassageReference & { bookDisplayLabel?: string | null }): string {
  if (!book?.trim() || !Number.isFinite(chapter) || chapter < 1) return "";
  const label =
    bookDisplayLabel?.trim() ? bookDisplayLabel.trim() : formatBookLabel(book);
  const base = `${label} ${chapter}`;
  if (!verseStart) return base;
  if (verseEnd && verseEnd > verseStart) return `${base}:${verseStart}-${verseEnd}`;
  return `${base}:${verseStart}`;
}

/** Format a reader selection like "Matthew 7:3-5" from sorted verse numbers. */
export function formatSelectedReference(
  bookName: string,
  chapter: number,
  verses: number[],
): string {
  if (!verses.length) return "";
  const sorted = [...verses].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const isContiguous = sorted.every((v, idx) => idx === 0 || v === sorted[idx - 1] + 1);

  if (sorted.length === 1) {
    return `${bookName} ${chapter}:${first}`;
  }

  if (isContiguous) {
    return `${bookName} ${chapter}:${first}-${last}`;
  }

  const ranges: string[] = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }

    if (rangeStart === prev) {
      ranges.push(String(rangeStart));
    } else {
      ranges.push(`${rangeStart}-${prev}`);
    }

    rangeStart = current;
    prev = current;
  }

  if (rangeStart === prev) {
    ranges.push(String(rangeStart));
  } else {
    ranges.push(`${rangeStart}-${prev}`);
  }

  return `${bookName} ${chapter}:${ranges.join(",")}`;
}
