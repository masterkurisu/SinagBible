import { describe, expect, it } from "vitest";
import { getSearchResultsForTranslation } from "@sinag-bible/core/bible-translations";
import { findSnippetHighlightRange } from "@/src/features/search/searchVerseSnippet";

describe("overlay this-book scope", () => {
  it("keeps keyword love hits inside the scoped book", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "love", {
      bookScopeSlug: "john",
    });

    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.results.length).toBeLessThanOrEqual(20);
    expect(outcome.results.every((row) => row.bookSlug === "john")).toBe(true);
    expect(outcome.results.some((row) => row.chapterNumber === 15 && row.verseNumber === 13)).toBe(
      true,
    );
  });

  it("still returns John 3:16 when this-book scope is another book", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "John 3:16", {
      bookScopeSlug: "genesis",
    });

    expect(outcome.results[0]).toMatchObject({
      bookSlug: "john",
      chapterNumber: 3,
      verseNumber: 16,
    });
  });

  it("still returns a named passage when this-book scope is another book", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "lord's prayer", {
      bookScopeSlug: "genesis",
    });

    expect(outcome.results[0]).toMatchObject({
      bookSlug: "matthew",
      chapterNumber: 6,
      verseNumber: 9,
    });
  });

  it("limits bare 3:16 to the scoped book", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "3:16", {
      bookScopeSlug: "genesis",
    });

    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.results.every((row) => row.bookSlug === "genesis")).toBe(true);
    expect(outcome.results.every((row) => row.chapterNumber === 3 && row.verseNumber === 16)).toBe(
      true,
    );
  });

  it("does not apply this-book scope when bookScopeSlug is omitted", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "love");
    const books = new Set(outcome.results.map((row) => row.bookSlug));
    expect(books.size).toBeGreaterThan(1);
  });
});

describe("overlay verse preview", () => {
  it("attaches the next verse as neighbor context", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "John 3:16");
    const hit = outcome.results[0];
    expect(hit?.neighborVerseText).toBeTruthy();
    expect(hit?.neighborVerseText).not.toBe(hit?.verseText);
  });

  it("highlights a keyword span and skips digit-only reference tokens", () => {
    expect(findSnippetHighlightRange("For God so loved the world", "love")).toEqual({
      start: 11,
      end: 16,
    });
    expect(findSnippetHighlightRange("For God so loved the world", "John 3:16")).toBeNull();
  });
});
