import { describe, expect, it } from "vitest";
import {
  JOURNAL_DETAIL_FLASH_LIST_MIN_BLOCKS,
  JOURNAL_REFLECTION_ESTIMATED_ITEM_SIZE_PX,
  estimatedReflectionItemSizePx,
  parseOwnedReflectionHtml,
  splitSavedReflectionHtml,
  shouldVirtualizeJournalReflection,
} from "./journalSavedReflectionBlocks";
import { REFLECTION_BLANK_STEP_PX } from "@/lib/journal-reflection-owned-html";

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

  it("keeps paragraphs whose only visible text is a verse-tag span", () => {
    expect(
      splitSavedReflectionHtml(
        '<p>See <span data-verse-ref="john:3:16">John 3:16</span>.</p>',
      ),
    ).toEqual([
      {
        key: "p-0",
        kind: "paragraph",
        html: 'See <span data-verse-ref="john:3:16">John 3:16</span>.',
      },
    ]);
  });

  it("skips empty headings", () => {
    expect(splitSavedReflectionHtml("<h1>   </h1><p>Keep</p>")).toEqual([
      { key: "p-1", kind: "paragraph", html: "Keep" },
    ]);
  });

  it("keeps interior blanks on a verse-only paragraph", () => {
    const blocks = parseOwnedReflectionHtml(
      '<p>Hello</p><p></p><p><span data-verse-ref="john:3:16">John 3:16</span></p>',
    );
    expect(blocks).toEqual([
      { key: "p-0", kind: "paragraph", html: "Hello" },
      {
        key: "p-2",
        kind: "paragraph",
        html: '<span data-verse-ref="john:3:16">John 3:16</span>',
        leadingBlankCount: 1,
      },
    ]);
  });

  it("restores pending blanks when a skipped heading sits between content", () => {
    const blocks = parseOwnedReflectionHtml("<p>Hello</p><p></p><h1>   </h1><p>Keep</p>");
    expect(blocks).toEqual([
      { key: "p-0", kind: "paragraph", html: "Hello" },
      { key: "p-3", kind: "paragraph", html: "Keep", leadingBlankCount: 1 },
    ]);
  });

  it("restores pending blanks when a verse-ref span has no inner text", () => {
    const blocks = parseOwnedReflectionHtml(
      '<p>Hello</p><p></p><p><span data-verse-ref="john:3:16"></span></p><p>Keep</p>',
    );
    expect(blocks).toEqual([
      { key: "p-0", kind: "paragraph", html: "Hello" },
      { key: "p-3", kind: "paragraph", html: "Keep", leadingBlankCount: 1 },
    ]);
  });
});

describe("parseOwnedReflectionHtml", () => {
  it("matches splitSavedReflectionHtml for non-empty HTML", () => {
    const html = "<h1>Title</h1><p>Hello</p>";
    expect(parseOwnedReflectionHtml(html)).toEqual(splitSavedReflectionHtml(html));
  });

  it("returns an empty array for empty HTML", () => {
    expect(parseOwnedReflectionHtml("")).toEqual([]);
    expect(splitSavedReflectionHtml("")).toEqual([]);
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

describe("estimatedReflectionItemSizePx", () => {
  it("adds leadingBlankCount * REFLECTION_BLANK_STEP_PX on top of the base estimate", () => {
    expect(estimatedReflectionItemSizePx({ key: "p-0", kind: "paragraph", html: "Hello" })).toBe(
      JOURNAL_REFLECTION_ESTIMATED_ITEM_SIZE_PX,
    );
    expect(
      estimatedReflectionItemSizePx({
        key: "p-1",
        kind: "paragraph",
        html: "World",
        leadingBlankCount: 2,
      }),
    ).toBe(JOURNAL_REFLECTION_ESTIMATED_ITEM_SIZE_PX + 2 * REFLECTION_BLANK_STEP_PX);
  });
});
