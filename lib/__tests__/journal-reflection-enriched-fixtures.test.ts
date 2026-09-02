import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { asyncStorageMock, expoSqliteMock } from "./journal-storage-mocks";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: asyncStorageMock,
}));
vi.mock("expo-sqlite", () => expoSqliteMock);

import { reflectionMarkdownToContent } from "@/lib/journal-local";
import { htmlToReflectionMarkdown } from "@/lib/journal-reflection-html";
import {
  ACCEPTED_LOSS_FIXTURES,
  ENRICHED_HTML_FIXTURES,
  ROUND_TRIP_FIXTURES,
  converterBranchesCovered,
} from "@/lib/journal-reflection-enriched-fixtures";
import {
  ENRICHED_HTML_LIBRARY_PIN,
  REFLECTION_MARKDOWN_CONVERTER_REVISION,
  normalizeReflectionMarkdownForCompare,
  reflectionHtmlNeedsLegacyEditor,
} from "@/lib/journal-reflection-legacy-route";

const OWNED_MARKDOWN_TO_HTML_IDS = new Set([
  "empty",
  "plain-paragraph",
  "bold-italic",
  "soft-break",
  "heading-1",
  "heading-2",
  "unordered-list",
  "ordered-list",
  "sibling-lists",
  "checklist",
  "link",
  "image",
  "verse-span",
  "null-markdown-html-source",
]);

describe("enriched HTML fixture golden (converter revision " + REFLECTION_MARKDOWN_CONVERTER_REVISION + ")", () => {
  it("pins react-native-enriched-html without a caret", () => {
    const pkg = JSON.parse(
      readFileSync(path.resolve(__dirname, "../../package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };
    expect(pkg.dependencies["react-native-enriched-html"]).toBe(ENRICHED_HTML_LIBRARY_PIN);
    expect(pkg.dependencies["react-native-enriched-html"]).not.toMatch(/^[~^]/);
  });
  it("covers the converter branches we ship", () => {
    const branches = converterBranchesCovered();
    for (const required of [
      "empty",
      "paragraph",
      "ul",
      "ol",
      "h1",
      "h2",
      "checklist",
      "img",
      "anchor",
      "verse-tag",
      "verse-tag-mention",
      "checkbox-native",
      "null-markdown",
      "long",
      "nested-list",
    ]) {
      expect(branches).toContain(required);
    }
  });

  it("round-trips stored HTML to expected markdown after normalize", () => {
    for (const fixture of ROUND_TRIP_FIXTURES) {
      const actual = normalizeReflectionMarkdownForCompare(
        htmlToReflectionMarkdown(fixture.html, { ...fixture.images }),
      );
      const expected = normalizeReflectionMarkdownForCompare(fixture.markdown);
      expect(actual, fixture.id).toBe(expected);
    }
  });

  it("round-trips owned markdown back to stored HTML for converter-owned shapes", () => {
    for (const fixture of ROUND_TRIP_FIXTURES) {
      if (!OWNED_MARKDOWN_TO_HTML_IDS.has(fixture.id)) continue;
      const html = reflectionMarkdownToContent(fixture.markdown, fixture.images ?? {});
      expect(html, fixture.id).toBe(fixture.html);
    }
  });

  it("every accepted-loss fixture fails lossless markdown equality AND trips the precheck", () => {
    expect(ACCEPTED_LOSS_FIXTURES.length).toBeGreaterThan(0);
    for (const fixture of ACCEPTED_LOSS_FIXTURES) {
      expect(reflectionHtmlNeedsLegacyEditor(fixture.html), fixture.id).toBe(true);
      const converted = normalizeReflectionMarkdownForCompare(
        htmlToReflectionMarkdown(fixture.html, { ...fixture.images }),
      );
      const expected = normalizeReflectionMarkdownForCompare(fixture.markdown);
      expect(converted, `${fixture.id} must not already equal the lossless expected markdown`).not.toBe(
        expected,
      );
    }
  });

  it("does not let a new fixture skip the accepted-loss dual-assert rule", () => {
    for (const fixture of ENRICHED_HTML_FIXTURES) {
      if (fixture.kind !== "accepted-loss") {
        expect(reflectionHtmlNeedsLegacyEditor(fixture.html), fixture.id).toBe(false);
      }
    }
  });
});
