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
  rankLocalJournalEntriesForOverlay,
} from "@/lib/journal-local-search";

function entry(overrides: Partial<LocalJournalEntry> & Pick<LocalJournalEntry, "id">): LocalJournalEntry {
  return {
    book: "john",
    chapter: 3,
    verse_start: 16,
    verse_end: 16,
    bible_translation: "KJV",
    content: "<p>unrelated body</p>",
    created_at: "2026-01-01T00:00:00.000Z",
    title: "Unrelated",
    ...overrides,
  };
}

describe("rankLocalJournalEntriesForOverlay", () => {
  it("filters non-matches, then sorts by relevance with created_at desc as the tie-break", () => {
    const olderTitle = entry({
      id: "local-older-title",
      title: "grace notes",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const newerTitle = entry({
      id: "local-newer-title",
      title: "grace today",
      created_at: "2026-03-01T00:00:00.000Z",
    });
    const bodyHit = entry({
      id: "local-body",
      title: "other",
      content: "<p>talking about grace in the body</p>",
      created_at: "2026-06-01T00:00:00.000Z",
    });
    const unrelated = entry({
      id: "local-miss",
      title: "weather",
      content: "<p>it rained</p>",
    });

    const ranked = rankLocalJournalEntriesForOverlay(
      [bodyHit, olderTitle, unrelated, newerTitle],
      "grace",
    );

    expect(ranked.map((row) => row.id)).toEqual([
      "local-newer-title",
      "local-older-title",
      "local-body",
    ]);
  });

  it("keeps original order when score and created_at are equal (stable sort)", () => {
    const first = entry({
      id: "local-a",
      title: "same score",
      content: "<p>hope in the morning</p>",
      created_at: "2026-02-01T00:00:00.000Z",
    });
    const second = entry({
      id: "local-b",
      title: "also same",
      content: "<p>hope in the evening</p>",
      created_at: "2026-02-01T00:00:00.000Z",
    });

    const ranked = rankLocalJournalEntriesForOverlay([first, second], "hope");

    expect(ranked.map((row) => row.id)).toEqual(["local-a", "local-b"]);
  });

  it("returns an empty list for a blank query and does not mutate the input", () => {
    const rows = [
      entry({ id: "local-1", title: "faith" }),
      entry({ id: "local-2", title: "love" }),
    ];
    const snapshot = [...rows];

    expect(rankLocalJournalEntriesForOverlay(rows, "   ")).toEqual([]);
    expect(rows).toEqual(snapshot);
  });
});

describe("filterLocalJournalEntriesByQuery (journal page contract)", () => {
  it("still preserves cache order instead of ranking", () => {
    const bodyHit = entry({
      id: "local-body",
      title: "other",
      content: "<p>talking about grace in the body</p>",
      created_at: "2026-06-01T00:00:00.000Z",
    });
    const titleHit = entry({
      id: "local-title",
      title: "grace notes",
      created_at: "2026-01-01T00:00:00.000Z",
    });

    const filtered = filterLocalJournalEntriesByQuery([bodyHit, titleHit], "grace");

    expect(filtered.map((row) => row.id)).toEqual(["local-body", "local-title"]);
  });
});
