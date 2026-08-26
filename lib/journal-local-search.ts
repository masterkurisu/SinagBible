import { formatPassageReference, parsePassageReference } from "@sinag-bible/core";
import { levenshtein, maxFuzzyDistanceForQuery } from "@sinag-bible/core/text-utils";
import type { LocalJournalEntry } from "@sinag-bible/types";
import { decodeBasicHtmlEntities } from "@/lib/journal-preview";
import { getTranslationDisplaySearchTokens } from "@/lib/translation-display-label";
import { journalEntryMatchesDateRange } from "@/src/features/journal/journalDateFilter";

export type JournalSearchableEntry = Pick<
  LocalJournalEntry,
  | "book"
  | "chapter"
  | "verse_start"
  | "verse_end"
  | "bible_translation"
  | "content"
  | "created_at"
  | "title"
  | "tags"
  | "is_favorite"
>;

export type JournalSearchCombinator = {
  keyword: string;
  tags: string[];
  dateRange: JournalSearchDateRange | null;
  bookSlug: string | null;
};

export type JournalLocalSearchOptions = {
  favoritesOnly?: boolean;
  now?: Date;
  /** When set, every present field must match (AND). Overlay power search. */
  combinator?: JournalSearchCombinator;
};

export type JournalSearchDateRange = {
  from: Date;
  to: Date;
};

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const MONTH_TOKEN =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const ISO_MONTH = "(\\d{4})-(0[1-9]|1[0-2])";
const RANGE_SEPARATOR = "(?:\\.{2,3}|to|[\\u2013\\u2014-])";
const ISO_MONTH_RANGE_RE = new RegExp(`^${ISO_MONTH}\\s*${RANGE_SEPARATOR}\\s*${ISO_MONTH}$`);
const ISO_MONTH_RE = new RegExp(`^${ISO_MONTH}$`);
const MONTH_DAY_RANGE_RE = new RegExp(
  `^${MONTH_TOKEN}\\s+(\\d{1,2})\\s*${RANGE_SEPARATOR}\\s*${MONTH_TOKEN}\\s+(\\d{1,2})$`,
  "i",
);

function resolveNow(options?: JournalLocalSearchOptions): Date {
  return options?.now ?? new Date();
}

function localDate(year: number, monthIndex: number, day: number): Date | null {
  const date = new Date(year, monthIndex, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function lastDateOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex + 1, 0);
}

const MONTH_DAY_RANGE_FIND_RE = new RegExp(
  `${MONTH_TOKEN}\\s+(\\d{1,2})\\s*${RANGE_SEPARATOR}\\s*${MONTH_TOKEN}\\s+(\\d{1,2})`,
  "i",
);
const ISO_MONTH_RANGE_FIND_RE = new RegExp(
  `${ISO_MONTH}\\s*${RANGE_SEPARATOR}\\s*${ISO_MONTH}`,
);
const ISO_MONTH_FIND_RE = new RegExp(`\\b${ISO_MONTH}\\b`);

/**
 * Whole-query date ranges (`last week`, `YYYY-MM`, month-day spans).
 * `2026-01-15` is not a month token — it still matches via locale/ISO substring.
 */
export function parseJournalSearchDateRange(rawQuery: string, now: Date): JournalSearchDateRange | null {
  const q = rawQuery.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return null;

  if (q === "last week") {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { from, to };
  }

  const isoRange = q.match(ISO_MONTH_RANGE_RE);
  if (isoRange) {
    let startYear = Number(isoRange[1]);
    let startMonth = Number(isoRange[2]) - 1;
    let endYear = Number(isoRange[3]);
    let endMonth = Number(isoRange[4]) - 1;
    let from = new Date(startYear, startMonth, 1);
    let to = lastDateOfMonth(endYear, endMonth);
    if (from.getTime() > to.getTime()) {
      from = new Date(endYear, endMonth, 1);
      to = lastDateOfMonth(startYear, startMonth);
    }
    return { from, to };
  }

  const isoMonth = q.match(ISO_MONTH_RE);
  if (isoMonth) {
    const year = Number(isoMonth[1]);
    const monthIndex = Number(isoMonth[2]) - 1;
    return {
      from: new Date(year, monthIndex, 1),
      to: lastDateOfMonth(year, monthIndex),
    };
  }

  const namedRange = q.match(MONTH_DAY_RANGE_RE);
  if (namedRange) {
    const startMonth = MONTH_NAME_TO_INDEX[namedRange[1].toLowerCase()];
    const endMonth = MONTH_NAME_TO_INDEX[namedRange[3].toLowerCase()];
    const startDay = Number(namedRange[2]);
    const endDay = Number(namedRange[4]);
    if (startMonth == null || endMonth == null) return null;
    const year = now.getFullYear();
    const from = localDate(year, startMonth, startDay);
    let to = localDate(year, endMonth, endDay);
    if (!from || !to) return null;
    if (to.getTime() < from.getTime()) {
      to = localDate(year + 1, endMonth, endDay);
      if (!to) return null;
    }
    return { from, to };
  }

  return null;
}

