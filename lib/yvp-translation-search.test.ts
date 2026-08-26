import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSearchResultsForYvpTranslation } from "./yvp-translation-search";
import { mergeYvpChapterTokens, resetYvpKeywordIndexForTests } from "./yvp-keyword-index";

const fetchYvpChapter = vi.fn();
const fetchYvpBookNav = vi.fn();
const getChapterSync = vi.fn();

vi.mock("@/lib/youversion-api", () => ({
  fetchYvpChapter: (...args: unknown[]) => fetchYvpChapter(...args),
  fetchYvpBookNav: (...args: unknown[]) => fetchYvpBookNav(...args),
}));

vi.mock("@/lib/chapter-store", () => ({
  getChapterSync: (...args: unknown[]) => getChapterSync(...args),
}));

describe("getSearchResultsForYvpTranslation", () => {
  beforeEach(() => {
    fetchYvpChapter.mockReset();
    fetchYvpBookNav.mockReset();
    getChapterSync.mockReset();
    getChapterSync.mockImplementation(() => {
      throw new Error("Chapter DB not open");
    });
    fetchYvpBookNav.mockResolvedValue([{ name: "John", slug: "john", chapterCount: 21 }]);
  });

  afterEach(() => {
    resetYvpKeywordIndexForTests();
  });

  it("hydrates KJV reference hits with YouVersion chapter text", async () => {
    fetchYvpChapter.mockResolvedValue({
      bookName: "John",
      bookSlug: "john",
      chapterNumber: 3,
      verses: Array.from({ length: 16 }, (_, i) => `NIV verse ${i + 1}`),
    });

    const outcome = await getSearchResultsForYvpTranslation(111, "john 3:16");

    expect(fetchYvpChapter).toHaveBeenCalledWith(111, "john", 3);
    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.results[0]).toMatchObject({
      bookSlug: "john",
      chapterNumber: 3,
      verseNumber: 16,
      verseText: "NIV verse 16",
    });
    expect(outcome.failedHydrationCount).toBe(0);
  });

  it("returns KJV suggestions when hydration yields no verses", async () => {
    fetchYvpChapter.mockRejectedValue(new Error("offline"));

    const outcome = await getSearchResultsForYvpTranslation(111, "love");

    expect(outcome.results).toEqual([]);
    expect(outcome.nearbyBooks.length + (outcome.bookSuggestion ? 1 : 0)).toBeGreaterThanOrEqual(0);
  });

  it("does not start chapter fetches when the overlay signal is already aborted", async () => {
    const controller = new AbortController();
    fetchYvpBookNav.mockImplementation(async () => {
      controller.abort();
      return [{ name: "John", slug: "john", chapterCount: 21 }];
    });

    const outcome = await getSearchResultsForYvpTranslation(111, "john 3:16", {
      signal: controller.signal,
    });

    expect(fetchYvpChapter).not.toHaveBeenCalled();
    expect(outcome.results).toEqual([]);
    expect(outcome.failedHydrationCount).toBe(0);
  });

  it("counts only initiated chapter fetches that failed", async () => {
    fetchYvpChapter.mockRejectedValue(new Error("offline"));

    const outcome = await getSearchResultsForYvpTranslation(111, "john 3:16");

    expect(outcome.results).toEqual([]);
    expect(outcome.failedHydrationCount).toBe(1);
  });

  it("does not count cancelled leftovers as failed hydrations", async () => {
    let release!: () => void;
    const gate = new Promise<never>((_resolve, reject) => {
      release = () => reject(new Error("offline"));
    });
    fetchYvpChapter.mockImplementation(() => gate);

    const controller = new AbortController();
    const pending = getSearchResultsForYvpTranslation(111, "john 3:16", {
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(fetchYvpChapter).toHaveBeenCalled());
    controller.abort();
    release();

    const outcome = await pending;
    expect(outcome.results).toEqual([]);
    expect(outcome.failedHydrationCount).toBe(0);
  });

  it("uses native postings instead of hydrating when coverage is enough", async () => {
    mergeYvpChapterTokens("yvp:111", "philippians", 4, [
      "Do not be anxious about anything, but in every situation, by prayer and petition, present your requests to God.",
    ]);
    getChapterSync.mockReturnValue({
      translationId: "yvp:111",
      bookSlug: "philippians",
      chapterNumber: 4,
      source: "yvp",
      payload: {
        id: "PHL.4",
        reference: "Philippians 4",
        content:
          '<span class="yv-vlbl">1</span>Do not be anxious about anything, but in every situation, by prayer and petition, present your requests to God.',
      },
    });

    const outcome = await getSearchResultsForYvpTranslation(111, "anxious");

    expect(fetchYvpChapter).not.toHaveBeenCalled();
    expect(
      outcome.results.some(
        (row) => row.bookSlug === "philippians" && /anxious/i.test(row.verseText),
      ),
    ).toBe(true);
    expect(outcome.failedHydrationCount).toBe(0);
  });
});
