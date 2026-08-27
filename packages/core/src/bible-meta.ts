import type { BibleBookNavItem, Testament } from "@sinag-bible/types";

const BIBLE_BOOK_NAMES = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
  "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations",
  "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
  "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts",
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
  "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
  "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
  "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
  "Jude", "Revelation",
];

function normalizeBookSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

const BIBLE_BOOK_SLUGS = BIBLE_BOOK_NAMES.map(normalizeBookSlug);

/**
 * KJV chapter count per book, same order as `BIBLE_BOOK_NAMES` (index 0 = Genesis).
 * Lets nav/slug resolution use the canonical KJV shape without loading the 4.5MB
 * KJV JSON — that file should only be parsed when its verse text is actually needed.
 */
const BIBLE_BOOK_CHAPTER_COUNTS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24,
  22, 25, 29, 36, 10, 13, 10, 42, 150, 31,
  12, 8, 66, 52, 5, 48, 12, 14, 3, 9,
  1, 4, 7, 3, 3, 3, 2, 14, 4, 28,
  16, 24, 21, 28, 16, 16, 13, 6, 6, 4,
  4, 5, 3, 6, 4, 3, 1, 13, 5, 5,
  3, 5, 1, 1, 1, 22,
] as const;

/** Canonical KJV book nav (name + slug + chapter count) with no JSON data load. */
export function getKjvCanonicalBookNav(): BibleBookNavItem[] {
  return BIBLE_BOOK_NAMES.map((name, i) => ({
    name,
    slug: BIBLE_BOOK_SLUGS[i]!,
    chapterCount: BIBLE_BOOK_CHAPTER_COUNTS[i],
  }));
}

/**
 * Standard USFM 3-letter book codes in KJV canon order (index 0 = Genesis).
 * Used to convert a reader book slug into the book ID expected by the
 * bible.helloao.org chapter endpoint: GET /api/{translationId}/{bookId}/{chapter}.json
 */
const BIBLE_BOOK_USFM_CODES = [
  /* OT */ "GEN", "EXO", "LEV", "NUM", "DEU",
  "JOS", "JDG", "RUT", "1SA", "2SA",
  "1KI", "2KI", "1CH", "2CH", "EZR",
  "NEH", "EST", "JOB", "PSA", "PRO",
  "ECC", "SNG", "ISA", "JER", "LAM",
  "EZK", "DAN", "HOS", "JOL", "AMO",
  "OBA", "JON", "MIC", "NAH", "HAB",
  "ZEP", "HAG", "ZEC", "MAL",
  /* NT */ "MAT", "MRK", "LUK", "JHN", "ACT",
  "ROM", "1CO", "2CO", "GAL", "EPH",
  "PHP", "COL", "1TH", "2TH", "1TI",
  "2TI", "TIT", "PHM", "HEB",
  "JAS", "1PE", "2PE", "1JN", "2JN", "3JN",
  "JUD", "REV",
] as const;

/** Returns the USFM book code for a given KJV-style slug, or null if unrecognised. */
export function getUsfmBookId(bookSlug: string): string | null {
  const i = BIBLE_BOOK_SLUGS.indexOf(bookSlug);
  if (i === -1) return null;
  return BIBLE_BOOK_USFM_CODES[i] ?? null;
}

/** Inverse of {@link getUsfmBookId}: USFM code (e.g. `JHN`) → reader slug (`john`). */
export function getBookSlugFromUsfm(usfm: string): string | null {
  const normalized = usfm.trim().toUpperCase();
  const i = (BIBLE_BOOK_USFM_CODES as readonly string[]).indexOf(normalized);
  if (i === -1) return null;
  return BIBLE_BOOK_SLUGS[i] ?? null;
}

/** Resolve display name for a normalized book slug (e.g. `isaiah` → `Isaiah`). */
export function getBookNameFromSlug(slug: string): string | null {
  const i = BIBLE_BOOK_SLUGS.indexOf(slug);
  if (i === -1) return null;
  return BIBLE_BOOK_NAMES[i];
}

/** Genesis–Malachi = old (index 0–38), Matthew–Revelation = new (39+). */
export function getTestament(bookSlug: string): Testament {
  const i = BIBLE_BOOK_SLUGS.indexOf(bookSlug);
  if (i === -1) return "old";
  return i < 39 ? "old" : "new";
}

/** Get reader path for a book slug and chapter number */
export function getReaderPath(bookSlug: string, chapter: number): string {
  return `/reader/${bookSlug}/${chapter}`;
}
