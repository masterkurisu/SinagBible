import { useCallback, useEffect, useRef } from "react";
import { Platform, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSetReaderTabBarScrollHidden } from "@/lib/reader-tab-bar-visibility-context";

const TOP_EDGE_PX = 40;
const BOTTOM_EDGE_PX = 48;

type ScrollMetrics = {
  y: number;
  contentHeight: number;
  viewportHeight: number;
};

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
  const hiddenRef = useRef(false);
  const metricsRef = useRef<ScrollMetrics>({ y: 0, contentHeight: 0, viewportHeight: 0 });

  const applyVisibility = useCallback(
    (shouldHide: boolean) => {
      if (hiddenRef.current === shouldHide) return;
      hiddenRef.current = shouldHide;
      setScrollHidden(shouldHide);
    },
    [setScrollHidden],
  );

  const evaluateFromMetrics = useCallback(() => {
    if (!enabled || forceVisible) {
      applyVisibility(false);
      return;
    }

    const { y, contentHeight, viewportHeight } = metricsRef.current;
    if (viewportHeight <= 0) return;

    const maxScrollY = Math.max(0, contentHeight - viewportHeight);
    const atTop = y <= TOP_EDGE_PX;
    const atBottom = maxScrollY <= BOTTOM_EDGE_PX || y >= maxScrollY - BOTTOM_EDGE_PX;
    applyVisibility(!(atTop || atBottom));
  }, [applyVisibility, enabled, forceVisible]);

  const onTabBarScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (Platform.OS !== "android" || !enabled) return;
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      metricsRef.current = {
        y: contentOffset.y,
        contentHeight: contentSize.height,
        viewportHeight: layoutMeasurement.height,
      };
      evaluateFromMetrics();
    },
    [enabled, evaluateFromMetrics],
  );

  const onTabBarContentSizeChange = useCallback(
    (_width: number, height: number) => {
      if (Platform.OS !== "android" || !enabled) return;
      metricsRef.current = { ...metricsRef.current, contentHeight: height };
      evaluateFromMetrics();
    },
    [enabled, evaluateFromMetrics],
  );

  const onTabBarListLayout = useCallback(
    (height: number) => {
      if (Platform.OS !== "android" || !enabled) return;
      metricsRef.current = { ...metricsRef.current, viewportHeight: height };
      evaluateFromMetrics();
    },
    [enabled, evaluateFromMetrics],
  );

  useEffect(() => {
    hiddenRef.current = false;
    metricsRef.current = { y: 0, contentHeight: 0, viewportHeight: 0 };
    setScrollHidden(false);
  }, [chapterRouteKey, setScrollHidden]);

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
