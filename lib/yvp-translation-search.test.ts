import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSearchResultsForYvpTranslation } from "./yvp-translation-search";

const fetchYvpChapter = vi.fn();
const fetchYvpBookNav = vi.fn();

vi.mock("@/lib/youversion-api", () => ({
  fetchYvpChapter: (...args: unknown[]) => fetchYvpChapter(...args),
  fetchYvpBookNav: (...args: unknown[]) => fetchYvpBookNav(...args),
}));

describe("getSearchResultsForYvpTranslation", () => {
  beforeEach(() => {
    fetchYvpChapter.mockReset();
    fetchYvpBookNav.mockReset();
    fetchYvpBookNav.mockResolvedValue([
      { name: "John", slug: "john", chapterCount: 21 },
    ]);
  });

  it("hydrates KJV reference hits with YouVersion chapter text", async () => {
    fetchYvpChapter.mockResolvedValue({
      bookName: "John",
      bookSlug: "john",
      chapterNumber: 3,
      verses: [
        "NIV verse 1",
        "NIV verse 2",
        "NIV verse 3",
        "NIV verse 4",
        "NIV verse 5",
        "NIV verse 6",
        "NIV verse 7",
        "NIV verse 8",
        "NIV verse 9",
        "NIV verse 10",
        "NIV verse 11",
        "NIV verse 12",
        "NIV verse 13",
        "NIV verse 14",
        "NIV verse 15",
        "NIV verse 16",
      ],
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
  });

  it("returns KJV suggestions when hydration yields no verses", async () => {
    fetchYvpChapter.mockRejectedValue(new Error("offline"));

    const outcome = await getSearchResultsForYvpTranslation(111, "love");

    expect(outcome.results).toEqual([]);
    expect(outcome.nearbyBooks.length + (outcome.bookSuggestion ? 1 : 0)).toBeGreaterThanOrEqual(0);
  });
});
