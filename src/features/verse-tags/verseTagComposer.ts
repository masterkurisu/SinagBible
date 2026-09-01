import { getKjvCanonicalBookNav } from "@sinag-bible/core/bible-meta";
import { getPassageMisspellingSuggestion, parsePassageReference } from "@sinag-bible/core/journal";
import { expandReferenceQuery } from "@sinag-bible/core/reference-aliases";
import {
  getActiveVerseTagMention,
  insertVerseTagAtMention,
} from "@sinag-bible/core/verse-tags";
import type { VerseTagRef } from "@sinag-bible/types";

export type VerseTagComposerPhase = "idle" | "mentioning" | "bookConfirmed" | "invalid";

export type VerseTagComposerError = "invalid-chapter" | "invalid-verse" | "invalid-range";

export type VerseTagComposerBook = {
  name: string;
  slug: string;
  chapterCount: number;
};

export type VerseTagComposerBookMatch =
  | { kind: "unique"; book: VerseTagComposerBook }
  | { kind: "ambiguous"; books: VerseTagComposerBook[] }
  | { kind: "none" };

export type VerseTagComposerConfirmedBook = {
  slug: string;
  translation: string;
};

export type VerseTagComposerState = {
  phase: VerseTagComposerPhase;
  buffer: string;
  atIndex: number | null;
  confirmedBook: VerseTagComposerConfirmedBook | null;
  chapter: number | null;
  error: VerseTagComposerError | null;
};

export type VerseTagComposerCommit = {
  text: string;
  cursorIndex: number;
  ref: VerseTagRef;
};

export type VerseTagComposerEvent =
  | { type: "change"; text: string; cursorIndex: number }
  | { type: "blur"; text: string; cursorIndex: number }
  | { type: "escape"; text: string; cursorIndex: number }
  | { type: "commit"; text: string; cursorIndex: number };

export type VerseTagComposerResult = {
  state: VerseTagComposerState;
  commit: VerseTagComposerCommit | null;
  /** Set only when transitioning into book-confirmed (Phase 3 prefetch signal). */
  bookConfirmed: VerseTagComposerConfirmedBook | null;
};

export type VerseTagComposerOptions = {
  translation?: string;
  books?: VerseTagComposerBook[];
  /**
   * Verse count for a book+chapter in the active translation.
   * `null` = chapter missing; `undefined` = not loaded yet (chapter count still checked).
   */
  getVerseCount?: (bookSlug: string, chapter: number) => number | null | undefined;
  matchBook?: (bookQuery: string) => VerseTagComposerBookMatch;
};

const IDLE_STATE: VerseTagComposerState = {
  phase: "idle",
  buffer: "",
  atIndex: null,
  confirmedBook: null,
  chapter: null,
  error: null,
};

const TRAILING_DELIMITER_RE = /([ \t]+|[.,;!?)\]])$/;
const CROSS_CHAPTER_RE = /\d+:\d+\s*-\s*\d+:\d+/;
const COMMA_LIST_RE = /\d+:\d+(?:-\d+)?,\d+/;

function isCommitDelimiter(delimiter: string): boolean {
  if (!delimiter) return false;
  if (/^[ \t]+$/.test(delimiter)) return true;
  return /^[.;!?)\]]+$/.test(delimiter);
}

function idleResult(): VerseTagComposerResult {
  return { state: IDLE_STATE, commit: null, bookConfirmed: null };
}

function normalizeBookSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function insertBookChapterSpace(s: string): string {
  return s.replace(/(\d)([A-Za-z])/g, "$1 $2").replace(/([A-Za-z])(\d)/g, "$1 $2");
}

function canConfirmUniqueBook(bookQuery: string, book: VerseTagComposerBook): boolean {
  const expanded = expandReferenceQuery(bookQuery.trim());
  if (!expanded) return false;

  const name = book.name.toLowerCase();
  const slug = book.slug.toLowerCase();
  const expandedSlug = normalizeBookSlug(expanded);

  if (name === expanded || slug === expandedSlug) {
    return true;
  }

  // Multi-word titles: a unique prefix still waiting on later words is not "book done".
  if (name.startsWith(`${expanded} `)) {
    return false;
  }

  return name.startsWith(expanded) || slug.startsWith(expandedSlug);
}

