import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { hapticLightImpact } from "@/lib/haptics";

/** Tap target diameter (36px radius). */
export const READER_CHAPTER_NAV_ARROW_CIRCLE_PX = 72;
/** Chevron glyph size inside the circle. */
export const READER_CHAPTER_NAV_ARROW_ICON_PX = 36;
/** Distance from the left screen edge. */
export const READER_CHAPTER_NAV_ARROW_EDGE_INSET_PX = 20;
/** Distance from the right screen edge (next arrow only). */
export const READER_CHAPTER_NAV_ARROW_RIGHT_EDGE_INSET_PX = 0;
/** Extra pressable slop beyond the circle edge. */
export const READER_CHAPTER_NAV_ARROW_HIT_SLOP_PX = 8;
/** Opacity when arrows are visible (before idle fade-out). */
export const READER_CHAPTER_NAV_ARROW_VISIBLE_OPACITY = 0.7;
/** Scale when arrows are visible. */
export const READER_CHAPTER_NAV_ARROW_VISIBLE_SCALE = 1;
/** Scale while fading out. */
export const READER_CHAPTER_NAV_ARROW_HIDDEN_SCALE = 0.88;
/** Fade in/out duration when showing or hiding arrows. */
export const READER_CHAPTER_NAV_ARROW_FADE_MS = 400;
/** Ignore sub-pixel / layout-settling scroll noise so arrows don't blink at chapter end. */
const READER_CHAPTER_NAV_ARROW_SCROLL_MOTION_THRESHOLD_PX = 4;
/** Hide arrows after this long without scroll or tap. */
export const READER_CHAPTER_NAV_ARROW_IDLE_HIDE_MS = 2_500;

type ChapterNavTarget = { slug: string; chapter: number };

type ReaderChapterNavArrowsProps = {
  opacityAnim: Animated.Value;
  scaleAnim: Animated.Value;
  pointerEventsEnabled: boolean;
  prevChapter: ChapterNavTarget | null;
  nextChapter: ChapterNavTarget | null;
  onPrev: () => void;
  onNext: () => void;
  colors: { brown800: string };
  rc: { sceneSurface: string; popoverShadow: string };
  prevArrowRef?: RefObject<View | null>;
  nextArrowRef?: RefObject<View | null>;
};

function chapterNavArrowCircleBackground(rc: { sceneSurface: string }) {
  // Android: theme surface (light/white in default theme) like book selector pill.
  // iOS: same scene-surface pill as the centered header title chip.
  return rc.sceneSurface;
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

export function ReaderChapterNavArrows({
  opacityAnim,
  scaleAnim,
  pointerEventsEnabled,
  prevChapter,
  nextChapter,
  onPrev,
  onNext,
  colors,
  rc,
  prevArrowRef,
  nextArrowRef,
}: ReaderChapterNavArrowsProps) {
  const { width: windowWidth } = useWindowDimensions();
  const overlayRef = useRef<View>(null);
  const [overlayFrame, setOverlayFrame] = useState({ x: 0, width: 0 });
  const circleBg = chapterNavArrowCircleBackground(rc);
  const hitSlop = READER_CHAPTER_NAV_ARROW_HIT_SLOP_PX;
  const leftInset = READER_CHAPTER_NAV_ARROW_EDGE_INSET_PX;
  const rightInset = READER_CHAPTER_NAV_ARROW_RIGHT_EDGE_INSET_PX;
  const circlePx = READER_CHAPTER_NAV_ARROW_CIRCLE_PX;
  const arrowMotionStyle = {
    opacity: opacityAnim,
    transform: [{ scale: scaleAnim }],
  };

  const measureOverlayInWindow = useCallback(() => {
    overlayRef.current?.measureInWindow((x, _y, width) => {
      if (width > 0) {
        setOverlayFrame({ x, width });
      }
    });
  }, []);

  useEffect(() => {
    measureOverlayInWindow();
  }, [measureOverlayInWindow, windowWidth, prevChapter, nextChapter]);

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

  const renderArrow = (
    direction: "prev" | "next",
    onPress: () => void,
    accessibilityLabel: string,
    arrowRef?: RefObject<View | null>,
  ) => (
    <View ref={arrowRef} collapsable={false} style={styles.circle}>
      <Pressable
        onPress={() => {
          hapticLightImpact();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={{ top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop }}
        style={({ pressed }) => [
          styles.circlePressable,
          {
            backgroundColor: circleBg,
            opacity: pressed ? 0.82 : 1,
            ...Platform.select({
              ios: {
                shadowColor: rc.popoverShadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.14,
                shadowRadius: 6,
              },
              android: { elevation: 3 },
              default: {},
            }),
          },
        ]}
      >
        <Ionicons
          name={direction === "prev" ? "chevron-back" : "chevron-forward"}
          size={READER_CHAPTER_NAV_ARROW_ICON_PX}
          color={colors.brown800}
          style={direction === "next" ? styles.nextChevronIcon : undefined}
        />
      </Pressable>
    </View>
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
        <Animated.View
          pointerEvents="box-none"
          style={[styles.sideSlot, { left: screenInsets.left, marginTop: -circlePx / 2 }, arrowMotionStyle]}
        >
          {renderArrow("prev", onPrev, "Previous chapter", prevArrowRef)}
        </Animated.View>
      ) : null}
      {nextChapter ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.sideSlot, { right: screenInsets.right, marginTop: -circlePx / 2 }, arrowMotionStyle]}
        >
          {renderArrow("next", onNext, "Next chapter", nextArrowRef)}
        </Animated.View>
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
    top: "50%",
  },
  nextChevronIcon: {
    transform: [{ translateX: 8 }],
  },
  circle: {
    width: READER_CHAPTER_NAV_ARROW_CIRCLE_PX,
    height: READER_CHAPTER_NAV_ARROW_CIRCLE_PX,
    borderRadius: READER_CHAPTER_NAV_ARROW_CIRCLE_PX / 2,
  },
  circlePressable: {
    width: READER_CHAPTER_NAV_ARROW_CIRCLE_PX,
    height: READER_CHAPTER_NAV_ARROW_CIRCLE_PX,
    borderRadius: READER_CHAPTER_NAV_ARROW_CIRCLE_PX / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});

