import { describe, expect, it } from "vitest";
import type { SearchResult } from "@sinag-bible/types";
import {
  filterSearchResultsByReaderMarks,
  parseOverlayMarksQuery,
  readerMarkMatchesFilter,
  readerMarksFromAnnotationChapters,
  readerMarksFromCarouselFavorites,
  readerMarksToSearchResults,
  resolveOverlayMarksFilter,
  type ReaderVerseMark,
} from "@/lib/reader-marks-search";

function mark(overrides: Partial<ReaderVerseMark> & Pick<ReaderVerseMark, "kind" | "verse">): ReaderVerseMark {
  return {
    bookSlug: "john",
    bookName: "John",
    chapter: 3,
    translationId: "KJV",
    ...overrides,
  };
}

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    bookName: "John",
    bookSlug: "john",
    chapterNumber: 3,
    verseNumber: 16,
    verseText: "For God so loved the world",
    ...overrides,
  };
}

describe("parseOverlayMarksQuery", () => {
  it("leaves ordinary keywords untouched so Bible search does not shrink", () => {
    expect(parseOverlayMarksQuery("love")).toEqual({
      remainder: "love",
      kind: null,
      color: null,
    });
    expect(parseOverlayMarksQuery("favorites")).toEqual({
      remainder: "favorites",
      kind: null,
      color: null,
    });
  });

  it("parses in: tokens and color tokens, including color implying highlights", () => {
    expect(parseOverlayMarksQuery("in:highlights")).toMatchObject({
      remainder: "",
      kind: "highlights",
    });
    expect(parseOverlayMarksQuery("in:highlight love")).toEqual({
      remainder: "love",
      kind: "highlights",
      color: null,
    });
    expect(parseOverlayMarksQuery("in:underlines")).toMatchObject({ kind: "underlines", remainder: "" });
    expect(parseOverlayMarksQuery("in:favorites")).toMatchObject({ kind: "favorites", remainder: "" });
    expect(parseOverlayMarksQuery("in:marks faith")).toEqual({
      remainder: "faith",
      kind: "marks",
      color: null,
    });
    expect(parseOverlayMarksQuery("color:yellow")).toEqual({
      remainder: "",
      kind: "highlights",
      color: "yellow",
    });
    expect(parseOverlayMarksQuery("in:highlights color:blue love")).toEqual({
      remainder: "love",
      kind: "highlights",
      color: "blue",
    });
  });
});

describe("resolveOverlayMarksFilter", () => {
  it("lets typed tokens win over chips, and chips apply when the query has no gate", () => {
    expect(
      resolveOverlayMarksFilter(
        { remainder: "love", kind: "underlines", color: null },
        "highlights",
        "yellow",
      ),
    ).toEqual({ kind: "underlines", color: "yellow" });
    expect(
      resolveOverlayMarksFilter({ remainder: "love", kind: null, color: null }, "highlights", null),
    ).toEqual({ kind: "highlights", color: null });
  });
});

describe("reader marks filter", () => {
  const highlighted = mark({
    kind: "highlight",
    verse: 16,
    colorId: "yellow",
  });
  const underlined = mark({
    kind: "underline",
    verse: 17,
    colorId: "navy",
  });
  const saved = mark({
    kind: "favorite",
    verse: 18,
    verseText: "saved text",
  });

  it("keeps keyword hits that are marked and leaves unmarked keyword search alone", () => {
    const love16 = result({ verseNumber: 16 });
    const love17 = result({ verseNumber: 17, verseText: "For God sent not his Son" });
    const unmarked = result({
      bookSlug: "romans",
      bookName: "Romans",
      chapterNumber: 8,
      verseNumber: 28,
    });

    expect(
      filterSearchResultsByReaderMarks([love16, love17, unmarked], [highlighted, underlined, saved], {
        kind: null,
        color: null,
      }),
    ).toHaveLength(3);

    const highlightedOnly = filterSearchResultsByReaderMarks(
      [love16, love17, unmarked],
      [highlighted, underlined, saved],
      { kind: "highlights", color: null },
    );
    expect(highlightedOnly.map((row) => row.verseNumber)).toEqual([16]);
    expect(highlightedOnly[0]?.markKind).toBe("highlight");
    expect(highlightedOnly[0]?.markColorId).toBe("yellow");
  });

  it("filters by color and by saved verses, and respects this-book scope", () => {
    expect(readerMarkMatchesFilter(highlighted, { kind: "highlights", color: "blue" })).toBe(false);
    expect(readerMarkMatchesFilter(highlighted, { kind: "highlights", color: "yellow" })).toBe(true);
    expect(readerMarkMatchesFilter(saved, { kind: "favorites", color: null })).toBe(true);
    expect(readerMarkMatchesFilter(saved, { kind: "favorites", color: "yellow" })).toBe(false);
    expect(
      readerMarkMatchesFilter(highlighted, {
        kind: "highlights",
        color: null,
        bookScopeSlug: "genesis",
      }),
    ).toBe(false);
    expect(
      readerMarkMatchesFilter(highlighted, {
        kind: "marks",
        color: null,
        bookScopeSlug: "john",
      }),
    ).toBe(true);
  });

  it("builds marks from annotation maps and carousel ranges", () => {
    const fromNotes = readerMarksFromAnnotationChapters([
      {
        bookSlug: "john",
        chapter: 3,
        translationId: "KJV",
        annotations: {
          16: { style: "highlight", colorId: "yellow" },
        },
      },
    ]);
    expect(fromNotes).toMatchObject([{ kind: "highlight", verse: 16, colorId: "yellow" }]);

    const fromSaved = readerMarksFromCarouselFavorites([
      {
        bookSlug: "psalms",
        bookName: "Psalms",
        chapter: 23,
        verseStart: 1,
        verseEnd: 2,
        text: "The Lord is my shepherd",
        translationId: "KJV",
      },
    ]);
    expect(fromSaved.map((row) => row.verse)).toEqual([1, 2]);
    expect(fromSaved[0]?.kind).toBe("favorite");
    expect(fromSaved[0]?.verseText).toBe("The Lord is my shepherd");
  });

  it("lists filtered marks as search rows without shrinking ordinary results when unused", async () => {
    const listed = await readerMarksToSearchResults(
      [highlighted, underlined, saved],
      { kind: "favorites", color: null },
    );
    expect(listed).toEqual([
      {
        bookName: "John",
        bookSlug: "john",
        chapterNumber: 3,
        verseNumber: 18,
        verseText: "saved text",
        markKind: "favorite",
      },
    ]);
  });
});
