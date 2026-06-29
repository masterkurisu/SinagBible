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
import { ActionBarOnboardingOverlay } from "@/src/features/reader/ActionBarOnboardingOverlay";
import { useBookPickerOnboarding } from "@/src/features/reader/useBookPickerOnboarding";
import { FullWindowOverlay } from "react-native-screens";

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
  const [bookSheetDismissPanEnabled, setBookSheetDismissPanEnabled] = useState(true);
  const [bookSelectorStorageReady, setBookSelectorStorageReady] = useState(false);

  const bookSheetTranslateY = useRef(new Animated.Value(0)).current;
  const bookSheetClosingRef = useRef(false);
  const bookSheetDragStartYRef = useRef(0);
  const bookSheetPanRef = useRef<PanGestureHandler>(null);
  const bookSheetScrollNativeRef = useRef<NativeViewGestureHandler>(null);
  const bookListScrollRef = useRef<GHScrollViewRef>(null);
  const bookListContentRef = useRef<View>(null);
  const currentBookItemRef = useRef<View>(null);
  const bookViewFilterButtonRef = useRef<View>(null);

  const { width: screenW } = useWindowDimensions();

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
    if (view === "grid" || view === "az") {
      setBookSelectorViewMode(view);
    } else {
      setBookSelectorViewMode("testament");
      setSelectorTestamentTab(view);
    }
    setBookViewMenuOpen(false);
  }, []);

  const bookGridColumns = 3;
  const bookSheetInnerW = Math.max(
    240,
    Dimensions.get("window").width
      - (insets.left + insets.right)
      - readerBookSheetScreenEdgePad * 2
      - readerBookSheetPad * 2,
  );
  const readerBookGridCellWResolved = Math.max(
    72,
    Math.min(
      readerBookGridCellW,
      Math.floor((bookSheetInnerW - readerBookGridGap * (bookGridColumns - 1)) / bookGridColumns),
    ),
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
      return;
    }
    resetPickerState();
    const currentBookIndex = books.findIndex((b) => b.slug === chapter.bookSlug);
    if (currentBookIndex >= 0 && bookSelectorViewMode === "testament") {
      setSelectorTestamentTab(currentBookIndex < OT_BOOK_COUNT ? "old" : "new");
    }
    bookSheetClosingRef.current = false;
    bookSheetTranslateY.stopAnimation();
    if (Platform.OS === "android") {
      bookSheetTranslateY.setValue(28);
      Animated.timing(bookSheetTranslateY, {
        toValue: 0,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
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

  if (!isOpen) return null;

  return (

  <ReaderBookSheetWindowOverlay
    visible={isOpen}
    onRequestClose={() => animateClose(0, 0)}
  >
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 32 }]}
      pointerEvents="box-none"
      accessibilityViewIsModal
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss book picker"
        onPress={() => animateClose(0, 0)}
        style={[StyleSheet.absoluteFill, { backgroundColor: rc.menuScrim }]}
      />
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: insets.left + readerBookSheetScreenEdgePad,
          right: insets.right + readerBookSheetScreenEdgePad,
          top: insets.top + 8,
          bottom: readerBookSheetBottomPx,
          transform: [{ translateY: bookSheetTranslateY }],
        }}
      >
        <View
          style={{
            flex: 1,
            minHeight: 0,
            borderRadius: 20,
            backgroundColor: rc.sceneSurface,
            overflow: "hidden",
            shadowColor: rc.popoverShadow,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.14,
            shadowRadius: 16,
            elevation: 10,
          }}
        >
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
              style={{ flex: 1, minHeight: 0, paddingTop: 6 }}
              accessibilityLabel="Book picker sheet"
              accessibilityHint="Swipe down to return to the reader without changing book or chapter"
            >
              {/* Handle pill + generous vertical padding so swipe-to-dismiss matches common sheet UX. */}
              <View
                style={{
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingTop: 4,
                  paddingBottom: 10,
                  minHeight: 44,
                }}
              >
                <View
                  pointerEvents="none"
                  style={{
                    width: 40,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: "rgba(0,0,0,0.22)",
                  }}
                />
              </View>
      {step === "books" ? (
        <>
          <View style={{ paddingHorizontal: readerBookSheetPad, paddingTop: 0, paddingBottom: 6 }}>
            <View style={{ minHeight: 48, justifyContent: "center", zIndex: 1 }}>
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
                <TouchableOpacity
                  onPress={() => setBookViewMenuOpen((o) => !o)}
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
                  /* Avoid a tall bottom hitSlop: it overlaps the book grid ScrollView and the OS
                   * waits to disambiguate scroll vs tap, which feels like lag or missed taps. */
                  hitSlop={{ top: 10, bottom: 4, left: 8, right: 8 }}
                  accessibilityLabel="Choose book list view"
                  accessibilityState={{ expanded: bookViewMenuOpen }}
                >
                  <MenuOptionsIcon size={22} color={colors.gold} />
                </TouchableOpacity>
              </View>
              <Text
                className="tracking-widest uppercase"
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 20,
                  textAlign: "center",
                  color: colors.brown800,
                }}
              >
                SELECT A BOOK
              </Text>
            </View>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 10,
                letterSpacing: 0.8,
                color: colors.gold,
                textAlign: "center",
                marginTop: 2,
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
                paddingHorizontal: readerBookSheetPad,
                paddingBottom: 24,
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
                          fontSize: 10,
                          letterSpacing: 2.2,
                          color: colors.gold,
                          marginBottom: 8,
                          paddingHorizontal: 4,
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
                                  borderRadius: 20,
                                  overflow: "hidden",
                                }}
                              >
                                {isCurrentBook ? (
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
                                      paddingVertical: 8,
                                      paddingHorizontal: 6,
                                      backgroundColor: colors.parchment,
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    <Text
                                      numberOfLines={1}
                                      style={{
                                        fontFamily: "Lora_400Regular",
                                        fontSize: 16,
                                        color: colors.brown800,
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
                    paddingVertical: 8,
                    paddingHorizontal: 12,
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
                      style={{ marginBottom: readerBookGridGap }}
                      activeOpacity={0.75}
                      accessibilityLabel={`Choose chapter for ${b.name}`}
                    >
                      <View
                        style={{
                          borderRadius: 20,
                          overflow: "hidden",
                        }}
                      >
                        {isCurrentBook ? (
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
                          <View style={[rowPad, { backgroundColor: colors.parchment }]}>
                          <Text
                            style={{
                              fontFamily: "Lora_400Regular",
                              fontSize: 18,
                              color: colors.brown800,
                              flexShrink: 1,
                            }}
                          >
                            {b.name}
                          </Text>
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
                        </View>
                      )}
                      </View>
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
                      paddingVertical: 8,
                      paddingHorizontal: 12,
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
                        style={{ marginBottom: readerBookGridGap }}
                        activeOpacity={0.75}
                        accessibilityLabel={`Choose chapter for ${b.name}`}
                      >
                        <View
                          style={{
                            borderRadius: 20,
                            overflow: "hidden",
                          }}
                        >
                          {isCurrentBook ? (
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
                            <View style={[testamentRowPad, { backgroundColor: colors.parchment }]}>
                              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    fontFamily: "Lora_400Regular",
                                    fontSize: 18,
                                    color: colors.brown800,
                                    flexShrink: 1,
                                  }}
                                >
                                  {b.name}
                                </Text>
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
                              </View>
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
                            </View>
                          )}
                        </View>
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
        <View style={{ flex: 1, paddingHorizontal: readerBookSheetPad }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <TouchableOpacity
              onPress={() => {
                hapticLightImpact();
                setStep("books");
                setPickerBook(null);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Back to books"
            >
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: colors.gold }}>
                ← Books
              </Text>
            </TouchableOpacity>
          </View>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              letterSpacing: 2.5,
              color: colors.gold,
              textAlign: "center",
            }}
          >
            {getSelectChapterHeadingForLanguage(translationLanguageLabel)}
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              letterSpacing: 1.8,
              color: colors.brown800,
              textAlign: "center",
              marginTop: 6,
              marginBottom: 18,
            }}
          >
            {pickerBook.name.toUpperCase()}
          </Text>
          <NativeViewGestureHandler
            ref={bookSheetScrollNativeRef}
            simultaneousHandlers={bookSheetPanRef}
          >
            <GHScrollView
              style={{ flex: 1 }}
              nestedScrollEnabled={Platform.OS === "android"}
              contentContainerStyle={{ paddingBottom: 20, flexDirection: "row", flexWrap: "wrap" }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onScroll={(ev) => onBookSheetScroll(ev.nativeEvent.contentOffset.y)}
            >
            {Array.from({ length: pickerBook.chapterCount }, (_, i) => i + 1).map((chNum, index) => {
              const isCurrent =
                pickerBook.slug === chapter.bookSlug && chNum === chapter.chapterNumber;
              const mr = index % readerChapterCols === readerChapterCols - 1 ? 0 : readerBookGridGap;
              return (
                <TouchableOpacity
                  key={chNum}
                  onPress={() => {
                    hapticLightImpact();
                    onClose();
                    goToReaderChapter(pickerBook.slug, chNum, resolvedTranslationId);
                  }}
                  style={{
                    width: readerChapterGridCellW,
                    marginRight: mr,
                    marginBottom: readerBookGridGap,
                    borderRadius: 12,
                    paddingVertical: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.parchment,
                    borderWidth: 1,
                    borderColor: isCurrent ? colors.brown800 : colors.borderSolid,
                  }}
                  activeOpacity={0.75}
                  accessibilityLabel={`Open ${pickerBook.name} chapter ${chNum}`}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 14,
                      color: isCurrent ? colors.gold : colors.brown800,
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
          style={{
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
          }}
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
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: active ? 999 : 8,
                  backgroundColor: active ? colors.brown800 : "transparent",
                }}
                activeOpacity={0.75}
              >
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 16,
                    letterSpacing: 0.4,
                    color: active ? "#f5e9d6" : colors.gold,
                  }}
                >
                  {option.label}
                </Text>
                {active ? <Text style={{ color: "#f5e9d6", fontSize: 16 }}>✓</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    ) : null}
        </View>
      </Animated.View>
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
