/** M3 `surface` — settings strip revealed when the reader slides aside. */
export const READER_MOBILE_SETTINGS_PANEL_BG = "#FFFFFF";

/** M3 compact navigation rail width (80dp). @deprecated Use expanded rail on phone. */
export const READER_SETTINGS_NAV_RAIL_WIDTH_PX = 80;

/** M3 rail destination min height (56dp). */
export const READER_SETTINGS_NAV_RAIL_ITEM_HEIGHT_PX = 56;

/** M3 expanded navigation rail width bounds (phone). */
export const READER_SETTINGS_EXPANDED_NAV_RAIL_MIN_WIDTH_PX = 200;
export const READER_SETTINGS_EXPANDED_NAV_RAIL_MAX_WIDTH_PX = 280;

/** Phone expanded rail width — also drives how far the reader slides aside. */
export function readerExpandedNavRailWidthPx(screenWidth: number): number {
  return Math.max(
    READER_SETTINGS_EXPANDED_NAV_RAIL_MIN_WIDTH_PX,
    Math.min(READER_SETTINGS_EXPANDED_NAV_RAIL_MAX_WIDTH_PX, Math.round(screenWidth * 0.42)),
  );
}

export const READER_M3_ON_SURFACE = "#1C1B1F";
export const READER_M3_ON_SURFACE_VARIANT = "#49454F";
export const READER_M3_SURFACE_CONTAINER = "#F3EDF7";
export const READER_M3_ERROR = "#B3261E";
export const READER_M3_ERROR_CONTAINER = "#F9DEDC";
export const READER_M3_ON_ERROR_CONTAINER = "#410E0B";
