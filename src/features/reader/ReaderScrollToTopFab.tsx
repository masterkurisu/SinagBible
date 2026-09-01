import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { Pressable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { hapticLightImpact } from "@/lib/haptics";
import { animateM3ScrollChromeVisibility, snapM3ScrollChromeOpacity } from "@/lib/high-refresh-scroll";
import { READER_CHAPTER_NAV_ARROW_IDLE_HIDE_MS } from "@/src/features/reader/ReaderChapterNavArrows";

/** Tap target diameter for the back-to-top control. */
export const READER_SCROLL_TO_TOP_FAB_CIRCLE_PX = 59;
/** Chevron glyph size inside the circle. */
export const READER_SCROLL_TO_TOP_FAB_ICON_PX = 29;
/** Distance from the right edge of the reader content. */
export const READER_SCROLL_TO_TOP_FAB_RIGHT_EDGE_INSET_PX = 20;
/** Distance from the bottom edge of the reader content (above tab bar). */
export const READER_SCROLL_TO_TOP_FAB_BOTTOM_EDGE_INSET_PX = 20;
/** Opacity when the FAB is visible (before idle fade-out). */
export const READER_SCROLL_TO_TOP_FAB_VISIBLE_OPACITY = 0.9;
/** Reveal once the reader has scrolled past this offset. */
export const READER_SCROLL_TO_TOP_FAB_SHOW_THRESHOLD_PX = 80;
/** Extra pressable slop beyond the circle edge. */
export const READER_SCROLL_TO_TOP_FAB_HIT_SLOP_PX = 12;
/** Ignore sub-pixel scroll noise when deciding whether to hide during motion. */
const READER_SCROLL_TO_TOP_FAB_SCROLL_MOTION_THRESHOLD_PX = 6;
/** Velocity (pt/s) above which a fling defers reveal until momentum ends. */
const READER_SCROLL_TO_TOP_FAB_FLING_VELOCITY_PX_S = 50;

type ReaderScrollToTopFabProps = {
  opacitySV: SharedValue<number>;
  pointerEventsEnabled: boolean;
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  colors: { brown800: string };
  buttonBackgroundColor: string;
  shadowColor: string;
  rippleColor?: string;
  bottomInsetPx: number;
  fabRef?: RefObject<View | null>;
};

export function ReaderScrollToTopFab({
  opacitySV,
  pointerEventsEnabled,
  onPress,
  onPressIn,
  onPressOut,
  colors,
  buttonBackgroundColor,
  shadowColor,
  rippleColor,
  bottomInsetPx,
  fabRef,
}: ReaderScrollToTopFabProps) {
  const circlePx = READER_SCROLL_TO_TOP_FAB_CIRCLE_PX;
  const hitSlop = READER_SCROLL_TO_TOP_FAB_HIT_SLOP_PX;
  const circleRadius = circlePx / 2;
  const visibilityMotionStyle = useAnimatedStyle(() => ({
    opacity: opacitySV.value,
  }));
  const circleChromeStyle = {
    backgroundColor: buttonBackgroundColor,
    ...Platform.select({
      ios: {
        shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.14,
        shadowRadius: 6,
      },
      android: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(0,0,0,0.08)",
      },
      default: {},
    }),
  };

  const handlePressIn = useCallback(() => {
    onPressIn();
    hapticLightImpact();
  }, [onPressIn]);

  const handlePressOut = useCallback(() => {
    onPressOut();
  }, [onPressOut]);

  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  const pressable =
    Platform.OS === "android" ? (
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        hitSlop={{ top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop }}
        accessibilityRole="button"
        accessibilityLabel="Back to top"
        android_ripple={{
          color: rippleColor ?? "rgba(0,0,0,0.12)",
          borderless: false,
          radius: circleRadius,
        }}
        style={({ pressed }) => [
          styles.circlePressable,
          circleChromeStyle,
          { opacity: pressed ? 0.82 : 1 },
        ]}
      >
        <Ionicons name="chevron-up" size={READER_SCROLL_TO_TOP_FAB_ICON_PX} color={colors.brown800} />
      </Pressable>
    ) : (
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayPressIn={0}
        hitSlop={{ top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop }}
        accessibilityRole="button"
        accessibilityLabel="Back to top"
        activeOpacity={0.82}
        style={[styles.circlePressable, circleChromeStyle]}
      >
        <Ionicons name="chevron-up" size={READER_SCROLL_TO_TOP_FAB_ICON_PX} color={colors.brown800} />
      </TouchableOpacity>
    );

  return (
    <View
      pointerEvents={pointerEventsEnabled ? "box-none" : "none"}
      style={[StyleSheet.absoluteFill, styles.overlay]}
    >
      <Reanimated.View
        pointerEvents="box-none"
        style={[
          styles.slot,
          {
            right: READER_SCROLL_TO_TOP_FAB_RIGHT_EDGE_INSET_PX,
            bottom: bottomInsetPx,
            width: circlePx,
            height: circlePx,
          },
          visibilityMotionStyle,
        ]}
      >
        <View ref={fabRef} collapsable={false} style={styles.circle}>
          {pressable}
        </View>
      </Reanimated.View>
    </View>
  );
}