/**
 * Pull a date range out of leftover power-search text (`love last week`).
 * Whole leftover is tried first so `jan 1 - jan 7` still parses as a range.
 */
export function extractJournalSearchDateRangeFromText(
  leftover: string,
  now: Date,
): { remainder: string; dateRange: JournalSearchDateRange | null } {
  const trimmed = leftover.trim().replace(/\s+/g, " ");
  if (!trimmed) return { remainder: "", dateRange: null };

  const whole = parseJournalSearchDateRange(trimmed, now);
  if (whole) return { remainder: "", dateRange: whole };

  const phrases = ["last week", "yesterday", "today"] as const;
  for (const phrase of phrases) {
    const re = new RegExp(`\\b${phrase}\\b`, "i");
    if (!re.test(trimmed)) continue;
    let range = parseJournalSearchDateRange(phrase, now);
    if (!range && phrase === "today") {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      range = { from: day, to: day };
    }
    if (!range && phrase === "yesterday") {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      range = { from: day, to: day };
    }
    if (!range) continue;
    return { remainder: trimmed.replace(re, " ").replace(/\s+/g, " ").trim(), dateRange: range };
  }

  const isoRange = trimmed.match(ISO_MONTH_RANGE_FIND_RE);
  if (isoRange?.[0]) {
    const range = parseJournalSearchDateRange(isoRange[0], now);
    if (range) {
      return {
        remainder: trimmed.replace(isoRange[0], " ").replace(/\s+/g, " ").trim(),
        dateRange: range,
      };
    }
  }

  const namedRange = trimmed.match(MONTH_DAY_RANGE_FIND_RE);
  if (namedRange?.[0]) {
    const range = parseJournalSearchDateRange(namedRange[0], now);
    if (range) {
      return {
        remainder: trimmed.replace(namedRange[0], " ").replace(/\s+/g, " ").trim(),
        dateRange: range,
      };
    }
  }

  if (!/\d{4}-(?:0[1-9]|1[0-2])-\d{2}/.test(trimmed)) {
    const isoMonth = trimmed.match(ISO_MONTH_FIND_RE);
    if (isoMonth?.[0]) {
      const range = parseJournalSearchDateRange(isoMonth[0], now);
      if (range) {
        return {
          remainder: trimmed.replace(isoMonth[0], " ").replace(/\s+/g, " ").trim(),
          dateRange: range,
        };
      }
    }
  }

  return { remainder: trimmed, dateRange: null };
}

function hasJournalCombinatorFields(combinator: JournalSearchCombinator | undefined): boolean {
  if (!combinator) return false;
  return (
    combinator.tags.length > 0 ||
    combinator.bookSlug != null ||
    combinator.dateRange != null ||
    combinator.keyword.trim().length > 0
  );
}

function isFavoritesQueryToken(q: string): boolean {
  return q === "favorite" || q === "favorites";
}

function journalEntryTagMatchesQuery(tags: string[] | undefined, q: string): boolean {
  const normalized = (tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  if (normalized.length === 0) return false;
  if (normalized.includes(q)) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.some((token) => normalized.includes(token));
}

function plainTextFromJournalHtml(html: string): string {
  const spaced = html.replace(/<[^>]+>/g, " ");
  return decodeBasicHtmlEntities(spaced).replace(/\s+/g, " ").trim().toLowerCase();
}

function titleFuzzyMatchesQuery(title: string, q: string): boolean {
  const t = title.trim().toLowerCase();
  if (!t || q.length < 4 || t.length < 4) return false;
  const maxD = maxFuzzyDistanceForQuery(q);
  if (maxD <= 0) return false;
  if (levenshtein(t, q) <= maxD) return true;
  return t.split(/\s+/).some((token) => token.length >= 4 && levenshtein(token, q) <= maxD);
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function journalEntryDateSearchStrings(createdAtIso: string): string[] {
  const parsed = new Date(createdAtIso);
  if (Number.isNaN(parsed.getTime())) return [];

  const month = parsed.getMonth() + 1;
  const day = parsed.getDate();
  const year = parsed.getFullYear();
  const pad2 = (n: number) => String(n).padStart(2, "0");

  return [
    parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    parsed.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }),
    parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    parsed.toLocaleDateString(undefined, { month: "long", day: "numeric" }),
    String(year),
    `${month}/${day}`,
    `${month}/${day}/${year}`,
    `${pad2(month)}/${pad2(day)}/${year}`,
    `${year}-${pad2(month)}-${pad2(day)}`,
  ].map((value) => value.toLowerCase());
}

