import { Platform } from "react-native";

/**
 * Core tab bar content height (approx), before system gesture/home inset.
 * iOS ~49pt. Android: Material bottom nav with `labelVisibilityMode="labeled"` is taller than 56dp;
 * use a slightly generous value so FABs/sheets clear the bar on devices with small bottom inset.
 */
const NATIVE_TAB_BAR_CORE_PX = Platform.select({
  ios: 20,
  android: 20,
  default: 40,
});

/**
 * Offset from the bottom of the screen to place floating controls (FAB, reader action bar)
 * above the native tab bar.
 */
export function nativeTabFabOffsetPx(safeAreaBottom: number): number {
  return NATIVE_TAB_BAR_CORE_PX + safeAreaBottom + 12;
}

/** Bottom inset so a sheet’s bottom edge sits `gapPx` above the native tab bar. */
export function nativeTabSheetBottomInsetPx(safeAreaBottom: number, gapPx: number): number {
  return NATIVE_TAB_BAR_CORE_PX + safeAreaBottom + gapPx;
}

/** Extra scroll padding when content is laid out above a docked tab bar (not an overlay). */
export function nativeTabScrollPaddingBottomPx(extraPx = 28): number {
  return extraPx;
}

/** Journal list: room below FAB plus native tab clearance. */
export function nativeTabJournalListPaddingBottomPx(safeAreaBottom: number): number {
  return nativeTabFabOffsetPx(safeAreaBottom) + 60 + 32;
}

/**
 * iPad landscape: expo-router `NativeTabs` can render as a top-centered floating pill that sits
 * below the status bar but is not included in `SafeAreaInsets.top`. Add this so modal sheets clear it.
 */
export function nativeFloatingTabBarTopReservePx(isLandscape: boolean, isTablet: boolean): number {
  if (Platform.OS !== "ios" || !isTablet || !isLandscape) return 0;
  return 62;
}
