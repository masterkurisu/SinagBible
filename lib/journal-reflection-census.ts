import {
  reflectionHtmlNeedsLegacyEditor,
  scanReflectionHtmlNasties,
} from "@/lib/journal-reflection-legacy-route";

export type JournalCensusRow = {
  id: string;
  content: string;
  content_markdown?: string | null;
};

export type JournalReflectionCensus = {
  totalRows: number;
  nullOrEmptyMarkdown: number;
  nestedListHtml: number;
  otherNasties: { id: string; tags: string[] }[];
};

export function isNullOrEmptyMarkdown(markdown: string | null | undefined): boolean {
  return markdown == null || markdown.trim() === "";
}

/**
 * Phase 0 census over already-loaded journal rows.
 * Nested-list count uses the same router as runtime (`reflectionHtmlNeedsLegacyEditor`).
 */
export function censusJournalReflectionRows(rows: JournalCensusRow[]): JournalReflectionCensus {
  let nullOrEmptyMarkdown = 0;
  let nestedListHtml = 0;
  const otherNasties: { id: string; tags: string[] }[] = [];

  for (const row of rows) {
    if (isNullOrEmptyMarkdown(row.content_markdown)) nullOrEmptyMarkdown += 1;
    if (reflectionHtmlNeedsLegacyEditor(row.content)) nestedListHtml += 1;
    const nasties = scanReflectionHtmlNasties(row.content).filter((tag) => tag !== "nested-list");
    if (nasties.length > 0) otherNasties.push({ id: row.id, tags: nasties });
  }

  return {
    totalRows: rows.length,
    nullOrEmptyMarkdown,
    nestedListHtml,
    otherNasties,
  };
}
