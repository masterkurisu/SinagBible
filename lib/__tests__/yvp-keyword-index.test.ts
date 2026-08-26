import { afterEach, describe, expect, it } from "vitest";
import {
  clearYvpKeywordIndex,
  lookupYvpKeywordPostings,
  lookupYvpKeywordPostingsForQuery,
  mergeYvpChapterTokens,
  resetYvpKeywordIndexForTests,
  yvpIndexHasCoverage,
  yvpIndexedChapterCount,
} from "@/lib/yvp-keyword-index";

afterEach(() => {
  resetYvpKeywordIndexForTests();
});

describe("yvp keyword index", () => {
  it("indexes verse tokens and reports coverage for those tokens", () => {
    mergeYvpChapterTokens("yvp:111", "philippians", 4, [
      "Do not be anxious about anything, but in every situation, by prayer and petition, present your requests to God.",
    ]);

    expect(yvpIndexHasCoverage("yvp:111", "anxious")).toBe(true);
    expect(yvpIndexHasCoverage("yvp:111", "love")).toBe(false);
    expect(lookupYvpKeywordPostings("yvp:111", "anxious")).toEqual([
      { bookSlug: "philippians", chapterNumber: 4, verseNumber: 1 },
    ]);
  });

  it("prefix-matches when the exact token is missing", () => {
    mergeYvpChapterTokens("yvp:111", "john", 15, ["This is my commandment, that ye love one another."]);

    expect(lookupYvpKeywordPostingsForQuery("yvp:111", "comma").length).toBeGreaterThan(0);
  });

  it("evicts the oldest chapter from memory after 60 per translation", () => {
    for (let chapter = 1; chapter <= 61; chapter++) {
      mergeYvpChapterTokens("yvp:111", "psalms", chapter, [`chapter${"a".repeat(chapter)} in this psalm`]);
    }

    expect(yvpIndexedChapterCount("yvp:111")).toBe(60);
    expect(lookupYvpKeywordPostings("yvp:111", `chapter${"a".repeat(1)}`)).toEqual([]);
    expect(lookupYvpKeywordPostings("yvp:111", `chapter${"a".repeat(61)}`).length).toBe(1);
  });

  it("clearYvpKeywordIndex drops one translation", () => {
    mergeYvpChapterTokens("yvp:111", "john", 3, ["For God so loved the world"]);
    mergeYvpChapterTokens("yvp:116", "juan", 3, ["loved"]);
    clearYvpKeywordIndex("yvp:111");
    expect(lookupYvpKeywordPostings("yvp:111", "loved")).toEqual([]);
    expect(lookupYvpKeywordPostings("yvp:116", "loved").length).toBe(1);
  });
});
