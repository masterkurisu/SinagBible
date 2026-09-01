import { describe, expect, it, vi } from "vitest";
import { asyncStorageMock, expoSqliteMock } from "./journal-storage-mocks";

// reflectionMarkdownToContent doesn't touch storage, but `@/lib/journal-local` also pulls in the
// SQLite/AsyncStorage-backed modules used by the rest of journal storage, so those need mocking
// the same way lib/journal-migration.test.ts mocks them.
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: asyncStorageMock,
}));
vi.mock("expo-sqlite", () => expoSqliteMock);

import { reflectionMarkdownToContent } from "@/lib/journal-local";
import { htmlToReflectionMarkdown } from "@/lib/journal-reflection-html";
import { stripHtmlPreview } from "@/lib/journal-preview";

describe("reflectionMarkdownToContent", () => {
  it("keeps existing bold/italic/list behavior unchanged", () => {
    expect(reflectionMarkdownToContent("**bold** and _italic_", {})).toBe(
      "<p><strong>bold</strong> and <em>italic</em></p>",
    );
    expect(reflectionMarkdownToContent("- one\n- **two**", {})).toBe(
      "<ul><li>one</li><li><strong>two</strong></li></ul>",
    );
  });

  it("merges consecutive list lines into one <ul>/<ol> instead of one tag per line", () => {
    // Regression test: the original `trimmed.split(/\n+/)` split every line into its own chunk,
    // so a 3-item list rendered as three separate one-item <ol> tags — which visually numbered
    // every ordered item "1." in the detail view / PDF export, since each block's item index
    // reset to 0.
    expect(reflectionMarkdownToContent("1. first\n2. second\n3. third", {})).toBe(
      "<ol><li>first</li><li>second</li><li>third</li></ol>",
    );
    expect(reflectionMarkdownToContent("- one\n- two\n- three", {})).toBe(
      "<ul><li>one</li><li>two</li><li>three</li></ul>",
    );
  });

  it("collapses a soft line break inside a paragraph to <br/> instead of splitting into two <p>s", () => {
    expect(reflectionMarkdownToContent("line one\nline two", {})).toBe("<p>line one<br/>line two</p>");
  });

  it("keeps an inline image its own <img> even without a blank line around it", () => {
    // Matches the actual token shape journal-new-entry-form.tsx inserts: `\n[image:id]\n`.
    expect(
      reflectionMarkdownToContent("before text\n[image:img-0]\nafter text", {
        "img-0": "file:///tmp/a.jpg",
      }),
    ).toBe('<p>before text</p><p><img src="file:///tmp/a.jpg" alt="" /></p><p>after text</p>');
  });

  it("converts headings", () => {
    expect(reflectionMarkdownToContent("# Big Title", {})).toBe("<h1>Big Title</h1>");
    expect(reflectionMarkdownToContent("## Smaller heading", {})).toBe("<h2>Smaller heading</h2>");
    expect(reflectionMarkdownToContent("## Heading\n- one\n- two", {})).toBe(
      "<h2>Heading</h2><ul><li>one</li><li>two</li></ul>",
    );
  });

  it("converts checklists, embedding the checkbox glyph directly in the HTML text", () => {
    expect(reflectionMarkdownToContent("- [ ] todo one\n- [x] done one", {})).toBe(
      '<ul data-checklist="true"><li data-checked="false">☐ todo one</li><li data-checked="true">☑ done one</li></ul>',
    );
  });

  it("converts links, plain and nested inside bold", () => {
    expect(reflectionMarkdownToContent("See [my site](https://example.com) for more.", {})).toBe(
      '<p>See <a href="https://example.com">my site</a> for more.</p>',
    );
    expect(reflectionMarkdownToContent("**[bold link](https://x.com)**", {})).toBe(
      '<p><strong><a href="https://x.com">bold link</a></strong></p>',
    );
  });

  it("writes data-verse-ref spans for [@...] tokens before markdown links", () => {
    expect(reflectionMarkdownToContent("See [@john:3:16] today.", {})).toBe(
      '<p>See <span data-verse-ref="john:3:16">John 3:16</span> today.</p>',
    );
    expect(reflectionMarkdownToContent("[@john:3:16](not a link)", {})).toBe(
      '<p><span data-verse-ref="john:3:16">John 3:16</span>(not a link)</p>',
    );
    expect(reflectionMarkdownToContent("see [@john:3:16].", {})).toBe(
      '<p>see <span data-verse-ref="john:3:16">John 3:16</span>.</p>',
    );
  });

  it("keeps [image:id] as images and [@john:3:16] as verse tags", () => {
    expect(
      reflectionMarkdownToContent("see [@john:3:16]\n[image:img-0]\n", {
        "img-0": "file:///tmp/a.jpg",
      }),
    ).toBe(
      '<p>see <span data-verse-ref="john:3:16">John 3:16</span></p><p><img src="file:///tmp/a.jpg" alt="" /></p>',
    );
    expect(reflectionMarkdownToContent("see [@image:id]", {})).toBe("<p>see [@image:id]</p>");
  });

  it("round-trips verse-tag spans back to tokens and keeps inner text for search", () => {
    const html = reflectionMarkdownToContent("See [@john:3:16] today.", {});
    expect(htmlToReflectionMarkdown(html)).toBe("See [@john:3:16] today.");
    expect(stripHtmlPreview(html, 600)).toContain("John 3:16");
  });
});
