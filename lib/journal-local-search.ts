import { formatPassageReference } from "@sinag-bible/core";
import type { LocalJournalEntry } from "@sinag-bible/types";
import { decodeBasicHtmlEntities } from "@/lib/journal-preview";

function plainTextFromJournalHtml(html: string): string {
  const spaced = html.replace(/<[^>]+>/g, " ");
  return decodeBasicHtmlEntities(spaced).replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * In-memory full-text filter over local journal entries (title, stripped HTML body,
 * formatted passage, book slug, chapter, translation id). Order of `entries` is preserved.
 */
export function filterLocalJournalEntriesByQuery(
  entries: LocalJournalEntry[],
  rawQuery: string,
): LocalJournalEntry[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];

  return entries.filter((entry) => {
    const title = (entry.title?.trim() ?? "").toLowerCase();
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
    const haystack = `${title} ${body} ${refLine} ${bookSlug} ${chapterStr} ${tr}`;
    return haystack.includes(q);
  });
}
