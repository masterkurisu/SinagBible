import { useCallback, useEffect, useRef, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { animateM3ScrollChromeVisibility } from "@/lib/high-refresh-scroll";

/** Reveal once the entry has been scrolled past this offset — same idea as the reader FAB. */
export const JOURNAL_DETAIL_SCROLL_TO_TOP_THRESHOLD_PX = 80;
/** Fade the FAB out after the user rests. */
export const JOURNAL_DETAIL_SCROLL_TO_TOP_IDLE_HIDE_MS = 1_500;
/** Velocity (pt/s) above which a fling defers reveal until momentum ends. */
const JOURNAL_DETAIL_FAB_FLING_VELOCITY_PX_S = 50;

export function useJournalDetailScrollToTopFab(scrollY: SharedValue<number>) {
  const fabOpacity = useSharedValue(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUserScrollActiveRef = useRef(false);
  const fabShownRef = useRef(false);
  const [pointerEventsEnabled, setPointerEventsEnabled] = useState(false);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current != null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const animateVisibility = useCallback(
    (visible: boolean) => {
      animateM3ScrollChromeVisibility(fabOpacity, visible);
      fabShownRef.current = visible;
      setPointerEventsEnabled(visible);
    },
    [fabOpacity],
  );

  const hideFab = useCallback(() => {
    clearIdleTimer();
    animateVisibility(false);
  }, [animateVisibility, clearIdleTimer]);

  const scheduleIdleHide = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      if (!isUserScrollActiveRef.current) {
        animateVisibility(false);
      }
    }, JOURNAL_DETAIL_SCROLL_TO_TOP_IDLE_HIDE_MS);
  }, [animateVisibility, clearIdleTimer]);

  const showFabIfEligible = useCallback(() => {
    if (scrollY.value < JOURNAL_DETAIL_SCROLL_TO_TOP_THRESHOLD_PX) {
      hideFab();
      return;
    }
    animateVisibility(true);
    scheduleIdleHide();
  }, [animateVisibility, hideFab, scheduleIdleHide, scrollY]);

  const onScrollBeginDrag = useCallback(() => {
    isUserScrollActiveRef.current = true;
    hideFab();
  }, [hideFab]);

  const onScrollEndDrag = useCallback(
    (event?: NativeSyntheticEvent<NativeScrollEvent>) => {
      const vy = event?.nativeEvent.velocity?.y ?? 0;
      const hasMomentum = Math.abs(vy) >= JOURNAL_DETAIL_FAB_FLING_VELOCITY_PX_S;
      if (!hasMomentum) {
        isUserScrollActiveRef.current = false;
        showFabIfEligible();
      }
    },
    [showFabIfEligible],
  );

  const onMomentumScrollEnd = useCallback(() => {
    isUserScrollActiveRef.current = false;
    showFabIfEligible();
  }, [showFabIfEligible]);

  const notifyScrolledToTop = useCallback(() => {
    hideFab();
  }, [hideFab]);

  useEffect(() => {
    return () => {
      clearIdleTimer();
    };
  }, [clearIdleTimer]);

  const fabAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fabOpacity.value,
  }));

  return {
    fabAnimatedStyle,
    pointerEventsEnabled,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
    notifyScrolledToTop,
  };
}