function journalEntryDateMatchesQuery(
  createdAtIso: string,
  q: string,
  now: Date,
): boolean {
  const parsed = new Date(createdAtIso);
  if (Number.isNaN(parsed.getTime())) return false;

  const range = parseJournalSearchDateRange(q, now);
  if (range) {
    return journalEntryMatchesDateRange(createdAtIso, range.from, range.to);
  }

  if (q === "today") return sameLocalDay(parsed, now);
  if (q === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return sameLocalDay(parsed, yesterday);
  }

  return journalEntryDateSearchStrings(createdAtIso).some((candidate) => candidate.includes(q));
}

function passageEntryMatchesParsedReference(
  entry: JournalSearchableEntry,
  parsed: NonNullable<ReturnType<typeof parsePassageReference>>,
): boolean {
  const entryBook = (entry.book ?? "").toLowerCase();
  if (!entryBook || entryBook !== parsed.book) return false;
  if (entry.chapter !== parsed.chapter) return false;
  if (parsed.verseStart == null) return true;

  const entryStart = entry.verse_start;
  const entryEnd = entry.verse_end ?? entry.verse_start;
  if (entryStart == null || entryEnd == null) return false;

  const queryEnd = parsed.verseEnd ?? parsed.verseStart;
  return entryStart <= queryEnd && entryEnd >= parsed.verseStart;
}

function buildJournalEntryHaystack(entry: JournalSearchableEntry): string {
  const title = entry.title?.trim() ?? "";
  const titleLower = title.toLowerCase();
  const body = plainTextFromJournalHtml(entry.content ?? "");
  const refLine =
    entry.book && entry.chapter > 0
      ? formatPassageReference({
          book: entry.book,
          chapter: entry.chapter,
          verseStart: entry.verse_start,
          verseEnd: entry.verse_end,
        }).toLowerCase()
      : "";
  const bookSlug = (entry.book ?? "").toLowerCase();
  const chapterStr = String(entry.chapter ?? "");
  const tr = getTranslationDisplaySearchTokens(entry.bible_translation).join(" ");
  return `${titleLower} ${body} ${refLine} ${bookSlug} ${chapterStr} ${tr}`;
}

function journalEntryMatchesKeywordOnly(entry: JournalSearchableEntry, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return true;

  if (isFavoritesQueryToken(q)) {
    return entry.is_favorite === true;
  }

  const parsedPassage = parsePassageReference(rawQuery.trim());
  if (parsedPassage && passageEntryMatchesParsedReference(entry, parsedPassage)) {
    return true;
  }

  const haystack = buildJournalEntryHaystack(entry);
  if (haystack.includes(q)) return true;

  const title = entry.title?.trim() ?? "";
  return titleFuzzyMatchesQuery(title, q);
}

function journalEntryMatchesCombinator(
  entry: JournalSearchableEntry,
  combinator: JournalSearchCombinator,
): boolean {
  if (combinator.bookSlug) {
    if ((entry.book ?? "").toLowerCase() !== combinator.bookSlug.toLowerCase()) return false;
  }
  if (combinator.dateRange) {
    if (!journalEntryMatchesDateRange(entry.created_at, combinator.dateRange.from, combinator.dateRange.to)) {
      return false;
    }
  }
  for (const tag of combinator.tags) {
    if (!journalEntryTagMatchesQuery(entry.tags, tag)) return false;
  }
  return journalEntryMatchesKeywordOnly(entry, combinator.keyword);
}

/**
 * Whether a journal entry matches a search query (keywords, dates, tags, or passage references).
 */
export function journalEntryMatchesSearchQuery(
  entry: JournalSearchableEntry,
  rawQuery: string,
  options?: JournalLocalSearchOptions,
): boolean {
  if (options?.favoritesOnly && entry.is_favorite !== true) return false;

  if (options?.combinator) {
    return journalEntryMatchesCombinator(entry, options.combinator);
  }

  const q = rawQuery.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return true;

  if (isFavoritesQueryToken(q)) {
    return entry.is_favorite === true;
  }

  const parsedPassage = parsePassageReference(rawQuery.trim());
  if (parsedPassage && passageEntryMatchesParsedReference(entry, parsedPassage)) {
    return true;
  }

  if (journalEntryTagMatchesQuery(entry.tags, q)) {
    return true;
  }

  if (journalEntryDateMatchesQuery(entry.created_at, q, resolveNow(options))) {
    return true;
  }

  const haystack = buildJournalEntryHaystack(entry);
  if (haystack.includes(q)) return true;

  const title = entry.title?.trim() ?? "";
  return titleFuzzyMatchesQuery(title, q);
}

