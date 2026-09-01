import { describe, expect, it } from "vitest";
import type { LocalJournalEntry, SearchResult } from "@sinag-bible/types";
import { flattenSearchSections } from "./searchFlashListRows";

function verse(partial: Partial<SearchResult> & Pick<SearchResult, "bookSlug" | "verseNumber">): SearchResult {
  return {
    bookName: partial.bookName ?? "John",
    bookSlug: partial.bookSlug,
    chapterNumber: partial.chapterNumber ?? 3,
    verseNumber: partial.verseNumber,
    verseText: partial.verseText ?? "For God so loved the world",
  };
}

function journal(id: string): LocalJournalEntry {
  return {
    id,
    book: "John",
    chapter: 3,
    verse_start: 16,
    verse_end: 16,
    content: "<p>Hello</p>",
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("flattenSearchSections", () => {
  it("emits header then journal then bible verses", () => {
    const rows = flattenSearchSections([
      { title: "Journal", data: [journal("a")] },
      { title: "Bible", data: [verse({ bookSlug: "john", verseNumber: 16 })] },
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["header", "journal", "header", "verse"]);
    expect(rows[0]).toMatchObject({ kind: "header", title: "Journal" });
    expect(rows[1]).toMatchObject({ kind: "journal", key: "j-a" });
    expect(rows[2]).toMatchObject({ kind: "header", title: "Bible" });
    expect(rows[3]).toMatchObject({ kind: "verse" });
  });

  it("keeps Related verses distinct from Journal", () => {
    const rows = flattenSearchSections([
      { title: "Related", data: [verse({ bookSlug: "romans", verseNumber: 8 })] },
    ]);
    expect(rows[1]?.kind).toBe("verse");
  });
});
