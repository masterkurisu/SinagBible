import { describe, expect, it } from "vitest";
import {
  createVerseTagChapterCache,
  resolveVerseTagPrefetchTarget,
} from "@/src/features/verse-tags/verseTagChapterCache";
import {
  computeVerseTagOverlayMetrics,
  VERSE_TAG_OVERLAY_GAP_PX,
  VERSE_TAG_OVERLAY_MAX_HEIGHT_PX,
} from "@/src/features/verse-tags/verseTagOverlayLayout";
import { formatVerseTagComposerError } from "@/src/features/verse-tags/verseTagChipCopy";
import { createVerseTagComposer } from "@/src/features/verse-tags/verseTagComposer";

describe("computeVerseTagOverlayMetrics", () => {
  it("sits above the keyboard and below the status bar", () => {
    const metrics = computeVerseTagOverlayMetrics({
      screenHeight: 844,
      keyboardHeight: 336,
      statusBarInset: 47,
    });
    expect(metrics.bottom).toBe(336 + VERSE_TAG_OVERLAY_GAP_PX);
    expect(metrics.maxHeight).toBeLessThanOrEqual(VERSE_TAG_OVERLAY_MAX_HEIGHT_PX);
    expect(metrics.bottom + metrics.maxHeight + 47).toBeLessThanOrEqual(844);
  });
});

describe("resolveVerseTagPrefetchTarget", () => {
  const book = { slug: "mark", translation: "KJV" };

  it("prefetches chapter 1 when the book is confirmed without a chapter", () => {
    expect(resolveVerseTagPrefetchTarget(book, null, null)).toEqual({
      slug: "mark",
      translation: "KJV",
      chapter: 1,
    });
  });

  it("prefetches the typed chapter as soon as it is known", () => {
    expect(resolveVerseTagPrefetchTarget(book, 11, null)).toEqual({
      slug: "mark",
      translation: "KJV",
      chapter: 11,
    });
  });

  it("does not prefetch after a completed insert", () => {
    expect(resolveVerseTagPrefetchTarget(book, 11, { text: "[@mark:11:22] " })).toBeNull();
  });
});

describe("verse tag chapter cache", () => {
  it("lets the composer validate verses from a warmed cache", () => {
    const cache = createVerseTagChapterCache();
    cache.set("KJV", "mark", 11, 33);
    const composer = createVerseTagComposer({
      translation: "KJV",
      getVerseCount: (book, chapter) => cache.get("KJV", book, chapter),
    });

    let text = "";
    let last;
    for (const char of "@mark 11:99 ") {
      text += char;
      last = composer.push({ type: "change", text, cursorIndex: text.length });
    }
    expect(last?.commit).toBeNull();
    expect(last?.state.error).toBe("invalid-verse");
    expect(formatVerseTagComposerError("invalid-verse")).toBe(
      "That verse is not in this chapter.",
    );
  });
});
