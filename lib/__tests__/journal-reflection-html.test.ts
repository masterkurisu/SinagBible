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

  it("converts headings", () => {
    expect(htmlToReflectionMarkdown("<h1>Big Title</h1>")).toBe("# Big Title");
    expect(htmlToReflectionMarkdown("<h2>Smaller heading</h2>")).toBe("## Smaller heading");
  });

  it("converts checklists, including the embedded checkbox glyph journal-local.ts writes", () => {
    expect(
      htmlToReflectionMarkdown(
        '<ul data-checklist="true"><li data-checked="false">☐ todo one</li><li data-checked="true">☑ done one</li></ul>',
      ),
    ).toBe("- [ ] todo one\n- [x] done one");
  });

  it("converts links", () => {
    expect(htmlToReflectionMarkdown('<p>Visit <a href="https://example.com">here</a> now.</p>')).toBe(
      "Visit [here](https://example.com) now.",
    );
  });

  it("round-trips data-verse-ref spans back to [@...] tokens", () => {
    expect(
      htmlToReflectionMarkdown('<p>See <span data-verse-ref="john:3:16">John 3:16</span> today.</p>'),
    ).toBe("See [@john:3:16] today.");
    expect(
      htmlToReflectionMarkdown(
        '<p><span data-translation="KJV" data-verse-ref="john:3:16">John 3:16</span></p>',
      ),
    ).toBe("[@john:3:16@KJV]");
  });

  it("round-trips Enriched mention nodes back to [@...] tokens", () => {
    expect(
      htmlToReflectionMarkdown(
        '<p>See <mention indicator="@" text="John 3:16" data-verse-ref="john:3:16">John 3:16</mention> today.</p>',
      ),
    ).toBe("See [@john:3:16] today.");
    expect(
      htmlToReflectionMarkdown(
        '<p><mention indicator="@" text="John 3:16" data-verse-ref="john:3:16" data-translation="KJV">John 3:16</mention></p>',
      ),
    ).toBe("[@john:3:16@KJV]");
  });

  it("does not treat a verse span followed by parens as a markdown link", () => {
    expect(
      htmlToReflectionMarkdown(
        '<p><span data-verse-ref="john:3:16">John 3:16</span>(not a link)</p>',
      ),
    ).toBe("[@john:3:16](not a link)");
  });

  it("converts Enriched native checkbox lists to markdown checklists", () => {
    expect(
      htmlToReflectionMarkdown(
        '<ul data-type="checkbox"><li>todo one</li><li checked>done one</li></ul>',
      ),
    ).toBe("- [ ] todo one\n- [x] done one");
  });

  it("does not preserve nested-list structure (accepted-loss / legacy-router class)", () => {
    expect(htmlToReflectionMarkdown("<ul><li>outer<ul><li>inner</li></ul></li></ul>")).not.toBe(
      "- outer\n  - inner",
    );
  });
});
