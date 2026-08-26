import { describe, expect, it, vi } from "vitest";
import type { LocalJournalEntry, SearchResult } from "@sinag-bible/types";
import { getSearchResultsForTranslation } from "@sinag-bible/core/bible-translations";
import { keywordHasPopularVerses } from "@sinag-bible/core/search-keyword-popular";
import { getTopicalVerseRefsForQuery } from "@sinag-bible/core/search-topical-index";
import { parseOverlayMarksQuery } from "@/lib/reader-marks-search";
import {
  journalEntryMatchesSearchQuery,
  rankLocalJournalEntriesForOverlay,
} from "@/lib/journal-local-search";
import {
  overlayPowerToJournalCombinator,
  parseOverlayPowerQuery,
  resolveAlsoTranslationId,
} from "@/lib/search-power-query";
import {
  attachAlsoTranslationSnippets,
  pickAlsoTranslationId,
} from "@/lib/search-also-translation";

vi.mock("@/lib/translation-display-label", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/translation-display-label")>();
  return {
    ...actual,
    getTranslationDisplaySearchTokens: (translationId: string | null | undefined) => {
      const raw = translationId?.trim().toLowerCase() ?? "";
      return raw ? [raw] : [];
    },
  };
});

function journalEntry(
  overrides: Partial<LocalJournalEntry> & Pick<LocalJournalEntry, "id">,
): LocalJournalEntry {
  return {
    book: "john",
    chapter: 3,
    verse_start: 16,
    verse_end: 16,
    bible_translation: "KJV",
    content: "<p>unrelated body</p>",
    created_at: "2026-01-15T12:00:00.000Z",
    title: "Unrelated",
    is_favorite: false,
    tags: [],
    ...overrides,
  };
}

const NOW = new Date(2026, 7, 27, 12, 0, 0);

describe("parseOverlayPowerQuery", () => {
  it("parses book, tag, also, and date combinators as AND fields", () => {
    const parsed = parseOverlayPowerQuery("book:john love tag:gratitude last week", NOW);
    expect(parsed.keyword).toBe("love");
    expect(parsed.bookSlug).toBe("john");
    expect(parsed.tags).toEqual(["gratitude"]);
    expect(parsed.dateRange).not.toBeNull();
    expect(parsed.hasJournalCombinator).toBe(true);
    expect(parsed.alsoTranslationId).toBeNull();
  });

  it("extracts today from leftover so journal AND can use it", () => {
    const parsed = parseOverlayPowerQuery("love today", NOW);
    expect(parsed.keyword).toBe("love");
    expect(parsed.dateRange).not.toBeNull();
    expect(parsed.hasJournalCombinator).toBe(true);
  });

  it("resolves book abbreviations and also: aliases", () => {
    expect(parseOverlayPowerQuery("book:jn faith").bookSlug).toBe("john");
    expect(parseOverlayPowerQuery("book:1-john hope").bookSlug).toBe("1-john");
    expect(parseOverlayPowerQuery("love also:WEB").alsoTranslationId).toBe("WEB");
    expect(parseOverlayPowerQuery("love also:niv").alsoTranslationId).toBe("yvp:111");
    expect(resolveAlsoTranslationId("kjv")).toBe("KJV");
    expect(resolveAlsoTranslationId("yvp:111")).toBe("yvp:111");
  });

  it("does not treat favorites without in: as a combinator or marks gate", () => {
    const parsed = parseOverlayPowerQuery("favorites");
    expect(parsed.keyword).toBe("favorites");
    expect(parsed.kind).toBeNull();
    expect(parsed.hasJournalCombinator).toBe(false);
    expect(parseOverlayMarksQuery("favorites").kind).toBeNull();
  });

  it("keeps in:highlights as marks and keyword remainder for Bible search", () => {
    const parsed = parseOverlayPowerQuery("in:highlights love");
    expect(parsed.kind).toBe("highlights");
    expect(parsed.keyword).toBe("love");
    expect(parsed.hasJournalCombinator).toBe(false);
  });
});

