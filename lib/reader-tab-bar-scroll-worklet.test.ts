import { describe, expect, it } from "vitest";
import type { SharedValue } from "react-native-reanimated";
import {
  TAB_BAR_BOTTOM_EDGE_PX,
  TAB_BAR_BOTTOM_UNPIN_SCROLL_UP_PX,
  TAB_BAR_SLIDE_DRAG_PX,
  updateTabBarSlideProgress,
} from "./reader-tab-bar-scroll-worklet";

function sv<T>(value: T): SharedValue<T> {
  return { value } as SharedValue<T>;
}

function makeState(overrides?: {
  y?: number;
  pinned?: boolean;
  drag?: number;
  prevMax?: number;
}) {
  return {
    prevY: sv(overrides?.y ?? -1),
    bottomPinned: sv(overrides?.pinned ?? false),
    dragAccum: sv(overrides?.drag ?? 0),
    prevMaxScrollY: sv(overrides?.prevMax ?? -1),
  };
}

function step(
  state: ReturnType<typeof makeState>,
  y: number,
  contentHeight: number,
  viewportHeight: number,
) {
  return updateTabBarSlideProgress(
    y,
    state.prevY,
    contentHeight,
    viewportHeight,
    state.bottomPinned,
    state.dragAccum,
    state.prevMaxScrollY,
  );
}

describe("updateTabBarSlideProgress", () => {
  const contentHeight = 4000;
  const viewportShown = 800;
  const maxShown = contentHeight - viewportShown;

  it("stays visible at the chapter end", () => {
    const state = makeState();
    expect(step(state, maxShown, contentHeight, viewportShown)).toBe(0);
    expect(state.bottomPinned.value).toBe(true);
  });

  it("stays pinned while scrolling a little up from the end", () => {
    const state = makeState();
    step(state, maxShown, contentHeight, viewportShown);
    expect(step(state, maxShown - 80, contentHeight, viewportShown)).toBe(0);
    expect(state.bottomPinned.value).toBe(true);
  });

  it("hides after scrolling past the unpin distance", () => {
    const state = makeState();
    step(state, maxShown, contentHeight, viewportShown);
    const hidden = step(
      state,
      maxShown - TAB_BAR_BOTTOM_UNPIN_SCROLL_UP_PX - 1,
      contentHeight,
      viewportShown,
    );
    expect(hidden).toBe(1);
    expect(state.bottomPinned.value).toBe(false);
    expect(state.dragAccum.value).toBe(TAB_BAR_SLIDE_DRAG_PX);
  });

  it("does not flicker when hiding the tab bar grows the viewport", () => {
    const state = makeState();
    step(state, maxShown, contentHeight, viewportShown);
    const yUnpinned = maxShown - TAB_BAR_BOTTOM_UNPIN_SCROLL_UP_PX - 1;
    expect(step(state, yUnpinned, contentHeight, viewportShown)).toBe(1);

    // Native tab hide can expand the list enough that y is now "at the end"
    // (and may clamp toward the new max). That layout change must not re-show.
    const viewportHidden = viewportShown + TAB_BAR_BOTTOM_UNPIN_SCROLL_UP_PX;
    const maxHidden = contentHeight - viewportHidden;
    const yClamped = Math.min(yUnpinned, maxHidden);

    expect(yClamped).toBeGreaterThanOrEqual(maxHidden - TAB_BAR_BOTTOM_EDGE_PX);
    expect(step(state, yClamped, contentHeight, viewportHidden)).toBe(1);
    expect(state.bottomPinned.value).toBe(false);

    expect(step(state, yClamped, contentHeight, viewportHidden)).toBe(1);
    expect(step(state, yClamped, contentHeight, viewportHidden)).toBe(1);
  });

  it("shows again when the user scrolls down to the (new) chapter end", () => {
    const state = makeState();
    step(state, maxShown, contentHeight, viewportShown);
    const yUnpinned = maxShown - TAB_BAR_BOTTOM_UNPIN_SCROLL_UP_PX - 1;
    step(state, yUnpinned, contentHeight, viewportShown);

    const viewportHidden = viewportShown + 32;
    const maxHidden = contentHeight - viewportHidden;
    step(state, yUnpinned, contentHeight, viewportHidden);

    expect(yUnpinned).toBeLessThan(maxHidden - TAB_BAR_BOTTOM_EDGE_PX);
    expect(step(state, maxHidden, contentHeight, viewportHidden)).toBe(0);
    expect(state.bottomPinned.value).toBe(true);
  });

  it("keeps the bar visible when the chapter fits on one screen", () => {
    const state = makeState();
    expect(step(state, 0, 500, 800)).toBe(0);
    expect(step(state, 0, 500, 800)).toBe(0);
  });
});
