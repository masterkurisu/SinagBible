import type { LocalJournalEntry, SearchResult } from "@sinag-bible/types";

export type SearchFlashRow =
  | { kind: "header"; key: string; title: string }
  | { kind: "verse"; key: string; result: SearchResult }
  | { kind: "journal"; key: string; entry: LocalJournalEntry };

export type SearchSection = {
  title: string;
  data: (SearchResult | LocalJournalEntry)[];
};

/** Flattens overlay sections into FlashList rows (`header` | `verse` | `journal`). */
export function flattenSearchSections(sections: SearchSection[]): SearchFlashRow[] {
  const rows: SearchFlashRow[] = [];
  let verseIndex = 0;
  for (const section of sections) {
    rows.push({ kind: "header", key: `h-${section.title}`, title: section.title });
    if (section.title === "Journal") {
      for (const item of section.data) {
        const entry = item as LocalJournalEntry;
        rows.push({ kind: "journal", key: `j-${entry.id}`, entry });
      }
      continue;
    }
    for (const item of section.data) {
      const result = item as SearchResult;
      rows.push({
        kind: "verse",
        key: `v-${result.bookSlug}-${result.chapterNumber}-${result.verseNumber}-${verseIndex++}`,
        result,
      });
    }
  }
  return rows;
}
