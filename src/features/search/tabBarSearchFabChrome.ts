import { Platform } from "react-native";
import { ANDROID_NAV_BAR_BODY_PX } from "@/lib/android-nav-bar-chrome";

/** M3 expressive extra-large circular icon button in the nav bar search slot. */
export const TAB_BAR_SEARCH_FAB_SIZE_PX = 64;

export const TAB_BAR_SEARCH_FAB_ICON_PX = 28;

/** M3 FAB-style resting elevation for the search circle. */
export const TAB_BAR_SEARCH_FAB_ELEVATION_PX = 6;

const IOS_TAB_BAR_BODY_PX = 49;

/** Vertical offset from the screen bottom to the FAB's bottom edge. */
export function tabBarSearchFabBottomPx(safeAreaBottom: number): number {
  const body = Platform.OS === "android" ? ANDROID_NAV_BAR_BODY_PX : IOS_TAB_BAR_BODY_PX;
  return safeAreaBottom + Math.max(0, (body - TAB_BAR_SEARCH_FAB_SIZE_PX) / 2);
}

/** `left` position to center the FAB in the fourth nav-bar slot (4-tab layout). */
export function tabBarSearchFabLeftPx(screenWidth: number): number {
  return screenWidth * (7 / 8) - TAB_BAR_SEARCH_FAB_SIZE_PX / 2;
}
