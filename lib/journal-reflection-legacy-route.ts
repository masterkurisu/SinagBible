/**
 * Pure-JS router and no-op-save normalizer for the reflection notes surface.
 *
 * `reflectionHtmlNeedsLegacyEditor` is a cheap HTML parse, not a native round-trip.
 * Call it before any Enriched mount. Nested lists (and later accepted-loss classes)
 * go to the live-markdown editor. Screen readers are OR'd in by callers.
 *
 * `normalizeReflectionMarkdownForCompare` is for no-op save only — never for routing.
 */

/** Exact npm pin. Bump `editor_version` when this changes. */
export const ENRICHED_HTML_LIBRARY_PIN = "1.1.1";

/** Bump when `htmlToReflectionMarkdown` or `reflectionMarkdownToContent` change. */
export const REFLECTION_MARKDOWN_CONVERTER_REVISION = 1;

const LIST_OPEN_RE = /<(ul|ol)\b[^>]*>/gi;
const LIST_CLOSE_RE = /<\/(ul|ol)>/gi;

/**
 * True when a `<ul>` / `<ol>` opens while another list is still open
 * (list inside `li`, or list inside list). Sibling lists are not nested.
 */
export function htmlHasNestedList(html: string): boolean {
  const tokens: { index: number; open: boolean }[] = [];
  let match: RegExpExecArray | null;
  LIST_OPEN_RE.lastIndex = 0;
  while ((match = LIST_OPEN_RE.exec(html)) !== null) {
    tokens.push({ index: match.index, open: true });
  }
  LIST_CLOSE_RE.lastIndex = 0;
  while ((match = LIST_CLOSE_RE.exec(html)) !== null) {
    tokens.push({ index: match.index, open: false });
  }
  tokens.sort((a, b) => a.index - b.index || (a.open ? -1 : 1));

  let depth = 0;
  for (const token of tokens) {
    if (token.open) {
      if (depth > 0) return true;
      depth += 1;
    } else if (depth > 0) {
      depth -= 1;
    }
  }
  return false;
}

/**
 * Per-row router. Independent of `JOURNAL_NOTES_SURFACE_ENABLED`.
 * Extend when an accepted-loss fixture class is added in Phase 0b.
 */
export function reflectionHtmlNeedsLegacyEditor(html: string): boolean {
  return htmlHasNestedList(html);
}

const NASTY_TAG_RE: { tag: string; re: RegExp }[] = [
  { tag: "table", re: /<table\b/i },
  { tag: "iframe", re: /<iframe\b/i },
  { tag: "video", re: /<video\b/i },
  { tag: "blockquote", re: /<blockquote\b/i },
  { tag: "pre", re: /<pre\b/i },
];

/** Extra HTML shapes the census reports; only nested-list is in the router today. */
export function scanReflectionHtmlNasties(html: string): string[] {
  const found: string[] = [];
  if (htmlHasNestedList(html)) found.push("nested-list");
  for (const { tag, re } of NASTY_TAG_RE) {
    if (re.test(html)) found.push(tag);
  }
  return found;
}

/**
 * Strip set (no-op save only — do not flatten lists, strip marks, or rewrite verse tokens):
 * - Unicode NFC
 * - Newlines → `\n`
 * - Trim trailing whitespace per line; trim document
 * - Collapse `>`-only leftover lines and empty-line runs to a single blank line
 */
export function normalizeReflectionMarkdownForCompare(markdown: string): string {
  const nfc = markdown.normalize("NFC");
  const unified = nfc.replace(/\r\n?/g, "\n");
  const lines = unified.split("\n").map((line) => {
    const trimmed = line.replace(/[ \t\u00a0]+$/g, "");
    return trimmed === ">" ? "" : trimmed;
  });

  const collapsed: string[] = [];
  let inBlankRun = false;
  for (const line of lines) {
    if (line.length === 0) {
      if (!inBlankRun) collapsed.push("");
      inBlankRun = true;
      continue;
    }
    inBlankRun = false;
    collapsed.push(line);
  }
  return collapsed.join("\n").trim();
}
