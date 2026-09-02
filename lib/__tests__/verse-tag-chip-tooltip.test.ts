import { describe, expect, it } from "vitest";
import {
  formatVerseTagChipAccessibilityLabel,
  formatVerseTagComposerError,
  formatVerseTagTooltipDescription,
  formatVerseTagTooltipTitle,
} from "@/src/features/verse-tags/verseTagChipCopy";
import {
  computeVerseTagTooltipPosition,
  VERSE_TAG_TOOLTIP_EST_HEIGHT_PX,
  VERSE_TAG_TOOLTIP_GAP_PX,
  VERSE_TAG_TOOLTIP_WIDTH_PX,
} from "@/src/features/verse-tags/verseTagTooltipLayout";
import { getMobileAppThemeBundle, MOBILE_APP_THEME_IDS } from "@sinag-bible/tokens";
import { getReaderSheetChrome } from "@/lib/reader-sheet-chrome";

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

  it("updates the title when the active translation abbreviation changes", () => {
    expect(formatVerseTagTooltipTitle("John 3:16", "WEB")).toBe("John 3:16 (WEB)");
  });
});

describe("formatVerseTagTooltipDescription", () => {
  it("uses distinct loading, offline, error, and not-found copy", () => {
    expect(formatVerseTagTooltipDescription({ kind: "loading" })).toBe("Loading verse…");
    expect(formatVerseTagTooltipDescription({ kind: "offline" })).toBe(
      "This verse isn't available offline.",
    );
    expect(formatVerseTagTooltipDescription({ kind: "error" })).toBe(
      "Couldn't load this verse. Try again.",
    );
    expect(formatVerseTagTooltipDescription({ kind: "not-found" })).toBe("Verse not found.");
    expect(
      formatVerseTagTooltipDescription({ kind: "ready", text: "For God so loved the world" }),
    ).toBe("For God so loved the world");
    expect(
      formatVerseTagTooltipDescription({
        kind: "ready",
        text: "Have faith in God",
        truncated: true,
      }),
    ).toBe("Have faith in God…");
  });
});

describe("formatVerseTagComposerError", () => {
  it("explains invalid chapter, verse, and range", () => {
    expect(formatVerseTagComposerError("invalid-chapter")).toBe(
      "That chapter is not in this translation.",
    );
    expect(formatVerseTagComposerError("invalid-verse")).toBe("That verse is not in this chapter.");
    expect(formatVerseTagComposerError("invalid-range")).toBe(
      "Only same-chapter ranges can be tagged.",
    );
  });
});

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(hexToRgb(foreground)), relativeLuminance(hexToRgb(background)));
  const darker = Math.min(relativeLuminance(hexToRgb(foreground)), relativeLuminance(hexToRgb(background)));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("verse-tag chip theme contrast", () => {
  it("keeps chip label contrast at WCAG AA for default, dark, night, and rose", () => {
    for (const id of ["default", "dark", "night", "rose"] as const) {
      const chrome = getReaderSheetChrome(getMobileAppThemeBundle(id));
      expect(contrastRatio(chrome.onSecondaryContainer, chrome.secondaryContainer)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it("keeps chip label contrast at WCAG AA across every shipped theme", () => {
    for (const id of MOBILE_APP_THEME_IDS) {
      const chrome = getReaderSheetChrome(getMobileAppThemeBundle(id));
      expect(contrastRatio(chrome.onSecondaryContainer, chrome.secondaryContainer)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
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

  it("flips below when safe-area top leaves too little room above the chip", () => {
    const nearStatusBar = { x: 16, y: 220, width: 88, height: 20 };
    const withoutSafe = computeVerseTagTooltipPosition(
      nearStatusBar,
      screenW,
      screenH,
      VERSE_TAG_TOOLTIP_WIDTH_PX,
      VERSE_TAG_TOOLTIP_EST_HEIGHT_PX,
    );
    expect(withoutSafe.placement).toBe("above");

    const withSafe = computeVerseTagTooltipPosition(
      nearStatusBar,
      screenW,
      screenH,
      VERSE_TAG_TOOLTIP_WIDTH_PX,
      VERSE_TAG_TOOLTIP_EST_HEIGHT_PX,
      { top: 48 },
    );
    expect(withSafe.placement).toBe("below");
    expect(withSafe.top).toBe(nearStatusBar.y + nearStatusBar.height + VERSE_TAG_TOOLTIP_GAP_PX);
  });
});
