import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  unstable_batchedUpdates,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type {
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import {
  NativeViewGestureHandler,
  PanGestureHandler,
  ScrollView as GHScrollView,
  State,
  type ScrollView as GHScrollViewRef,
} from "react-native-gesture-handler";
import type { BibleBookNavItem, BibleChapter } from "@sinag-bible/types";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { MenuOptionsIcon } from "@/components/icons/MenuOptionsIcon";
import { BOOK_GENRE_BY_SLUG } from "@/lib/book-genre-by-slug";
import { getSelectChapterHeadingForLanguage } from "@/lib/reader-chapter-label";
import { hapticLightImpact } from "@/lib/haptics";
import { nativeTabSheetBottomInsetPx } from "@/lib/native-tab-chrome";
import { ActionBarOnboardingOverlay } from "@/src/features/reader/ActionBarOnboardingOverlay";
import {
  READER_M3_APP_BAR_ICON_BUTTON_PX,
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
  READER_M3_SURFACE_CONTAINER,
} from "@/src/features/reader/readerSettingsPanelChrome";
import { useBookPickerOnboarding } from "@/src/features/reader/useBookPickerOnboarding";
import { FullWindowOverlay } from "react-native-screens";

const M3_SHEET_TOP_RADIUS_PX = 28;
const M3_ICON_BUTTON_RIPPLE = "rgba(28,27,31,0.12)";

type BookPickerFilterButtonProps = {
  open: boolean;
  onPress: () => void;
  isAndroidSheet: boolean;
  defaultIconColor: string;
  selectedIconColor: string;
  /** Increment to play a brief spin when the view mode changes. */
  spinNonce?: number;
};

/** M3 standard icon button — ripple, press scale, selected container, icon rotation. */
function BookPickerFilterButton({
  open,
  onPress,
  isAndroidSheet,
  defaultIconColor,
  selectedIconColor,
  spinNonce = 0,
}: BookPickerFilterButtonProps) {
  const openAnim = useRef(new Animated.Value(open ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    Animated.spring(openAnim, {
      toValue: open ? 1 : 0,
      friction: 8,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [open, openAnim]);

  useEffect(() => {
    if (!isAndroidSheet || spinNonce === 0) return;
    spinLoopRef.current?.stop();
    spinAnim.setValue(0);
    spinLoopRef.current = Animated.timing(spinAnim, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    spinLoopRef.current.start(({ finished }) => {
      if (finished) spinAnim.setValue(0);
    });
  }, [isAndroidSheet, spinAnim, spinNonce]);

  useEffect(() => () => spinLoopRef.current?.stop(), []);

  const handlePress = useCallback(() => {
    hapticLightImpact();
    onPress();
  }, [onPress]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      friction: 8,
      tension: 320,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const openRotation = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const busyRotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const selectedBgOpacity = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  if (!isAndroidSheet) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        delayPressIn={0}
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          minWidth: 48,
          minHeight: 44,
          paddingLeft: 10,
          paddingRight: 16,
        }}
        hitSlop={{ top: 10, bottom: 4, left: 8, right: 8 }}
        accessibilityLabel="Choose book list view"
        accessibilityState={{ expanded: open }}
      >
        <MenuOptionsIcon size={22} color={defaultIconColor} />
      </TouchableOpacity>
    );
  }

  return (
    <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        android_ripple={{ color: M3_ICON_BUTTON_RIPPLE, borderless: true, radius: 24 }}
        style={{
          width: READER_M3_APP_BAR_ICON_BUTTON_PX,
          height: READER_M3_APP_BAR_ICON_BUTTON_PX,
          borderRadius: READER_M3_APP_BAR_ICON_BUTTON_PX / 2,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
        accessibilityRole="button"
        accessibilityLabel="Choose book list view"
        accessibilityState={{ expanded: open }}
      >
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, {
            borderRadius: READER_M3_APP_BAR_ICON_BUTTON_PX / 2,
            backgroundColor: READER_M3_SURFACE_CONTAINER,
            opacity: selectedBgOpacity,
          }]}
        />
        <Animated.View style={{ transform: [{ scale: scaleAnim }, { rotate: openRotation }] }}>
          <Animated.View style={{ transform: [{ rotate: busyRotation }] }}>
            <MenuOptionsIcon size={24} color={open ? selectedIconColor : defaultIconColor} />
          </Animated.View>
        </Animated.View>
      </Pressable>
  );
}

export type BookSelectorViewMode = "grid" | "az" | "testament";
export type SelectorTestamentTab = "old" | "new";

/** iOS: render in separate UIWindow; Android: use a Modal so this sheet always layers above header controls. */
export function ReaderBookSheetWindowOverlay({
  children,
  visible,
  onRequestClose,
}: {
  children: ReactNode;
  visible: boolean;
  onRequestClose: () => void;
}) {
  if (Platform.OS === "android") {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={onRequestClose}
      >
        {children}
      </Modal>
    );
  }
  if (Platform.OS === "ios") {
    return (
      <FullWindowOverlay unstable_accessibilityContainerViewIsModal>{children}</FullWindowOverlay>
    );
  }
  return children;
}

const BOOK_SELECTOR_VIEW_STORAGE_KEY = "sb:reader:bookSelectorView";
const OT_BOOK_COUNT = 39;
/** Space above the scrolled-to book so it is not flush with the sheet header. */
const BOOK_LIST_SCROLL_TOP_INSET = 40;

export type BookPickerSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onExitAnimationStart?: () => void;
  chapter: BibleChapter;
  books: BibleBookNavItem[];
  resolvedTranslationId: string;
  translationLanguageLabel: string;
  goToReaderChapter: (bookSlug: string, chapterNumber: number, translationId: string) => void;
  colors: {
    borderSolid: string;
    brown800: string;
    gold: string;
    parchment: string;
  };
  rc: MobileAppThemeBundle["reader"];
  insets: { top: number; bottom: number; left: number; right: number };
  readerBookSheetBottomPx: number;
  readerBookSheetPad?: number;
  readerBookSheetScreenEdgePad?: number;
  readerBookGridGap?: number;
  readerBookGridCellW?: number;
  readerChapterCols?: number;
  readerChapterGridCellW?: number;
};

