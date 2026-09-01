import { describe, expect, it } from "vitest";
import {
  encodeVerseTag,
  extractActiveVerseTagMention,
  formatVerseTagLabel,
  getActiveVerseTagMention,
  insertVerseTagAtMention,
  isVerseTagMentionTrigger,
  parseVerseTagFromHtmlAttrs,
  parseVerseTagQuery,
  parseVerseTagToken,
  splitTextWithVerseTags,
  verseTagToHtml,
} from "@sinag-bible/core/verse-tags";
import { getKjvCanonicalBookNav } from "@sinag-bible/core/bible-meta";
import {
  createVerseTagComposer,
  matchVerseTagComposerBook,
} from "@/src/features/verse-tags/verseTagComposer";
import type { VerseTagComposerEvent } from "@/src/features/verse-tags/verseTagComposer";

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

  it("extracts active mention query including spaces, stopping at newline", () => {
    expect(extractActiveVerseTagMention("Hello @john:3", 13)).toBe("john:3");
    expect(extractActiveVerseTagMention("Hello @john 3", 11)).toBe("john");
    expect(extractActiveVerseTagMention("Hello @john 3", 13)).toBe("john 3");
    expect(extractActiveVerseTagMention("Hello @mark 11:22", 17)).toBe("mark 11:22");
    expect(extractActiveVerseTagMention("Hello world", 11)).toBeNull();
  });

  it("cancels the active mention when a newline is between @ and the cursor", () => {
    expect(extractActiveVerseTagMention("Hello @john\n3", 13)).toBeNull();
    expect(getActiveVerseTagMention("@mark 11:22", 11)).toEqual({
      atIndex: 0,
      buffer: "mark 11:22",
    });
  });

  it("inserts encoded token at a space-tolerant mention", () => {
    const text = "Reflect on @mark 11:22";
    const cursor = text.length;
    const result = insertVerseTagAtMention(
      text,
      cursor,
      { book: "mark", chapter: 11, verseStart: 22 },
      "KJV",
    );
    expect(result).toEqual({
      text: "Reflect on [@mark:11:22]",
      cursorIndex: "Reflect on [@mark:11:22]".length,
    });
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

function testVerseCount(book: string, chapter: number): number | null {
  const nav = getKjvCanonicalBookNav().find((item) => item.slug === book);
  if (!nav || chapter < 1 || chapter > nav.chapterCount) return null;
  if (book === "mark" && chapter === 11) return 33;
  if (book === "john" && chapter === 3) return 36;
  if (book === "1-john" && chapter === 3) return 24;
  if (book === "song-of-solomon" && chapter === 2) return 17;
  return 60;
}

function createTestComposer() {
  return createVerseTagComposer({
    translation: "KJV",
    getVerseCount: testVerseCount,
  });
}

function typeBuffer(
  composer: ReturnType<typeof createVerseTagComposer>,
  buffer: string,
  prefix = "",
) {
  let text = prefix;
  let last = composer.push({ type: "change", text, cursorIndex: text.length });
  for (const char of buffer) {
    text += char;
    last = composer.push({ type: "change", text, cursorIndex: text.length });
  }
  return { text, last };
}

describe("matchVerseTagComposerBook", () => {
  const books = getKjvCanonicalBookNav();

  it("treats jo as an ambiguous prefix and never auto-picks", () => {
    const match = matchVerseTagComposerBook("jo", books);
    expect(match.kind).toBe("ambiguous");
    if (match.kind === "ambiguous") {
      const slugs = match.books.map((book) => book.slug);
      expect(slugs).toEqual(expect.arrayContaining(["job", "joel", "john", "jonah", "joshua"]));
    }
  });

  it("resolves unambiguous books, numbered books, and misspellings", () => {
    expect(matchVerseTagComposerBook("mark", books)).toEqual({
      kind: "unique",
      book: expect.objectContaining({ slug: "mark" }),
    });
    expect(matchVerseTagComposerBook("1 John", books)).toEqual({
      kind: "unique",
      book: expect.objectContaining({ slug: "1-john" }),
    });
    expect(matchVerseTagComposerBook("Song of Solomon", books)).toEqual({
      kind: "unique",
      book: expect.objectContaining({ slug: "song-of-solomon" }),
    });
    expect(matchVerseTagComposerBook("mathew", books)).toEqual({
      kind: "unique",
      book: expect.objectContaining({ slug: "matthew" }),
    });
  });
});

describe("verseTagComposer", () => {
  it("keeps spaces in the buffer until a complete ref is ready", () => {
    const composer = createTestComposer();
    const { last } = typeBuffer(composer, "@mark 11:22");
    expect(last.state.phase).toBe("bookConfirmed");
    expect(last.state.buffer).toBe("mark 11:22");
    expect(last.commit).toBeNull();
  });

  it("emits book-confirmed when an unambiguous book is followed by space", () => {
    const composer = createTestComposer();
    const afterMark = typeBuffer(composer, "@mark");
    expect(afterMark.last.bookConfirmed).toBeNull();
    expect(afterMark.last.state.phase).toBe("mentioning");

    const afterSpace = typeBuffer(composer, "@mark ");
    expect(afterSpace.last.bookConfirmed).toEqual({ slug: "mark", translation: "KJV" });
    expect(afterSpace.last.state.phase).toBe("bookConfirmed");
    expect(afterSpace.last.state.confirmedBook).toEqual({ slug: "mark", translation: "KJV" });
  });

  it("does not treat the first space in Song of Solomon as book-done", () => {
    const composer = createTestComposer();
    const afterSong = typeBuffer(composer, "@Song ");
    expect(afterSong.last.bookConfirmed).toBeNull();
    expect(afterSong.last.state.phase).toBe("mentioning");

    const afterOf = typeBuffer(composer, "@Song of ");
    expect(afterOf.last.bookConfirmed).toBeNull();
    expect(afterOf.last.state.phase).toBe("mentioning");

    const confirmed = typeBuffer(composer, "@Song of Solomon ");
    expect(confirmed.last.bookConfirmed).toEqual({
      slug: "song-of-solomon",
      translation: "KJV",
    });
    expect(confirmed.last.state.phase).toBe("bookConfirmed");
  });

  it("auto-commits a valid ref on a delimiter and adds a trailing space", () => {
    const composer = createTestComposer();
    const { last } = typeBuffer(composer, "@Mark 11:22 ");
    expect(last.commit).toEqual({
      text: "[@mark:11:22] ",
      cursorIndex: "[@mark:11:22] ".length,
      ref: { book: "mark", chapter: 11, verseStart: 22 },
    });
    expect(last.state.phase).toBe("idle");
  });

  it("commits numbered books and same-chapter ranges", () => {
    const numbered = createTestComposer();
    expect(typeBuffer(numbered, "@1 John 3:16 ").last.commit).toEqual({
      text: "[@1-john:3:16] ",
      cursorIndex: "[@1-john:3:16] ".length,
      ref: { book: "1-john", chapter: 3, verseStart: 16 },
    });

    const range = createTestComposer();
    expect(typeBuffer(range, "@john 3:16-18 ").last.commit?.ref).toEqual({
      book: "john",
      chapter: 3,
      verseStart: 16,
      verseEnd: 18,
    });

    const song = createTestComposer();
    expect(typeBuffer(song, "@Song of Solomon 2:1 ").last.commit?.ref).toEqual({
      book: "song-of-solomon",
      chapter: 2,
      verseStart: 1,
    });
  });

  it("does not insert invalid complete-looking chapter or verse refs", () => {
    const badChapter = createTestComposer();
    const chapterResult = typeBuffer(badChapter, "@mark 99:1 ");
    expect(chapterResult.last.commit).toBeNull();
    expect(chapterResult.last.state.phase).toBe("invalid");
    expect(chapterResult.last.state.error).toBe("invalid-chapter");
    expect(chapterResult.text).toBe("@mark 99:1 ");

    const badVerse = createTestComposer();
    const verseResult = typeBuffer(badVerse, "@mark 11:99 ");
    expect(verseResult.last.commit).toBeNull();
    expect(verseResult.last.state.phase).toBe("invalid");
    expect(verseResult.last.state.error).toBe("invalid-verse");
  });

  it("never auto-picks an ambiguous prefix even with a complete-looking ref", () => {
    const composer = createTestComposer();
    const { last } = typeBuffer(composer, "@jo 3:16 ");
    expect(last.commit).toBeNull();
    expect(last.bookConfirmed).toBeNull();
    expect(last.state.confirmedBook).toBeNull();
    expect(last.state.phase).toBe("mentioning");
  });

  it("commits a valid ref on blur and adds a trailing space if missing", () => {
    const composer = createTestComposer();
    typeBuffer(composer, "@mark 11:22");
    const blur = composer.push({
      type: "blur",
      text: "@mark 11:22",
      cursorIndex: "@mark 11:22".length,
    });
    expect(blur.commit).toEqual({
      text: "[@mark:11:22] ",
      cursorIndex: "[@mark:11:22] ".length,
      ref: { book: "mark", chapter: 11, verseStart: 22 },
    });
  });

  it("aborts to idle on Escape without deleting typed text", () => {
    const composer = createTestComposer();
    const typed = typeBuffer(composer, "@mark 11:22");
    const escaped = composer.push({
      type: "escape",
      text: typed.text,
      cursorIndex: typed.text.length,
    } satisfies VerseTagComposerEvent);
    expect(escaped.state.phase).toBe("idle");
    expect(escaped.commit).toBeNull();
    expect(escaped.bookConfirmed).toBeNull();

    const afterEscape = composer.push({
      type: "change",
      text: "@mark 11:22 ",
      cursorIndex: "@mark 11:22 ".length,
    });
    expect(afterEscape.commit).toBeNull();
    expect(afterEscape.state.phase).toBe("idle");
  });

  it("returns to idle when the user deletes through @", () => {
    const composer = createTestComposer();
    typeBuffer(composer, "@mark");
    const deleted = composer.push({ type: "change", text: "", cursorIndex: 0 });
    expect(deleted.state.phase).toBe("idle");
    expect(deleted.state.buffer).toBe("");
  });

  it("leaves cross-chapter ranges as plain text with a visible range error", () => {
    const cross = createTestComposer();
    const crossResult = typeBuffer(cross, "@john 3:16-4:2 ");
    expect(crossResult.last.commit).toBeNull();
    expect(crossResult.last.state.error).toBe("invalid-range");
    expect(crossResult.text).toBe("@john 3:16-4:2 ");
  });

  it("leaves comma lists as plain text because a comma ends the mention", () => {
    const comma = createTestComposer();
    const commaResult = typeBuffer(comma, "@john 3:16,18 ");
    expect(commaResult.last.commit).toBeNull();
    expect(commaResult.text).toBe("@john 3:16,18 ");
  });

  it("shows an invalid-range error for a reversed same-chapter range", () => {
    const composer = createTestComposer();
    const result = typeBuffer(composer, "@john 3:18-16 ");
    expect(result.last.commit).toBeNull();
    expect(result.last.state.phase).toBe("invalid");
    expect(result.last.state.error).toBe("invalid-range");
  });

  it("cancels on newline without deleting the typed mention", () => {
    const composer = createTestComposer();
    typeBuffer(composer, "@mark 11:22");
    const next = composer.push({
      type: "change",
      text: "@mark 11:22\n",
      cursorIndex: "@mark 11:22\n".length,
    });
    expect(next.state.phase).toBe("idle");
    expect(next.commit).toBeNull();
  });

  it("commits a complete valid ref on an explicit commit event without a delimiter", () => {
    const composer = createTestComposer();
    typeBuffer(composer, "@mark 11:22");
    const committed = composer.push({
      type: "commit",
      text: "@mark 11:22",
      cursorIndex: "@mark 11:22".length,
    });
    expect(committed.commit?.ref).toEqual({ book: "mark", chapter: 11, verseStart: 22 });
    expect(committed.state.phase).toBe("idle");
  });

  it("exposes the typed chapter after book-confirm so prefetch can start", () => {
    const composer = createTestComposer();
    expect(typeBuffer(composer, "@mark ").last.state.chapter).toBeNull();
    expect(typeBuffer(composer, "@mark 11").last.state.chapter).toBe(11);
    expect(typeBuffer(composer, "@mark 11").last.state.confirmedBook?.slug).toBe("mark");
  });
});
