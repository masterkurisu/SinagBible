import { describe, expect, it } from "vitest";
import { formatJournalTagLabel } from "@/lib/journal-tags";
import { JOURNAL_TAG_CHIP_LONG_PRESS_MS } from "@/src/features/journal/useChipLongPress";
import {
  canAcceptSuggestionAdd,
  canCommitTagDraft,
  isRenameDraftError,
  isTagDraftAddError,
  MAX_TAGS_PER_ENTRY,
  shouldUseEditableCatalogChip,
} from "./journalTagSectionLogic";

describe("formatJournalTagLabel", () => {
  it("title-cases each word", () => {
    expect(formatJournalTagLabel("my tag")).toBe("My Tag");
    expect(formatJournalTagLabel("gratitude")).toBe("Gratitude");
  });
});

describe("useChipLongPress", () => {
  it("uses a ~400ms long-press delay", () => {
    expect(JOURNAL_TAG_CHIP_LONG_PRESS_MS).toBe(400);
  });
});

describe("shouldUseEditableCatalogChip", () => {
  it("uses editable chip for selected catalog tags so long-press can open actions", () => {
    expect(shouldUseEditableCatalogChip("faith", ["faith"], null)).toBe(true);
    expect(shouldUseEditableCatalogChip("faith", [], "faith")).toBe(true);
    expect(shouldUseEditableCatalogChip("faith", [], null)).toBe(false);
  });
});

describe("canCommitTagDraft", () => {
  it("rejects duplicate adds", () => {
    expect(canCommitTagDraft(["faith"], "faith")).toBe(false);
    expect(canCommitTagDraft(["faith"], "Faith")).toBe(false);
  });

  it("rejects when the entry is already at the tag cap", () => {
    const fullTags = ["a", "b", "c", "d", "e", "f", "g", "h"];
    expect(fullTags).toHaveLength(MAX_TAGS_PER_ENTRY);
    expect(canCommitTagDraft(fullTags, "new")).toBe(false);
  });

  it("accepts a valid new tag", () => {
    expect(canCommitTagDraft(["faith"], "hope")).toBe(true);
  });
});

describe("canAcceptSuggestionAdd", () => {
  it("rejects an 8th suggestion add", () => {
    const fullTags = ["a", "b", "c", "d", "e", "f", "g", "h"];
    expect(canAcceptSuggestionAdd(fullTags, "hope")).toBe(false);
  });

  it("allows removing a selected suggestion", () => {
    expect(canAcceptSuggestionAdd(["faith"], "faith")).toBe(true);
  });
});

describe("isTagDraftAddError", () => {
  it("flags duplicate draft commits", () => {
    expect(isTagDraftAddError(true, "faith", ["faith"])).toBe(true);
  });
});

describe("isRenameDraftError", () => {
  it("flags rename collisions", () => {
    expect(isRenameDraftError("faith", "hope", ["faith", "hope"])).toBe(true);
  });

  it("does not flag the unchanged rename draft", () => {
    expect(isRenameDraftError("faith", "Faith", ["faith", "hope"])).toBe(false);
  });
});
