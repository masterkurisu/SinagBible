import { describe, expect, it } from "vitest";
import { getTestament } from "@sinag-bible/core/bible-meta";
import { getSearchResultsForTranslation } from "@sinag-bible/core/bible-translations";

describe("overlay numeric Bible queries", () => {
  it("keeps John 3:16 as a book + digits reference", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "John 3:16");

    expect(outcome.results[0]).toMatchObject({
      bookSlug: "john",
      chapterNumber: 3,
      verseNumber: 16,
    });
  });

  it("keeps Psalm 23 as a book + digits chapter match", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "Psalm 23");

    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.results.every((r) => r.bookSlug === "psalms" && r.chapterNumber === 23)).toBe(
      true,
    );
  });

  it("collects bare 3:16 as chapter:verse across books, cap 20, with NT/OT mix and no text substring", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "3:16");

    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.results.length).toBeLessThanOrEqual(20);
    expect(
      outcome.results.every((r) => r.chapterNumber === 3 && r.verseNumber === 16),
    ).toBe(true);

    const testaments = outcome.results.map((r) => getTestament(r.bookSlug));
    expect(testaments).toContain("new");
    expect(testaments).toContain("old");
    expect(testaments[0]).toBe("new");
    expect(testaments[1]).toBe("old");
  });

  it("collects bare 23:1 as chapter:verse only", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "23:1");

    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.results.length).toBeLessThanOrEqual(20);
    expect(
      outcome.results.every((r) => r.chapterNumber === 23 && r.verseNumber === 1),
    ).toBe(true);
  });

  it("collects bare 1:1-3 as that chapter:verse range only, cap 20", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "1:1-3");

    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.results.length).toBeLessThanOrEqual(20);
    expect(
      outcome.results.every(
        (r) => r.chapterNumber === 1 && r.verseNumber >= 1 && r.verseNumber <= 3,
      ),
    ).toBe(true);
  });

  it("does not verse-text search digit-only 316", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "316");

    expect(outcome.results).toEqual([]);
    expect(outcome.bookSuggestion).toBeNull();
    expect(outcome.nearbyBooks).toEqual([]);
  });

  it("does not verse-text search short digit-only queries 23 and 16", async () => {
    const twentyThree = await getSearchResultsForTranslation("KJV", "23");
    const sixteen = await getSearchResultsForTranslation("KJV", "16");

    expect(twentyThree.results).toEqual([]);
    expect(sixteen.results).toEqual([]);
  });

  it("puts the last-read book first for bare 3:16 when that book has the verse", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "3:16", {
      lastReadBookSlug: "genesis",
    });

    expect(outcome.results[0]).toMatchObject({
      bookSlug: "genesis",
      chapterNumber: 3,
      verseNumber: 16,
    });
    expect(outcome.results.length).toBeLessThanOrEqual(20);
    expect(outcome.results.every((r) => r.chapterNumber === 3 && r.verseNumber === 16)).toBe(true);
  });

  it("offers a last-read Did-you-mean chip for 316 without auto-running the search", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "316", {
      lastReadBookSlug: "john",
    });

    expect(outcome.results).toEqual([]);
    expect(outcome.bookSuggestion).toMatchObject({
      bookSlug: "john",
      distance: 1,
      correctedQuery: "john 3:16",
    });
    expect(outcome.nearbyBooks).toHaveLength(1);
    expect(outcome.nearbyBooks[0]?.correctedQuery).toBe("john 3:16");
  });
});
