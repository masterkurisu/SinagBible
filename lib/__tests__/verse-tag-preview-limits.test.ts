import { describe, expect, it } from "vitest";
import {
  clampVerseTagPreviewRange,
  computeVerseTagTooltipWidth,
  VERSE_TAG_PREVIEW_MAX_VERSES,
  VERSE_TAG_TOOLTIP_MAX_WIDTH_PX,
  VERSE_TAG_TOOLTIP_MIN_WIDTH_PX,
} from "@/src/features/verse-tags/verseTagPreviewLimits";

describe("clampVerseTagPreviewRange", () => {
  it("leaves a single verse and a short range unchanged", () => {
    expect(clampVerseTagPreviewRange(22, null)).toEqual({
      verseStart: 22,
      verseEnd: null,
      truncated: false,
    });
    expect(clampVerseTagPreviewRange(16, 18)).toEqual({
      verseStart: 16,
      verseEnd: 18,
      truncated: false,
    });
  });

  it(`caps a longer range at ${VERSE_TAG_PREVIEW_MAX_VERSES} verses`, () => {
    expect(clampVerseTagPreviewRange(16, 21)).toEqual({
      verseStart: 16,
      verseEnd: 18,
      truncated: true,
    });
  });
});

describe("computeVerseTagTooltipWidth", () => {
  it("uses the min width for short verse text", () => {
    expect(computeVerseTagTooltipWidth(20, 390)).toBe(VERSE_TAG_TOOLTIP_MIN_WIDTH_PX);
  });

  it("grows toward the max width for longer verse text", () => {
    const wide = computeVerseTagTooltipWidth(220, 390);
    expect(wide).toBeGreaterThan(VERSE_TAG_TOOLTIP_MIN_WIDTH_PX);
    expect(wide).toBeLessThanOrEqual(Math.min(VERSE_TAG_TOOLTIP_MAX_WIDTH_PX, 390 - 32));
  });
});