export function useReaderScrollToTopFabVisibility(chapterRouteKey: string, enabled: boolean) {
  const opacitySV = useSharedValue(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUserScrollActiveRef = useRef(false);
  const isPressingRef = useRef(false);
  const fabShownRef = useRef(false);
  const lastScrollOffsetRef = useRef(0);
  const scrolledPastThresholdRef = useRef(false);
  const [touchTargetActive, setTouchTargetActive] = useState(false);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current != null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const syncTouchTarget = useCallback(
    (visible: boolean) => {
      const next = visible && enabled && scrolledPastThresholdRef.current;
      setTouchTargetActive(next);
    },
    [enabled],
  );

  const animateVisibility = useCallback(
    (visible: boolean, targetOpacity = READER_SCROLL_TO_TOP_FAB_VISIBLE_OPACITY) => {
      if (visible && isPressingRef.current) {
        fabShownRef.current = true;
        syncTouchTarget(true);
        return;
      }

      animateM3ScrollChromeVisibility(
        opacitySV,
        visible,
        visible ? targetOpacity : 0,
      );
      fabShownRef.current = visible;
      syncTouchTarget(visible);
    },
    [opacitySV, syncTouchTarget],
  );

  const scheduleIdleHide = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      if (!isUserScrollActiveRef.current && !isPressingRef.current) {
        animateVisibility(false);
      }
    }, READER_CHAPTER_NAV_ARROW_IDLE_HIDE_MS);
  }, [animateVisibility, clearIdleTimer]);

  const hideFab = useCallback(() => {
    if (isPressingRef.current) return;
    clearIdleTimer();
    animateVisibility(false);
  }, [animateVisibility, clearIdleTimer]);

  const showFab = useCallback(() => {
    if (!enabled || !scrolledPastThresholdRef.current) return;
    if (!fabShownRef.current) {
      animateVisibility(true);
    } else {
      snapM3ScrollChromeOpacity(opacitySV, READER_SCROLL_TO_TOP_FAB_VISIBLE_OPACITY);
      syncTouchTarget(true);
    }
    scheduleIdleHide();
  }, [animateVisibility, enabled, opacitySV, scheduleIdleHide, syncTouchTarget]);

  const syncFromScrollOffset = useCallback(
    (y: number, options?: { revealWhenIdle?: boolean }) => {
      lastScrollOffsetRef.current = y;
      const scrolledPastThreshold = y >= READER_SCROLL_TO_TOP_FAB_SHOW_THRESHOLD_PX;
      scrolledPastThresholdRef.current = scrolledPastThreshold;
      if (!scrolledPastThreshold) {
        hideFab();
        setTouchTargetActive(false);
        return;
      }
      if (!enabled) {
        hideFab();
        setTouchTargetActive(false);
        return;
      }
      if (
        options?.revealWhenIdle &&
        !isUserScrollActiveRef.current &&
        !isPressingRef.current
      ) {
        showFab();
      }
    },
    [enabled, hideFab, showFab],
  );

  const onScrollBridge = useCallback(
    (y: number) => {
      if (!enabled) return;
      const prevY = lastScrollOffsetRef.current;
      const scrolledPastThreshold = y >= READER_SCROLL_TO_TOP_FAB_SHOW_THRESHOLD_PX;
      scrolledPastThresholdRef.current = scrolledPastThreshold;
      lastScrollOffsetRef.current = y;

      if (!scrolledPastThreshold) {
        hideFab();
        setTouchTargetActive(false);
        return;
      }

      const moved = Math.abs(y - prevY) > READER_SCROLL_TO_TOP_FAB_SCROLL_MOTION_THRESHOLD_PX;
      if (moved && fabShownRef.current && !isPressingRef.current && isUserScrollActiveRef.current) {
        hideFab();
        return;
      }

      if (
        !isUserScrollActiveRef.current &&
        !isPressingRef.current &&
        scrolledPastThreshold &&
        !fabShownRef.current
      ) {
        showFab();
      }
    },
    [enabled, hideFab, showFab],
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScrollBridge(event.nativeEvent.contentOffset.y);
    },
    [onScrollBridge],
  );

  const onFabPressIn = useCallback(() => {
    isPressingRef.current = true;
    clearIdleTimer();
    snapM3ScrollChromeOpacity(opacitySV, READER_SCROLL_TO_TOP_FAB_VISIBLE_OPACITY);
    fabShownRef.current = true;
    syncTouchTarget(true);
  }, [clearIdleTimer, opacitySV, syncTouchTarget]);

  const onFabPressOut = useCallback(() => {
    isPressingRef.current = false;
    if (enabled && scrolledPastThresholdRef.current && fabShownRef.current) {
      scheduleIdleHide();
    }
  }, [enabled, scheduleIdleHide]);

  const onScrollBeginDrag = useCallback(() => {
    isUserScrollActiveRef.current = true;
    hideFab();
  }, [hideFab]);

  const onScrollEndDrag = useCallback(
    (event?: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event?.nativeEvent.contentOffset.y ?? lastScrollOffsetRef.current;
      syncFromScrollOffset(y);
      const vy = event?.nativeEvent.velocity?.y ?? 0;
      const hasMomentum = Math.abs(vy) >= READER_SCROLL_TO_TOP_FAB_FLING_VELOCITY_PX_S;
      if (!hasMomentum) {
        isUserScrollActiveRef.current = false;
        if (enabled) {
          showFab();
        }
      }
    },
    [enabled, showFab, syncFromScrollOffset],
  );

  const onMomentumScrollEnd = useCallback(() => {
    isUserScrollActiveRef.current = false;
    if (enabled) {
      showFab();
    }
  }, [enabled, showFab]);

  useEffect(() => {
    clearIdleTimer();
    isUserScrollActiveRef.current = false;
    isPressingRef.current = false;
    lastScrollOffsetRef.current = 0;
    scrolledPastThresholdRef.current = false;
    setTouchTargetActive(false);
    animateVisibility(false);
    return () => {
      clearIdleTimer();
    };
  }, [chapterRouteKey, animateVisibility, clearIdleTimer]);

  useEffect(() => {
    if (!enabled) {
      setTouchTargetActive(false);
      hideFab();
    }
  }, [enabled, hideFab]);

  return {
    opacitySV,
    pointerEventsEnabled: enabled && touchTargetActive,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
    onScroll,
    hideFab,
    onFabPressIn,
    onFabPressOut,
    onScrollBridge,
    notifyScrolledToTop: syncFromScrollOffset,
    syncFromScrollOffset,
  };
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 50,
    elevation: 50,
  },
  slot: {
    position: "absolute",
  },
  circle: {
    width: READER_SCROLL_TO_TOP_FAB_CIRCLE_PX,
    height: READER_SCROLL_TO_TOP_FAB_CIRCLE_PX,
    borderRadius: READER_SCROLL_TO_TOP_FAB_CIRCLE_PX / 2,
    overflow: "hidden",
  },
  circlePressable: {
    width: READER_SCROLL_TO_TOP_FAB_CIRCLE_PX,
    height: READER_SCROLL_TO_TOP_FAB_CIRCLE_PX,
    borderRadius: READER_SCROLL_TO_TOP_FAB_CIRCLE_PX / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
