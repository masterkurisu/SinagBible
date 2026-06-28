import { useCallback, useEffect, useRef, type RefObject } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { EdgeInsets } from "react-native-safe-area-context";
import { hapticLightImpact } from "@/lib/haptics";

/** Tap target diameter (26px radius). */
export const READER_CHAPTER_NAV_ARROW_CIRCLE_PX = 52;
/** Chevron glyph size inside the circle. */
export const READER_CHAPTER_NAV_ARROW_ICON_PX = 26;
/** Distance from the screen edge (before safe-area inset). */
export const READER_CHAPTER_NAV_ARROW_EDGE_INSET_PX = 8;
/** Extra pressable slop beyond the circle edge. */
export const READER_CHAPTER_NAV_ARROW_HIT_SLOP_PX = 8;
/** Fade in/out duration when showing or hiding arrows. */
export const READER_CHAPTER_NAV_ARROW_FADE_MS = 220;
/** Hide arrows after this long without scroll or tap. */
export const READER_CHAPTER_NAV_ARROW_IDLE_HIDE_MS = 10_000;

type ChapterNavTarget = { slug: string; chapter: number };

type ReaderChapterNavArrowsProps = {
  opacityAnim: Animated.Value;
  pointerEventsEnabled: boolean;
  prevChapter: ChapterNavTarget | null;
  nextChapter: ChapterNavTarget | null;
  onPrev: () => void;
  onNext: () => void;
  colors: { brown800: string };
  rc: { sceneSurface: string; popoverShadow: string };
  insets: EdgeInsets;
  prevArrowRef?: RefObject<View | null>;
  nextArrowRef?: RefObject<View | null>;
};

function chapterNavArrowCircleBackground(rc: { sceneSurface: string }) {
  // Android: theme surface (light/white in default theme) like book selector pill.
  // iOS: same scene-surface pill as the centered header title chip.
  return rc.sceneSurface;
}

export function ReaderChapterNavArrows({
  opacityAnim,
  pointerEventsEnabled,
  prevChapter,
  nextChapter,
  onPrev,
  onNext,
  colors,
  rc,
  insets,
  prevArrowRef,
  nextArrowRef,
}: ReaderChapterNavArrowsProps) {
  const circleBg = chapterNavArrowCircleBackground(rc);
  const hitSlop = READER_CHAPTER_NAV_ARROW_HIT_SLOP_PX;
  const leftInset = Math.max(insets.left, READER_CHAPTER_NAV_ARROW_EDGE_INSET_PX);
  const rightInset = Math.max(insets.right, READER_CHAPTER_NAV_ARROW_EDGE_INSET_PX);

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
        />
      </Pressable>
    </View>
  );

  return (
    <Animated.View
      pointerEvents={pointerEventsEnabled ? "box-none" : "none"}
      style={[StyleSheet.absoluteFill, styles.overlay, { opacity: opacityAnim }]}
    >
      {prevChapter ? (
        <View pointerEvents="box-none" style={[styles.sideSlot, { left: leftInset }]}>
          {renderArrow("prev", onPrev, "Previous chapter", prevArrowRef)}
        </View>
      ) : null}
      {nextChapter ? (
        <View pointerEvents="box-none" style={[styles.sideSlot, { right: rightInset }]}>
          {renderArrow("next", onNext, "Next chapter", nextArrowRef)}
        </View>
      ) : null}
    </Animated.View>
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
    marginTop: -READER_CHAPTER_NAV_ARROW_CIRCLE_PX / 2,
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

export function useReaderChapterNavArrowsVisibility(chapterRouteKey: string, enabled: boolean) {
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScrollingRef = useRef(false);
  const arrowsShownRef = useRef(true);
  const lastScrollOffsetRef = useRef(0);
  const scrollMotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const animateOpacity = useCallback(
    (toValue: number) => {
      opacityAnim.stopAnimation();
      Animated.timing(opacityAnim, {
        toValue,
        duration: READER_CHAPTER_NAV_ARROW_FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      arrowsShownRef.current = toValue > 0.5;
    },
    [opacityAnim],
  );

  const hideArrows = useCallback(() => {
    clearIdleTimer();
    animateOpacity(0);
  }, [animateOpacity, clearIdleTimer]);

  const showArrows = useCallback(() => {
    if (!enabled) return;
    animateOpacity(1);
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      if (!isScrollingRef.current) {
        animateOpacity(0);
      }
    }, READER_CHAPTER_NAV_ARROW_IDLE_HIDE_MS);
  }, [animateOpacity, clearIdleTimer, enabled]);

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
      if (Math.abs(y - lastScrollOffsetRef.current) > 0.5) {
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
      }
    },
    [clearScrollMotionTimer, enabled, hideArrows, showArrows],
  );

  const revealFromInteraction = useCallback(() => {
    if (!enabled) return;
    showArrows();
  }, [enabled, showArrows]);

  useEffect(() => {
    clearIdleTimer();
    clearScrollMotionTimer();
    isScrollingRef.current = false;
    lastScrollOffsetRef.current = 0;
    if (enabled) {
      opacityAnim.setValue(1);
      arrowsShownRef.current = true;
      idleTimerRef.current = setTimeout(() => {
        if (!isScrollingRef.current) {
          animateOpacity(0);
        }
      }, READER_CHAPTER_NAV_ARROW_IDLE_HIDE_MS);
    } else {
      opacityAnim.setValue(0);
      arrowsShownRef.current = false;
    }
    return () => {
      clearIdleTimer();
      clearScrollMotionTimer();
    };
  }, [
    chapterRouteKey,
    enabled,
    animateOpacity,
    clearIdleTimer,
    clearScrollMotionTimer,
    opacityAnim,
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
    pointerEventsEnabled: enabled,
    onScrollBeginDrag,
    onScrollEndDrag: onScrollEnd,
    onMomentumScrollEnd: onScrollEnd,
    onScroll,
    revealFromInteraction,
    hideFromMotion,
  };
}