describe("topical index", () => {
  it("returns trinity refs that are not popular-keyword verses", () => {
    expect(keywordHasPopularVerses("trinity")).toBe(false);
    const refs = getTopicalVerseRefsForQuery("trinity");
    expect(refs.length).toBe(5);
    expect(refs[0]).toEqual({ slug: "matthew", chapter: 28, verse: 19 });
  });

  it("prepends topical trinity hits on KJV and still filters this-book scope", async () => {
    const whole = await getSearchResultsForTranslation("KJV", "trinity");
    expect(whole.results[0]).toMatchObject({
      bookSlug: "matthew",
      chapterNumber: 28,
      verseNumber: 19,
    });

    const scoped = await getSearchResultsForTranslation("KJV", "trinity", {
      bookScopeSlug: "genesis",
    });
    expect(scoped.results.length).toBeGreaterThan(0);
    expect(scoped.results.every((row) => row.bookSlug === "genesis")).toBe(true);
    expect(scoped.results.some((row) => row.chapterNumber === 1 && row.verseNumber === 26)).toBe(
      true,
    );
  });
});

describe("also-in snippets", () => {
  it("picks the first pinned translation that is not the reader translation", () => {
    expect(pickAlsoTranslationId("KJV", ["KJV", "yvp:111", "WEB"])).toBe("yvp:111");
    expect(pickAlsoTranslationId("yvp:111", ["KJV", "yvp:111"])).toBe("KJV");
  });

  it("attaches WEB wording for John 3:16 without a second keyword search", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "John 3:16");
    const attached = await attachAlsoTranslationSnippets(outcome.results, "WEB");
    const first = attached[0] as SearchResult;
    expect(first).toMatchObject({
      bookSlug: "john",
      chapterNumber: 3,
      verseNumber: 16,
      alsoTranslationLabel: "WEB",
    });
    expect(first.alsoVerseText?.length).toBeGreaterThan(10);
    expect(first.alsoTranslationLabel).toBe("WEB");
  });
});

describe("journal combinator AND", () => {
  it("requires both keyword and tag when combinator fields are set", () => {
    const taggedLove = journalEntry({
      id: "a",
      title: "Loved this",
      tags: ["gratitude"],
    });
    const loveOnly = journalEntry({
      id: "b",
      title: "Loved this",
      tags: ["prayer"],
    });
    const tagOnly = journalEntry({
      id: "c",
      title: "Quiet morning",
      tags: ["gratitude"],
    });
    const power = parseOverlayPowerQuery("love tag:gratitude");
    const combinator = overlayPowerToJournalCombinator(power);
    expect(combinator).toBeDefined();
    expect(journalEntryMatchesSearchQuery(taggedLove, power.keyword, { combinator })).toBe(true);
    expect(journalEntryMatchesSearchQuery(loveOnly, power.keyword, { combinator })).toBe(false);
    expect(journalEntryMatchesSearchQuery(tagOnly, power.keyword, { combinator })).toBe(false);
  });

  it("ranks overlay journal combinator hits without changing unmarked keyword matching", () => {
    const taggedLove = journalEntry({
      id: "a",
      title: "Loved this",
      tags: ["gratitude"],
      created_at: "2026-01-16T12:00:00.000Z",
    });
    const loveOnly = journalEntry({
      id: "b",
      title: "Loved this",
      tags: [],
      created_at: "2026-01-17T12:00:00.000Z",
    });
    const power = parseOverlayPowerQuery("love tag:gratitude");
    const ranked = rankLocalJournalEntriesForOverlay([loveOnly, taggedLove], power.keyword, {
      combinator: overlayPowerToJournalCombinator(power),
    });
    expect(ranked.map((row) => row.id)).toEqual(["a"]);

    expect(journalEntryMatchesSearchQuery(loveOnly, "love")).toBe(true);
  });
});