/** Protestant 66 + aliases + misspellings. Ambiguous prefixes never auto-pick. */
export function matchVerseTagComposerBook(
  bookQuery: string,
  books: VerseTagComposerBook[],
): VerseTagComposerBookMatch {
  const trimmed = bookQuery.trim().toLowerCase();
  if (!trimmed) return { kind: "none" };

  const expanded = expandReferenceQuery(trimmed);
  const expandedSlug = normalizeBookSlug(expanded);
  const compact = trimmed.replace(/\s+/g, "");
  const misspelledName =
    getPassageMisspellingSuggestion(trimmed) ??
    getPassageMisspellingSuggestion(compact) ??
    getPassageMisspellingSuggestion(expanded.split(/\s+/)[0] ?? "");
  const misspelledSlug = misspelledName ? normalizeBookSlug(misspelledName) : null;

  const exact: VerseTagComposerBook[] = [];
  const prefix: VerseTagComposerBook[] = [];

  for (const book of books) {
    const name = book.name.toLowerCase();
    const slug = book.slug.toLowerCase();
    const isExact =
      name === expanded ||
      slug === expandedSlug ||
      (misspelledName != null &&
        (name === misspelledName.toLowerCase() || slug === misspelledSlug));
    if (isExact) {
      exact.push(book);
      continue;
    }
    if (expanded.length >= 2 && (name.startsWith(expanded) || slug.startsWith(expandedSlug))) {
      prefix.push(book);
    }
  }

  if (exact.length === 1) return { kind: "unique", book: exact[0]! };
  if (exact.length > 1) return { kind: "ambiguous", books: exact };

  if (prefix.length === 1) return { kind: "unique", book: prefix[0]! };
  if (prefix.length > 1) return { kind: "ambiguous", books: prefix };

  if (expanded.length >= 2 && !/^\d/.test(expanded)) {
    const byToken = books.filter((book) =>
      book.name
        .toLowerCase()
        .split(/\s+/)
        .some((token) => !/^\d+$/.test(token) && token.startsWith(expanded)),
    );
    if (byToken.length === 1) return { kind: "unique", book: byToken[0]! };
    if (byToken.length > 1) return { kind: "ambiguous", books: byToken };
  }

  return { kind: "none" };
}

type ParsedBuffer = {
  bookQuery: string;
  bookMatch: VerseTagComposerBookMatch;
  chapter: number | null;
  verseStart: number | null;
  verseEnd: number | null;
  trailingDelimiter: string;
  crossChapter: boolean;
  commaList: boolean;
  bookReady: boolean;
};

