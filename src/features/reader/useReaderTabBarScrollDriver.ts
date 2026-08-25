import { useCallback, useEffect } from "react";
import { Platform } from "react-native";
import { runOnJS, useAnimatedReaction, useSharedValue, type SharedValue } from "react-native-reanimated";
import { updateTabBarSlideProgress } from "@/lib/reader-tab-bar-scroll-worklet";
import { useReaderTabBarSlideController } from "@/lib/reader-tab-bar-visibility-context";

/** Snap slide progress + drag/rest tracking to fully visible (no timing). */
function snapTabBarSlideToVisible(
  tabBarSlideProgressSV: SharedValue<number>,
  dragAccumSV: SharedValue<number>,
  prevYSV: SharedValue<number>,
  prevMaxScrollYSV: SharedValue<number>,
  bottomPinnedSV: SharedValue<boolean>,
  hideIntentSV: SharedValue<boolean>,
  restStateSV: SharedValue<number>,
) {
  "worklet";
  dragAccumSV.value = 0;
  prevYSV.value = -1;
  prevMaxScrollYSV.value = -1;
  bottomPinnedSV.value = false;
  hideIntentSV.value = false;
  restStateSV.value = -1;
  tabBarSlideProgressSV.value = 0;
}

export function useReaderTabBarScrollDriver({
  chapterRouteKey,
  enabled,
  forceVisible,
  readerScrollY,
}: {
  chapterRouteKey: string;
  /** Android phones + tablets on the reader chapter screen. */
  enabled: boolean;
  /** Overlays, selection, onboarding — keep the tab bar visible. */
  forceVisible: boolean;
  readerScrollY: SharedValue<number>;
}) {
  const {
    tabBarSlideProgressSV,
    onHideSlideBegin,
    onHideSlideComplete,
    onShowSlideBegin,
    onShowSlideComplete,
    snapScrollHidden,
  } = useReaderTabBarSlideController();

  const contentHeightSV = useSharedValue(0);
  const viewportHeightSV = useSharedValue(0);
  const bottomPinnedSV = useSharedValue(false);
  const enabledSV = useSharedValue(enabled);
  const forceVisibleSV = useSharedValue(forceVisible);
  /** Accumulated finger-travel since the last direction reversal — drives slide progress directly. */
  const dragAccumSV = useSharedValue(0);
  const prevYSV = useSharedValue(-1);
  const prevMaxScrollYSV = useSharedValue(-1);
  /** Current committed direction — mirrors which side (native shown/hidden) is authoritative right now. */
  const hideIntentSV = useSharedValue(false);
  /** -1 = resting shown, 1 = resting hidden, 0 = mid-drag. Gates one-shot begin/complete calls. */
  const restStateSV = useSharedValue(-1);

  useEffect(() => {
    enabledSV.value = enabled;
  }, [enabled, enabledSV]);

  useEffect(() => {
    forceVisibleSV.value = forceVisible;
  }, [forceVisible, forceVisibleSV]);

  const applyForcedVisible = useCallback(() => {
    snapTabBarSlideToVisible(
      tabBarSlideProgressSV,
      dragAccumSV,
      prevYSV,
      prevMaxScrollYSV,
      bottomPinnedSV,
      hideIntentSV,
      restStateSV,
    );
    // readerScrollY and content metrics stay as-is — forceVisibleSV blocks re-hide while overlays are up.
    snapScrollHidden(false);
  }, [
    bottomPinnedSV,
    dragAccumSV,
    hideIntentSV,
    prevMaxScrollYSV,
    prevYSV,
    restStateSV,
    snapScrollHidden,
    tabBarSlideProgressSV,
  ]);

  const resetOnChapterChange = useCallback(() => {
    readerScrollY.value = 0;
    snapTabBarSlideToVisible(
      tabBarSlideProgressSV,
      dragAccumSV,
      prevYSV,
      prevMaxScrollYSV,
      bottomPinnedSV,
      hideIntentSV,
      restStateSV,
    );
    contentHeightSV.value = 0;
    viewportHeightSV.value = 0;
    snapScrollHidden(false);
  }, [
    bottomPinnedSV,
    contentHeightSV,
    dragAccumSV,
    hideIntentSV,
    prevMaxScrollYSV,
    prevYSV,
    readerScrollY,
    restStateSV,
    snapScrollHidden,
    tabBarSlideProgressSV,
    viewportHeightSV,
  ]);

  useAnimatedReaction(
    () => {
      if (!enabledSV.value || forceVisibleSV.value) return null;
      return updateTabBarSlideProgress(
        readerScrollY.value,
        prevYSV,
        contentHeightSV.value,
        viewportHeightSV.value,
        bottomPinnedSV,
        dragAccumSV,
        prevMaxScrollYSV,
      );
    },
    (progress) => {
      if (progress === null) return;

      // Direct, continuous assignment every frame — same execution as the header title's
      // scroll-driven opacity interpolation. No withTiming, no separate animation clock.
      const prevProgress = tabBarSlideProgressSV.value;
      tabBarSlideProgressSV.value = progress;

      if (progress > prevProgress && !hideIntentSV.value) {
        hideIntentSV.value = true;
        runOnJS(onHideSlideBegin)();
      } else if (progress < prevProgress && hideIntentSV.value) {
        hideIntentSV.value = false;
        runOnJS(onShowSlideBegin)();
      }

      if (progress >= 1 && restStateSV.value !== 1) {
        restStateSV.value = 1;
        runOnJS(onHideSlideComplete)();
      } else if (progress <= 0 && restStateSV.value !== -1) {
        restStateSV.value = -1;
        runOnJS(onShowSlideComplete)();
      } else if (progress > 0 && progress < 1) {
        restStateSV.value = 0;
      }
    },
    [
      readerScrollY,
      contentHeightSV,
      viewportHeightSV,
      bottomPinnedSV,
      dragAccumSV,
      prevYSV,
      prevMaxScrollYSV,
      enabledSV,
      forceVisibleSV,
    ],
  );

  useEffect(() => {
    resetOnChapterChange();
  }, [chapterRouteKey, resetOnChapterChange]);

  useEffect(() => {
    if (forceVisible || !enabled) {
      applyForcedVisible();
    }
  }, [forceVisible, enabled, applyForcedVisible]);

  const onTabBarContentSizeChange = useCallback(
    (_width: number, height: number) => {
      if (Platform.OS !== "android" || !enabled) return;
      contentHeightSV.value = height;
    },
    [contentHeightSV, enabled],
  );

  const onTabBarListLayout = useCallback(
    (height: number) => {
      if (Platform.OS !== "android" || !enabled) return;
      viewportHeightSV.value = height;
    },
    [enabled, viewportHeightSV],
  );

  return {
    contentHeightSV,
    viewportHeightSV,
    onTabBarContentSizeChange,
    onTabBarListLayout,
  };
}
