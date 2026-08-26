import { describe, expect, it, vi } from "vitest";
import { expandReferenceQuery } from "@sinag-bible/core/reference-aliases";
import { getSearchResultsForTranslation } from "@sinag-bible/core/bible-translations";
import { parsePassageReference } from "@sinag-bible/core/journal";
import type { LocalJournalEntry } from "@sinag-bible/types";

vi.mock("@/lib/translation-display-label", () => ({
  getTranslationDisplaySearchTokens: (translationId: string | null | undefined) => {
    const raw = translationId?.trim().toLowerCase() ?? "";
    return raw ? [raw] : [];
  },
}));

import { rankLocalJournalEntriesForOverlay } from "@/lib/journal-local-search";

function johnEntry(id: string): LocalJournalEntry {
  return {
    id,
    book: "john",
    chapter: 3,
    verse_start: 16,
    verse_end: 16,
    bible_translation: "KJV",
    content: "<p>unrelated body</p>",
    created_at: "2026-01-01T00:00:00.000Z",
    title: "Unrelated",
  };
}

describe("expandReferenceQuery space-separated chapter/verse", () => {
  it("normalizes john 3 16 and jn 3 16 to john 3:16", () => {
    expect(expandReferenceQuery("john 3 16")).toBe("john 3:16");
    expect(expandReferenceQuery("jn 3 16")).toBe("john 3:16");
    expect(expandReferenceQuery("John 3 16-18")).toBe("john 3:16-18");
  });

  it("does not treat digit-only 316 / 23 or bookless 3 16 as a chapter:verse ref", () => {
    expect(expandReferenceQuery("316")).toBe("316");
    expect(expandReferenceQuery("23")).toBe("23");
    expect(expandReferenceQuery("3 16")).toBe("3 16");
  });
});

describe("expandReferenceQuery abbreviation table", () => {
  it("expands common short forms listed for overlay reference input", () => {
    expect(expandReferenceQuery("jn 3:16")).toBe("john 3:16");
    expect(expandReferenceQuery("rom 8:1")).toBe("romans 8:1");
    expect(expandReferenceQuery("ps 23")).toBe("psalms 23");
    expect(expandReferenceQuery("psa 23")).toBe("psalms 23");
    expect(expandReferenceQuery("mt 5:3")).toBe("matthew 5:3");
    expect(expandReferenceQuery("mk 1:1")).toBe("mark 1:1");
    expect(expandReferenceQuery("lk 1:1")).toBe("luke 1:1");
    expect(expandReferenceQuery("act 2:1")).toBe("acts 2:1");
    expect(expandReferenceQuery("gal 5:22")).toBe("galatians 5:22");
    expect(expandReferenceQuery("eph 2:8")).toBe("ephesians 2:8");
    expect(expandReferenceQuery("col 1:16")).toBe("colossians 1:16");
    expect(expandReferenceQuery("heb 11:1")).toBe("hebrews 11:1");
    expect(expandReferenceQuery("jas 1:2")).toBe("james 1:2");
    expect(expandReferenceQuery("1jn 4:8")).toBe("1 john 4:8");
    expect(expandReferenceQuery("2jn 1:1")).toBe("2 john 1:1");
    expect(expandReferenceQuery("3jn 1:1")).toBe("3 john 1:1");
    expect(expandReferenceQuery("1pe 5:7")).toBe("1 peter 5:7");
    expect(expandReferenceQuery("2pe 1:3")).toBe("2 peter 1:3");
  });

  it("keeps prefix mat as mat (completion stays in search, not this table)", () => {
    expect(expandReferenceQuery("mat")).toBe("mat");
  });
});

