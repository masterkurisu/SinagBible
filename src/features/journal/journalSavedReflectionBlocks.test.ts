import { describe, expect, it } from "vitest";
import {
  JOURNAL_DETAIL_FLASH_LIST_MIN_BLOCKS,
  splitSavedReflectionHtml,
  shouldVirtualizeJournalReflection,
} from "./journalSavedReflectionBlocks";

describe("splitSavedReflectionHtml", () => {
  it("returns a fallback block when there are no wrapping tags", () => {
    expect(splitSavedReflectionHtml("Hello world")).toEqual([
      { key: "fallback", kind: "fallback", html: "Hello world" },
    ]);
  });

  it("splits paragraphs, headings, and lists", () => {
    const blocks = splitSavedReflectionHtml(
      "<h1>Title</h1><p>Hello</p><ul><li>one</li><li>two</li></ul>",
    );
    expect(blocks.map((b) => b.kind)).toEqual([
      "heading1",
      "paragraph",
      "list-item",
      "list-item",
    ]);
    expect(blocks[2]).toMatchObject({ kind: "list-item", marker: "\u2022 ", isLastInList: false });
    expect(blocks[3]).toMatchObject({ kind: "list-item", marker: "\u2022 ", isLastInList: true });
  });

  it("emits image then caption paragraph", () => {
    const blocks = splitSavedReflectionHtml(
      '<p><img src="file:///tmp/a.jpg" alt="" />caption</p>',
    );
    expect(blocks).toEqual([
      { key: "img-0", kind: "image", uri: "file:///tmp/a.jpg" },
      { key: "p-after-img-0", kind: "paragraph", html: "caption" },
    ]);
  });

  it("skips empty headings", () => {
    expect(splitSavedReflectionHtml("<h1>   </h1><p>Keep</p>")).toEqual([
      { key: "p-1", kind: "paragraph", html: "Keep" },
    ]);
  });
});

describe("shouldVirtualizeJournalReflection", () => {
  it("virtualizes at the block threshold", () => {
    expect(shouldVirtualizeJournalReflection(JOURNAL_DETAIL_FLASH_LIST_MIN_BLOCKS, 10)).toBe(true);
    expect(shouldVirtualizeJournalReflection(JOURNAL_DETAIL_FLASH_LIST_MIN_BLOCKS - 1, 10)).toBe(
      false,
    );
  });

  it("virtualizes long content even with few blocks", () => {
    expect(shouldVirtualizeJournalReflection(2, 4000)).toBe(true);
  });
});