export function useReaderChapterNavArrowsVisibility(
  chapterRouteKey: string,
  enabled: boolean,
  forceVisible = false,
) {
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(READER_CHAPTER_NAV_ARROW_HIDDEN_SCALE)).current;
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScrollingRef = useRef(false);
  const arrowsShownRef = useRef(false);
  const forceVisibleRef = useRef(forceVisible);
  const lastScrollOffsetRef = useRef(0);
  const scrollMotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  forceVisibleRef.current = forceVisible;

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current != null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const clearScrollMotionTimer = useCallback(() => {
    if (scrollMotionTimerRef.current != null) {
      clearTimeout(scrollMotionTimerRef.current);
      scrollMotionTimerRef.current = null;
    }
  }, []);

  const animateVisibility = useCallback(
    (visible: boolean, targetOpacity = READER_CHAPTER_NAV_ARROW_VISIBLE_OPACITY) => {
      opacityAnim.stopAnimation();
      scaleAnim.stopAnimation();
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: visible ? targetOpacity : 0,
          duration: READER_CHAPTER_NAV_ARROW_FADE_MS,
          easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: visible ? READER_CHAPTER_NAV_ARROW_VISIBLE_SCALE : READER_CHAPTER_NAV_ARROW_HIDDEN_SCALE,
          duration: READER_CHAPTER_NAV_ARROW_FADE_MS,
          easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      arrowsShownRef.current = visible;
    },
    [opacityAnim, scaleAnim],
  );

  const scheduleIdleHide = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      if (!isScrollingRef.current && !forceVisibleRef.current) {
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
    isScrollingRef.current = true;
    hideArrows();
  }, [hideArrows]);

  const onScrollEnd = useCallback(() => {
    isScrollingRef.current = false;
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
      isScrollingRef.current = true;
      clearScrollMotionTimer();
      scrollMotionTimerRef.current = setTimeout(() => {
        isScrollingRef.current = false;
        showArrows();
      }, 120);
    },
    [clearScrollMotionTimer, enabled, hideArrows, showArrows],
  );

  const revealFromInteraction = useCallback(() => {
    if (!enabled) return;
    showArrows();
  }, [enabled, showArrows]);

  useEffect(() => {
    if (forceVisible) {
      clearIdleTimer();
      clearScrollMotionTimer();
      animateVisibility(true, 1);
      return;
    }

    clearIdleTimer();
    clearScrollMotionTimer();
    isScrollingRef.current = false;
    lastScrollOffsetRef.current = 0;
    if (enabled) {
      animateVisibility(true);
      scheduleIdleHide();
    } else {
      animateVisibility(false);
    }
    return () => {
      clearIdleTimer();
      clearScrollMotionTimer();
    };
  }, [
    chapterRouteKey,
    enabled,
    forceVisible,
    animateVisibility,
    clearIdleTimer,
    clearScrollMotionTimer,
    scheduleIdleHide,
  ]);

  const hideFromMotion = useCallback(() => {
    isScrollingRef.current = true;
    hideArrows();
    clearScrollMotionTimer();
    scrollMotionTimerRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      showArrows();
    }, 180);
  }, [clearScrollMotionTimer, hideArrows, showArrows]);

  return {
    opacityAnim,
    scaleAnim,
    pointerEventsEnabled: enabled,
    onScrollBeginDrag,
    onScrollEndDrag: onScrollEnd,
    onMomentumScrollEnd: onScrollEnd,
    onScroll,
    revealFromInteraction,
    hideFromMotion,
  };
}
