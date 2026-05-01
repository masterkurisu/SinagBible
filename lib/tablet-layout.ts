import { Platform } from "react-native";

/** Android: shortest window side at/above this is treated as tablet (Material ~600dp). */
const TABLET_MIN_SHORTEST_SIDE = 600;

/** True for iPad / large Android tablets (split by window size on Android). */
export function isTabletLayout(windowWidth: number, windowHeight: number): boolean {
  const shortest = Math.min(windowWidth, windowHeight);
  if (Platform.OS === "ios") {
    const isPad = (Platform as { isPad?: boolean }).isPad === true;
    /** `isPad` is false for iPhone-only builds on iPad; size check still catches large windows. */
    return isPad || shortest >= TABLET_MIN_SHORTEST_SIDE;
  }
  return shortest >= TABLET_MIN_SHORTEST_SIDE;
}

/**
 * Centered column width for journal/new-entry on tablets so fields are not stretched edge-to-edge
 * and vertical flex (reflection editor) lays out predictably.
 */
export const TABLET_NEW_ENTRY_MAX_WIDTH_PX = 540;

/** Visual card width for tablet new-entry sheets (slightly wider than inner form column). */
export const TABLET_NEW_ENTRY_SHEET_MAX_WIDTH_PX = 620;
