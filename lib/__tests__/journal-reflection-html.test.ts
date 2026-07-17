import { describe, expect, it } from "vitest";
import {
  buildImageMapFromReflectionHtml,
  htmlToReflectionMarkdown,
} from "@/lib/journal-reflection-html";

describe("htmlToReflectionMarkdown", () => {
  it("converts bold and italic inline markup", () => {
    expect(htmlToReflectionMarkdown("<p><strong>bold</strong> and <em>italic</em></p>")).toBe(
      "**bold** and _italic_",
    );
  });

  it("converts bulleted lists", () => {
    expect(
      htmlToReflectionMarkdown("<ul><li>one</li><li><strong>two</strong></li></ul>"),
    ).toBe("- one\n- **two**");
  });

  it("converts ordered lists", () => {
    expect(htmlToReflectionMarkdown("<ol><li>first</li><li>second</li></ol>")).toBe(
      "1. first\n2. second",
    );
  });

  it("maps images to tokens", () => {
    const images = buildImageMapFromReflectionHtml(
      '<p><img src="file:///tmp/a.jpg" alt="" /></p>',
    );
    expect(htmlToReflectionMarkdown('<p><img src="file:///tmp/a.jpg" alt="" /></p>', images)).toBe(
      "[image:img-0]",
    );
  });

  it("converts plain paragraph HTML from legacy edit mode", () => {
    expect(htmlToReflectionMarkdown("<p>Hello world</p>")).toBe("Hello world");
  });
});
