import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import type { GestureResponderEvent, PanResponderGestureState } from "react-native";
import { Animated, BackHandler, Dimensions, Easing, PanResponder, Platform } from "react-native";
import Reanimated from "react-native-reanimated";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { registerTabScrollRef } from "@/lib/tab-scroll-to-top";
import type { TranslationId } from "@sinag-bible/core/bible-translations";
import type { BibleVerseInlineItem } from "@sinag-bible/types";

export type ReaderVerseFlashItem =
  | { kind: "verse"; verseIndex: number; verseText: string; verseInlineContent?: BibleVerseInlineItem[] }
  | { kind: "empty"; side: "left" | "right"; row: number };

type ChapterNavTarget = { slug: string; chapter: number };

/** Fade-in for verse body after in-place chapter changes (`setParams`). */
export const READER_VERSES_FADE_IN_MS = 320;

/** Slide-down distance (px) for reader menus at open. */
export const READER_MENU_SLIDE_FROM_PX = 20;

export const noopChapterSwipePan = PanResponder.create({
  onStartShouldSetPanResponder: () => false,
  onMoveShouldSetPanResponder: () => false,
  onMoveShouldSetPanResponderCapture: () => false,
  onPanResponderTerminationRequest: () => true,
  onPanResponderRelease: () => {},
});

/**
 * Strict: only claim the pan during move so diagonal scrolling stays on the chapter list.
 * Android uses stricter thresholds so vertical scrolling wins more often and chapter swipe
 * does not steal slight diagonals.
 */
export function chapterSwipeMoveShouldActivate(g: PanResponderGestureState): boolean {
  const adx = Math.abs(g.dx);
  const ady = Math.abs(g.dy);
  if (Platform.OS === "android") {
    return adx > 44 && adx > ady * 2.35 + 36;
  }
  return adx > 28 && adx > ady * 1.7 + 22;
}

/**
 * Android: the native vertical scroll recognizer otherwise wins before horizontal swipes reach
 * `onMoveShouldSetPanResponder`, so chapter navigation never fires. iOS keeps capture disabled so
 * vertical scrolling stays smooth (unchanged).
 */
export function chapterSwipeMoveShouldSetCapture(): boolean {
  return Platform.OS === "android";
}

/** Slightly looser at release so a mostly-horizontal swipe still changes chapter after scrolling. */
export function chapterSwipeReleaseShouldNavigate(g: PanResponderGestureState, minHorizontal: number): boolean {
  const adx = Math.abs(g.dx);
  const ady = Math.abs(g.dy);
  if (adx < minHorizontal) return false;
  if (Platform.OS === "android") {
    return adx > ady * 1.65 + 22;
  }
  return adx > ady * 1.35 + 14;
}

export const AnimatedReaderChapterFlashList = Reanimated.createAnimatedComponent(
  FlashList,
) as typeof FlashList<ReaderVerseFlashItem>;

