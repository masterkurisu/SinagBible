import { describe, expect, it } from "vitest";
import { getMobileAppThemeBundle } from "@sinag-bible/tokens";
import { getVerseTagTooltipColors } from "@/src/features/verse-tags/verseTagTooltipChrome";

describe("getVerseTagTooltipColors", () => {
  it("keeps the default white tooltip on light themes", () => {
    const colors = getVerseTagTooltipColors(getMobileAppThemeBundle("default"));
    expect(colors.backgroundColor).toBe("#ffffff");
    expect(colors.borderColor).toBeUndefined();
  });

  it("lifts dark-theme tooltips above the journal page with a border", () => {
    const colors = getVerseTagTooltipColors(getMobileAppThemeBundle("dark"));
    expect(colors.backgroundColor).toBe("#484038");
    expect(colors.borderColor).toBe("#3d3428");
  });

  it("uses a lighter chip-toned surface on night", () => {
    const night = getMobileAppThemeBundle("night");
    const colors = getVerseTagTooltipColors(night);
    expect(colors.backgroundColor).toBe(night.journal.chipActiveBackground);
    expect(colors.borderColor).toBe(night.ui.borderSolid);
  });
});
