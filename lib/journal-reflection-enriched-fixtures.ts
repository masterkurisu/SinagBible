/**
 * Converter-branch fixtures for the Enriched HTML data gate (Phase 0b).
 *
 * Round-trip fixtures: stored HTML → `htmlToReflectionMarkdown` matches `markdown`
 * after `normalizeReflectionMarkdownForCompare`. Native `setValue → getHTML` is
 * asserted on device by `/dev/enriched-html-spike`.
 *
 * Accepted-loss fixtures must fail Enriched equality AND return true from
 * `reflectionHtmlNeedsLegacyEditor`. Nested lists are the first class; any new
 * loss class follows the same dual-assert rule.
 */

export type EnrichedFixtureKind = "round-trip" | "accepted-loss";

export type EnrichedFixture = {
  id: string;
  kind: EnrichedFixtureKind;
  /** Branch of htmlToReflectionMarkdown / reflectionMarkdownToContent this covers. */
  branch: string;
  html: string;
  markdown: string;
  images?: Record<string, string>;
};

const IMAGE_A = "file:///tmp/a.jpg";

function longDocumentFixture(): EnrichedFixture {
  const partsMd: string[] = ["# Long reflection", "", "A long body for the 0a jank gate."];
  const partsHtml: string[] = ["<h1>Long reflection</h1>", "<p>A long body for the 0a jank gate.</p>"];
  for (let i = 1; i <= 80; i++) {
    partsMd.push("", `Paragraph ${i} with **bold** and _italic_ markers, verse mention [@john:3:16], and a link [Sinag](https://example.com).`);
    partsHtml.push(
      `<p>Paragraph ${i} with <strong>bold</strong> and <em>italic</em> markers, verse mention <span data-verse-ref="john:3:16">John 3:16</span>, and a link <a href="https://example.com">Sinag</a>.</p>`,
    );
  }
  partsMd.push("", "- bullet one", "- bullet two", "", "1. first", "2. second");
  partsHtml.push("<ul><li>bullet one</li><li>bullet two</li></ul>", "<ol><li>first</li><li>second</li></ol>");
  return {
    id: "long-document",
    kind: "round-trip",
    branch: "long",
    html: partsHtml.join(""),
    markdown: partsMd.join("\n"),
  };
}

