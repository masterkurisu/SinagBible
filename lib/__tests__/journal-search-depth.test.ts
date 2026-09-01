import { describe, expect, it, vi } from "vitest";
import type { LocalJournalEntry } from "@sinag-bible/types";

vi.mock("@/lib/translation-display-label", () => ({
  getTranslationDisplaySearchTokens: (translationId: string | null | undefined) => {
    const raw = translationId?.trim().toLowerCase() ?? "";
    return raw ? [raw] : [];
  },
}));

import {
  filterLocalJournalEntriesByQuery,
  journalEntryMatchesSearchQuery,
  parseJournalSearchDateRange,
  rankLocalJournalEntriesForOverlay,
} from "@/lib/journal-local-search";
import { normalizeJournalTag, normalizeJournalTags } from "@/lib/journal-tags";

function entry(overrides: Partial<LocalJournalEntry> & Pick<LocalJournalEntry, "id">): LocalJournalEntry {
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

describe("normalizeJournalTags", () => {
  it("trims, lowercases, dedupes, and caps length", () => {
    expect(normalizeJournalTags([" Gratitude ", "GRATITUDE", "forgiveness"])).toEqual([
      "gratitude",
      "forgiveness",
    ]);
  });

  it("does not treat verse-tag tokens or @mentions as category tags", () => {
    expect(normalizeJournalTag("[@john:3:16]")).toBeNull();
    expect(normalizeJournalTag("@john")).toBeNull();
    expect(normalizeJournalTags(["gratitude", "[@john:3:16]", "@mark"])).toEqual(["gratitude"]);
  });
});

describe("parseJournalSearchDateRange", () => {
  it("parses last week as a rolling 7 local days including today", () => {
    const range = parseJournalSearchDateRange("last week", NOW);
    expect(range).not.toBeNull();
    expect(range!.from.getFullYear()).toBe(2026);
    expect(range!.from.getMonth()).toBe(7);
    expect(range!.from.getDate()).toBe(21);
    expect(range!.to.getFullYear()).toBe(2026);
    expect(range!.to.getMonth()).toBe(7);
    expect(range!.to.getDate()).toBe(27);
  });

  it("parses an ISO month and a month-to-month range, not a full ISO date", () => {
    const january = parseJournalSearchDateRange("2026-01", NOW);
    expect(january!.from.getMonth()).toBe(0);
    expect(january!.from.getDate()).toBe(1);
    expect(january!.to.getMonth()).toBe(0);
    expect(january!.to.getDate()).toBe(31);

    const span = parseJournalSearchDateRange("2026-01 ... 2026-03", NOW);
    expect(span!.from.getMonth()).toBe(0);
    expect(span!.to.getMonth()).toBe(2);
    expect(span!.to.getDate()).toBe(31);

    expect(parseJournalSearchDateRange("2026-01-15", NOW)).toBeNull();
  });

  it("parses named day ranges and wraps the year when the end is before the start", () => {
    const january = parseJournalSearchDateRange("jan 1 - jan 7", NOW);
    expect(january!.from.getFullYear()).toBe(2026);
    expect(january!.from.getMonth()).toBe(0);
    expect(january!.from.getDate()).toBe(1);
    expect(january!.to.getDate()).toBe(7);

    const wrap = parseJournalSearchDateRange("dec 28 - jan 7", NOW);
    expect(wrap!.from.getFullYear()).toBe(2026);
    expect(wrap!.from.getMonth()).toBe(11);
    expect(wrap!.to.getFullYear()).toBe(2027);
    expect(wrap!.to.getMonth()).toBe(0);
    expect(wrap!.to.getDate()).toBe(7);
  });
});

describe("journal search depth", () => {
  it("matches a tag that is not in the title or body", () => {
    const tagged = entry({
      id: "local-tagged",
      title: "Quiet morning",
      content: "<p>a walk outside</p>",
      tags: ["gratitude"],
    });
    const miss = entry({
      id: "local-miss",
      title: "Quiet morning",
      content: "<p>a walk outside</p>",
    });

    expect(journalEntryMatchesSearchQuery(tagged, "gratitude")).toBe(true);
    expect(journalEntryMatchesSearchQuery(miss, "gratitude")).toBe(false);
    expect(rankLocalJournalEntriesForOverlay([miss, tagged], "gratitude").map((row) => row.id)).toEqual([
      "local-tagged",
    ]);
  });

  it("does not treat verse-tag HTML as a journal category tag", () => {
    const htmlOnly = entry({
      id: "local-html",
      content: '<p><span data-verse-tag="gratitude">tagged verse</span></p>',
    });
    expect(journalEntryMatchesSearchQuery(htmlOnly, "gratitude")).toBe(false);
  });

  it("matches last week, ISO month ranges, and named day ranges with an injected now", () => {
    const inWindow = entry({
      id: "local-in",
      created_at: new Date(2026, 7, 22, 9, 0, 0).toISOString(),
    });
    const tooOld = entry({
      id: "local-old",
      created_at: new Date(2026, 7, 19, 9, 0, 0).toISOString(),
    });
    const january = entry({
      id: "local-jan",
      created_at: "2026-01-20T12:00:00.000Z",
    });
    const april = entry({
      id: "local-apr",
      created_at: "2026-04-02T12:00:00.000Z",
    });
    const jan3 = entry({
      id: "local-jan3",
      created_at: new Date(2026, 0, 3, 12, 0, 0).toISOString(),
    });
    const jan20 = entry({
      id: "local-jan20",
      created_at: new Date(2026, 0, 20, 12, 0, 0).toISOString(),
    });
    const opts = { now: NOW };

    expect(journalEntryMatchesSearchQuery(inWindow, "last week", opts)).toBe(true);
    expect(journalEntryMatchesSearchQuery(tooOld, "last week", opts)).toBe(false);
    expect(journalEntryMatchesSearchQuery(january, "2026-01 ... 2026-03", opts)).toBe(true);
    expect(journalEntryMatchesSearchQuery(april, "2026-01 ... 2026-03", opts)).toBe(false);
    expect(journalEntryMatchesSearchQuery(jan3, "jan 1 - jan 7", opts)).toBe(true);
    expect(journalEntryMatchesSearchQuery(jan20, "jan 1 - jan 7", opts)).toBe(false);
  });

  it("treats an exact favorites query as a token, not a substring of other words", () => {
    const favorite = entry({ id: "local-fav", is_favorite: true, title: "Pinned" });
    const other = entry({
      id: "local-other",
      is_favorite: false,
      title: "My favorite verse",
      content: "<p>this is my favorite verse in John</p>",
    });

    expect(rankLocalJournalEntriesForOverlay([other, favorite], "favorites").map((row) => row.id)).toEqual([
      "local-fav",
    ]);
    expect(rankLocalJournalEntriesForOverlay([other, favorite], "favorite").map((row) => row.id)).toEqual([
      "local-fav",
    ]);
    expect(
      rankLocalJournalEntriesForOverlay([other, favorite], "my favorite verse").map((row) => row.id),
    ).toEqual(["local-other"]);
  });

  it("lets overlay favoritesOnly restrict keyword hits without changing cache order on the journal page", () => {
    const favoriteHit = entry({
      id: "local-fav-hit",
      is_favorite: true,
      title: "grace notes",
    });
    const otherHit = entry({
      id: "local-other-hit",
      is_favorite: false,
      title: "grace in the valley",
    });

    expect(
      rankLocalJournalEntriesForOverlay([otherHit, favoriteHit], "grace", { favoritesOnly: true }).map(
        (row) => row.id,
      ),
    ).toEqual(["local-fav-hit"]);
    expect(rankLocalJournalEntriesForOverlay([otherHit, favoriteHit], "grace").map((row) => row.id)).toEqual([
      "local-other-hit",
      "local-fav-hit",
    ]);
    expect(rankLocalJournalEntriesForOverlay([favoriteHit], "   ", { favoritesOnly: true })).toEqual([]);

    const filtered = filterLocalJournalEntriesByQuery([otherHit, favoriteHit], "grace");
    expect(filtered.map((row) => row.id)).toEqual(["local-other-hit", "local-fav-hit"]);
  });
});
