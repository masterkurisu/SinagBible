import { useCallback, useEffect } from "react";
import { Platform } from "react-native";
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import {
  evaluateTabBarScrollHidden,
  TAB_BAR_SLIDE_HIDE_MS,
  TAB_BAR_SLIDE_SHOW_MS,
} from "@/lib/reader-tab-bar-scroll-worklet";
import { useReaderTabBarSlideController } from "@/lib/reader-tab-bar-visibility-context";

const M3_EMPHASIZED_ACCELERATE = Easing.bezier(0.3, 0, 0.8, 0.15);
const M3_EMPHASIZED_DECELERATE = Easing.bezier(0.05, 0.7, 0.1, 1);

/** Snap slide progress + committed state to fully visible (no timing). */
function snapTabBarSlideToVisible(
  tabBarSlideProgressSV: SharedValue<number>,
  committedHiddenSV: SharedValue<boolean>,
  bottomPinnedSV: SharedValue<boolean>,
) {
  "worklet";
  cancelAnimation(tabBarSlideProgressSV);
  committedHiddenSV.value = false;
  bottomPinnedSV.value = false;
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
  /** Last hidden state that triggered a slide — gates withTiming inside the worklet. */
  const committedHiddenSV = useSharedValue(false);

  useEffect(() => {
    enabledSV.value = enabled;
  }, [enabled, enabledSV]);

  useEffect(() => {
    forceVisibleSV.value = forceVisible;
  }, [forceVisible, forceVisibleSV]);

  const applyForcedVisible = useCallback(() => {
    snapTabBarSlideToVisible(tabBarSlideProgressSV, committedHiddenSV, bottomPinnedSV);
    // readerScrollY and content metrics stay as-is — forceVisibleSV blocks re-hide while overlays are up.
    snapScrollHidden(false);
  }, [bottomPinnedSV, committedHiddenSV, snapScrollHidden, tabBarSlideProgressSV]);

  const resetOnChapterChange = useCallback(() => {
    readerScrollY.value = 0;
    snapTabBarSlideToVisible(tabBarSlideProgressSV, committedHiddenSV, bottomPinnedSV);
    contentHeightSV.value = 0;
    viewportHeightSV.value = 0;
    snapScrollHidden(false);
  }, [
    bottomPinnedSV,
    committedHiddenSV,
    contentHeightSV,
    readerScrollY,
    snapScrollHidden,
    tabBarSlideProgressSV,
    viewportHeightSV,
  ]);

  useAnimatedReaction(
    () => {
      if (!enabledSV.value || forceVisibleSV.value) return null;
      return evaluateTabBarScrollHidden(
        readerScrollY.value,
        contentHeightSV.value,
        viewportHeightSV.value,
        bottomPinnedSV,
        committedHiddenSV.value,
      );
    },
    (shouldHide) => {
      if (shouldHide === null) return;
      if (shouldHide === committedHiddenSV.value) return;

      committedHiddenSV.value = shouldHide;
      cancelAnimation(tabBarSlideProgressSV);

      if (shouldHide) {
        tabBarSlideProgressSV.value = 0;
        runOnJS(onHideSlideBegin)();
        tabBarSlideProgressSV.value = withTiming(
          1,
          {
            duration: TAB_BAR_SLIDE_HIDE_MS,
            easing: M3_EMPHASIZED_ACCELERATE,
          },
          (finished) => {
            "worklet";
            if (!finished) return;
            runOnJS(onHideSlideComplete)();
          },
        );
        return;
      }

      // Show: slide overlay up (1→0); native bar is already visible underneath.
      tabBarSlideProgressSV.value = 1;
      runOnJS(onShowSlideBegin)();
      tabBarSlideProgressSV.value = withTiming(
        0,
        {
          duration: TAB_BAR_SLIDE_SHOW_MS,
          easing: M3_EMPHASIZED_DECELERATE,
        },
        (finished) => {
          "worklet";
          if (!finished) return;
          runOnJS(onShowSlideComplete)();
        },
      );
    },
    [readerScrollY, contentHeightSV, viewportHeightSV, bottomPinnedSV, enabledSV, forceVisibleSV],
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