export const ENRICHED_HTML_FIXTURES: EnrichedFixture[] = [
  {
    id: "empty",
    kind: "round-trip",
    branch: "empty",
    html: "<p></p>",
    markdown: "",
  },
  {
    id: "plain-paragraph",
    kind: "round-trip",
    branch: "paragraph",
    html: "<p>Hello world</p>",
    markdown: "Hello world",
  },
  {
    id: "no-block-tags",
    kind: "round-trip",
    branch: "inline-fragment",
    html: "Hello world",
    markdown: "Hello world",
  },
  {
    id: "div-block",
    kind: "round-trip",
    branch: "div",
    html: "<div>From a div</div>",
    markdown: "From a div",
  },
  {
    id: "bold-italic",
    kind: "round-trip",
    branch: "inline-strong-em",
    html: "<p><strong>bold</strong> and <em>italic</em></p>",
    markdown: "**bold** and _italic_",
  },
  {
    id: "b-i-tags",
    kind: "round-trip",
    branch: "inline-b-i",
    html: "<p><b>bold</b> and <i>italic</i></p>",
    markdown: "**bold** and _italic_",
  },
  {
    id: "span-font-styles",
    kind: "round-trip",
    branch: "span-font",
    html: '<p><span style="font-weight: bold">bold</span> and <span style="font-style: italic">italic</span></p>',
    markdown: "**bold** and _italic_",
  },
  {
    id: "soft-break",
    kind: "round-trip",
    branch: "br",
    html: "<p>line one<br/>line two</p>",
    markdown: "line one\nline two",
  },
  {
    id: "heading-1",
    kind: "round-trip",
    branch: "h1",
    html: "<h1>Big Title</h1>",
    markdown: "# Big Title",
  },
  {
    id: "heading-2",
    kind: "round-trip",
    branch: "h2",
    html: "<h2>Smaller heading</h2>",
    markdown: "## Smaller heading",
  },
  {
    id: "unordered-list",
    kind: "round-trip",
    branch: "ul",
    html: "<ul><li>one</li><li><strong>two</strong></li></ul>",
    markdown: "- one\n- **two**",
  },
  {
    id: "ordered-list",
    kind: "round-trip",
    branch: "ol",
    html: "<ol><li>first</li><li>second</li></ol>",
    markdown: "1. first\n2. second",
  },
  {
    id: "sibling-lists",
    kind: "round-trip",
    branch: "sibling-ul-ol",
    html: "<ul><li>one</li><li>two</li></ul><ol><li>first</li><li>second</li></ol>",
    markdown: "- one\n- two\n\n1. first\n2. second",
  },
  {
    id: "checklist",
    kind: "round-trip",
    branch: "checklist",
    html: '<ul data-checklist="true"><li data-checked="false">☐ todo one</li><li data-checked="true">☑ done one</li></ul>',
    markdown: "- [ ] todo one\n- [x] done one",
  },
  {
    id: "link",
    kind: "round-trip",
    branch: "anchor",
    html: '<p>Visit <a href="https://example.com">here</a> now.</p>',
    markdown: "Visit [here](https://example.com) now.",
  },
  {
    id: "image",
    kind: "round-trip",
    branch: "img",
    html: `<p><img src="${IMAGE_A}" alt="" /></p>`,
    markdown: "[image:img-0]",
    images: { "img-0": IMAGE_A },
  },
  {
    id: "verse-span",
    kind: "round-trip",
    branch: "verse-tag",
    html: '<p>See <span data-verse-ref="john:3:16">John 3:16</span> today.</p>',
    markdown: "See [@john:3:16] today.",
  },
  {
    id: "verse-span-translation",
    kind: "round-trip",
    branch: "verse-tag-translation",
    html: '<p><span data-translation="KJV" data-verse-ref="john:3:16">John 3:16</span></p>',
    markdown: "[@john:3:16@KJV]",
  },
  {
    id: "verse-span-not-a-link",
    kind: "round-trip",
    branch: "verse-tag-parens",
    html: '<p><span data-verse-ref="john:3:16">John 3:16</span>(not a link)</p>',
    markdown: "[@john:3:16](not a link)",
  },
  {
    id: "enriched-mention",
    kind: "round-trip",
    branch: "verse-tag-mention",
    html: '<p>See <mention indicator="@" text="John 3:16" data-verse-ref="john:3:16">John 3:16</mention> today.</p>',
    markdown: "See [@john:3:16] today.",
  },
  {
    id: "enriched-checkbox",
    kind: "round-trip",
    branch: "checkbox-native",
    html: '<ul data-type="checkbox"><li>todo one</li><li checked>done one</li></ul>',
    markdown: "- [ ] todo one\n- [x] done one",
  },
  {
    id: "null-markdown-html-source",
    kind: "round-trip",
    branch: "null-markdown",
    html: "<p>Pre-dual-write row with HTML only.</p>",
    markdown: "Pre-dual-write row with HTML only.",
  },
  longDocumentFixture(),
  {
    id: "nested-ul-in-li",
    kind: "accepted-loss",
    branch: "nested-list",
    html: "<ul><li>outer<ul><li>inner</li></ul></li></ul>",
    markdown: "- outer\n- inner",
  },
  {
    id: "nested-ol-in-ol",
    kind: "accepted-loss",
    branch: "nested-list",
    html: "<ol><li>one<ol><li>two</li></ol></li></ol>",
    markdown: "1. one\n2. two",
  },
  {
    id: "ol-inside-ul-li",
    kind: "accepted-loss",
    branch: "nested-list",
    html: "<ul><li>alpha<ol><li>beta</li></ol></li></ul>",
    markdown: "- alpha\n- beta",
  },
];

export const ACCEPTED_LOSS_FIXTURES = ENRICHED_HTML_FIXTURES.filter(
  (fixture) => fixture.kind === "accepted-loss",
);

export const ROUND_TRIP_FIXTURES = ENRICHED_HTML_FIXTURES.filter(
  (fixture) => fixture.kind === "round-trip",
);

export const LONG_JANK_FIXTURE = ENRICHED_HTML_FIXTURES.find((fixture) => fixture.id === "long-document")!;

/** Native mention double round-trip seed (Phase 0b item 2). */
export const MENTION_DOUBLE_ROUND_TRIP = {
  indicator: "@",
  text: "John 3:16",
  attributes: {
    "data-verse-ref": "john:3:16",
    "data-translation": "NIV",
  },
} as const;

export function converterBranchesCovered(): string[] {
  return [...new Set(ENRICHED_HTML_FIXTURES.map((fixture) => fixture.branch))];
}
