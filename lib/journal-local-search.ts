import { formatPassageReference, parsePassageReference } from "@sinag-bible/core";
import { levenshtein, maxFuzzyDistanceForQuery } from "@sinag-bible/core/text-utils";
import type { LocalJournalEntry } from "@sinag-bible/types";
import { decodeBasicHtmlEntities } from "@/lib/journal-preview";

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
>;

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

function journalEntryDateMatchesQuery(createdAtIso: string, q: string): boolean {
  const parsed = new Date(createdAtIso);
  if (Number.isNaN(parsed.getTime())) return false;

  const today = new Date();
  if (q === "today") return sameLocalDay(parsed, today);
  if (q === "yesterday") {
    const yesterday = new Date(today);
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
  const tr = (entry.bible_translation ?? "").toLowerCase();
  return `${titleLower} ${body} ${refLine} ${bookSlug} ${chapterStr} ${tr}`;
}

/**
 * Whether a journal entry matches a search query (keywords, dates, or passage references).
 */
export function journalEntryMatchesSearchQuery(
  entry: JournalSearchableEntry,
  rawQuery: string,
): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;

  const parsedPassage = parsePassageReference(rawQuery.trim());
  if (parsedPassage && passageEntryMatchesParsedReference(entry, parsedPassage)) {
    return true;
  }

  if (journalEntryDateMatchesQuery(entry.created_at, q)) {
    return true;
  }

  const haystack = buildJournalEntryHaystack(entry);
  if (haystack.includes(q)) return true;

  const title = entry.title?.trim() ?? "";
  return titleFuzzyMatchesQuery(title, q);
}

/**
 * Relevance score for ordering journal search results (higher = better match).
 * Returns 0 when the entry does not match.
 */
export function journalEntrySearchRelevanceScore(
  entry: JournalSearchableEntry,
  rawQuery: string,
): number {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return 0;

  const parsedPassage = parsePassageReference(rawQuery.trim());
  if (parsedPassage && passageEntryMatchesParsedReference(entry, parsedPassage)) {
    return 100;
  }

  const title = entry.title?.trim() ?? "";
  const titleLower = title.toLowerCase();
  if (titleLower.includes(q)) return 80;
  if (titleFuzzyMatchesQuery(title, q)) return 70;

  if (journalEntryDateMatchesQuery(entry.created_at, q)) return 60;

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
 * In-memory full-text filter over local journal entries (title, stripped HTML body,
 * formatted passage, book slug, chapter, translation id, dates). Order of `entries` is preserved.
 * Titles also accept fuzzy matches (Levenshtein) consistent with Bible book suggestions.
 * Returns an empty array when the query is blank (global search tab idle state).
 */
export function filterLocalJournalEntriesByQuery(
  entries: LocalJournalEntry[],
  rawQuery: string,
): LocalJournalEntry[] {
  const q = rawQuery.trim();
  if (!q) return [];

  return entries.filter((entry) => journalEntryMatchesSearchQuery(entry, q));
}
