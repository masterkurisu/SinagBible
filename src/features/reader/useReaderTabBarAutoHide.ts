import { useCallback, useEffect, useRef } from "react";
import { Platform, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import {
  useSetReaderTabBarScrollHidden,
  useSnapReaderTabBarScrollHidden,
} from "@/lib/reader-tab-bar-visibility-context";

/** Small dead zone at chapter top — keeps tab bar visible for tiny scroll corrections. */
const TOP_EDGE_PX = 16;
const BOTTOM_EDGE_PX = 48;
/**
 * Extra slack before hiding again after reaching the chapter end.
 * Covers list padding animation + native tab bar show/hide viewport resize.
 */
const BOTTOM_UNPIN_SCROLL_UP_PX = 96;
/** Ignore layout/content-size churn while tab bar slide + padding settle. */
const METRICS_COOLDOWN_MS = 260;

type ScrollMetrics = {
  y: number;
  contentHeight: number;
  viewportHeight: number;
};

type MetricsSource = "scroll" | "layout";

export function useReaderTabBarAutoHide({
  chapterRouteKey,
  enabled,
  forceVisible,
}: {
  chapterRouteKey: string;
  /** Android phones + tablets on the reader chapter screen. */
  enabled: boolean;
  /** Overlays, selection, onboarding — keep the tab bar visible. */
  forceVisible: boolean;
}) {
  const setScrollHidden = useSetReaderTabBarScrollHidden();
  const snapScrollHidden = useSnapReaderTabBarScrollHidden();
  const hiddenRef = useRef(false);
  const metricsRef = useRef<ScrollMetrics>({ y: 0, contentHeight: 0, viewportHeight: 0 });
  const bottomPinnedRef = useRef(false);
  const metricsCooldownUntilRef = useRef(0);

  const applyVisibility = useCallback(
    (shouldHide: boolean) => {
      if (hiddenRef.current === shouldHide) return;
      hiddenRef.current = shouldHide;
      setScrollHidden(shouldHide);
      metricsCooldownUntilRef.current = Date.now() + METRICS_COOLDOWN_MS;
      if (shouldHide) {
        bottomPinnedRef.current = false;
      }
    },
    [setScrollHidden],
  );

  const evaluateFromMetrics = useCallback(
    (source: MetricsSource) => {
      if (!enabled || forceVisible) {
        bottomPinnedRef.current = false;
        applyVisibility(false);
        return;
      }

      if (source !== "scroll" && Date.now() < metricsCooldownUntilRef.current) {
        return;
      }

      const { y, contentHeight, viewportHeight } = metricsRef.current;
      if (viewportHeight <= 0) return;

      const maxScrollY = Math.max(0, contentHeight - viewportHeight);
      const atTop = y <= TOP_EDGE_PX;
      const nearBottom = maxScrollY <= BOTTOM_EDGE_PX || y >= maxScrollY - BOTTOM_EDGE_PX;

      if (bottomPinnedRef.current) {
        const scrolledUpFromBottom = y < maxScrollY - BOTTOM_UNPIN_SCROLL_UP_PX;
        if (scrolledUpFromBottom && !atTop) {
          bottomPinnedRef.current = false;
          applyVisibility(true);
        }
        return;
      }

      if (atTop || nearBottom) {
        if (nearBottom) {
          bottomPinnedRef.current = true;
        }
        applyVisibility(false);
        return;
      }

      applyVisibility(true);
    },
    [applyVisibility, enabled, forceVisible],
  );

  const onTabBarScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (Platform.OS !== "android" || !enabled) return;
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      metricsRef.current = {
        y: contentOffset.y,
        contentHeight: contentSize.height,
        viewportHeight: layoutMeasurement.height,
      };
      evaluateFromMetrics("scroll");
    },
    [enabled, evaluateFromMetrics],
  );

  const onTabBarContentSizeChange = useCallback(
    (_width: number, height: number) => {
      if (Platform.OS !== "android" || !enabled) return;
      metricsRef.current = { ...metricsRef.current, contentHeight: height };
      evaluateFromMetrics("layout");
    },
    [enabled, evaluateFromMetrics],
  );

  const onTabBarListLayout = useCallback(
    (height: number) => {
      if (Platform.OS !== "android" || !enabled) return;
      metricsRef.current = { ...metricsRef.current, viewportHeight: height };
      evaluateFromMetrics("layout");
    },
    [enabled, evaluateFromMetrics],
  );

  useEffect(() => {
    hiddenRef.current = false;
    bottomPinnedRef.current = false;
    metricsCooldownUntilRef.current = 0;
    metricsRef.current = { y: 0, contentHeight: 0, viewportHeight: 0 };
    snapScrollHidden(false);
  }, [chapterRouteKey, snapScrollHidden]);

  useEffect(() => {
    if (forceVisible) {
      applyVisibility(false);
    }
  }, [forceVisible, applyVisibility]);

  return {
    onTabBarScroll,
    onTabBarContentSizeChange,
    onTabBarListLayout,
  };
}
