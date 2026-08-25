import { describe, expect, it } from "vitest";
import { computeReflectionBlocks } from "@/lib/journal-reflection-blocks";

describe("computeReflectionBlocks", () => {
  it("returns nothing for empty text", () => {
    expect(computeReflectionBlocks("")).toEqual([]);
  });

  it("groups a single paragraph into one block with correct offsets", () => {
    const md = "Hello world";
    const blocks = computeReflectionBlocks(md);
    expect(blocks).toEqual([{ kind: "plain", text: "Hello world", start: 0, end: 11 }]);
  });

  it("splits on blank lines into separate blocks", () => {
    const md = "First paragraph\n\nSecond paragraph";
    const blocks = computeReflectionBlocks(md);
    expect(blocks.map((b) => b.text)).toEqual(["First paragraph", "Second paragraph"]);
    expect(blocks[0]).toMatchObject({ start: 0, end: 15 });
    expect(blocks[1]).toMatchObject({ start: 17, end: 33 });
  });

  it("merges consecutive same-kind list lines into one block", () => {
    const md = "- one\n- two\n- three";
    const blocks = computeReflectionBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.kind).toBe("bullet");
    expect(blocks[0]!.text).toBe("- one\n- two\n- three");
  });

  it("splits when line kind changes even without a blank line", () => {
    const md = "- bullet item\n1. ordered item";
    const blocks = computeReflectionBlocks(md);
    expect(blocks.map((b) => b.kind)).toEqual(["bullet", "ordered"]);
  });

  it("keeps an image line as its own block even mid-paragraph", () => {
    const md = "before text\n[image:img-0]\nafter text";
    const blocks = computeReflectionBlocks(md);
    expect(blocks.map((b) => ({ kind: b.kind, text: b.text }))).toEqual([
      { kind: "plain", text: "before text" },
      { kind: "image", text: "[image:img-0]" },
      { kind: "plain", text: "after text" },
    ]);
  });

  it("classifies headings and checklists distinctly", () => {
    const md = "# Big\n## Small\n- [ ] todo\n- [x] done";
    const blocks = computeReflectionBlocks(md);
    expect(blocks.map((b) => b.kind)).toEqual(["heading1", "heading2", "checklist"]);
    expect(blocks[2]!.text).toBe("- [ ] todo\n- [x] done");
  });

  it("round-trips: slicing the source string at block offsets reproduces block text", () => {
    const md = "# Heading\n\n- a\n- b\n\nplain paragraph\n\n[image:x]";
    const blocks = computeReflectionBlocks(md);
    for (const block of blocks) {
      expect(md.slice(block.start, block.end)).toBe(block.text);
    }
  });
});
