import { describe, expect, it } from "vitest";
import { getSearchResultsForTranslation } from "@sinag-bible/core/bible-translations";
import { lookupNamedPassage } from "@sinag-bible/core/search-named-passages";
import { getRelatedVerseRefsForQuery } from "@sinag-bible/core/search-related-verses";
import { parseStrongsQuery, lookupStrongsQuery } from "@sinag-bible/core/search-strongs-index";
import {
  isSearchVoiceAvailable,
  transcriptFromVoiceResult,
} from "@/lib/search-voice";

describe("voice search facade", () => {
  it("does not claim the mic when the native recognizer is unavailable", () => {
    expect(isSearchVoiceAvailable()).toBe(false);
  });

  it("reads a transcript from a recognition result event", () => {
    expect(
      transcriptFromVoiceResult({
        isFinal: true,
        results: [{ transcript: "  John 3:16  " }],
      }),
    ).toBe("John 3:16");
    expect(transcriptFromVoiceResult({})).toBe("");
  });
});

describe("Strong’s number search", () => {
  it("parses G/H numbers and strong: aliases, not digit-only queries", () => {
    expect(parseStrongsQuery("G26")).toEqual({ prefix: "G", number: 26, id: "G26" });
    expect(parseStrongsQuery("strong:g26")).toEqual({ prefix: "G", number: 26, id: "G26" });
    expect(parseStrongsQuery("H7225")).toMatchObject({ id: "H7225" });
    expect(parseStrongsQuery("26")).toBeNull();
    expect(parseStrongsQuery("316")).toBeNull();
    expect(parseStrongsQuery("John 3:16")).toBeNull();
  });

  it("returns curated G26 verses with a caption, not a full lemma corpus", async () => {
    const hit = lookupStrongsQuery("G26");
    expect(hit?.gloss).toBe("agape");
    expect(hit?.refs[0]).toEqual({ slug: "1-john", chapter: 4, verse: 8 });

    const outcome = await getSearchResultsForTranslation("KJV", "G26");
    expect(outcome.results[0]).toMatchObject({
      bookSlug: "1-john",
      chapterNumber: 4,
      verseNumber: 8,
      strongsLabel: "G26 · agape",
    });
    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.results.length).toBeLessThanOrEqual(5);
  });
});

describe("related verses", () => {
  it("uses an explicit cross-ref table for John 3:16 and named passages", () => {
    const john = getRelatedVerseRefsForQuery("John 3:16");
    expect(john[0]).toEqual({ slug: "romans", chapter: 5, verse: 8 });
    expect(john.some((ref) => ref.slug === "john" && ref.chapter === 3 && ref.verse === 16)).toBe(
      false,
    );

    const named = lookupNamedPassage("lord's prayer");
    expect(named).toMatchObject({ slug: "matthew", chapter: 6, verse: 9 });
    expect(getRelatedVerseRefsForQuery("lord's prayer")[0]?.slug).toBe("luke");
  });

  it("does not invent related verses from a keyword search like love", () => {
    expect(getRelatedVerseRefsForQuery("love")).toEqual([]);
    expect(getRelatedVerseRefsForQuery("G26")).toEqual([]);
    expect(getRelatedVerseRefsForQuery("trinity")).toEqual([]);
  });
});
