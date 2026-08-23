import { describe, expect, it } from "vitest";
import {
  buildReaderVerseFlashListData,
  findFlashListIndexForVerseNumber,
  readerVerseFlashListColumnProps,
  splitVerseIndexForBalancedColumns,
} from "./readerVerseFlashListData";

describe("readerVerseFlashListColumnProps", () => {
  it("uses independent-height masonry columns in tablet landscape", () => {
    expect(readerVerseFlashListColumnProps(true)).toEqual({
      numColumns: 2,
      masonry: true,
      optimizeItemArrangement: false,
    });
  });

  it("keeps a single linear column in portrait", () => {
    expect(readerVerseFlashListColumnProps(false)).toEqual({
      numColumns: 1,
      masonry: false,
      optimizeItemArrangement: false,
    });
  });
});

describe("buildReaderVerseFlashListData", () => {
  it("keeps verses in reading order for a single column", () => {
    const items = buildReaderVerseFlashListData(["a", "bb", "ccc"], false, 2);
    expect(items).toEqual([
      { kind: "verse", verseIndex: 0, verseText: "a", verseInlineContent: undefined },
      { kind: "verse", verseIndex: 1, verseText: "bb", verseInlineContent: undefined },
      { kind: "verse", verseIndex: 2, verseText: "ccc", verseInlineContent: undefined },
    ]);
  });

  it("interleaves left then right so sequential masonry keeps newspaper order", () => {
    const items = buildReaderVerseFlashListData(["v1", "v2", "v3", "v4", "v5"], true, 3);
    expect(items.map((item) => (item.kind === "verse" ? item.verseIndex : item.side))).toEqual([
      0,
      3,
      1,
      4,
      2,
      "right",
    ]);
  });

  it("pads the left column when the right column is longer", () => {
    const items = buildReaderVerseFlashListData(["v1", "v2", "v3", "v4", "v5"], true, 2);
    expect(items.map((item) => (item.kind === "verse" ? item.verseIndex : `${item.side}:${item.row}`))).toEqual([
      0,
      2,
      1,
      3,
      "left:2",
      4,
    ]);
  });
});

describe("findFlashListIndexForVerseNumber", () => {
  it("finds a right-column verse in the interleaved list", () => {
    const items = buildReaderVerseFlashListData(["v1", "v2", "v3", "v4"], true, 2);
    expect(findFlashListIndexForVerseNumber(items, 4)).toBe(3);
  });
});

describe("splitVerseIndexForBalancedColumns", () => {
  it("splits near half the total character length", () => {
    expect(splitVerseIndexForBalancedColumns(["aa", "bb", "cccc"])).toBe(2);
  });
});
