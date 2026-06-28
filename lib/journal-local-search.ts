import { formatPassageReference } from "@sinag-bible/core";
import { levenshtein, maxFuzzyDistanceForQuery } from "@sinag-bible/core/text-utils";
import type { LocalJournalEntry } from "@sinag-bible/types";
import { decodeBasicHtmlEntities } from "@/lib/journal-preview";

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

/**
 * In-memory full-text filter over local journal entries (title, stripped HTML body,
 * formatted passage, book slug, chapter, translation id). Order of `entries` is preserved.
 * Titles also accept fuzzy matches (Levenshtein) consistent with Bible book suggestions.
 */
export function filterLocalJournalEntriesByQuery(
  entries: LocalJournalEntry[],
  rawQuery: string,
): LocalJournalEntry[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];

  return entries.filter((entry) => {
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
    const haystack = `${titleLower} ${body} ${refLine} ${bookSlug} ${chapterStr} ${tr}`;
    if (haystack.includes(q)) return true;
    return titleFuzzyMatchesQuery(title, q);
  });
}
