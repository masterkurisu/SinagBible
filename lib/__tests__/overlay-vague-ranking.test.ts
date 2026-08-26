import { describe, expect, it } from "vitest";
import { getTestament } from "@sinag-bible/core/bible-meta";
import { getSearchResultsForTranslation } from "@sinag-bible/core/bible-translations";

function hitsPerBook(results: { bookSlug: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of results) {
    counts.set(row.bookSlug, (counts.get(row.bookSlug) ?? 0) + 1);
  }
  return counts;
}

describe("vague search score-then-cap", () => {
  it("keeps curated love verses first, then caps at 20 with at most 3 hits per book", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "love");

    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.results.length).toBeLessThanOrEqual(20);
    expect(Math.max(0, ...hitsPerBook(outcome.results).values())).toBeLessThanOrEqual(3);

    expect(outcome.results.slice(0, 5).map((r) => `${r.bookSlug}:${r.chapterNumber}:${r.verseNumber}`)).toEqual(
      [
        "leviticus:19:18",
        "deuteronomy:6:5",
        "matthew:22:37",
        "john:15:13",
        "1-john:4:8",
      ],
    );

    expect(outcome.results.every((r) => !("score" in r) && !("bookIndex" in r))).toBe(true);
  });

  it("does not drop extra same-book love hits just to force an NT/OT mix", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "love");
    const johnHits = outcome.results.filter((r) => r.bookSlug === "john");

    expect(johnHits.length).toBeGreaterThanOrEqual(1);
    expect(johnHits.length).toBeLessThanOrEqual(3);
    expect(johnHits[0]).toMatchObject({ chapterNumber: 15, verseNumber: 13 });
  });

  it("stops at book openers for a clear title query", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "matthew");

    expect(outcome.results[0]).toMatchObject({
      bookSlug: "matthew",
      chapterNumber: 1,
      verseNumber: 1,
    });
    expect(outcome.results.length).toBeLessThanOrEqual(2);
  });

  it("caps non-curated keyword hits at 1 per book and 20 total, mixing NT/OT on score ties", async () => {
    const outcome = await getSearchResultsForTranslation("KJV", "covenant");

    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.results.length).toBeLessThanOrEqual(20);
    expect(Math.max(0, ...hitsPerBook(outcome.results).values())).toBe(1);

    const testaments = outcome.results.map((r) => getTestament(r.bookSlug));
    expect(testaments).toContain("new");
    expect(testaments).toContain("old");
    expect(testaments[0]).toBe("new");
    expect(testaments[1]).toBe("old");
  });
});