export function BookPickerSheet({
  isOpen,
  onClose,
  onExitAnimationStart,
  chapter,
  books,
  resolvedTranslationId,
  translationLanguageLabel,
  goToReaderChapter,
  colors,
  rc,
  insets,
  readerBookSheetBottomPx,
  readerBookSheetPad = 16,
  readerBookSheetScreenEdgePad = 5,
  readerBookGridGap = 8,
  readerBookGridCellW = 100,
  readerChapterCols = 5,
  readerChapterGridCellW = 56,
}: BookPickerSheetProps) {
  const [step, setStep] = useState<"books" | "chapters">("books");
  const [pickerBook, setPickerBook] = useState<BibleBookNavItem | null>(null);
  const [bookSelectorViewMode, setBookSelectorViewMode] = useState<BookSelectorViewMode>("testament");
  const [selectorTestamentTab, setSelectorTestamentTab] = useState<SelectorTestamentTab>("new");
  const [bookViewMenuOpen, setBookViewMenuOpen] = useState(false);
  const [filterFeedbackNonce, setFilterFeedbackNonce] = useState(0);
  const [bookSheetDismissPanEnabled, setBookSheetDismissPanEnabled] = useState(true);
  const [bookSelectorStorageReady, setBookSelectorStorageReady] = useState(false);

  const bookSheetTranslateY = useRef(new Animated.Value(0)).current;
  const dropOpacityAnim = useRef(new Animated.Value(0)).current;
  const bookSheetClosingRef = useRef(false);
  const bookSheetDragStartYRef = useRef(0);
  const bookSheetPanRef = useRef<PanGestureHandler>(null);
  const bookSheetScrollNativeRef = useRef<NativeViewGestureHandler>(null);
  const bookListScrollRef = useRef<GHScrollViewRef>(null);
  const bookListContentRef = useRef<View>(null);
  const currentBookItemRef = useRef<View>(null);
  const bookViewFilterButtonRef = useRef<View>(null);

  const { width: screenW, height: screenH } = useWindowDimensions();
  const isAndroidSheet = Platform.OS === "android";
  const m3SheetPad = 24;
  const m3SheetBottomPad = nativeTabSheetBottomInsetPx(insets.bottom, 0);
  const m3SheetMaxHeight = Math.min(screenH * 0.92, screenH - insets.top - 48);
  const m3SheetHeight = Math.min(m3SheetMaxHeight, screenH * 0.72);
  const sheetHorizontalPad = isAndroidSheet ? m3SheetPad : readerBookSheetPad;
  const sheetScreenEdgePad = isAndroidSheet ? 0 : readerBookSheetScreenEdgePad;

  const bookPickerOnboarding = useBookPickerOnboarding({
    isOpen,
    pickerStep: step,
    viewMenuOpen: bookViewMenuOpen,
    filterButtonRef: bookViewFilterButtonRef,
    insets,
    screenW,
    readerBookSheetScreenEdgePad,
    readerBookSheetPad,
  });

  const getBookAzSortKey = useCallback(
    (bookName: string) => bookName.replace(/^[0-9]+\s*/u, "").trim().toLowerCase(),
    [],
  );

  const { oldTestamentBooks, newTestamentBooks } = useMemo(() => {
    return {
      oldTestamentBooks: books.slice(0, OT_BOOK_COUNT),
      newTestamentBooks: books.slice(OT_BOOK_COUNT),
    };
  }, [books]);

  const azSortedBooks = useMemo(
    () => [...books].sort((a, b) => getBookAzSortKey(a.name).localeCompare(getBookAzSortKey(b.name))),
    [books, getBookAzSortKey],
  );

  const gridSectionsForPicker = useMemo(
    () =>
      [
        { id: "ot" as const, label: "OLD TESTAMENT", items: oldTestamentBooks },
        { id: "nt" as const, label: "NEW TESTAMENT", items: newTestamentBooks },
      ] as const,
    [oldTestamentBooks, newTestamentBooks],
  );

  const activeBookViewLabel = useMemo(() => {
    if (bookSelectorViewMode === "grid") return "Grid view";
    if (bookSelectorViewMode === "az") return "A-Z view";
    return selectorTestamentTab === "old" ? "Old Testament view" : "New Testament view";
  }, [bookSelectorViewMode, selectorTestamentTab]);

  const applyBookSelectorView = useCallback((view: "grid" | "az" | "old" | "new") => {
    hapticLightImpact();
    if (isAndroidSheet) setFilterFeedbackNonce((n) => n + 1);
    if (view === "grid" || view === "az") {
      setBookSelectorViewMode(view);
    } else {
      setBookSelectorViewMode("testament");
      setSelectorTestamentTab(view);
    }
    setBookViewMenuOpen(false);
  }, [isAndroidSheet]);

  const bookGridColumns = 3;
  const bookSheetInnerW = Math.max(
    240,
    screenW - sheetScreenEdgePad * 2 - sheetHorizontalPad * 2,
  );
  const readerBookGridCellWResolved = Math.max(
    72,
    Math.min(
      readerBookGridCellW,
      Math.floor((bookSheetInnerW - readerBookGridGap * (bookGridColumns - 1)) / bookGridColumns),
    ),
  );
  const readerChapterGridCellWResolved = Math.floor(
    (bookSheetInnerW - readerBookGridGap * (readerChapterCols - 1)) / readerChapterCols,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(BOOK_SELECTOR_VIEW_STORAGE_KEY);
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as {
              mode?: BookSelectorViewMode;
              testamentTab?: SelectorTestamentTab;
            };
            unstable_batchedUpdates(() => {
              if (parsed.mode === "grid" || parsed.mode === "az" || parsed.mode === "testament") {
                setBookSelectorViewMode(parsed.mode);
              }
              if (parsed.testamentTab === "old" || parsed.testamentTab === "new") {
                setSelectorTestamentTab(parsed.testamentTab);
              }
              setBookSelectorStorageReady(true);
            });
            return;
          } catch {
            // ignore corrupt storage
          }
        }
        if (!cancelled) setBookSelectorStorageReady(true);
      } catch {
        if (!cancelled) setBookSelectorStorageReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bookSelectorStorageReady) return;
    void AsyncStorage.setItem(
      BOOK_SELECTOR_VIEW_STORAGE_KEY,
      JSON.stringify({ mode: bookSelectorViewMode, testamentTab: selectorTestamentTab }),
    ).catch(() => {});
  }, [bookSelectorStorageReady, bookSelectorViewMode, selectorTestamentTab]);

  const resetPickerState = useCallback(() => {
    setStep("books");
    setPickerBook(null);
    setBookViewMenuOpen(false);
    setBookSheetDismissPanEnabled(true);
  }, []);

  const scrollBookListToCurrentBook = useCallback(() => {
    const scrollView = bookListScrollRef.current;
    const content = bookListContentRef.current;
    const currentItem = currentBookItemRef.current;
    if (!scrollView || !content || !currentItem) return;

    currentItem.measureLayout(
      content,
      (_x, y) => {
        scrollView.scrollTo({
          y: Math.max(0, y - BOOK_LIST_SCROLL_TOP_INSET),
          animated: false,
        });
      },
      () => {},
    );
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetPickerState();
      bookSheetClosingRef.current = false;
      bookSheetTranslateY.stopAnimation();
      bookSheetTranslateY.setValue(0);
      dropOpacityAnim.setValue(0);
      return;
    }
    resetPickerState();
    const currentBookIndex = books.findIndex((b) => b.slug === chapter.bookSlug);
    if (currentBookIndex >= 0 && bookSelectorViewMode === "testament") {
      setSelectorTestamentTab(currentBookIndex < OT_BOOK_COUNT ? "old" : "new");
    }
    bookSheetClosingRef.current = false;
    bookSheetTranslateY.stopAnimation();
    if (isAndroidSheet) {
      dropOpacityAnim.setValue(0);
      Animated.timing(dropOpacityAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      bookSheetTranslateY.setValue(Dimensions.get("window").height);
      Animated.timing(bookSheetTranslateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    dropOpacityAnim.setValue(1);
    bookSheetTranslateY.setValue(Dimensions.get("window").height);
    Animated.spring(bookSheetTranslateY, {
      toValue: 0,
      friction: 9,
      tension: 68,
      useNativeDriver: true,
    }).start();
  }, [
    isOpen,
    bookSheetTranslateY,
    dropOpacityAnim,
    isAndroidSheet,
    resetPickerState,
    books,
    chapter.bookSlug,
    bookSelectorViewMode,
  ]);

  useEffect(() => {
    if (!isOpen || step !== "books") return;

    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        scrollBookListToCurrentBook();
      });
    });

    return () => task.cancel();
  }, [
    isOpen,
    step,
    bookSelectorViewMode,
    selectorTestamentTab,
    chapter.bookSlug,
    scrollBookListToCurrentBook,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    setBookSheetDismissPanEnabled(true);
  }, [isOpen, step, bookSelectorViewMode, selectorTestamentTab]);

  const animateClose = useCallback(
    (velocityY = 0, draggedY = 0) => {
      if (bookSheetClosingRef.current) return;
      bookSheetClosingRef.current = true;
      onExitAnimationStart?.();
      const h = Dimensions.get("window").height;
      const targetY = h + 56;
      const vel = Math.max(0, velocityY);
      const duration = Math.max(170, Math.min(340, Math.round(300 - Math.min(1.85, vel) * 88)));
      bookSheetTranslateY.stopAnimation();
      const clamped = Math.max(0, draggedY);
      if (clamped > 0) bookSheetTranslateY.setValue(clamped);
      Animated.timing(bookSheetTranslateY, {
        toValue: targetY,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        bookSheetClosingRef.current = false;
        bookSheetTranslateY.setValue(0);
        onClose();
      });
    },
    [bookSheetTranslateY, onClose, onExitAnimationStart],
  );

  const onBookSheetScroll = useCallback((scrollY: number) => {
    const atTop = scrollY <= (Platform.OS === "android" ? 16 : 2);
    setBookSheetDismissPanEnabled((prev) => (prev === atTop ? prev : atTop));
  }, []);

  const onBookSheetDismissGestureEvent = useCallback(
    (e: PanGestureHandlerGestureEvent) => {
      if (bookSheetClosingRef.current) return;
      const ty = e.nativeEvent.translationY;
      bookSheetTranslateY.setValue(Math.max(0, bookSheetDragStartYRef.current + ty));
    },
    [bookSheetTranslateY],
  );

  const onBookSheetDismissGestureStateChange = useCallback(
    (e: PanGestureHandlerStateChangeEvent) => {
      const { state, oldState, velocityY, translationY } = e.nativeEvent;
      if (state === State.ACTIVE && oldState !== State.ACTIVE) {
        setBookViewMenuOpen(false);
        bookSheetTranslateY.stopAnimation((value: number) => {
          bookSheetDragStartYRef.current = value;
        });
      }
      if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
        if (bookSheetClosingRef.current) return;
        const ty = translationY ?? 0;
        const y = Math.max(0, bookSheetDragStartYRef.current + ty);
        const vyPxPerS = Math.abs(velocityY ?? 0);
        const velForCloseAnim = Math.min(1.85, vyPxPerS / 520);
        if (y > 90 || vyPxPerS > 520) {
          animateClose(velForCloseAnim, y);
          return;
        }
        Animated.spring(bookSheetTranslateY, {
          toValue: 0,
          velocity: Math.max(0, (velocityY ?? 0) / 1000),
          friction: 9,
          tension: 75,
          useNativeDriver: true,
        }).start();
      }
    },
    [animateClose, bookSheetTranslateY],
  );

  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      animateClose(0.45, 0);
      return true;
    });
    return () => sub.remove();
  }, [isOpen, animateClose]);

  const sheetSurfaceStyle = isAndroidSheet
    ? {
        height: m3SheetHeight,
        backgroundColor: rc.sceneSurface,
        borderTopLeftRadius: M3_SHEET_TOP_RADIUS_PX,
        borderTopRightRadius: M3_SHEET_TOP_RADIUS_PX,
        overflow: "hidden" as const,
        elevation: 10,
        shadowColor: rc.popoverShadow,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
        paddingBottom: m3SheetBottomPad,
      }
    : {
        flex: 1,
        minHeight: 0,
        borderRadius: 20,
        backgroundColor: rc.sceneSurface,
        overflow: "hidden" as const,
        shadowColor: rc.popoverShadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
        elevation: 10,
      };

  const sheetTitleColor = isAndroidSheet ? READER_M3_ON_SURFACE : colors.brown800;
  const sheetMutedColor = isAndroidSheet ? READER_M3_ON_SURFACE_VARIANT : colors.gold;

  if (!isOpen) return null;

  return (

  <ReaderBookSheetWindowOverlay
    visible={isOpen}
    onRequestClose={() => animateClose(0, 0)}
  >
    <View
      style={isAndroidSheet ? { flex: 1 } : [StyleSheet.absoluteFill, { zIndex: 9999, elevation: 32 }]}
      pointerEvents="box-none"
      accessibilityViewIsModal
    >
      {isAndroidSheet ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: rc.menuScrim, opacity: dropOpacityAnim }]}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss book picker"
        onPress={() => animateClose(0, 0)}
        style={[StyleSheet.absoluteFill, isAndroidSheet ? undefined : { backgroundColor: rc.menuScrim }]}
      />
      <View
        pointerEvents="box-none"
        style={isAndroidSheet ? { flex: 1, justifyContent: "flex-end" } : StyleSheet.absoluteFill}
      >
        <Animated.View
          pointerEvents="box-none"
          style={
            isAndroidSheet
              ? {
                  width: "100%",
                  maxHeight: m3SheetMaxHeight,
                  transform: [{ translateY: bookSheetTranslateY }],
                }
              : {
                  position: "absolute",
                  left: insets.left + readerBookSheetScreenEdgePad,
                  right: insets.right + readerBookSheetScreenEdgePad,
                  top: insets.top + 8,
                  bottom: readerBookSheetBottomPx,
                  transform: [{ translateY: bookSheetTranslateY }],
                }
          }
        >
          <View style={sheetSurfaceStyle}>
          <PanGestureHandler
            ref={bookSheetPanRef}
            enabled={Platform.OS === "android" ? true : bookSheetDismissPanEnabled}
            simultaneousHandlers={bookSheetScrollNativeRef}
            onGestureEvent={onBookSheetDismissGestureEvent}
            onHandlerStateChange={onBookSheetDismissGestureStateChange}
            activeOffsetY={8}
            failOffsetX={[-32, 32]}
          >
            <View
              style={{ flex: 1, minHeight: 0, paddingTop: isAndroidSheet ? 0 : 6 }}
              accessibilityLabel="Book picker sheet"
              accessibilityHint="Swipe down to return to the reader without changing book or chapter"
            >
              <View
                style={{
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingTop: isAndroidSheet ? 12 : 4,
                  paddingBottom: isAndroidSheet ? 4 : 10,
                  minHeight: 44,
                }}
              >
                <View
                  pointerEvents="none"
                  style={
                    isAndroidSheet
                      ? {
                          width: 32,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: "rgba(28,27,31,0.4)",
                        }
                      : {
                          width: 40,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: "rgba(0,0,0,0.22)",
                        }
                  }
                />
              </View>
      {step === "books" ? (
        <>
          <View style={{ paddingHorizontal: sheetHorizontalPad, paddingTop: 0, paddingBottom: 6 }}>
            <View style={{ minHeight: isAndroidSheet ? 56 : 48, justifyContent: "center", zIndex: 1 }}>
              <View
                ref={bookViewFilterButtonRef}
                collapsable={false}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  zIndex: 10,
                  elevation: 10,
                }}
              >
                <BookPickerFilterButton
                  open={bookViewMenuOpen}
                  onPress={() => setBookViewMenuOpen((o) => !o)}
                  isAndroidSheet={isAndroidSheet}
                  defaultIconColor={isAndroidSheet ? READER_M3_ON_SURFACE_VARIANT : colors.gold}
                  selectedIconColor={colors.gold}
                  spinNonce={filterFeedbackNonce}
                />
              </View>
              <Text
                className={isAndroidSheet ? undefined : "tracking-widest uppercase"}
                style={{
                  fontFamily: isAndroidSheet ? "Inter_500Medium" : "Inter_600SemiBold",
                  fontSize: isAndroidSheet ? 22 : 20,
                  textAlign: "center",
                  color: sheetTitleColor,
                }}
              >
                {isAndroidSheet ? "Select a book" : "SELECT A BOOK"}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: isAndroidSheet ? 14 : 10,
                letterSpacing: isAndroidSheet ? 0 : 0.8,
                color: sheetMutedColor,
                textAlign: "center",
                marginTop: isAndroidSheet ? 4 : 2,
              }}
            >
              {activeBookViewLabel}
            </Text>
          </View>
          <NativeViewGestureHandler
            ref={bookSheetScrollNativeRef}
            simultaneousHandlers={bookSheetPanRef}
          >
            <GHScrollView
              ref={bookListScrollRef}
              key={`${bookSelectorViewMode}-${selectorTestamentTab}`}
              style={{ flex: 1 }}
              nestedScrollEnabled={Platform.OS === "android"}
              contentContainerStyle={{
                paddingHorizontal: sheetHorizontalPad,
                paddingBottom: isAndroidSheet ? 16 : 24,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onScroll={(ev) => onBookSheetScroll(ev.nativeEvent.contentOffset.y)}
            >
            <View ref={bookListContentRef} collapsable={false}>
            {bookSelectorViewMode === "grid"
              ? gridSectionsForPicker.map((section) => {
                  if (!section.items.length) return null;
                  return (
                    <View key={section.id} style={{ marginBottom: 18 }}>
                      <Text
                        style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: isAndroidSheet ? 12 : 10,
                          letterSpacing: isAndroidSheet ? 0.5 : 2.2,
                          color: sheetMutedColor,
                          marginBottom: 8,
                          paddingHorizontal: isAndroidSheet ? 0 : 4,
                        }}
                      >
                        {section.label}
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                        {section.items.map((b, index) => {
                          const isCurrentBook = b.slug === chapter.bookSlug;
                          const mr = index % bookGridColumns === bookGridColumns - 1 ? 0 : readerBookGridGap;
                          return (
                            <TouchableOpacity
                              key={b.slug}
                              ref={isCurrentBook ? currentBookItemRef : undefined}
                              onPress={() => {
                                hapticLightImpact();
                                setPickerBook(b);
                                setStep("chapters");
                              }}
                              style={{
                                width: readerBookGridCellWResolved,
                                marginRight: mr,
                                marginBottom: readerBookGridGap,
                              }}
                              activeOpacity={0.75}
                              accessibilityLabel={`Choose chapter for ${b.name}`}
                            >
                              <View
                                style={{
                                  borderRadius: isAndroidSheet ? 12 : 20,
                                  overflow: "hidden",
                                }}
                              >
                                {isCurrentBook && !isAndroidSheet ? (
                                  <LinearGradient
                                    colors={rc.translationSelectedGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={{
                                      paddingVertical: 8,
                                      paddingHorizontal: 6,
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    <Text
                                      numberOfLines={1}
                                      style={{
                                        fontFamily: "Lora_400Regular",
                                        fontSize: 16,
                                        color: rc.selectionText,
                                        textAlign: "center",
                                      }}
                                    >
                                      {b.name}
                                    </Text>
                                  </LinearGradient>
                                ) : (
                                  <View
                                    style={{
                                      paddingVertical: isAndroidSheet ? 10 : 8,
                                      paddingHorizontal: 6,
                                      backgroundColor: isAndroidSheet
                                        ? isCurrentBook
                                          ? `${colors.gold}33`
                                          : READER_M3_SURFACE_CONTAINER
                                        : colors.parchment,
                                      alignItems: "center",
                                      justifyContent: "center",
                                      minHeight: isAndroidSheet ? 44 : undefined,
                                    }}
                                  >
                                    <Text
                                      numberOfLines={1}
                                      style={{
                                        fontFamily: isAndroidSheet ? "Inter_400Regular" : "Lora_400Regular",
                                        fontSize: isAndroidSheet ? 14 : 16,
                                        color: isAndroidSheet ? READER_M3_ON_SURFACE : colors.brown800,
                                        textAlign: "center",
                                      }}
                                    >
                                      {b.name}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })
              : null}

            {bookSelectorViewMode === "az"
              ? azSortedBooks.map((b) => {
                  const isCurrentBook = b.slug === chapter.bookSlug;
                  const rowPad = {
                    flexDirection: "row" as const,
                    alignItems: "center" as const,
                    justifyContent: "space-between" as const,
                    paddingVertical: isAndroidSheet ? 12 : 8,
                    paddingHorizontal: isAndroidSheet ? 0 : 12,
                    minHeight: isAndroidSheet ? 56 : undefined,
                  };
                  return (
                    <TouchableOpacity
                      key={b.slug}
                      ref={isCurrentBook ? currentBookItemRef : undefined}
                      onPress={() => {
                        hapticLightImpact();
                        setPickerBook(b);
                        setStep("chapters");
                      }}
                      style={{
                        marginBottom: isAndroidSheet ? 0 : readerBookGridGap,
                        borderRadius: isAndroidSheet ? 12 : 20,
                        overflow: "hidden",
                        backgroundColor:
                          isAndroidSheet && isCurrentBook ? READER_M3_SURFACE_CONTAINER : "transparent",
                      }}
                      activeOpacity={0.75}
                      accessibilityLabel={`Choose chapter for ${b.name}`}
                    >
                      {isCurrentBook && !isAndroidSheet ? (
                        <LinearGradient
                          colors={rc.translationSelectedGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={rowPad}
                        >
                          <Text
                            style={{
                              fontFamily: "Lora_400Regular",
                              fontSize: 18,
                              color: rc.selectionText,
                              flexShrink: 1,
                            }}
                          >
                            {b.name}
                          </Text>
                          <View
                            style={{
                              borderRadius: 999,
                              backgroundColor: "rgba(255,255,255,0.12)",
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                            }}
                          >
                            <Text
                              style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.gold }}
                            >
                              {b.chapterCount} ch
                            </Text>
                          </View>
                        </LinearGradient>
                      ) : (
                        <View
                          style={[
                            rowPad,
                            !isAndroidSheet ? { backgroundColor: colors.parchment } : undefined,
                          ]}
                        >
                          <Text
                            style={{
                              fontFamily: isAndroidSheet ? "Inter_400Regular" : "Lora_400Regular",
                              fontSize: isAndroidSheet ? 16 : 18,
                              color: isAndroidSheet ? READER_M3_ON_SURFACE : colors.brown800,
                              flexShrink: 1,
                            }}
                          >
                            {b.name}
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text
                              style={{
                                fontFamily: "Inter_400Regular",
                                fontSize: isAndroidSheet ? 14 : 11,
                                color: sheetMutedColor,
                              }}
                            >
                              {b.chapterCount} ch
                            </Text>
                            {isAndroidSheet && isCurrentBook ? (
                              <Ionicons name="checkmark" size={20} color={colors.gold} />
                            ) : null}
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              : null}

            {bookSelectorViewMode === "testament"
              ? (selectorTestamentTab === "old"
                  ? oldTestamentBooks
                  : newTestamentBooks
                ).map(
                  (b) => {
                    const isCurrentBook = b.slug === chapter.bookSlug;
                    const genre = BOOK_GENRE_BY_SLUG[b.slug] ?? "Book";
                    const testamentRowPad = {
                      flexDirection: "row" as const,
                      alignItems: "center" as const,
                      justifyContent: "space-between" as const,
                      paddingVertical: isAndroidSheet ? 12 : 8,
                      paddingHorizontal: isAndroidSheet ? 0 : 12,
                      minHeight: isAndroidSheet ? 56 : undefined,
                    };
                    return (
                      <TouchableOpacity
                        key={b.slug}
                        ref={isCurrentBook ? currentBookItemRef : undefined}
                        onPress={() => {
                          hapticLightImpact();
                          setPickerBook(b);
                          setStep("chapters");
                        }}
                        style={{
                          marginBottom: isAndroidSheet ? 0 : readerBookGridGap,
                          borderRadius: isAndroidSheet ? 12 : 20,
                          overflow: "hidden",
                          backgroundColor:
                            isAndroidSheet && isCurrentBook ? READER_M3_SURFACE_CONTAINER : "transparent",
                        }}
                        activeOpacity={0.75}
                        accessibilityLabel={`Choose chapter for ${b.name}`}
                      >
                        {isCurrentBook && !isAndroidSheet ? (
                            <LinearGradient
                              colors={rc.translationSelectedGradient}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={testamentRowPad}
                            >
                              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    fontFamily: "Lora_400Regular",
                                    fontSize: 18,
                                    color: rc.selectionText,
                                    flexShrink: 1,
                                  }}
                                >
                                  {b.name}
                                </Text>
                                <View
                                  style={{
                                    borderRadius: 999,
                                    backgroundColor: "rgba(255,255,255,0.12)",
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontFamily: "Inter_400Regular",
                                      fontSize: 10,
                                      letterSpacing: 0.4,
                                      color: colors.gold,
                                    }}
                                  >
                                    {genre}
                                  </Text>
                                </View>
                              </View>
                              <View
                                style={{
                                  borderRadius: 999,
                                  backgroundColor: "rgba(255,255,255,0.12)",
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                }}
                              >
                                <Text
                                  style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.gold }}
                                >
                                  {b.chapterCount} ch
                                </Text>
                              </View>
                            </LinearGradient>
                          ) : (
                            <View
                              style={[
                                testamentRowPad,
                                !isAndroidSheet ? { backgroundColor: colors.parchment } : undefined,
                              ]}
                            >
                              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    fontFamily: isAndroidSheet ? "Inter_400Regular" : "Lora_400Regular",
                                    fontSize: isAndroidSheet ? 16 : 18,
                                    color: isAndroidSheet ? READER_M3_ON_SURFACE : colors.brown800,
                                    flexShrink: 1,
                                  }}
                                >
                                  {b.name}
                                </Text>
                                {!isAndroidSheet ? (
                                <View
                                  style={{
                                    borderRadius: 999,
                                    backgroundColor: "rgba(0,0,0,0.05)",
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontFamily: "Inter_400Regular",
                                      fontSize: 10,
                                      letterSpacing: 0.4,
                                      color: colors.gold,
                                    }}
                                  >
                                    {genre}
                                  </Text>
                                </View>
                                ) : null}
                              </View>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                {isAndroidSheet ? (
                                  <Text
                                    style={{
                                      fontFamily: "Inter_400Regular",
                                      fontSize: 14,
                                      color: sheetMutedColor,
                                    }}
                                  >
                                    {genre} · {b.chapterCount} ch
                                  </Text>
                                ) : (
                                <View
                                  style={{
                                    borderRadius: 999,
                                    backgroundColor: "rgba(0,0,0,0.05)",
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                  }}
                                >
                                  <Text
                                    style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.gold }}
                                  >
                                    {b.chapterCount} ch
                                  </Text>
                                </View>
                                )}
                                {isAndroidSheet && isCurrentBook ? (
                                  <Ionicons name="checkmark" size={20} color={colors.gold} />
                                ) : null}
                              </View>
                            </View>
                          )}
                      </TouchableOpacity>
                    );
                  },
                )
              : null}
            </View>
            </GHScrollView>
          </NativeViewGestureHandler>
        </>
      ) : pickerBook ? (
        <View style={{ flex: 1, paddingHorizontal: sheetHorizontalPad }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: isAndroidSheet ? 12 : 16 }}>
            <TouchableOpacity
              onPress={() => {
                hapticLightImpact();
                setStep("books");
                setPickerBook(null);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Back to books"
            >
              <Text
                style={{
                  fontFamily: isAndroidSheet ? "Inter_500Medium" : "Inter_500Medium",
                  fontSize: isAndroidSheet ? 14 : 13,
                  color: isAndroidSheet ? colors.gold : colors.gold,
                }}
              >
                {isAndroidSheet ? "← Books" : "← Books"}
              </Text>
            </TouchableOpacity>
          </View>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: isAndroidSheet ? 14 : 12,
              letterSpacing: isAndroidSheet ? 0 : 2.5,
              color: sheetMutedColor,
              textAlign: "center",
            }}
          >
            {getSelectChapterHeadingForLanguage(translationLanguageLabel)}
          </Text>
          <Text
            style={{
              fontFamily: isAndroidSheet ? "Inter_500Medium" : "Inter_400Regular",
              fontSize: isAndroidSheet ? 22 : 12,
              letterSpacing: isAndroidSheet ? 0 : 1.8,
              color: isAndroidSheet ? sheetTitleColor : colors.brown800,
              textAlign: "center",
              marginTop: isAndroidSheet ? 4 : 6,
              marginBottom: isAndroidSheet ? 16 : 18,
            }}
          >
            {isAndroidSheet ? pickerBook.name : pickerBook.name.toUpperCase()}
          </Text>
          <NativeViewGestureHandler
            ref={bookSheetScrollNativeRef}
            simultaneousHandlers={bookSheetPanRef}
          >
            <GHScrollView
              style={{ flex: 1 }}
              nestedScrollEnabled={Platform.OS === "android"}
              contentContainerStyle={{
                paddingBottom: 20,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: readerBookGridGap,
                width: bookSheetInnerW,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onScroll={(ev) => onBookSheetScroll(ev.nativeEvent.contentOffset.y)}
            >
            {Array.from({ length: pickerBook.chapterCount }, (_, i) => i + 1).map((chNum) => {
              const isCurrent =
                pickerBook.slug === chapter.bookSlug && chNum === chapter.chapterNumber;
              return (
                <TouchableOpacity
                  key={chNum}
                  onPress={() => {
                    hapticLightImpact();
                    onClose();
                    goToReaderChapter(pickerBook.slug, chNum, resolvedTranslationId);
                  }}
                  style={{
                    width: readerChapterGridCellWResolved,
                    marginBottom: 0,
                    borderRadius: isAndroidSheet ? 12 : 12,
                    paddingVertical: isAndroidSheet ? 12 : 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isAndroidSheet
                      ? isCurrent
                        ? `${colors.gold}33`
                        : READER_M3_SURFACE_CONTAINER
                      : colors.parchment,
                    borderWidth: isAndroidSheet ? 0 : 1,
                    borderColor: isCurrent ? colors.brown800 : colors.borderSolid,
                    minHeight: isAndroidSheet ? 48 : undefined,
                  }}
                  activeOpacity={0.75}
                  accessibilityLabel={`Open ${pickerBook.name} chapter ${chNum}`}
                >
                  <Text
                    style={{
                      fontFamily: isAndroidSheet ? "Inter_500Medium" : "Inter_500Medium",
                      fontSize: isAndroidSheet ? 16 : 14,
                      color: isCurrent
                        ? isAndroidSheet
                          ? colors.gold
                          : colors.gold
                        : isAndroidSheet
                          ? READER_M3_ON_SURFACE
                          : colors.brown800,
                    }}
                  >
                    {chNum}
                  </Text>
                </TouchableOpacity>
              );
            })}
            </GHScrollView>
          </NativeViewGestureHandler>
        </View>
      ) : null}
            </View>
          </PanGestureHandler>
    {bookViewMenuOpen && step === "books" ? (
      <View
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, { zIndex: 300 }]}
        collapsable={false}
      >
        <TouchableWithoutFeedback
          accessibilityRole="button"
          accessibilityLabel="Dismiss view options"
          onPress={() => setBookViewMenuOpen(false)}
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "transparent" }]} />
        </TouchableWithoutFeedback>
        <View
          pointerEvents="auto"
          style={
            isAndroidSheet
              ? {
                  position: "absolute",
                  top: 72,
                  left: sheetHorizontalPad,
                  zIndex: 1,
                  minWidth: 220,
                  borderRadius: 12,
                  backgroundColor: rc.sceneSurface,
                  paddingVertical: 8,
                  elevation: 8,
                  shadowColor: rc.popoverShadow,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.16,
                  shadowRadius: 8,
                }
              : {
                  position: "absolute",
                  top: 58,
                  left: readerBookSheetPad,
                  zIndex: 1,
                  minWidth: 200,
                  borderRadius: 12,
                  backgroundColor: rc.sceneSurface,
                  padding: 8,
                  borderWidth: 1,
                  borderColor: "#ffffff",
                  shadowColor: rc.popoverShadow,
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.22,
                  shadowRadius: 5,
                  elevation: 8,
                }
          }
        >
          {(
            [
              { id: "grid" as const, label: "Grid" },
              { id: "az" as const, label: "A-Z" },
              { id: "old" as const, label: "Old Testament" },
              { id: "new" as const, label: "New Testament" },
            ] as const
          ).map((option) => {
            const active =
              option.id === "grid"
                ? bookSelectorViewMode === "grid"
                : option.id === "az"
                  ? bookSelectorViewMode === "az"
                  : bookSelectorViewMode === "testament" && selectorTestamentTab === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => applyBookSelectorView(option.id)}
                style={
                  isAndroidSheet
                    ? {
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        minHeight: 48,
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        backgroundColor: active ? READER_M3_SURFACE_CONTAINER : "transparent",
                      }
                    : {
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        borderRadius: active ? 999 : 8,
                        backgroundColor: active ? colors.brown800 : "transparent",
                      }
                }
                activeOpacity={0.75}
              >
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 16,
                    letterSpacing: isAndroidSheet ? 0 : 0.4,
                    color: isAndroidSheet
                      ? READER_M3_ON_SURFACE
                      : active
                        ? "#f5e9d6"
                        : colors.gold,
                  }}
                >
                  {option.label}
                </Text>
                {active ? (
                  isAndroidSheet ? (
                    <Ionicons name="checkmark" size={20} color={colors.gold} />
                  ) : (
                    <Text style={{ color: "#f5e9d6", fontSize: 16 }}>✓</Text>
                  )
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    ) : null}
          </View>
        </Animated.View>
      </View>
    {bookPickerOnboarding.showLayer &&
    bookPickerOnboarding.currentStep &&
    bookPickerOnboarding.buttonAnchor ? (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { zIndex: 10000, elevation: 100 }]}
        accessibilityLabel={bookPickerOnboarding.currentStep.title}
      >
        <ActionBarOnboardingOverlay
          step={bookPickerOnboarding.currentStep}
          buttonAnchor={bookPickerOnboarding.buttonAnchor}
          tooltipPlacement="below"
          verticalOffsetPx={-40}
          colors={{
            tooltipBackground: rc.selectionBackground,
            tooltipText: rc.selectionText,
            arrow: "#FFFFFF",
          }}
        />
      </View>
    ) : null}
    </View>
  </ReaderBookSheetWindowOverlay>
  );
}