function journalEntryKeywordRelevanceScore(
  entry: JournalSearchableEntry,
  rawQuery: string,
  now: Date,
): number {
  const q = rawQuery.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return 0;

  const parsedPassage = parsePassageReference(rawQuery.trim());
  if (parsedPassage && passageEntryMatchesParsedReference(entry, parsedPassage)) {
    return 100;
  }

  if (isFavoritesQueryToken(q) && entry.is_favorite === true) {
    return 95;
  }

  if (journalEntryTagMatchesQuery(entry.tags, q)) {
    const exactTag = (entry.tags ?? []).some((tag) => tag.trim().toLowerCase() === q);
    return exactTag ? 85 : 82;
  }

  const title = entry.title?.trim() ?? "";
  const titleLower = title.toLowerCase();
  if (titleLower.includes(q)) return 80;
  if (titleFuzzyMatchesQuery(title, q)) return 70;

  if (journalEntryDateMatchesQuery(entry.created_at, q, now)) return 60;

  const refLine =
    entry.book && entry.chapter > 0
      ? formatPassageReference({
          book: entry.book,
          chapter: entry.chapter,
          verseStart: entry.verse_start,
          verseEnd: entry.verse_end,
        }).toLowerCase()
      : "";
  if (refLine.includes(q)) return 50;

  const body = plainTextFromJournalHtml(entry.content ?? "");
  if (body.includes(q)) return 40;

  const haystack = buildJournalEntryHaystack(entry);
  if (haystack.includes(q)) return 30;

  return 0;
}

/**
 * Relevance score for ordering journal search results (higher = better match).
 * Returns 0 when the entry does not match.
 */
export function journalEntrySearchRelevanceScore(
  entry: JournalSearchableEntry,
  rawQuery: string,
  options?: JournalLocalSearchOptions,
): number {
  if (!journalEntryMatchesSearchQuery(entry, rawQuery, options)) return 0;

  const combinator = options?.combinator;
  if (combinator) {
    const keywordScore = journalEntryKeywordRelevanceScore(
      entry,
      combinator.keyword,
      resolveNow(options),
    );
    if (keywordScore > 0) return keywordScore;
    if (combinator.tags.length > 0) return 85;
    if (combinator.dateRange) return 60;
    if (combinator.bookSlug) return 50;
    return 1;
  }

  return journalEntryKeywordRelevanceScore(entry, rawQuery, resolveNow(options));
}

/**
 * In-memory full-text filter over local journal entries (title, stripped HTML body,
 * formatted passage, book slug, chapter, translation id, dates, tags). Order of `entries` is preserved.
 * Titles also accept fuzzy matches (Levenshtein) consistent with Bible book suggestions.
 * Returns an empty array when the query is blank (global search tab idle state).
 */
export function filterLocalJournalEntriesByQuery(
  entries: LocalJournalEntry[],
  rawQuery: string,
  options?: JournalLocalSearchOptions,
): LocalJournalEntry[] {
  const q = rawQuery.trim();
  if (!q && !hasJournalCombinatorFields(options?.combinator)) return [];

  return entries.filter((entry) => journalEntryMatchesSearchQuery(entry, q, options));
}

/**
 * Overlay-only journal ranking: filter matches, then sort by relevance score
 * (highest first) with a stable `created_at` descending tie-break.
 * Does not mutate `entries`. Journal-page search should keep using
 * {@link filterLocalJournalEntriesByQuery} plus its own sort.
 */
export function rankLocalJournalEntriesForOverlay(
  entries: LocalJournalEntry[],
  rawQuery: string,
  options?: JournalLocalSearchOptions,
): LocalJournalEntry[] {
  const q = rawQuery.trim();
  if (!q && !hasJournalCombinatorFields(options?.combinator)) return [];

  return entries
    .filter((entry) => journalEntryMatchesSearchQuery(entry, q, options))
    .sort((a, b) => {
      const scoreDiff =
        journalEntrySearchRelevanceScore(b, q, options) -
        journalEntrySearchRelevanceScore(a, q, options);
      if (scoreDiff !== 0) return scoreDiff;
      return b.created_at.localeCompare(a.created_at);
    });
}
