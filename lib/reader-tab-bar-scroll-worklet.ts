import type { SharedValue } from "react-native-reanimated";

/** Small dead zone at chapter top — keeps tab bar visible for tiny scroll corrections. */
export const TAB_BAR_TOP_EDGE_PX = 16;
export const TAB_BAR_BOTTOM_EDGE_PX = 48;
/**
 * Extra slack before hiding again after reaching the chapter end.
 * Covers list padding animation + native tab bar show/hide viewport resize.
 */
export const TAB_BAR_BOTTOM_UNPIN_SCROLL_UP_PX = 96;
/** Prevents rapid hide/show flapping near thresholds once the JS bridge throttle is gone. */
export const TAB_BAR_SCROLL_HYSTERESIS_PX = 8;

/** M3 emphasized motion — faster exit, slightly softer enter. */
export const TAB_BAR_SLIDE_HIDE_MS = 150;
export const TAB_BAR_SLIDE_SHOW_MS = 200;

export function evaluateTabBarScrollHidden(
  y: number,
  contentHeight: number,
  viewportHeight: number,
  bottomPinned: SharedValue<boolean>,
  currentlyHidden: boolean,
): boolean {
  "worklet";
  if (viewportHeight <= 0) return false;

  const maxScrollY = Math.max(0, contentHeight - viewportHeight);
  const topShowEdge = TAB_BAR_TOP_EDGE_PX;
  const topHideEdge = TAB_BAR_TOP_EDGE_PX + TAB_BAR_SCROLL_HYSTERESIS_PX;
  const atTop = currentlyHidden ? y <= topShowEdge : y <= topHideEdge;
  const bottomShowEdge = TAB_BAR_BOTTOM_EDGE_PX;
  const bottomHideEdge = TAB_BAR_BOTTOM_EDGE_PX + TAB_BAR_SCROLL_HYSTERESIS_PX;
  const nearBottom =
    maxScrollY <= bottomShowEdge ||
    (currentlyHidden
      ? y >= maxScrollY - bottomShowEdge
      : y >= maxScrollY - bottomHideEdge);

  if (bottomPinned.value) {
    const scrolledUpFromBottom = y < maxScrollY - TAB_BAR_BOTTOM_UNPIN_SCROLL_UP_PX;
    if (scrolledUpFromBottom && !atTop) {
      bottomPinned.value = false;
      return true;
    }
    return false;
  }

  if (atTop || nearBottom) {
    if (nearBottom) {
      bottomPinned.value = true;
    }
    return false;
  }

  return true;
}