function parseComposerBuffer(
  buffer: string,
  matchBook: (bookQuery: string) => VerseTagComposerBookMatch,
): ParsedBuffer {
  const trailingMatch = buffer.match(TRAILING_DELIMITER_RE);
  const trailingDelimiter = trailingMatch?.[1] ?? "";
  const core = trailingDelimiter ? buffer.slice(0, -trailingDelimiter.length) : buffer;
  const expanded = insertBookChapterSpace(expandReferenceQuery(core.trim()));
  const crossChapter = CROSS_CHAPTER_RE.test(core) || CROSS_CHAPTER_RE.test(expanded);
  const commaList = COMMA_LIST_RE.test(core.replace(/\s+/g, "")) || COMMA_LIST_RE.test(expanded);

  const empty: ParsedBuffer = {
    bookQuery: core.trim(),
    bookMatch: matchBook(core.trim()),
    chapter: null,
    verseStart: null,
    verseEnd: null,
    trailingDelimiter,
    crossChapter,
    commaList,
    bookReady: false,
  };

  if (!expanded) {
    return empty;
  }

  if (crossChapter || commaList) {
    const bookQuery = expanded.replace(/\s+\d.*$/, "").trim() || core.trim();
    const bookMatch = matchBook(bookQuery);
    return {
      ...empty,
      bookQuery,
      bookMatch,
      bookReady:
        bookMatch.kind === "unique" && canConfirmUniqueBook(bookQuery, bookMatch.book),
    };
  }

  const complete = expanded.match(/^(.*?)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (complete) {
    const bookQuery = complete[1]!.trim();
    const bookMatch = matchBook(bookQuery);
    const bookReady =
      bookMatch.kind === "unique" && canConfirmUniqueBook(bookQuery, bookMatch.book);
    return {
      bookQuery,
      bookMatch,
      chapter: Number.parseInt(complete[2]!, 10),
      verseStart: Number.parseInt(complete[3]!, 10),
      verseEnd: complete[4] ? Number.parseInt(complete[4], 10) : null,
      trailingDelimiter,
      crossChapter: false,
      commaList: false,
      bookReady,
    };
  }

  const passage = parsePassageReference(expanded);
  if (passage?.verseStart != null) {
    const bookQuery = expanded.replace(/\s+\d+:\d+(?:-\d+)?$/, "").trim();
    const bookMatch = matchBook(bookQuery);
    const bookReady =
      bookMatch.kind === "unique" && canConfirmUniqueBook(bookQuery, bookMatch.book);
    return {
      bookQuery,
      bookMatch,
      chapter: passage.chapter,
      verseStart: passage.verseStart,
      verseEnd: passage.verseEnd ?? null,
      trailingDelimiter,
      crossChapter: false,
      commaList: false,
      bookReady,
    };
  }

  const openRange = expanded.match(/^(.*?)\s+(\d+):(\d+)-$/);
  if (openRange) {
    const bookQuery = openRange[1]!.trim();
    const bookMatch = matchBook(bookQuery);
    return {
      bookQuery,
      bookMatch,
      chapter: Number.parseInt(openRange[2]!, 10),
      verseStart: Number.parseInt(openRange[3]!, 10),
      verseEnd: null,
      trailingDelimiter,
      crossChapter: false,
      commaList: false,
      bookReady:
        bookMatch.kind === "unique" && canConfirmUniqueBook(bookQuery, bookMatch.book),
    };
  }

  const openVerse = expanded.match(/^(.*?)\s+(\d+):$/);
  if (openVerse) {
    const bookQuery = openVerse[1]!.trim();
    const bookMatch = matchBook(bookQuery);
    return {
      bookQuery,
      bookMatch,
      chapter: Number.parseInt(openVerse[2]!, 10),
      verseStart: null,
      verseEnd: null,
      trailingDelimiter,
      crossChapter: false,
      commaList: false,
      bookReady:
        bookMatch.kind === "unique" && canConfirmUniqueBook(bookQuery, bookMatch.book),
    };
  }

  const chapterOnly = expanded.match(/^(.*?)\s+(\d+)$/);
  if (chapterOnly) {
    const bookQuery = chapterOnly[1]!.trim();
    const bookMatch = matchBook(bookQuery);
    return {
      bookQuery,
      bookMatch,
      chapter: Number.parseInt(chapterOnly[2]!, 10),
      verseStart: null,
      verseEnd: null,
      trailingDelimiter,
      crossChapter: false,
      commaList: false,
      bookReady:
        bookMatch.kind === "unique" && canConfirmUniqueBook(bookQuery, bookMatch.book),
    };
  }

  const bookQuery = expanded.trim();
  const bookMatch = matchBook(bookQuery);
  const uniqueReady =
    bookMatch.kind === "unique" && canConfirmUniqueBook(bookQuery, bookMatch.book);
  const digitFollows = /(?:^|\s)\d/.test(core.slice(bookQuery.length));
  const spaceFollows = trailingDelimiter.length > 0 && /^[ \t]+$/.test(trailingDelimiter);

  return {
    bookQuery,
    bookMatch,
    chapter: null,
    verseStart: null,
    verseEnd: null,
    trailingDelimiter,
    crossChapter: false,
    commaList: false,
    bookReady: uniqueReady && (spaceFollows || digitFollows),
  };
}

function validateRef(
  parsed: ParsedBuffer,
  getVerseCount?: VerseTagComposerOptions["getVerseCount"],
): { ref: VerseTagRef; error: VerseTagComposerError | null } | { ref: null; error: VerseTagComposerError | null } {
  if (parsed.crossChapter || parsed.commaList) {
    if (parsed.bookMatch.kind === "unique" && parsed.bookReady) {
      return { ref: null, error: "invalid-range" };
    }
    return { ref: null, error: null };
  }

  if (parsed.bookMatch.kind !== "unique" || !parsed.bookReady) {
    return { ref: null, error: null };
  }

  const book = parsed.bookMatch.book;
  if (parsed.chapter == null) {
    return { ref: null, error: null };
  }

  if (!Number.isInteger(parsed.chapter) || parsed.chapter < 1) {
    return { ref: null, error: "invalid-chapter" };
  }

  const loadedCount = getVerseCount?.(book.slug, parsed.chapter);
  if (loadedCount === null || parsed.chapter > book.chapterCount) {
    return { ref: null, error: "invalid-chapter" };
  }

  if (parsed.verseStart == null) {
    return { ref: null, error: null };
  }

  if (!Number.isInteger(parsed.verseStart) || parsed.verseStart < 1) {
    return { ref: null, error: "invalid-verse" };
  }

  if (parsed.verseEnd != null) {
    if (!Number.isInteger(parsed.verseEnd) || parsed.verseEnd < 1 || parsed.verseEnd <= parsed.verseStart) {
      return { ref: null, error: "invalid-range" };
    }
  }

  if (typeof loadedCount === "number") {
    if (parsed.verseStart > loadedCount) {
      return { ref: null, error: "invalid-verse" };
    }
    if (parsed.verseEnd != null && parsed.verseEnd > loadedCount) {
      return { ref: null, error: "invalid-verse" };
    }
  }

  return {
    ref: {
      book: book.slug,
      chapter: parsed.chapter,
      verseStart: parsed.verseStart,
      ...(parsed.verseEnd != null ? { verseEnd: parsed.verseEnd } : {}),
    },
    error: null,
  };
}

function withTrailingSpace(text: string, cursorIndex: number): { text: string; cursorIndex: number } {
  const next = text[cursorIndex];
  if (next === " " || next === "\t") {
    return { text, cursorIndex: cursorIndex + 1 };
  }
  if (next === undefined) {
    return { text: `${text} `, cursorIndex: cursorIndex + 1 };
  }
  if (/[.,;!?)\]]/.test(next)) {
    return { text, cursorIndex };
  }
  return {
    text: `${text.slice(0, cursorIndex)} ${text.slice(cursorIndex)}`,
    cursorIndex: cursorIndex + 1,
  };
}

