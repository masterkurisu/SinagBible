import { describe, expect, it } from "vitest";
import { enrichedHtmlToOwnedHtml } from "@/lib/journal-reflection-enriched-mapping";
import {
  canonicalizeOwnedReflectionHtml,
  reflectionSpacerSignature,
  MAX_CONSECUTIVE_BLANK_PARAGRAPHS,
} from "@/lib/journal-reflection-owned-html";
import { parseOwnedReflectionHtml } from "@/src/features/journal/journalSavedReflectionBlocks";

function blankRun(count: number): string {
  return Array.from({ length: count }, () => "<p></p>").join("");
}

describe("canonicalizeOwnedReflectionHtml", () => {
  it("strips leading and trailing empty paragraphs", () => {
    expect(canonicalizeOwnedReflectionHtml("<p></p><p>Keep</p><p><br></p>")).toBe("<p>Keep</p>");
  });

  it("clamps interior blank runs above the cap", () => {
    const input = `<p>Start</p>${blankRun(11)}<p>End</p>`;
    const output = canonicalizeOwnedReflectionHtml(input);
    expect(output).toBe(`<p>Start</p>${blankRun(MAX_CONSECUTIVE_BLANK_PARAGRAPHS)}<p>End</p>`);
  });

  it("is idempotent", () => {
    const html = `<p>Start</p>${blankRun(2)}<p>End</p>`;
    const once = canonicalizeOwnedReflectionHtml(html);
    expect(canonicalizeOwnedReflectionHtml(once)).toBe(once);
  });

  it("drops empty paragraphs inside list items", () => {
    expect(
      canonicalizeOwnedReflectionHtml("<ul><li><p></p></li><li><p>Keep</p></li></ul>"),
    ).toBe("<ul><li><p>Keep</p></li></ul>");
  });
});

describe("reflectionSpacerSignature", () => {
  it("ignores leading and trailing blank runs after canonicalize", () => {
    const stored = `<p></p><p>Hello</p>${blankRun(2)}<p></p>`;
    const editor = `<p>Hello</p>${blankRun(2)}`;
    expect(reflectionSpacerSignature(stored)).toBe(reflectionSpacerSignature(editor));
  });
});

describe("parseOwnedReflectionHtml blank spacing", () => {
  it.each([
    [0, "<p>Hello</p>"],
    [1, `<p>Hello</p>${blankRun(1)}<p>World</p>`],
    [2, `<p>Hello</p>${blankRun(2)}<p>World</p>`],
    [10, `<p>Hello</p>${blankRun(10)}<p>World</p>`],
    [10, `<p>Hello</p>${blankRun(11)}<p>World</p>`],
  ])("attaches %i leading blanks to the following block", (expected, html) => {
    const blocks = parseOwnedReflectionHtml(canonicalizeOwnedReflectionHtml(html));
    const world = blocks.find((block) => block.kind === "paragraph" && block.html === "World");
    expect(world?.leadingBlankCount ?? 0).toBe(expected);
  });

  it("keeps verse-only paragraphs and can attach leading blanks before them", () => {
    const html = `${blankRun(1)}<p><span data-verse-ref="john:3:16">John 3:16</span></p>`;
    const blocks = parseOwnedReflectionHtml(canonicalizeOwnedReflectionHtml(html));
    expect(blocks).toEqual([
      {
        key: "p-0",
        kind: "paragraph",
        html: '<span data-verse-ref="john:3:16">John 3:16</span>',
      },
    ]);
  });

  it("drops in-list empty paragraphs", () => {
    expect(
      parseOwnedReflectionHtml(
        canonicalizeOwnedReflectionHtml("<ul><li><p></p></li><li><p>One</p></li></ul>"),
      ).map((block) => block.kind),
    ).toEqual(["list-item"]);
  });
});

describe("owned vs enriched spacing parity", () => {
  it("matches leadingBlankCount after canonicalize and owned mapping", () => {
    const enriched = `<p>Hello</p>${blankRun(2)}<p>World</p>`;
    const owned = canonicalizeOwnedReflectionHtml(enrichedHtmlToOwnedHtml(enriched));
    const fromOwned = parseOwnedReflectionHtml(owned).map((block) => block.leadingBlankCount ?? 0);
    const fromEnriched = parseOwnedReflectionHtml(
      canonicalizeOwnedReflectionHtml(enrichedHtmlToOwnedHtml(enriched)),
    ).map((block) => block.leadingBlankCount ?? 0);
    expect(fromOwned).toEqual(fromEnriched);
  });
});
