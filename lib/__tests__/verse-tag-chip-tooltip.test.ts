import { describe, expect, it } from "vitest";
import {
  formatVerseTagChipAccessibilityLabel,
  formatVerseTagTooltipTitle,
} from "@/src/features/verse-tags/verseTagChipCopy";
import {
  computeVerseTagTooltipPosition,
  VERSE_TAG_TOOLTIP_EST_HEIGHT_PX,
  VERSE_TAG_TOOLTIP_GAP_PX,
  VERSE_TAG_TOOLTIP_WIDTH_PX,
} from "@/src/features/verse-tags/verseTagTooltipLayout";

describe("formatVerseTagChipAccessibilityLabel", () => {
  it("announces a full spoken chip label for a single verse", () => {
    expect(
      formatVerseTagChipAccessibilityLabel({ book: "mark", chapter: 11, verseStart: 22 }),
    ).toBe("Verse reference, Mark chapter 11 verse 22, double tap to preview");
  });

  it("announces ranges and resolved book labels", () => {
    expect(
      formatVerseTagChipAccessibilityLabel(
        { book: "john", chapter: 3, verseStart: 16, verseEnd: 18 },
        "John",
      ),
    ).toBe("Verse reference, John chapter 3 verses 16 through 18, double tap to preview");
    expect(
      formatVerseTagChipAccessibilityLabel(
        { book: "1-john", chapter: 3, verseStart: 16 },
        "1 John",
      ),
    ).toBe("Verse reference, 1 John chapter 3 verse 16, double tap to preview");
  });
});

describe("formatVerseTagTooltipTitle", () => {
  it("appends the active version abbreviation", () => {
    expect(formatVerseTagTooltipTitle("Mark 11:22", "KJV")).toBe("Mark 11:22 (KJV)");
  });
});

describe("computeVerseTagTooltipPosition", () => {
  const screenW = 390;
  const screenH = 844;
  const chip = { x: 120, y: 400, width: 88, height: 20 };

  it("prefers above the chip and centers horizontally", () => {
    const layout = computeVerseTagTooltipPosition(chip, screenW, screenH);
    expect(layout.placement).toBe("above");
    expect(layout.top).toBe(chip.y - VERSE_TAG_TOOLTIP_EST_HEIGHT_PX - VERSE_TAG_TOOLTIP_GAP_PX);
    expect(layout.width).toBe(VERSE_TAG_TOOLTIP_WIDTH_PX);
    expect(layout.left).toBe(chip.x + chip.width / 2 - layout.width / 2);
  });

  it("flips below when there is not enough room above", () => {
    const nearTop = { x: 40, y: 24, width: 72, height: 18 };
    const layout = computeVerseTagTooltipPosition(nearTop, screenW, screenH);
    expect(layout.placement).toBe("below");
    expect(layout.top).toBe(nearTop.y + nearTop.height + VERSE_TAG_TOOLTIP_GAP_PX);
  });

  it("keeps the tooltip on screen when the chip is near an edge", () => {
    const nearRight = { x: 340, y: 500, width: 40, height: 18 };
    const layout = computeVerseTagTooltipPosition(nearRight, screenW, screenH);
    expect(layout.left + layout.width).toBeLessThanOrEqual(screenW - 16);
    expect(layout.left).toBeGreaterThanOrEqual(16);
  });
});
