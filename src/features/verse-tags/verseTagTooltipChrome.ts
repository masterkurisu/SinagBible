import { isMobileAppDarkThemeId, type MobileAppThemeBundle } from "@sinag-bible/tokens";
import { getReaderSheetChrome } from "@/lib/reader-sheet-chrome";

export type VerseTagTooltipColors = {
  backgroundColor: string;
  titleColor: string;
  descriptionColor: string;
  borderColor?: string;
};

/** Elevated tooltip surface so verse previews stay legible on dark journal pages. */
export function getVerseTagTooltipColors(bundle: MobileAppThemeBundle): VerseTagTooltipColors {
  const chrome = getReaderSheetChrome(bundle);

  if (!isMobileAppDarkThemeId(bundle.id)) {
    return {
      backgroundColor: bundle.reader.popoverSurface,
      titleColor: chrome.onSurface,
      descriptionColor: chrome.onSurfaceVariant,
    };
  }

  const backgroundColor =
    bundle.id === "night"
      ? bundle.journal.chipActiveBackground
      : bundle.ui.parchmentDark;

  return {
    backgroundColor,
    titleColor: chrome.onSurface,
    descriptionColor: chrome.onSurfaceVariant,
    borderColor: bundle.ui.borderSolid,
  };
}
