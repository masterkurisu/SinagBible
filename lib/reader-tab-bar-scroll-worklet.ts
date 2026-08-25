import type { SharedValue } from "react-native-reanimated";

/** Small dead zone at chapter top — keeps tab bar visible for tiny scroll corrections. */
export const TAB_BAR_TOP_EDGE_PX = 16;
export const TAB_BAR_BOTTOM_EDGE_PX = 48;
/**
 * Extra slack before hiding again after reaching the chapter end.
 * Covers list padding animation + native tab bar show/hide viewport resize.
 */
export const TAB_BAR_BOTTOM_UNPIN_SCROLL_UP_PX = 96;

/**
 * Finger-travel distance (px) that fully hides/shows the tab bar — mirrors how the
 * header title fade drives its opacity directly off `readerScrollY` via `interpolate`
 * rather than a fixed-duration `withTiming`. The slide progress below is the same idea:
 * a plain 0–1 value computed every frame from the raw scroll delta, so the tab bar
 * tracks the gesture 1:1 instead of animating on its own clock.
 */
export const TAB_BAR_SLIDE_DRAG_PX = 120;

/** Nominal settle time used by callers that need to wait out a forced "show" (no animation is timed anymore). */
export const TAB_BAR_SLIDE_SHOW_MS = 220;

/** Ignore implausibly large per-frame jumps (native tab bar show/hide resizing the scroll viewport). */
const MAX_PLAUSIBLE_FRAME_DELTA_PX = 120;

/**
 * Advances the drag accumulator by the latest scroll delta and returns the resulting
 * 0–1 slide progress (0 = fully shown, 1 = fully hidden). Pure continuous tracking —
 * no timing curve, no discrete threshold snap — same execution model as the header
 * title's scroll-driven opacity interpolation.
 *
 * The accumulator only ever grows from downward scroll — scrolling back up mid-chapter
 * does not un-hide the bar. It only resets (and the bar reappears) once the scroll
 * position actually reaches the chapter's top or bottom edge.
 */
export function updateTabBarSlideProgress(
  y: number,
  prevY: SharedValue<number>,
  contentHeight: number,
  viewportHeight: number,
  bottomPinned: SharedValue<boolean>,
  dragAccum: SharedValue<number>,
): number {
  "worklet";
  if (viewportHeight <= 0) {
    prevY.value = y;
    return 0;
  }

  const prev = prevY.value < 0 ? y : prevY.value;
  const dy = y - prev;
  prevY.value = y;

  const maxScrollY = Math.max(0, contentHeight - viewportHeight);
  const atTop = y <= TAB_BAR_TOP_EDGE_PX;
  const nearBottom =
    maxScrollY <= TAB_BAR_BOTTOM_EDGE_PX || y >= maxScrollY - TAB_BAR_BOTTOM_EDGE_PX;

  if (atTop || nearBottom) {
    bottomPinned.value = nearBottom;
    dragAccum.value = 0;
    return 0;
  }

  if (bottomPinned.value) {
    if (y < maxScrollY - TAB_BAR_BOTTOM_UNPIN_SCROLL_UP_PX) {
      // Scrolled decisively away from the bottom edge — resume hidden immediately rather
      // than waiting for a fresh downward scroll. Mirrors leaving the top dead zone, where
      // departing the edge (there, via downward scroll) is itself what resumes hiding.
      bottomPinned.value = false;
      dragAccum.value = TAB_BAR_SLIDE_DRAG_PX;
      return 1;
    }
    dragAccum.value = 0;
    return 0;
  }

  const clampedDy = Math.abs(dy) > MAX_PLAUSIBLE_FRAME_DELTA_PX ? 0 : dy;
  if (clampedDy > 0) {
    dragAccum.value = Math.min(TAB_BAR_SLIDE_DRAG_PX, dragAccum.value + clampedDy);
  }
  return dragAccum.value / TAB_BAR_SLIDE_DRAG_PX;
}
