import { describe, expect, it } from "vitest";
import { parseReflectionLiveMarkdown } from "@/lib/journal-reflection-live-markdown-parser";
import {
  REFLECTION_LIVE_BODY_FONT_FAMILY,
  REFLECTION_LIVE_BODY_FONT_SIZE,
  REFLECTION_LIVE_BODY_LINE_HEIGHT,
  REFLECTION_LIVE_H1_FONT_SIZE,
  createReflectionLiveMarkdownInputStyle,
  createReflectionLiveMarkdownStyle,
} from "@/lib/journal-reflection-live-markdown-style";

function byType(input: string, type: string) {
  return parseReflectionLiveMarkdown(input).filter((r) => r.type === type);
}

describe("createReflectionLiveMarkdownStyle", () => {
  const colors = { gold: "#c9a96e", tan100: "#B5A993", brown800: "#2c2416" };

  it("maps links to gold and syntax markers to muted tan", () => {
    const style = createReflectionLiveMarkdownStyle(colors);
    expect(style.link?.color).toBe("#c9a96e");
    expect(style.syntax?.color).toBe("#B5A993");
  });

  it("uses the formatted-preview heading1 size for h1", () => {
    const style = createReflectionLiveMarkdownStyle(colors);
    expect(style.h1?.fontSize).toBe(REFLECTION_LIVE_H1_FONT_SIZE);
    expect(style.h1?.fontSize).toBe(26);
  });

  it("sets body input to Lora at the reflection field size", () => {
    const inputStyle = createReflectionLiveMarkdownInputStyle(colors.brown800);
    expect(inputStyle.fontFamily).toBe(REFLECTION_LIVE_BODY_FONT_FAMILY);
    expect(inputStyle.fontSize).toBe(REFLECTION_LIVE_BODY_FONT_SIZE);
    expect(inputStyle.lineHeight).toBe(REFLECTION_LIVE_BODY_LINE_HEIGHT);
    expect(inputStyle.color).toBe(colors.brown800);
  });
});

describe("parseReflectionLiveMarkdown", () => {
  it("returns nothing for empty input", () => {
    expect(parseReflectionLiveMarkdown("")).toEqual([]);
  });

  it("marks GitHub **bold** (not ExpensiMark *bold*)", () => {
    const input = "Hello **world**";
    expect(byType(input, "bold")).toEqual([{ type: "bold", start: 8, length: 5 }]);
    expect(byType(input, "syntax")).toEqual([
      { type: "syntax", start: 6, length: 2 },
      { type: "syntax", start: 13, length: 2 },
    ]);
    expect(parseReflectionLiveMarkdown("*not bold*")).toEqual([]);
  });

  it("marks _italic_", () => {
    const input = "say _hi_";
    expect(byType(input, "italic")).toEqual([{ type: "italic", start: 5, length: 2 }]);
  });

  it("marks # headings as h1 and dims the hash prefix", () => {
    const input = "# Title";
    expect(byType(input, "syntax")).toEqual([{ type: "syntax", start: 0, length: 2 }]);
    expect(byType(input, "h1")).toEqual([{ type: "h1", start: 2, length: 5 }]);
  });

  it("approximates ## headings as bold (no h2 MarkdownType)", () => {
    const input = "## Sub";
    expect(byType(input, "syntax")).toEqual([{ type: "syntax", start: 0, length: 3 }]);
    expect(byType(input, "bold")).toEqual([{ type: "bold", start: 3, length: 3 }]);
    expect(byType(input, "h1")).toEqual([]);
  });

  it("dims list, ordered, and checklist prefixes as syntax", () => {
    expect(byType("- item", "syntax")).toEqual([{ type: "syntax", start: 0, length: 2 }]);
    expect(byType("1. item", "syntax")).toEqual([{ type: "syntax", start: 0, length: 3 }]);
    expect(byType("- [ ] todo", "syntax")).toEqual([{ type: "syntax", start: 0, length: 6 }]);
    expect(byType("- [x] done", "syntax")).toEqual([{ type: "syntax", start: 0, length: 6 }]);
  });

  it("styles link labels and dims markdown punctuation", () => {
    const input = "see [here](https://example.com)";
    expect(byType(input, "link")).toEqual([{ type: "link", start: 5, length: 4 }]);
    expect(byType(input, "syntax")).toEqual([
      { type: "syntax", start: 4, length: 1 },
      { type: "syntax", start: 9, length: 22 },
    ]);
  });

  it("dims [image:id] tokens as syntax (no inline-image widget)", () => {
    const input = "[image:abc]";
    expect(parseReflectionLiveMarkdown(input)).toEqual([
      { type: "syntax", start: 0, length: 11 },
    ]);
  });

  it("styles closed verse-tag tokens without treating them as markdown links", () => {
    const input = "[@john:3:16]";
    expect(byType(input, "syntax")).toEqual([
      { type: "syntax", start: 0, length: 2 },
      { type: "syntax", start: 11, length: 1 },
    ]);
    expect(byType(input, "link")).toEqual([{ type: "link", start: 2, length: 9 }]);
  });

  it("keeps [@john:3:16](not a link) as a verse token plus plain parens", () => {
    const input = "[@john:3:16](not a link)";
    expect(byType(input, "link")).toEqual([{ type: "link", start: 2, length: 9 }]);
    expect(byType(input, "syntax")).toEqual([
      { type: "syntax", start: 0, length: 2 },
      { type: "syntax", start: 11, length: 1 },
    ]);
  });

  it("does not parse [@john:3:16](https://example.com) as a markdown link", () => {
    const input = "[@john:3:16](https://example.com)";
    expect(byType(input, "link")).toEqual([{ type: "link", start: 2, length: 9 }]);
    expect(input.slice(2, 11)).toBe("john:3:16");
  });

  it("leaves empty [@] unstyled", () => {
    expect(parseReflectionLiveMarkdown("[@]")).toEqual([]);
  });

  it("parses inline markup inside a heading", () => {
    const input = "# Hello **there**";
    expect(byType(input, "h1")[0]).toMatchObject({ start: 2, length: 15 });
    expect(byType(input, "bold")).toEqual([{ type: "bold", start: 10, length: 5 }]);
  });
});
