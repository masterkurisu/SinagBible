import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
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
import { animateM3ScrollChromeVisibility } from "@/lib/high-refresh-scroll";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";

/** Same diameter as the back-to-top control. */
export const READER_CHAPTER_NAV_ARROW_CIRCLE_PX = 59;
/** Same glyph size as the back-to-top control. */
export const READER_CHAPTER_NAV_ARROW_ICON_PX = 29;
/** Distance from the left screen edge. */
export const READER_CHAPTER_NAV_ARROW_EDGE_INSET_PX = 12;
/** Distance from the right screen edge (next arrow only). */
export const READER_CHAPTER_NAV_ARROW_RIGHT_EDGE_INSET_PX = 12;
/** Extra pressable slop beyond the circle edge. */
export const READER_CHAPTER_NAV_ARROW_HIT_SLOP_PX = 8;
/** Opacity when arrows are visible (before idle fade-out). Matches back-to-top. */
export const READER_CHAPTER_NAV_ARROW_VISIBLE_OPACITY = 0.9;
/** Scale when arrows are visible. */
export const READER_CHAPTER_NAV_ARROW_VISIBLE_SCALE = 1;
/** Scale while fading out. */
export const READER_CHAPTER_NAV_ARROW_HIDDEN_SCALE = 0.88;
/** Fade in/out duration when showing or hiding arrows. */
export const READER_CHAPTER_NAV_ARROW_FADE_MS = 300;
/** Ignore sub-pixel / layout-settling scroll noise so arrows don't blink at chapter end. */
const READER_CHAPTER_NAV_ARROW_SCROLL_MOTION_THRESHOLD_PX = 6;
/** Hide arrows after this long without scroll or tap. */
export const READER_CHAPTER_NAV_ARROW_IDLE_HIDE_MS = 1_500;
/** Velocity (pt/s) above which a fling defers arrow reveal until momentum ends. */
const READER_CHAPTER_NAV_ARROW_FLING_VELOCITY_PX_S = 50;

type ChapterNavTarget = { slug: string; chapter: number };

type ReaderChapterNavArrowsProps = {
  opacitySV: SharedValue<number>;
  pointerEventsEnabled: boolean;
  prevChapter: ChapterNavTarget | null;
  nextChapter: ChapterNavTarget | null;
  onPrev: () => void;
  onNext: () => void;
  prevArrowRef?: RefObject<View | null>;
  nextArrowRef?: RefObject<View | null>;
};

type ChapterNavArrowButtonProps = {
  direction: "prev" | "next";
  onPress: () => void;
  accessibilityLabel: string;
  arrowRef?: RefObject<View | null>;
  containerColor: string;
  iconColor: string;
  rippleColor: string;
  shadowColor: string;
};