export function useReaderGestures({
  bookSlug,
  chapterNumber,
  requestedTranslationId,
  readerPayload,
  isReaderContentCurrent,
  chapterNav,
  goToReaderChapter,
  readerOverlayOpen,
  clearReaderDropdownState,
  dismissReaderChromeFromBackgroundPress,
  fontSettingsSheetOpen,
  readerDropdown,
  toolsMenuOpen,
  settingsMenuAnchor,
  setBookViewMenuOpen,
}: {
  bookSlug: string | undefined;
  chapterNumber: number;
  requestedTranslationId: TranslationId;
  readerPayload: {
    resolvedTranslationId: TranslationId;
    chapter: { verses: readonly string[] };
  } | null;
  isReaderContentCurrent: boolean;
  chapterNav: { prevChapter: ChapterNavTarget | null; nextChapter: ChapterNavTarget | null };
  goToReaderChapter: (nextBookSlug: string, nextChapter: number, translationId: TranslationId) => void;
  readerOverlayOpen: boolean;
  clearReaderDropdownState: () => void;
  dismissReaderChromeFromBackgroundPress: () => void;
  fontSettingsSheetOpen: boolean;
  readerDropdown: "book" | "translation" | "theme" | null;
  toolsMenuOpen: boolean;
  settingsMenuAnchor: import("react-native").LayoutRectangle | null;
  setBookViewMenuOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const dropSlideAnim = useRef(new Animated.Value(0)).current;
  const dropOpacityAnim = useRef(new Animated.Value(0)).current;
  const settingsPopupSlideAnim = useRef(new Animated.Value(0)).current;
  const settingsPopupOpacityAnim = useRef(new Animated.Value(0)).current;
  const bookSheetTranslateY = useRef(new Animated.Value(0)).current;
  const bookSheetClosingRef = useRef(false);
  const bookSheetDragStartYRef = useRef(0);
  const fontSettingsPopupSlideAnim = useRef(new Animated.Value(0)).current;
  const fontSettingsPopupOpacityAnim = useRef(new Animated.Value(0)).current;
  const readerVersesOpacityAnim = useRef(new Animated.Value(1)).current;
  /** True after we've shown synced content then lost sync (chapter change), not initial null payload. */
  const readerVersesHadDesyncRef = useRef(false);

  const readerScrollRef = useRef<FlashListRef<ReaderVerseFlashItem> | null>(null);
  /** Drives cross-fade between in-content heading and stack header title (native scroll events). */
  const readerScrollYAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return registerTabScrollRef("reader", {
      scrollToOffset: ({ offset, animated = true }) => {
        readerScrollRef.current?.scrollToOffset({ offset, animated });
      },
    });
  }, []);

  useEffect(() => {
    readerScrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    readerScrollYAnim.setValue(0);
  }, [bookSlug, chapterNumber, requestedTranslationId, readerScrollYAnim]);

  useEffect(() => {
    if (!readerDropdown) {
      dropSlideAnim.setValue(0);
      dropOpacityAnim.setValue(0);
      return;
    }
    dropSlideAnim.setValue(0);
    dropOpacityAnim.setValue(0);

    Animated.parallel([
      Animated.timing(dropSlideAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dropOpacityAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [readerDropdown, dropSlideAnim, dropOpacityAnim]);

  useEffect(() => {
    if (!toolsMenuOpen || !settingsMenuAnchor) {
      settingsPopupSlideAnim.setValue(0);
      settingsPopupOpacityAnim.setValue(0);
      return;
    }
    settingsPopupSlideAnim.setValue(0);
    settingsPopupOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(settingsPopupSlideAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(settingsPopupOpacityAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [toolsMenuOpen, settingsMenuAnchor, settingsPopupSlideAnim, settingsPopupOpacityAnim]);

  const closeReaderDropdown = useCallback(() => {
    bookSheetTranslateY.stopAnimation();
    bookSheetClosingRef.current = false;
    bookSheetTranslateY.setValue(0);
    clearReaderDropdownState();
  }, [bookSheetTranslateY, clearReaderDropdownState]);

  const animateCloseBookSheet = useCallback(
    (velocityY = 0, draggedY = 0) => {
      if (bookSheetClosingRef.current) return;
      bookSheetClosingRef.current = true;
      const h = Dimensions.get("window").height;
      const targetY = h + 56;
      const vel = Math.max(0, velocityY);
      const duration = Math.max(170, Math.min(340, Math.round(300 - Math.min(1.85, vel) * 88)));
      bookSheetTranslateY.stopAnimation();
      const clamped = Math.max(0, draggedY);
      if (clamped > 0) {
        bookSheetTranslateY.setValue(clamped);
      }
      Animated.timing(bookSheetTranslateY, {
        toValue: targetY,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        bookSheetClosingRef.current = false;
        bookSheetTranslateY.setValue(0);
        closeReaderDropdown();
      });
    },
    [bookSheetTranslateY, closeReaderDropdown],
  );

  const bookSheetDragPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) =>
          !bookSheetClosingRef.current && g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderTerminationRequest: () => true,
        onPanResponderGrant: () => {
          setBookViewMenuOpen(false);
          bookSheetTranslateY.stopAnimation((value: number) => {
            bookSheetDragStartYRef.current = value;
          });
        },
        onPanResponderMove: (_e, g) => {
          if (bookSheetClosingRef.current) return;
          bookSheetTranslateY.setValue(Math.max(0, bookSheetDragStartYRef.current + g.dy));
        },
        onPanResponderRelease: (_e, g) => {
          if (bookSheetClosingRef.current) return;
          const y = Math.max(0, bookSheetDragStartYRef.current + g.dy);
          if (y > 90 || g.vy > 0.55) {
            animateCloseBookSheet(g.vy, y);
            return;
          }
          Animated.spring(bookSheetTranslateY, {
            toValue: 0,
            velocity: Math.max(0, g.vy),
            friction: 9,
            tension: 75,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: (_e, g) => {
          if (bookSheetClosingRef.current) return;
          const y = Math.max(0, bookSheetDragStartYRef.current + g.dy);
          if (y > 90 || g.vy > 0.55) {
            animateCloseBookSheet(g.vy, y);
            return;
          }
          Animated.spring(bookSheetTranslateY, {
            toValue: 0,
            velocity: Math.max(0, g.vy),
            friction: 9,
            tension: 75,
            useNativeDriver: true,
          }).start();
        },
      }),
    [animateCloseBookSheet, bookSheetTranslateY, setBookViewMenuOpen],
  );

  useEffect(() => {
    if (readerDropdown !== "book") return;
    bookSheetClosingRef.current = false;
    bookSheetTranslateY.stopAnimation();
    bookSheetTranslateY.setValue(Dimensions.get("window").height);
    Animated.spring(bookSheetTranslateY, {
      toValue: 0,
      friction: 9,
      tension: 68,
      useNativeDriver: true,
    }).start();
  }, [readerDropdown, bookSheetTranslateY]);

  useEffect(() => {
    if (readerDropdown !== "book") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      animateCloseBookSheet(0.45, 0);
      return true;
    });
    return () => sub.remove();
  }, [readerDropdown, animateCloseBookSheet]);

  useEffect(() => {
    if (!fontSettingsSheetOpen) {
      fontSettingsPopupSlideAnim.setValue(0);
      fontSettingsPopupOpacityAnim.setValue(0);
      return;
    }
    fontSettingsPopupSlideAnim.setValue(0);
    fontSettingsPopupOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(fontSettingsPopupSlideAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fontSettingsPopupOpacityAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fontSettingsSheetOpen, fontSettingsPopupSlideAnim, fontSettingsPopupOpacityAnim]);

  useEffect(() => {
    if (!isReaderContentCurrent) {
      readerVersesHadDesyncRef.current = true;
      readerVersesOpacityAnim.stopAnimation();
      readerVersesOpacityAnim.setValue(0);
      return;
    }

    if (readerVersesHadDesyncRef.current) {
      readerVersesHadDesyncRef.current = false;
      readerVersesOpacityAnim.stopAnimation();
      readerVersesOpacityAnim.setValue(0);
      Animated.timing(readerVersesOpacityAnim, {
        toValue: 1,
        duration: READER_VERSES_FADE_IN_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else {
      readerVersesOpacityAnim.setValue(1);
    }
  }, [isReaderContentCurrent, readerVersesOpacityAnim]);

  const chapterSwipePan = useMemo(() => {
    const tid = readerPayload?.resolvedTranslationId;
    if (!tid) return noopChapterSwipePan;
    const { prevChapter, nextChapter } = chapterNav;
    const releaseThresholdPx = Platform.OS === "android" ? 72 : 52;
    const tryChapterSwipeNavigate = (g: PanResponderGestureState) => {
      if (!chapterSwipeReleaseShouldNavigate(g, releaseThresholdPx)) return;
      if (g.dx <= -releaseThresholdPx && nextChapter) {
        goToReaderChapter(nextChapter.slug, nextChapter.chapter, tid);
      } else if (g.dx >= releaseThresholdPx && prevChapter) {
        goToReaderChapter(prevChapter.slug, prevChapter.chapter, tid);
      }
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e: GestureResponderEvent, g: PanResponderGestureState) =>
        chapterSwipeMoveShouldActivate(g),
      onMoveShouldSetPanResponderCapture: (_e: GestureResponderEvent, g: PanResponderGestureState) =>
        chapterSwipeMoveShouldSetCapture() && chapterSwipeMoveShouldActivate(g),
      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        tryChapterSwipeNavigate(g);
      },
      onPanResponderTerminate: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        tryChapterSwipeNavigate(g);
      },
    });
  }, [chapterNav, readerPayload?.resolvedTranslationId, goToReaderChapter]);

  const onReaderScrollBeginDrag = useCallback(() => {
    dismissReaderChromeFromBackgroundPress();
  }, [dismissReaderChromeFromBackgroundPress]);

  return {
    dropSlideAnim,
    dropOpacityAnim,
    settingsPopupSlideAnim,
    settingsPopupOpacityAnim,
    bookSheetTranslateY,
    bookSheetDragPanResponder,
    fontSettingsPopupSlideAnim,
    fontSettingsPopupOpacityAnim,
    readerVersesOpacityAnim,
    readerScrollRef,
    readerScrollYAnim,
    closeReaderDropdown,
    animateCloseBookSheet,
    chapterSwipePan,
    noopChapterSwipePan,
    onReaderScrollBeginDrag,
    chapterSwipePanHandlers: (readerOverlayOpen ? noopChapterSwipePan : chapterSwipePan).panHandlers,
  };
}
