import { describe, expect, it } from "vitest";
import {
  getClosestBookSuggestionForTranslation,
  getClosestBookSuggestionsForTranslation,
  getSearchResultsForTranslation,
} from "@sinag-bible/core/bible-translations";

describe("overlay book-token fuzzy budget", () => {
  it("suggests John for the book-token typo jhon (distance 1)", async () => {
    const suggestion = await getClosestBookSuggestionForTranslation("KJV", "jhon");

    expect(suggestion).not.toBeNull();
    expect(suggestion?.bookName.toLowerCase()).toBe("john");
    expect(suggestion?.distance).toBe(1);
  });

  it("applies the distance budget to the book token in jhon 3:16, not the full string", async () => {
    const suggestion = await getClosestBookSuggestionForTranslation("KJV", "jhon 3:16");

    expect(suggestion).not.toBeNull();
    expect(suggestion?.bookName.toLowerCase()).toBe("john");
    expect(suggestion?.distance).toBe(1);
    expect(suggestion?.correctedQuery.toLowerCase()).toBe("john 3:16");
  });

  it("does not suggest Luke for love (distance 2 exceeds the book-token budget of 1)", async () => {
    const suggestions = await getClosestBookSuggestionsForTranslation("KJV", "love", {
      limit: 3,
    });

    expect(suggestions.some((s) => s.bookName.toLowerCase() === "luke")).toBe(false);
  });

  it("does not suggest Luke when love is the book token of a reference query", async () => {
    const suggestions = await getClosestBookSuggestionsForTranslation("KJV", "love 3:16", {
      limit: 3,
    });

    expect(suggestions.some((s) => s.bookName.toLowerCase() === "luke")).toBe(false);
  });

  it("treats mat as a prefix of Matthew at distance 0, so search does not show Did you mean", async () => {
    const suggestion = await getClosestBookSuggestionForTranslation("KJV", "mat");
    expect(suggestion?.bookName.toLowerCase()).toBe("matthew");
    expect(suggestion?.distance).toBe(0);

    const outcome = await getSearchResultsForTranslation("KJV", "mat");
    expect(outcome.bookSuggestion).toBeNull();
    expect(outcome.nearbyBooks).toEqual([]);
  });
});