function ChapterNavArrowButton({
  direction,
  onPress,
  accessibilityLabel,
  arrowRef,
  containerColor,
  iconColor,
  rippleColor,
  shadowColor,
}: ChapterNavArrowButtonProps) {
  const size = READER_CHAPTER_NAV_ARROW_CIRCLE_PX;
  const circleChromeStyle = {
    backgroundColor: containerColor,
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

  return (
    <View ref={arrowRef} collapsable={false} style={styles.circle}>
      <Pressable
        onPress={() => {
          hapticLightImpact();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={{
          top: READER_CHAPTER_NAV_ARROW_HIT_SLOP_PX,
          bottom: READER_CHAPTER_NAV_ARROW_HIT_SLOP_PX,
          left: READER_CHAPTER_NAV_ARROW_HIT_SLOP_PX,
          right: READER_CHAPTER_NAV_ARROW_HIT_SLOP_PX,
        }}
        android_ripple={{ color: rippleColor, borderless: false, radius: size / 2 }}
        style={({ pressed }) => [
          styles.circlePressable,
          circleChromeStyle,
          { opacity: pressed ? 0.82 : 1 },
        ]}
      >
        <Ionicons
          name={direction === "prev" ? "chevron-back" : "chevron-forward"}
          size={READER_CHAPTER_NAV_ARROW_ICON_PX}
          color={iconColor}
        />
      </Pressable>
    </View>
  );
}

function chapterNavArrowScreenInsets(
  windowWidth: number,
  overlayWindowX: number,
  overlayWidth: number,
  leftInset: number,
  rightInset: number,
) {
  const gapToScreenLeft = overlayWindowX;
  const gapToScreenRight = Math.max(0, windowWidth - overlayWindowX - overlayWidth);
  return {
    left: leftInset - gapToScreenLeft,
    right: rightInset - gapToScreenRight,
  };
}

/** Pin arrows to screen vertical center so tab-bar show/hide does not shift them. */
function chapterNavArrowScreenTopPx(
  windowHeight: number,
  overlayWindowY: number,
  circlePx: number,
) {
  return windowHeight / 2 - overlayWindowY - circlePx / 2;
}

export function ReaderChapterNavArrows({
  opacitySV,
  pointerEventsEnabled,
  prevChapter,
  nextChapter,
  onPrev,
  onNext,
  prevArrowRef,
  nextArrowRef,
}: ReaderChapterNavArrowsProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const overlayRef = useRef<View>(null);
  const [overlayFrame, setOverlayFrame] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const { bundle } = useMobileAppTheme();
  const containerColor = bundle.reader.popoverSurface;
  const iconColor = bundle.ui.brown800;
  const rippleColor = bundle.journal.fabRipple;
  const shadowColor = bundle.reader.popoverShadow;
  const leftInset = READER_CHAPTER_NAV_ARROW_EDGE_INSET_PX;
  const rightInset = READER_CHAPTER_NAV_ARROW_RIGHT_EDGE_INSET_PX;
  const circlePx = READER_CHAPTER_NAV_ARROW_CIRCLE_PX;
  const arrowMotionStyle = useAnimatedStyle(() => ({
    opacity: opacitySV.value,
  }));

  const measureOverlayInWindow = useCallback(() => {
    overlayRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        setOverlayFrame({ x, y, width, height });
      }
    });
  }, []);

  useEffect(() => {
    measureOverlayInWindow();
  }, [measureOverlayInWindow, windowWidth, windowHeight, prevChapter, nextChapter]);

  const screenInsets =
    windowWidth > 0 && overlayFrame.width > 0
      ? chapterNavArrowScreenInsets(
          windowWidth,
          overlayFrame.x,
          overlayFrame.width,
          leftInset,
          rightInset,
        )
      : { left: leftInset, right: rightInset };

  const arrowTopPx =
    windowHeight > 0 && overlayFrame.height > 0
      ? chapterNavArrowScreenTopPx(windowHeight, overlayFrame.y, circlePx)
      : null;

  const arrowVerticalStyle =
    arrowTopPx != null
      ? { top: arrowTopPx }
      : { top: "50%" as const, marginTop: -circlePx / 2 };

  const renderArrow = (
    direction: "prev" | "next",
    onPress: () => void,
    accessibilityLabel: string,
    arrowRef?: RefObject<View | null>,
  ) => (
    <ChapterNavArrowButton
      direction={direction}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      arrowRef={arrowRef}
      containerColor={containerColor}
      iconColor={iconColor}
      rippleColor={rippleColor}
      shadowColor={shadowColor}
    />
  );

  return (
    <View
      ref={overlayRef}
      collapsable={false}
      onLayout={measureOverlayInWindow}
      pointerEvents={pointerEventsEnabled ? "box-none" : "none"}
      style={[StyleSheet.absoluteFill, styles.overlay]}
    >
      {prevChapter ? (
        <Reanimated.View
          pointerEvents="box-none"
          style={[styles.sideSlot, { left: screenInsets.left }, arrowVerticalStyle, arrowMotionStyle]}
        >
          {renderArrow("prev", onPrev, "Previous chapter", prevArrowRef)}
        </Reanimated.View>
      ) : null}
      {nextChapter ? (
        <Reanimated.View
          pointerEvents="box-none"
          style={[styles.sideSlot, { right: screenInsets.right }, arrowVerticalStyle, arrowMotionStyle]}
        >
          {renderArrow("next", onNext, "Next chapter", nextArrowRef)}
        </Reanimated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 12,
    elevation: 12,
  },
  sideSlot: {
    position: "absolute",
  },
  circle: {
    width: READER_CHAPTER_NAV_ARROW_CIRCLE_PX,
    height: READER_CHAPTER_NAV_ARROW_CIRCLE_PX,
    borderRadius: READER_CHAPTER_NAV_ARROW_CIRCLE_PX / 2,
    overflow: "hidden",
  },
  circlePressable: {
    width: READER_CHAPTER_NAV_ARROW_CIRCLE_PX,
    height: READER_CHAPTER_NAV_ARROW_CIRCLE_PX,
    borderRadius: READER_CHAPTER_NAV_ARROW_CIRCLE_PX / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});

export function useReaderChapterNavArrowsVisibility(
  chapterRouteKey: string,
  enabled: boolean,
  forceVisible = false,
) {
  const opacitySV = useSharedValue(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUserScrollActiveRef = useRef(false);
  const arrowsShownRef = useRef(false);
  const forceVisibleRef = useRef(forceVisible);
  const lastScrollOffsetRef = useRef(0);
  const chapterSwipeMotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  forceVisibleRef.current = forceVisible;

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current != null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const clearChapterSwipeMotionTimer = useCallback(() => {
    if (chapterSwipeMotionTimerRef.current != null) {
      clearTimeout(chapterSwipeMotionTimerRef.current);
      chapterSwipeMotionTimerRef.current = null;
    }
  }, []);

  const animateVisibility = useCallback(
    (visible: boolean, targetOpacity = READER_CHAPTER_NAV_ARROW_VISIBLE_OPACITY) => {
      animateM3ScrollChromeVisibility(opacitySV, visible, targetOpacity);
      arrowsShownRef.current = visible;
    },
    [opacitySV],
  );

  const scheduleIdleHide = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      if (!isUserScrollActiveRef.current && !forceVisibleRef.current) {
        animateVisibility(false);
      }
    }, READER_CHAPTER_NAV_ARROW_IDLE_HIDE_MS);
  }, [animateVisibility, clearIdleTimer]);

  const hideArrows = useCallback(() => {
    if (forceVisibleRef.current) return;
    clearIdleTimer();
    animateVisibility(false);
  }, [animateVisibility, clearIdleTimer]);

  const showArrows = useCallback(() => {
    if (!enabled || forceVisibleRef.current) return;
    if (!arrowsShownRef.current) {
      animateVisibility(true);
    }
    scheduleIdleHide();
  }, [animateVisibility, enabled, scheduleIdleHide]);

  const onScrollBeginDrag = useCallback(() => {
    isUserScrollActiveRef.current = true;
    hideArrows();
  }, [hideArrows]);

  const onScrollEndDrag = useCallback(
    (event?: NativeSyntheticEvent<NativeScrollEvent>) => {
      const vy = event?.nativeEvent.velocity?.y ?? 0;
      const hasMomentum = Math.abs(vy) >= READER_CHAPTER_NAV_ARROW_FLING_VELOCITY_PX_S;
      if (!hasMomentum) {
        isUserScrollActiveRef.current = false;
        if (enabled) {
          showArrows();
        }
      }
    },
    [enabled, showArrows],
  );

  const onMomentumScrollEnd = useCallback(() => {
    isUserScrollActiveRef.current = false;
    if (enabled) {
      showArrows();
    }
  }, [enabled, showArrows]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!enabled) return;
      const y = event.nativeEvent.contentOffset.y;
      if (Math.abs(y - lastScrollOffsetRef.current) <= READER_CHAPTER_NAV_ARROW_SCROLL_MOTION_THRESHOLD_PX) {
        return;
      }
      lastScrollOffsetRef.current = y;
      if (arrowsShownRef.current) {
        hideArrows();
      }
    },
    [enabled, hideArrows],
  );

  const revealFromInteraction = useCallback(() => {
    if (!enabled) return;
    showArrows();
  }, [enabled, showArrows]);

  useEffect(() => {
    if (forceVisible) {
      clearIdleTimer();
      clearChapterSwipeMotionTimer();
      animateVisibility(true, 1);
      return;
    }

    clearIdleTimer();
    clearChapterSwipeMotionTimer();
    isUserScrollActiveRef.current = false;
    lastScrollOffsetRef.current = 0;
    if (enabled) {
      animateVisibility(true);
      scheduleIdleHide();
    } else {
      animateVisibility(false);
    }
    return () => {
      clearIdleTimer();
      clearChapterSwipeMotionTimer();
    };
  }, [
    chapterRouteKey,
    enabled,
    forceVisible,
    animateVisibility,
    clearIdleTimer,
    clearChapterSwipeMotionTimer,
    scheduleIdleHide,
  ]);

  const hideFromMotion = useCallback(() => {
    isUserScrollActiveRef.current = true;
    hideArrows();
    clearChapterSwipeMotionTimer();
    chapterSwipeMotionTimerRef.current = setTimeout(() => {
      isUserScrollActiveRef.current = false;
      showArrows();
    }, 180);
  }, [clearChapterSwipeMotionTimer, hideArrows, showArrows]);

  return {
    opacitySV,
    pointerEventsEnabled: enabled,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
    onScroll,
    revealFromInteraction,
    hideFromMotion,
  };
}
