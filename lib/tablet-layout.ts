import { Platform } from "react-native";
import { DeviceType, deviceType } from "expo-device";

/** Android: shortest window side at/above this is treated as tablet (Material ~600dp). */
const TABLET_MIN_SHORTEST_SIDE = 600;

function isIosTabletDevice(): boolean {
  return (Platform as { isPad?: boolean }).isPad === true;
}

function isAndroidTabletDevice(windowWidth: number, windowHeight: number): boolean {
  if (deviceType === DeviceType.TABLET || deviceType === DeviceType.DESKTOP) {
    return true;
  }
  return Math.min(windowWidth, windowHeight) >= TABLET_MIN_SHORTEST_SIDE;
}

/** True for iPad / large Android tablets (split by window size on Android). */
export function isTabletLayout(windowWidth: number, windowHeight: number): boolean {
  const shortest = Math.min(windowWidth, windowHeight);
  if (Platform.OS === "ios") {
    /** `isPad` is false for iPhone-only builds on iPad; size check still catches large windows. */
    return isIosTabletDevice() || shortest >= TABLET_MIN_SHORTEST_SIDE;
  }
  if (Platform.OS === "android") {
    return isAndroidTabletDevice(windowWidth, windowHeight);
  }
  return shortest >= TABLET_MIN_SHORTEST_SIDE;
}

export function isLandscapeLayout(windowWidth: number, windowHeight: number): boolean {
  return windowWidth > windowHeight;
}

/** Reader two-column verse list: tablet-class device in landscape (matches iPad behavior). */
export function isReaderTabletLandscapeTwoColumn(
  windowWidth: number,
  windowHeight: number,
): boolean {
  return isTabletLayout(windowWidth, windowHeight) && isLandscapeLayout(windowWidth, windowHeight);
}

/**
 * Centered column width for journal/new-entry on tablets so fields are not stretched edge-to-edge
 * and vertical flex (reflection editor) lays out predictably.
 */
export const TABLET_NEW_ENTRY_MAX_WIDTH_PX = 540;

/** Visual card width for tablet new-entry sheets (slightly wider than inner form column). */
export const TABLET_NEW_ENTRY_SHEET_MAX_WIDTH_PX = 620;
