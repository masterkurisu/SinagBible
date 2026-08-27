import type { MobileAppThemeBundle } from "@sinag-bible/tokens";

/** M3 surface roles for the tab-bar search overlay, mapped from the active theme. */
export type SearchOverlayChrome = {
  primary: string;
  onSurface: string;
  onSurfaceVariant: string;
  surfaceContainerLow: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  outline: string;
  outlineVariant: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  iconRipple: string;
};

export function getSearchOverlayChrome(bundle: MobileAppThemeBundle): SearchOverlayChrome {
  const { ui, journal, chrome, search } = bundle;
  return {
    primary: search.tint,
    onSurface: ui.brown800,
    onSurfaceVariant: ui.brown500,
    // Neutral tonal steps from the same palette as the sheet, so the pill
    // reads as "one step up" in every theme instead of an unrelated accent
    // color. Ordering (low -> highest) holds across all themes, light or dark:
    // parchmentMid -> parchmentDeep -> parchmentDark.
    surfaceContainerLow: ui.parchmentMid,
    surfaceContainerHigh: ui.parchmentDeep,
    surfaceContainerHighest: ui.parchmentDark,
    outline: ui.tan300,
    outlineVariant: ui.borderSolid,
    secondaryContainer: journal.chipActiveBackground,
    onSecondaryContainer: journal.chipActiveText,
    iconRipple: chrome.androidRipple,
  };
}
