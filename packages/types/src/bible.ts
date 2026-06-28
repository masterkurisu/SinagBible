/** A single book in the KJV data structure */
export type KJVBook = {
  name: string;
  /** Array of chapters; each chapter is an array of verse strings */
  chapters: string[][];
  /**
   * When present, aligned with `chapters[chapterIndex][verseIndex]` for helloao-shaped
   * API-backed translations. Omitted for local JSON translations (e.g. KJV file).
   */
  verseInlineByChapter?: BibleVerseInlineItem[][][];
};

/** Root shape of the KJV JSON file */
export type KJVData = {
  translation: string;
  books: KJVBook[];
};

/** Minimal nav item for book selection UI */
export type BibleBookNavItem = {
  name: string;
  slug: string;
  chapterCount: number;
};

/** Fragment inside a single verse (bible.helloao.org chapter / complete.json content arrays). */
export type BibleVerseFormattedText = {
  text: string;
  poem?: number;
  wordsOfJesus?: boolean;
};

export type BibleVerseInlineHeading = { heading: string };
export type BibleVerseInlineLineBreak = { lineBreak: true };
export type BibleVerseFootnoteRef = { noteId: number };

export type BibleVerseInlineItem =
  | string
  | BibleVerseFormattedText
  | BibleVerseInlineHeading
  | BibleVerseInlineLineBreak
  | BibleVerseFootnoteRef;

/** A resolved chapter with its verses */
export type BibleChapter = {
  bookName: string;
  bookSlug: string;
  chapterNumber: number;
  verses: string[];
  /**
   * Structured fragments per verse when available; indices align with `verses` (verse 1 → index 0).
   */
  verseInlineContent?: BibleVerseInlineItem[][];
};

/** Result shape for full-text verse search */
export type SearchResult = {
  bookName: string;
  bookSlug: string;
  chapterNumber: number;
  verseNumber: number;
  verseText: string;
};

/** Testament of a Bible book */
export type Testament = "old" | "new";

/** Parsed passage reference */
export type PassageReference = {
  book: string;
  chapter: number;
  verseStart: number | null;
  verseEnd: number | null;
};

/** Fuzzy book name match suggestion */
export type BookSuggestion = {
  bookName: string;
  /** Canonical slug when available (for genre hints in UI). */
  bookSlug?: string;
  distance: number;
  /** Query to use for search (e.g. "john 3:16" when user typed "jhon 3:16") */
  correctedQuery: string;
};

/** Bible / journal search payload with optional spelling recommendations. */
export type TranslationSearchOutcome = {
  results: SearchResult[];
  /** Closest book-name match when the query looks misspelled. */
  bookSuggestion: BookSuggestion | null;
  /** Additional book-name near-matches when there are no results. */
  nearbyBooks: BookSuggestion[];
  /** Normalized query used to produce `results` (after any book-name correction). */
  effectiveQuery: string;
};