describe("overlay space-separated and abbreviated Bible references", () => {
  it("treats john 3 16 like John 3:16", async () => {
    const spaced = await getSearchResultsForTranslation("KJV", "john 3 16");
    const colon = await getSearchResultsForTranslation("KJV", "John 3:16");

    expect(spaced.results[0]).toMatchObject({
      bookSlug: "john",
      chapterNumber: 3,
      verseNumber: 16,
    });
    expect(spaced.results[0]?.bookSlug).toBe(colon.results[0]?.bookSlug);
    expect(spaced.results[0]?.chapterNumber).toBe(colon.results[0]?.chapterNumber);
    expect(spaced.results[0]?.verseNumber).toBe(colon.results[0]?.verseNumber);
  });

  it("treats jn 3 16 like John 3:16", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "jn 3 16");

    expect(outcome.results[0]).toMatchObject({
      bookSlug: "john",
      chapterNumber: 3,
      verseNumber: 16,
    });
  });

  it("treats John 3 16-18 like John 3:16-18", async () => {
    const spaced = await getSearchResultsForTranslation("KJV", "John 3 16-18");
    const colon = await getSearchResultsForTranslation("KJV", "John 3:16-18");

    const spacedKeys = spaced.results.map(
      (row) => `${row.bookSlug}:${row.chapterNumber}:${row.verseNumber}`,
    );
    const colonKeys = colon.results.map(
      (row) => `${row.bookSlug}:${row.chapterNumber}:${row.verseNumber}`,
    );

    expect(spacedKeys).toEqual(["john:3:16", "john:3:17", "john:3:18"]);
    expect(colonKeys).toEqual(spacedKeys);
  });

  it("does not reopen digit-only 316 as every book's 3:16", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "316");
    expect(outcome.results).toEqual([]);
  });

  it("does not treat bookless 3 16 as canon-wide chapter:verse", async () => {
    const spaced = await getSearchResultsForTranslation("KJV", "3 16");
    const bare = await getSearchResultsForTranslation("KJV", "3:16");

    expect(bare.results.length).toBeGreaterThan(1);
    expect(bare.results.every((row) => row.chapterNumber === 3 && row.verseNumber === 16)).toBe(
      true,
    );
    expect(spaced.results).not.toEqual(bare.results);
    expect(
      spaced.results.length === 0 ||
        !spaced.results.every((row) => row.chapterNumber === 3 && row.verseNumber === 16),
    ).toBe(true);
  });

  it("resolves listed NT/OT shorts to the intended book", async () => {
    const cases: Array<[string, string, number, number]> = [
      ["rom 8:1", "romans", 8, 1],
      ["ps 23:1", "psalms", 23, 1],
      ["mt 5:3", "matthew", 5, 3],
      ["1jn 4:8", "1-john", 4, 8],
      ["1pe 5:7", "1-peter", 5, 7],
    ];

    for (const [query, bookSlug, chapter, verse] of cases) {
      const outcome = await getSearchResultsForTranslation("KJV", query);
      expect(outcome.results[0], query).toMatchObject({
        bookSlug,
        chapterNumber: chapter,
        verseNumber: verse,
      });
    }
  });
});

describe("overlay journal linked-verse accepts the same reference shapes", () => {
  it("parses space-separated and abbreviated forms as john 3:16", () => {
    expect(parsePassageReference("John 3 16")).toEqual({
      book: "john",
      chapter: 3,
      verseStart: 16,
      verseEnd: null,
    });
    expect(parsePassageReference("jn 3 16")).toEqual({
      book: "john",
      chapter: 3,
      verseStart: 16,
      verseEnd: null,
    });
    expect(parsePassageReference("John 3 16-18")).toEqual({
      book: "john",
      chapter: 3,
      verseStart: 16,
      verseEnd: 18,
    });
  });

  it("ranks a linked John 3:16 entry for john 3 16 and jn 3:16", () => {
    const hit = johnEntry("local-john");
    const miss = {
      ...johnEntry("local-other"),
      book: "romans",
      chapter: 8,
      verse_start: 1,
      verse_end: 1,
    };

    expect(rankLocalJournalEntriesForOverlay([miss, hit], "john 3 16").map((row) => row.id)).toEqual(
      ["local-john"],
    );
    expect(rankLocalJournalEntriesForOverlay([miss, hit], "jn 3:16").map((row) => row.id)).toEqual([
      "local-john",
    ]);
  });
});