function commitMention(
  text: string,
  cursorIndex: number,
  parsed: ParsedBuffer,
  ref: VerseTagRef,
  translation: string,
): VerseTagComposerCommit {
  const mentionEnd = cursorIndex - parsed.trailingDelimiter.length;
  const inserted = insertVerseTagAtMention(text, mentionEnd, ref, translation);
  const spaced = withTrailingSpace(inserted.text, inserted.cursorIndex);
  return { ...spaced, ref };
}

function mentioningState(
  buffer: string,
  atIndex: number,
  parsed: ParsedBuffer,
  translation: string,
  error: VerseTagComposerError | null,
): VerseTagComposerState {
  const confirmedBook =
    parsed.bookReady && parsed.bookMatch.kind === "unique"
      ? { slug: parsed.bookMatch.book.slug, translation }
      : null;

  let phase: VerseTagComposerPhase = "mentioning";
  if (error) {
    phase = "invalid";
  } else if (confirmedBook) {
    phase = "bookConfirmed";
  }

  return {
    phase,
    buffer,
    atIndex,
    confirmedBook,
    chapter: parsed.chapter,
    error,
  };
}

/** Pure @-mention composer. No UI — later phases wire overlay, chips, and prefetch. */
export function createVerseTagComposer(options: VerseTagComposerOptions = {}) {
  const translation = options.translation?.trim() || "KJV";
  const books = options.books ?? getKjvCanonicalBookNav();
  const matchBook =
    options.matchBook ?? ((bookQuery: string) => matchVerseTagComposerBook(bookQuery, books));

  let dismissedAt: number | null = null;
  let lastConfirmedSlug: string | null = null;
  let state: VerseTagComposerState = IDLE_STATE;

  function emitBookConfirmed(next: VerseTagComposerState): VerseTagComposerConfirmedBook | null {
    const slug = next.confirmedBook?.slug ?? null;
    if (!slug || slug === lastConfirmedSlug) {
      if (!slug) lastConfirmedSlug = null;
      return null;
    }
    lastConfirmedSlug = slug;
    return next.confirmedBook;
  }

  function push(event: VerseTagComposerEvent): VerseTagComposerResult {
    if (event.type === "escape") {
      const mention = getActiveVerseTagMention(event.text, event.cursorIndex);
      dismissedAt = mention?.atIndex ?? null;
      lastConfirmedSlug = null;
      state = IDLE_STATE;
      return idleResult();
    }

    const mention = getActiveVerseTagMention(event.text, event.cursorIndex);
    if (!mention) {
      dismissedAt = null;
      lastConfirmedSlug = null;
      state = IDLE_STATE;
      return idleResult();
    }

    if (dismissedAt === mention.atIndex) {
      state = IDLE_STATE;
      return idleResult();
    }

    const parsed = parseComposerBuffer(mention.buffer, matchBook);
    const validated = validateRef(parsed, options.getVerseCount);
    const shouldCommit =
      validated.ref != null &&
      validated.error == null &&
      !parsed.crossChapter &&
      !parsed.commaList &&
      (event.type === "blur" ||
        event.type === "commit" ||
        (event.type === "change" && isCommitDelimiter(parsed.trailingDelimiter)));

    if (event.type === "blur" && !shouldCommit) {
      lastConfirmedSlug = null;
      state = IDLE_STATE;
      return idleResult();
    }

    if (shouldCommit && validated.ref) {
      const commit = commitMention(
        event.text,
        event.cursorIndex,
        parsed,
        validated.ref,
        translation,
      );
      const confirmed: VerseTagComposerConfirmedBook = {
        slug: validated.ref.book,
        translation,
      };
      const bookConfirmed = lastConfirmedSlug === confirmed.slug ? null : confirmed;
      lastConfirmedSlug = null;
      dismissedAt = null;
      state = IDLE_STATE;
      return { state: IDLE_STATE, commit, bookConfirmed };
    }

    state = mentioningState(mention.buffer, mention.atIndex, parsed, translation, validated.error);
    const bookConfirmed = emitBookConfirmed(state);
    return { state, commit: null, bookConfirmed };
  }

  return {
    push,
    getState: () => state,
  };
}
