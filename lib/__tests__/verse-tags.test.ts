import { describe, expect, it } from "vitest";
import {
  encodeVerseTag,
  extractActiveVerseTagMention,
  formatVerseTagLabel,
  insertVerseTagAtMention,
  isVerseTagMentionTrigger,
  parseVerseTagFromHtmlAttrs,
  parseVerseTagQuery,
  parseVerseTagToken,
  splitTextWithVerseTags,
  verseTagToHtml,
} from "@sinag-bible/core/verse-tags";

describe("parseVerseTagToken", () => {
  it("parses hyphenated book slugs", () => {
    expect(parseVerseTagToken("[@1-john:3:16]")).toEqual({
      book: "1-john",
      chapter: 3,
      verseStart: 16,
    });
    expect(parseVerseTagToken("[@song-of-solomon:2:1]")).toEqual({
      book: "song-of-solomon",
      chapter: 2,
      verseStart: 1,
    });
  });

  it("parses optional translation suffix", () => {
    expect(parseVerseTagToken("[@john:3:16@KJV]")).toEqual({
      book: "john",
      chapter: 3,
      verseStart: 16,
      translation: "KJV",
    });
    expect(parseVerseTagToken("[@john:3:16]")).toEqual({
      book: "john",
      chapter: 3,
      verseStart: 16,
    });
  });

  it("rejects malformed tokens", () => {
    expect(parseVerseTagToken("[@john:3]")).toBeNull();
    expect(parseVerseTagToken("[@:3:16]")).toBeNull();
    expect(parseVerseTagToken("[@john:3:16")).toBeNull();
  });

  it("accepts same-chapter ranges and rejects reversed ranges", () => {
    expect(parseVerseTagToken("[@john:3:16-18]")).toEqual({
      book: "john",
      chapter: 3,
      verseStart: 16,
      verseEnd: 18,
    });
    expect(parseVerseTagToken("[@john:3:18-16]")).toBeNull();
  });

  it("rejects cross-chapter style input", () => {
    expect(parseVerseTagToken("[@john:3:16-4:2]")).toBeNull();
  });
});

describe("encodeVerseTag", () => {
  it("omits translation when it matches context", () => {
    const ref = { book: "john", chapter: 3, verseStart: 16, translation: "KJV" };
    expect(encodeVerseTag(ref, "KJV")).toBe("[@john:3:16]");
    expect(encodeVerseTag(ref, "WEB")).toBe("[@john:3:16@KJV]");
  });
});

describe("splitTextWithVerseTags", () => {
  it("splits valid and malformed tags without throwing", () => {
    const text = "See [@john:3:16] and [@bad] plus [@john:3:16";
    expect(() => splitTextWithVerseTags(text)).not.toThrow();
    expect(splitTextWithVerseTags(text)).toEqual([
      { kind: "text", value: "See " },
      {
        kind: "tag",
        raw: "[@john:3:16]",
        ref: { book: "john", chapter: 3, verseStart: 16 },
      },
      { kind: "text", value: " and " },
      { kind: "tag", raw: "[@bad]", ref: null },
      { kind: "text", value: " plus " },
      { kind: "tag", raw: "[@john:3:16", ref: null },
    ]);
  });

  it("never throws on arbitrary input", () => {
    const inputs = ["", "@foo", "[@]", "[@a:b:c:d:e]", "no tags here"];
    for (const input of inputs) {
      expect(() => splitTextWithVerseTags(input)).not.toThrow();
    }
  });
});

describe("formatVerseTagLabel", () => {
  it("formats single verse and ranges", () => {
    expect(formatVerseTagLabel({ book: "john", chapter: 3, verseStart: 16 })).toBe("John 3:16");
    expect(
      formatVerseTagLabel({ book: "john", chapter: 3, verseStart: 16, verseEnd: 18 }),
    ).toBe("John 3:16-18");
    expect(
      formatVerseTagLabel(
        { book: "1-john", chapter: 3, verseStart: 16 },
        "1 John",
      ),
    ).toBe("1 John 3:16");
  });
});

describe("verseTagToHtml", () => {
  it("writes data attributes and derived label", () => {
    expect(
      verseTagToHtml({ book: "john", chapter: 3, verseStart: 16, translation: "KJV" }, "WEB"),
    ).toBe('<span data-verse-ref="john:3:16" data-translation="KJV">John 3:16</span>');
    expect(verseTagToHtml({ book: "john", chapter: 3, verseStart: 16, verseEnd: 18 })).toBe(
      '<span data-verse-ref="john:3:16-18">John 3:16-18</span>',
    );
  });
});

describe("parseVerseTagFromHtmlAttrs", () => {
  it("round-trips data-verse-ref values", () => {
    expect(parseVerseTagFromHtmlAttrs("john:3:16", "KJV")).toEqual({
      book: "john",
      chapter: 3,
      verseStart: 16,
      translation: "KJV",
    });
    expect(parseVerseTagFromHtmlAttrs("john:3:16-18")).toEqual({
      book: "john",
      chapter: 3,
      verseStart: 16,
      verseEnd: 18,
    });
  });
});

describe("parseVerseTagQuery", () => {
  it("parses partial mention queries", () => {
    expect(parseVerseTagQuery("john")).toEqual({ book: "john" });
    expect(parseVerseTagQuery("john:3")).toEqual({ book: "john", chapter: 3 });
    expect(parseVerseTagQuery("john:3:16-18@KJV")).toEqual({
      book: "john",
      chapter: 3,
      verseStart: 16,
      verseEnd: 18,
      translation: "KJV",
    });
    expect(parseVerseTagQuery("")).toEqual({});
  });
});

describe("mention helpers", () => {
  it("detects @ trigger at word boundaries only", () => {
    expect(isVerseTagMentionTrigger("hello @jo", 7)).toBe(true);
    expect(isVerseTagMentionTrigger("@john", 1)).toBe(true);
    expect(isVerseTagMentionTrigger("email@domain", 11)).toBe(false);
  });

  it("does not trigger @ inside an existing token", () => {
    const text = "See [@john:3:16@KJV] here";
    const atInTranslation = text.indexOf("@KJV") + 1;
    expect(isVerseTagMentionTrigger(text, atInTranslation)).toBe(false);
    expect(extractActiveVerseTagMention(text, atInTranslation)).toBeNull();
  });

  it("extracts active mention query until whitespace", () => {
    expect(extractActiveVerseTagMention("Hello @john:3", 13)).toBe("john:3");
    expect(extractActiveVerseTagMention("Hello @john 3", 11)).toBe("john");
    expect(extractActiveVerseTagMention("Hello world", 11)).toBeNull();
  });

  it("inserts encoded token at active mention", () => {
    const text = "Reflect on @john";
    const cursor = text.length;
    const result = insertVerseTagAtMention(
      text,
      cursor,
      { book: "john", chapter: 3, verseStart: 16 },
      "KJV",
    );
    expect(result).toEqual({
      text: "Reflect on [@john:3:16]",
      cursorIndex: "Reflect on [@john:3:16]".length,
    });
  });
});
