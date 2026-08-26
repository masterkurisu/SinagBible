import { describe, expect, it } from "vitest";
import { expandSearchQuerySynonyms, shouldExpandEnglishSearchSynonyms } from "@/lib/search-query-synonyms";
import { getSearchResultsForReaderTranslation } from "@/lib/bible-search-service";

describe("expandSearchQuerySynonyms", () => {
  it("maps anxious to the anxiety cluster and searches the canonical key first", () => {
    expect(expandSearchQuerySynonyms("anxious")).toEqual({
      canonical: "anxiety",
      searchQueries: ["anxiety", "anxious"],
    });
  });

  it("does not expand digit queries or unknown tokens", () => {
    expect(expandSearchQuerySynonyms("John 3:16").canonical).toBeNull();
    expect(expandSearchQuerySynonyms("316").searchQueries).toEqual(["316"]);
    expect(expandSearchQuerySynonyms("selah").searchQueries).toEqual(["selah"]);
  });

  it("skips English synonym expansion for Tagalog and Cebuano ids", () => {
    expect(shouldExpandEnglishSearchSynonyms("KJV")).toBe(true);
    expect(shouldExpandEnglishSearchSynonyms("WEB")).toBe(true);
    expect(shouldExpandEnglishSearchSynonyms("yvp:111")).toBe(true);
    expect(shouldExpandEnglishSearchSynonyms("ADB1905")).toBe(false);
    expect(shouldExpandEnglishSearchSynonyms("tgl_ulb")).toBe(false);
    expect(shouldExpandEnglishSearchSynonyms("ceb_ulb")).toBe(false);
  });
});

describe("synonym overlay search", () => {
  it("surfaces anxiety popular verses when the user types anxious", async () => {
    const outcome = await getSearchResultsForReaderTranslation("KJV", "anxious");

    expect(
      outcome.results.some(
        (row) => row.bookSlug === "philippians" && row.chapterNumber === 4 && row.verseNumber === 6,
      ),
    ).toBe(true);
  });
});
