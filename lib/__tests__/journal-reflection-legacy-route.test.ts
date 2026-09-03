import { describe, expect, it } from "vitest";
import {
  censusJournalReflectionRows,
  isNullOrEmptyMarkdown,
} from "@/lib/journal-reflection-census";
import {
  htmlHasNestedList,
  normalizeReflectionMarkdownForCompare,
  reflectionHtmlNeedsLegacyEditor,
  shouldMountLegacyReflectionEditor,
} from "@/lib/journal-reflection-legacy-route";

describe("htmlHasNestedList", () => {
  it("returns false for sibling lists", () => {
    expect(htmlHasNestedList("<ul><li>one</li></ul><ol><li>two</li></ol>")).toBe(false);
  });

  it("returns true for a list inside a list item", () => {
    expect(htmlHasNestedList("<ul><li>outer<ul><li>inner</li></ul></li></ul>")).toBe(true);
  });

  it("returns true for mixed nested lists", () => {
    expect(htmlHasNestedList("<ul><li>alpha<ol><li>beta</li></ol></li></ul>")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(htmlHasNestedList("<UL><LI>outer<UL><LI>inner</LI></UL></LI></UL>")).toBe(true);
  });
});

describe("reflectionHtmlNeedsLegacyEditor", () => {
  it("routes nested lists to legacy and leaves flat HTML alone", () => {
    expect(reflectionHtmlNeedsLegacyEditor("<p>Hello</p>")).toBe(false);
    expect(reflectionHtmlNeedsLegacyEditor("<ul><li>one</li><li>two</li></ul>")).toBe(false);
    expect(reflectionHtmlNeedsLegacyEditor("<ul><li>outer<ul><li>inner</li></ul></li></ul>")).toBe(
      true,
    );
  });

  it("ORs screen readers into the same legacy path", () => {
    expect(
      shouldMountLegacyReflectionEditor({
        html: "<p>Hello</p>",
        screenReaderEnabled: false,
      }),
    ).toBe(false);
    expect(
      shouldMountLegacyReflectionEditor({
        html: "<p>Hello</p>",
        screenReaderEnabled: true,
      }),
    ).toBe(true);
  });
});

describe("normalizeReflectionMarkdownForCompare", () => {
  it("applies NFC, newline unification, per-line trim, and blank-run collapse", () => {
    const cafe = "cafe\u0301";
    expect(normalizeReflectionMarkdownForCompare(`${cafe}  \r\n\r\n\r\nnext  `)).toBe("café\n\nnext");
  });

  it("collapses quote-only leftover lines with empty-line runs", () => {
    expect(normalizeReflectionMarkdownForCompare("a\n>\n\n>\n\nb")).toBe("a\n\nb");
  });

  it("does not flatten lists or rewrite verse tokens", () => {
    const src = "- one\n- two\n\nSee [@john:3:16] today.";
    expect(normalizeReflectionMarkdownForCompare(src)).toBe(src);
  });
});

describe("censusJournalReflectionRows", () => {
  it("counts null/empty markdown and nested-list HTML", () => {
    const census = censusJournalReflectionRows([
      { id: "a", content: "<p>hi</p>", content_markdown: "hi" },
      { id: "b", content: "<p>old</p>", content_markdown: null },
      { id: "c", content: "<p></p>", content_markdown: "   " },
      {
        id: "d",
        content: "<ul><li>outer<ul><li>inner</li></ul></li></ul>",
        content_markdown: "- outer",
      },
    ]);
    expect(census.totalRows).toBe(4);
    expect(census.nullOrEmptyMarkdown).toBe(2);
    expect(census.nestedListHtml).toBe(1);
    expect(isNullOrEmptyMarkdown(null)).toBe(true);
  });

  it("reports extra HTML nasties without treating them as nested-list rows", () => {
    const census = censusJournalReflectionRows([
      { id: "table", content: "<table><tr><td>x</td></tr></table>", content_markdown: "x" },
    ]);
    expect(census.nestedListHtml).toBe(0);
    expect(census.otherNasties).toEqual([{ id: "table", tags: ["table"] }]);
    expect(reflectionHtmlNeedsLegacyEditor("<table><tr><td>x</td></tr></table>")).toBe(false);
  });
});
