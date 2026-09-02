import { describe, expect, it } from "vitest";
import {
  enrichedHtmlToOwnedHtml,
  ownedHtmlToEnrichedHtml,
  verseTagToEnrichedMention,
} from "@/lib/journal-reflection-enriched-mapping";

const OWNED_SPAN =
  '<p>See <span data-verse-ref="john:3:16">John 3:16</span> today.</p>';
const ENRICHED_MENTION =
  '<p>See <mention indicator="@" text="John 3:16" data-verse-ref="john:3:16">John 3:16</mention> today.</p>';
const OWNED_CHECKLIST =
  '<ul data-checklist="true"><li data-checked="false">☐ todo one</li><li data-checked="true">☑ done one</li></ul>';
const ENRICHED_CHECKBOX =
  '<ul data-type="checkbox"><li>todo one</li><li checked>done one</li></ul>';

describe("verseTagToEnrichedMention", () => {
  it("maps a verse ref to setMention text and 0b attributes", () => {
    expect(
      verseTagToEnrichedMention({ book: "john", chapter: 3, verseStart: 16 }, "NIV"),
    ).toEqual({
      text: "John 3:16",
      attributes: { "data-verse-ref": "john:3:16" },
    });
  });

  it("keeps a translation only when it differs from the journal context", () => {
    expect(
      verseTagToEnrichedMention(
        { book: "john", chapter: 3, verseStart: 16, translation: "KJV" },
        "NIV",
      ).attributes,
    ).toEqual({
      "data-verse-ref": "john:3:16",
      "data-translation": "KJV",
    });
    expect(
      verseTagToEnrichedMention(
        { book: "john", chapter: 3, verseStart: 16, translation: "NIV" },
        "NIV",
      ).attributes,
    ).toEqual({ "data-verse-ref": "john:3:16" });
  });

  it("encodes verse ranges", () => {
    expect(
      verseTagToEnrichedMention({ book: "john", chapter: 3, verseStart: 16, verseEnd: 18 }, "NIV")
        .attributes["data-verse-ref"],
    ).toBe("john:3:16-18");
  });
});

describe("ownedHtmlToEnrichedHtml / enrichedHtmlToOwnedHtml", () => {
  it("maps verse spans to mentions and back", () => {
    expect(ownedHtmlToEnrichedHtml(OWNED_SPAN)).toBe(ENRICHED_MENTION);
    expect(enrichedHtmlToOwnedHtml(ENRICHED_MENTION)).toBe(OWNED_SPAN);
  });

  it("maps owned checklists to native checkbox lists and back", () => {
    expect(ownedHtmlToEnrichedHtml(OWNED_CHECKLIST)).toBe(ENRICHED_CHECKBOX);
    expect(enrichedHtmlToOwnedHtml(ENRICHED_CHECKBOX)).toBe(OWNED_CHECKLIST);
  });

  it("does not treat data-checked=false as checked", () => {
    const owned =
      '<ul data-checklist="true"><li data-checked="false">☐ still open</li></ul>';
    expect(ownedHtmlToEnrichedHtml(owned)).toBe(
      '<ul data-type="checkbox"><li>still open</li></ul>',
    );
    expect(enrichedHtmlToOwnedHtml('<ul data-type="checkbox"><li>still open</li></ul>')).toBe(
      owned,
    );
  });

  it("is idempotent on each dialect", () => {
    expect(ownedHtmlToEnrichedHtml(ownedHtmlToEnrichedHtml(OWNED_SPAN))).toBe(ENRICHED_MENTION);
    expect(enrichedHtmlToOwnedHtml(enrichedHtmlToOwnedHtml(ENRICHED_MENTION))).toBe(OWNED_SPAN);
    expect(ownedHtmlToEnrichedHtml(ownedHtmlToEnrichedHtml(OWNED_CHECKLIST))).toBe(
      ENRICHED_CHECKBOX,
    );
    expect(enrichedHtmlToOwnedHtml(enrichedHtmlToOwnedHtml(ENRICHED_CHECKBOX))).toBe(
      OWNED_CHECKLIST,
    );
  });

  it("passes images through unchanged", () => {
    const html = '<p><img src="data:image/jpeg;base64,abc" width="800" height="600"></p>';
    expect(ownedHtmlToEnrichedHtml(html)).toBe(html);
    expect(enrichedHtmlToOwnedHtml(html)).toBe(html);
  });
});
