import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  RefreshControl,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  Keyboard,
  PanResponder,
  Platform,
  InteractionManager,
  useWindowDimensions,
  Alert,
  type ListRenderItem,
} from "react-native";
import { FlatList } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { useFocusEffect, useIsFocused } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { formatBookLabel, formatPassageReference, getTestament } from "@sinag-bible/core";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { loadJournalListItems, type MobileJournalListItem } from "@/lib/load-journal-entries";
import {
  deleteLocalEntry,
  JOURNAL_LOCAL_STORAGE_USER_MESSAGE,
  updateLocalEntry,
} from "@/lib/journal-local";
import { stripHtmlPreview } from "@/lib/journal-preview";
import { useSbJournalTabPadding } from "@/lib/use-sb-bottom-padding";
import { nativeTabFabOffsetPx, nativeFloatingTabBarTopReservePx } from "@/lib/native-tab-chrome";
import { isTabletLayout, TABLET_NEW_ENTRY_SHEET_MAX_WIDTH_PX } from "@/lib/tablet-layout";
import { ScreenLoadingSkeleton } from "@/components/loading-skeleton";
import { JournalNewEntryForm, type JournalNewEntryFormHandle } from "@/components/journal-new-entry-form";
import { JournalSwipeableListRow } from "@/components/journal-swipeable-list-row";
import { registerTabScrollRef } from "@/lib/tab-scroll-to-top";
import { hapticLightImpact } from "@/lib/haptics";
import { JournalOnboardingLayer } from "@/src/features/journal/JournalOnboardingLayer";
import { useJournalOnboarding } from "@/src/features/journal/useJournalOnboarding";
import type { JournalOnboardingStepId } from "@/src/features/journal/journalOnboardingSteps";

const SHEET_GAP_ABOVE_FAB_PX = 12;
const FAB_SIZE_PX = 72;
/** Android native tab bar overlaps the journal FAB slightly; nudge FAB (and matching list pad) up. */
const ANDROID_JOURNAL_FAB_EXTRA_BOTTOM_PX = Platform.OS === "android" ? 50 : 0;
/** On iOS the FAB sits too close to the bottom; lift it to match Android visual placement. */
const IOS_JOURNAL_FAB_EXTRA_BOTTOM_PX = Platform.OS === "ios" ? 30 : 0;

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateGroup(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  const today = new Date();
  const sameDay =
    parsed.getDate() === today.getDate() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getFullYear() === today.getFullYear();
  if (sameDay) return "Today";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type JournalRow =
  | { kind: "heading"; key: string; label: string }
  | { kind: "entry"; key: string; item: MobileJournalListItem };

type FilterKind = "all" | "new" | "old" | "favorites";
type SortKind = "newest" | "oldest" | "book";

const FILTER_MENU_ITEMS: { kind: FilterKind; label: string }[] = [
  { kind: "all", label: "All" },
  { kind: "new", label: "New Testament" },
  { kind: "old", label: "Old Testament" },
  { kind: "favorites", label: "Favorites" },
];

const SORT_MENU_ITEMS: { kind: SortKind; label: string }[] = [
  { kind: "newest", label: "Newest" },
  { kind: "oldest", label: "Oldest" },
  { kind: "book", label: "Book A-Z" },
];

function filterOptionLabel(kind: FilterKind): string {
  switch (kind) {
    case "all":
      return "All";
    case "new":
      return "New Testament";
    case "old":
      return "Old Testament";
    case "favorites":
      return "Favorites";
  }
}

function sortOptionLabel(kind: SortKind): string {
  switch (kind) {
    case "newest":
      return "Newest";
    case "oldest":
      return "Oldest";
    case "book":
      return "Book A-Z";
  }
}

const cardShadow = {
  shadowColor: "#2c2416",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

const emptyShadow = {
  shadowColor: "#2c2416",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.05,
  shadowRadius: 34,
  elevation: 3,
};

/** Heading row height for list date labels */
const JOURNAL_LIST_ROW_SEPARATOR_PX = 12;
const JOURNAL_LIST_HEADING_HEIGHT_PX = 28;

/** Fixed tile body height — minHeight alone had no effect because children were always taller. */
const JOURNAL_TILE_CONTENT_HEIGHT_PX = 108;
const JOURNAL_TILE_BADGE_SLOT_MIN_PX = 18;
const JOURNAL_TILE_PREVIEW_BLOCK_MIN_PX = 28;
const JOURNAL_TILE_RADIUS_PX = 16;
const JOURNAL_TILE_PREVIEW_FONT_PX = 13;
const JOURNAL_TILE_PREVIEW_LINE_HEIGHT_PX = 16;

const JournalListRowSeparator = memo(function JournalListRowSeparator() {
  return <View style={{ height: JOURNAL_LIST_ROW_SEPARATOR_PX }} />;
});

const JournalListDateHeading = memo(function JournalListDateHeading({ label }: { label: string }) {
  const { bundle } = useMobileAppTheme();
  return (
    <View style={{ height: JOURNAL_LIST_HEADING_HEIGHT_PX, paddingTop: 4, justifyContent: "center" }}>
      <Text
        className="text-[12px] tracking-[0.18em]"
        style={{ fontFamily: "Inter_500Medium", color: bundle.journal.dateHeading }}
      >
        {label}
      </Text>
    </View>
  );
});

type JournalListEntryCardProps = {
  item: MobileJournalListItem;
  onEntryPress: (id: string) => void;
  onSwipeFavorite: (item: MobileJournalListItem) => void;
  onSwipeDelete: (item: MobileJournalListItem) => void;
};

const JournalListEntryCard = memo(function JournalListEntryCard({
  item,
  onEntryPress,
  onSwipeFavorite,
  onSwipeDelete,
}: JournalListEntryCardProps) {
  const { bundle } = useMobileAppTheme();
  const colors = bundle.ui;
  const j = bundle.journal;
  const entryCardShadow = useMemo(
    () => ({
      ...cardShadow,
      shadowColor: colors.brown800,
    }),
    [colors.brown800],
  );

  const passage = useMemo(
    () =>
      item.book && item.chapter > 0
        ? formatPassageReference({
            book: item.book,
            chapter: item.chapter,
            verseStart: item.verse_start,
            verseEnd: item.verse_end,
          })
        : "",
    [item.book, item.chapter, item.verse_start, item.verse_end],
  );

  const title = useMemo(() => item.title?.trim() || passage || "Untitled entry", [item.title, passage]);

  const preview = useMemo(() => stripHtmlPreview(item.content, 120), [item.content]);

  const createdLabel = useMemo(() => formatDate(item.created_at), [item.created_at]);

  const isFavorite = item.is_favorite === true;
  const favoriteLeftRadii = isFavorite
    ? { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }
    : null;
  const pinClass = isFavorite ? "border-l-[10px] border-l-[#fbe0e0]" : "border-l-[3px] border-l-transparent";

  return (
    <JournalSwipeableListRow
      rowKey={item.id}
      onPress={() => onEntryPress(item.id)}
      onSwipeFavorite={() => onSwipeFavorite(item)}
      onSwipeDelete={() => onSwipeDelete(item)}
      shellStyle={favoriteLeftRadii ?? undefined}
      cardStyle={[
        entryCardShadow,
        {
          backgroundColor: j.cardBackground,
          borderRadius: JOURNAL_TILE_RADIUS_PX,
          ...(favoriteLeftRadii ?? {}),
        },
      ]}
    >
      <View
        className={`py-1.5 pl-4 pr-4 ${pinClass}`}
        style={{
          height: JOURNAL_TILE_CONTENT_HEIGHT_PX,
          overflow: "hidden",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexShrink: 1 }}>
          <View style={{ minHeight: JOURNAL_TILE_BADGE_SLOT_MIN_PX, justifyContent: "center" }}>
            {passage ? (
              <View
                className="self-start rounded-full px-2 py-0.5"
                style={{ backgroundColor: j.chipActiveBackground }}
              >
                <Text
                  className="text-[10px] font-medium uppercase"
                  style={{
                    fontFamily: "Inter_500Medium",
                    letterSpacing: 1.4,
                    color: j.chipActiveText,
                  }}
                  numberOfLines={1}
                >
                  {passage}
                  {item.bible_translation ? ` · ${item.bible_translation}` : ""}
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            className="mt-0.5 text-[14px] font-medium"
            style={{ fontFamily: "Lora_400Regular", lineHeight: 18, color: colors.brown800 }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          <View style={{ minHeight: JOURNAL_TILE_PREVIEW_BLOCK_MIN_PX, marginTop: 1 }}>
            {preview ? (
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: JOURNAL_TILE_PREVIEW_FONT_PX,
                  lineHeight: JOURNAL_TILE_PREVIEW_LINE_HEIGHT_PX,
                  color: colors.tan300,
                }}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {preview}
              </Text>
            ) : null}
          </View>
        </View>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            paddingTop: 1,
            lineHeight: 13,
            fontSize: 10,
            color: j.dateHeading,
          }}
          numberOfLines={1}
        >
          {createdLabel}
        </Text>
      </View>
    </JournalSwipeableListRow>
  );
});

const JournalListEmpty = memo(function JournalListEmpty() {
  const { bundle } = useMobileAppTheme();
  const emptyShadowThemed = useMemo(
    () => ({
      ...emptyShadow,
      shadowColor: bundle.ui.brown800,
    }),
    [bundle.ui.brown800],
  );
  const j = bundle.journal;
  return (
    <View
      className="mx-1 rounded-2xl border px-6 py-12 items-center"
      style={[
        emptyShadowThemed,
        {
          borderColor: j.emptyStateBorder,
          backgroundColor: j.emptyStateBackground,
        },
      ]}
    >
      <Text
        className="text-[15px] italic leading-relaxed text-center"
        style={{ fontFamily: "Lora_400Regular", color: j.emptyStateText }}
      >
        Nothing written yet. Open the Bible, find a verse that moves you, and begin.
      </Text>
    </View>
  );
});

function FabPlusIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M12 5v14M5 12h14"
        stroke="#f5e9d6"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function JournalIndexScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [hasVisitedJournalTab, setHasVisitedJournalTab] = useState(false);
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { bundle } = useMobileAppTheme();
  const colors = bundle.ui;
  const j = bundle.journal;
  const listPadBottom = useSbJournalTabPadding() + ANDROID_JOURNAL_FAB_EXTRA_BOTTOM_PX;
  const [entries, setEntries] = useState<MobileJournalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKind>("all");
  const [sort, setSort] = useState<SortKind>("newest");
  const [menuOpen, setMenuOpen] = useState(false);
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [newEntrySheetKey, setNewEntrySheetKey] = useState(0);
  const [newEntryHasDraft, setNewEntryHasDraft] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const listRef = useRef<FlatList<JournalRow> | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const createFromBibleRef = useRef<View | null>(null);
  const swipeActionsRef = useRef<View | null>(null);
  const dateGroupingRef = useRef<View | null>(null);
  const filtersRef = useRef<View | null>(null);
  const sortRef = useRef<View | null>(null);
  const journalOnboardingTargetRefs = useMemo(
    (): Record<JournalOnboardingStepId, React.RefObject<View | null>> => ({
      "create-from-bible": createFromBibleRef,
      "swipe-actions": swipeActionsRef,
      "date-grouping": dateGroupingRef,
      filters: filtersRef,
      sort: sortRef,
    }),
    [],
  );

  const fabBottom =
    nativeTabFabOffsetPx(insets.bottom) +
    ANDROID_JOURNAL_FAB_EXTRA_BOTTOM_PX +
    IOS_JOURNAL_FAB_EXTRA_BOTTOM_PX;
  const cardBottom = fabBottom + FAB_SIZE_PX + SHEET_GAP_ABOVE_FAB_PX;
  const isTablet = isTabletLayout(windowWidth, windowHeight);
  const sheetHorizontalInset = insets.left + 2;
  const sheetMaxWidth = isTablet ? TABLET_NEW_ENTRY_SHEET_MAX_WIDTH_PX : undefined;
  const sheetWidth = Math.min(
    windowWidth - sheetHorizontalInset * 2,
    sheetMaxWidth ?? windowWidth - sheetHorizontalInset * 2,
  );
  const sheetLeft = Math.max(sheetHorizontalInset, (windowWidth - sheetWidth) / 2);
  /**
   * Keep sheet top below status bar; on iPad landscape add space for the floating top tab pill
   * (not part of safe-area insets).
   */
  const sheetTopGutter =
    12 +
    nativeFloatingTabBarTopReservePx(
      windowWidth > windowHeight,
      isTablet,
    );
  const sheetMaxHeight = Math.min(
    600,
    windowHeight * 0.72 + 80,
    Math.max(280, windowHeight - cardBottom - insets.top - sheetTopGutter),
  );

  const fabSpin = useRef(new Animated.Value(0)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(20)).current;
  const sheetClosingRef = useRef(false);
  const newEntryFormRef = useRef<JournalNewEntryFormHandle | null>(null);
  useEffect(() => {
    Animated.timing(fabSpin, {
      toValue: newEntryOpen ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [newEntryOpen, fabSpin]);

  useEffect(() => {
    if (!newEntryOpen) return;
    sheetClosingRef.current = false;
    sheetOpacity.setValue(0);
    sheetTranslate.setValue(20);
    Animated.parallel([
      Animated.timing(sheetOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(sheetTranslate, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();
  }, [newEntryOpen, sheetOpacity, sheetTranslate]);

  const animateCloseNewEntrySheet = useCallback(
    (velocityY = 0, draggedY = 0) => {
      if (sheetClosingRef.current) return;
      sheetClosingRef.current = true;
      Keyboard.dismiss();

      const targetTranslateY = sheetMaxHeight + 40;
      const clampedDragY = Math.max(0, draggedY);
      const velocity = Math.max(0, velocityY);
      const duration = Math.max(150, Math.min(320, Math.round(280 - Math.min(1.8, velocity) * 90)));

      if (clampedDragY > 0) {
        sheetTranslate.setValue(clampedDragY);
      }

      Animated.parallel([
        Animated.timing(sheetTranslate, {
          toValue: targetTranslateY,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheetOpacity, {
          toValue: 0,
          duration: Math.max(180, duration + 90),
          delay: 80,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        sheetClosingRef.current = false;
        setNewEntryOpen(false);
        sheetTranslate.setValue(20);
        sheetOpacity.setValue(0);
      });
    },
    [sheetMaxHeight, sheetOpacity, sheetTranslate],
  );

  const closeNewEntrySheet = useCallback(() => {
    animateCloseNewEntrySheet(0.45, 0);
  }, [animateCloseNewEntrySheet]);

  const springJournalNewEntryOpen = useCallback(() => {
    Animated.parallel([
      Animated.spring(sheetTranslate, {
        toValue: 0,
        friction: 9,
        tension: 75,
        useNativeDriver: true,
      }),
      Animated.timing(sheetOpacity, {
        toValue: 1,
        duration: 170,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [sheetOpacity, sheetTranslate]);

  const confirmJournalNewEntryDraftClose = useCallback(() => {
    Alert.alert("Save or discard?", "You have unsaved text in this draft.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Save", onPress: () => newEntryFormRef.current?.save() },
      { text: "Discard", style: "destructive", onPress: closeNewEntrySheet },
    ]);
  }, [closeNewEntrySheet]);

  const newEntryHandlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => newEntryOpen,
        onMoveShouldSetPanResponder: (_e, g) =>
          newEntryOpen && g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderTerminationRequest: () => true,
        onPanResponderGrant: () => {
          sheetTranslate.stopAnimation();
          sheetOpacity.stopAnimation();
        },
        onPanResponderMove: (_e, g) => {
          if (!newEntryOpen || sheetClosingRef.current) return;
          const dragY = Math.max(0, g.dy);
          sheetTranslate.setValue(dragY);
          sheetOpacity.setValue(Math.max(0.82, 1 - dragY / 900));
        },
        onPanResponderRelease: (_e, g) => {
          if (!newEntryOpen || sheetClosingRef.current) return;
          const dragY = Math.max(0, g.dy);
          const shouldClose = dragY > 90 || g.vy > 0.55;
          if (shouldClose) {
            if (newEntryHasDraft) {
              springJournalNewEntryOpen();
              confirmJournalNewEntryDraftClose();
              return;
            }
            animateCloseNewEntrySheet(g.vy, dragY);
            return;
          }
          Animated.parallel([
            Animated.spring(sheetTranslate, {
              toValue: 0,
              velocity: Math.max(0, g.vy),
              friction: 9,
              tension: 75,
              useNativeDriver: true,
            }),
            Animated.timing(sheetOpacity, {
              toValue: 1,
              duration: 170,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start();
        },
        onPanResponderTerminate: (_e, g) => {
          if (!newEntryOpen || sheetClosingRef.current) return;
          const dragY = Math.max(0, g.dy);
          const shouldClose = dragY > 90 || g.vy > 0.55;
          if (shouldClose) {
            if (newEntryHasDraft) {
              springJournalNewEntryOpen();
              confirmJournalNewEntryDraftClose();
              return;
            }
            animateCloseNewEntrySheet(g.vy, dragY);
            return;
          }
          Animated.parallel([
            Animated.spring(sheetTranslate, {
              toValue: 0,
              velocity: Math.max(0, g.vy),
              friction: 9,
              tension: 75,
              useNativeDriver: true,
            }),
            Animated.timing(sheetOpacity, {
              toValue: 1,
              duration: 170,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    [
      animateCloseNewEntrySheet,
      confirmJournalNewEntryDraftClose,
      newEntryHasDraft,
      newEntryOpen,
      sheetOpacity,
      sheetTranslate,
      springJournalNewEntryOpen,
    ],
  );

  const fabIconRotate = fabSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  const openNewEntrySheet = () => {
    setNewEntrySheetKey((k) => k + 1);
    setNewEntryHasDraft(false);
    setNewEntryOpen(true);
  };

  const requestCloseNewEntrySheet = useCallback(() => {
    if (!newEntryHasDraft) {
      closeNewEntrySheet();
      return;
    }
    confirmJournalNewEntryDraftClose();
  }, [closeNewEntrySheet, confirmJournalNewEntryDraftClose, newEntryHasDraft]);

  const toggleNewEntrySheet = () => {
    hapticLightImpact();
    if (newEntryOpen) {
      requestCloseNewEntrySheet();
    } else {
      openNewEntrySheet();
    }
  };

  const load = useCallback(async () => {
    try {
      const rows = await loadJournalListItems();
      setEntries(rows);
    } catch (e) {
      if (__DEV__) {
        console.error(e);
      }
      Alert.alert("Journal", JOURNAL_LOCAL_STORAGE_USER_MESSAGE);
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const showJournalToast = useCallback((message: string) => {
    toastAnimRef.current?.stop();
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) {
      toastOpacity.setValue(0);
      return;
    }
    toastOpacity.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(2200),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    toastAnimRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) setToast(null);
    });
    return () => {
      anim.stop();
    };
  }, [toast, toastOpacity]);

  useFocusEffect(
    useCallback(() => {
      setHasVisitedJournalTab(true);
      let cancelled = false;
      setLoading(true);
      const task = InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;
        void load();
      });
      return () => {
        cancelled = true;
        task.cancel();
        // Release RichEditor WebViews when leaving the tab (Hermes / native memory).
        setNewEntryOpen(false);
        setNewEntryHasDraft(false);
      };
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const filteredSorted = useMemo(() => {
    const filtered = entries.filter((entry) => {
      if (filter === "all") return true;
      if (filter === "favorites") return entry.is_favorite === true;
      if (!entry.book || entry.chapter <= 0) return false;
      const testament = filter === "new" ? "new" : "old";
      return getTestament(entry.book) === testament;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      const safeTimeA = Number.isNaN(timeA) ? 0 : timeA;
      const safeTimeB = Number.isNaN(timeB) ? 0 : timeB;

      if (sort === "newest") return safeTimeB - safeTimeA;
      if (sort === "oldest") return safeTimeA - safeTimeB;

      const bookA = a.book ? formatBookLabel(a.book) : "";
      const bookB = b.book ? formatBookLabel(b.book) : "";
      const byBook = bookA.localeCompare(bookB, undefined, { sensitivity: "base" });
      if (byBook !== 0) return byBook;
      if (a.chapter !== b.chapter) return a.chapter - b.chapter;
      return safeTimeB - safeTimeA;
    });

    return sorted;
  }, [entries, filter, sort]);

  const rows = useMemo<JournalRow[]>(() => {
    const next: JournalRow[] = [];
    let lastLabel: string | null = null;
    for (const item of filteredSorted) {
      const label = formatDateGroup(item.created_at).toUpperCase();
      if (label !== lastLabel) {
        next.push({ kind: "heading", key: `heading-${label}-${item.id}`, label });
        lastLabel = label;
      }
      next.push({ kind: "entry", key: item.id, item });
    }
    return next;
  }, [filteredSorted]);

  const firstEntryId = useMemo(
    () => rows.find((row) => row.kind === "entry")?.item.id ?? null,
    [rows],
  );
  const firstHeadingKey = useMemo(
    () => rows.find((row) => row.kind === "heading")?.key ?? null,
    [rows],
  );

  const journalOnboarding = useJournalOnboarding({
    journalContentReady: !loading,
    menuOpen,
    setMenuOpen,
    targetRefs: journalOnboardingTargetRefs,
    screenW: windowWidth,
    screenH: windowHeight,
    newEntryFabBottomPx: fabBottom,
  });

  const journalRowOffsets = useMemo(() => {
    const offsets: number[] = [];
    let runningOffset = 0;
    for (const row of rows) {
      offsets.push(runningOffset);
      const rowHeight =
        row.kind === "heading" ? JOURNAL_LIST_HEADING_HEIGHT_PX : JOURNAL_TILE_CONTENT_HEIGHT_PX;
      runningOffset += rowHeight + JOURNAL_LIST_ROW_SEPARATOR_PX;
    }
    return offsets;
  }, [rows]);

  const getJournalItemLayout = useCallback(
    (_: ArrayLike<JournalRow> | null | undefined, index: number) => {
      const row = rows[index];
      const rowHeight =
        row?.kind === "heading" ? JOURNAL_LIST_HEADING_HEIGHT_PX : JOURNAL_TILE_CONTENT_HEIGHT_PX;
      return {
        length: rowHeight + JOURNAL_LIST_ROW_SEPARATOR_PX,
        offset: journalRowOffsets[index] ?? 0,
        index,
      };
    },
    [journalRowOffsets, rows],
  );

  const handleEntryPress = useCallback(
    (id: string) => {
      router.push(`/journal/${id}` as never);
    },
    [router],
  );

  const commitToggleFavorite = useCallback(
    async (item: MobileJournalListItem) => {
      const next = item.is_favorite !== true;
      try {
        await updateLocalEntry(item.id, { is_favorite: next });
        setEntries((prev) => prev.map((e) => (e.id === item.id ? { ...e, is_favorite: next } : e)));
        showJournalToast(next ? "Pinned to favorites" : "Removed from favorites");
      } catch (e) {
        if (__DEV__) {
          console.error(e);
        }
        Alert.alert("Could not update favorite", "Try again.");
      }
    },
    [showJournalToast],
  );

  const requestDeleteEntry = useCallback(
    (item: MobileJournalListItem) => {
      Alert.alert("Delete entry?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await deleteLocalEntry(item.id);
                setEntries((prev) => prev.filter((e) => e.id !== item.id));
                showJournalToast("Entry deleted");
              } catch (e) {
                if (__DEV__) {
                  console.error(e);
                }
                Alert.alert("Could not delete", "Try again.");
              }
            })();
          },
        },
      ]);
    },
    [showJournalToast],
  );

  const keyExtractor = useCallback(
    (row: JournalRow) => (row.kind === "entry" ? row.item.id : row.key),
    [],
  );

  const renderJournalRow = useCallback<ListRenderItem<JournalRow>>(
    ({ item: row }) => {
      if (row.kind === "heading") {
        const isFirstHeading = row.key === firstHeadingKey;
        return (
          <View ref={isFirstHeading ? dateGroupingRef : undefined} collapsable={false}>
            <JournalListDateHeading label={row.label} />
          </View>
        );
      }
      const isFirstEntry = row.item.id === firstEntryId;
      if (isFirstEntry) {
        return (
          <View ref={swipeActionsRef} collapsable={false}>
            <JournalListEntryCard
              item={row.item}
              onEntryPress={handleEntryPress}
              onSwipeFavorite={commitToggleFavorite}
              onSwipeDelete={requestDeleteEntry}
            />
          </View>
        );
      }
      return (
        <JournalListEntryCard
          item={row.item}
          onEntryPress={handleEntryPress}
          onSwipeFavorite={commitToggleFavorite}
          onSwipeDelete={requestDeleteEntry}
        />
      );
    },
    [
      commitToggleFavorite,
      firstEntryId,
      firstHeadingKey,
      handleEntryPress,
      requestDeleteEntry,
    ],
  );

  const journalListEmpty = useMemo(() => <JournalListEmpty />, []);

  const refreshControl = useMemo(
    () => <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brown800} />,
    [colors.brown800, refreshing, onRefresh],
  );

  const listContentContainerStyle = useMemo(() => ({ paddingBottom: listPadBottom }), [listPadBottom]);

  const sheetCardThemed = useMemo(
    () => [
      styles.sheetCard,
      {
        backgroundColor: j.newEntrySheetBackground,
        borderColor: j.newEntrySheetBorder,
        shadowColor: colors.brown800,
      },
    ],
    [j.newEntrySheetBackground, j.newEntrySheetBorder, colors.brown800],
  );

  useEffect(() => {
    return registerTabScrollRef("journal", {
      scrollToOffset: ({ offset, animated = true }) => {
        listRef.current?.scrollToOffset({ offset, animated });
      },
    });
  }, []);

  if (!isFocused || !hasVisitedJournalTab) {
    return (
      <View style={{ flex: 1, backgroundColor: bundle.journal.listPageBackground }} />
    );
  }

  return (
    <View className="flex-1" style={{ overflow: "visible", backgroundColor: bundle.journal.listPageBackground }}>
      <View style={{ flex: 1, zIndex: 0 }}>
      <View className="px-4 pb-3 pt-[49px]">
        <Text className="text-[32px] font-normal" style={{ fontFamily: "Lora_400Regular", color: colors.brown800 }}>
          Journal
        </Text>
        <Text
          className="mt-0.5 text-[13px] leading-relaxed"
          style={{ fontFamily: "Inter_400Regular", color: j.subtitleQuote }}
        >
          <Text className="italic" style={{ color: j.subtitleQuote }}>
            Your Word is a lamp unto my feet and a light unto my path.{" "}
          </Text>
          <Text style={{ fontWeight: "700", fontStyle: "normal", color: colors.brown800 }}>Psalm 119:105</Text>
          {"\n"}
          Pause, reflect, and document your journey with the Word of God today.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Journal filter and sort options"
          onPress={() => {
            if (journalOnboarding.tourActive) return;
            setMenuOpen((open) => !open);
          }}
          className="mt-3 self-start rounded-full px-3 py-2 active:opacity-90"
          style={{ backgroundColor: j.filterOpenerBackground }}
        >
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: j.filterOpenerText }}>
            {filterOptionLabel(filter)} · {sortOptionLabel(sort)}
          </Text>
        </Pressable>
        {menuOpen ? (
          <View
            className="mt-2 w-full rounded-2xl border px-3 py-3"
            style={{ borderColor: j.panelBorder, backgroundColor: j.panelBackground }}
            pointerEvents={journalOnboarding.tourActive ? "none" : "auto"}
          >
            <View ref={filtersRef} collapsable={false}>
              <Text
                className="text-[11px] uppercase tracking-[0.16em]"
                style={{ fontFamily: "Inter_500Medium", color: j.dateHeading }}
              >
                Filter
              </Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {FILTER_MENU_ITEMS.map((item) => {
                  const active = item.kind === filter;
                  return (
                    <Pressable
                      key={item.kind}
                      onPress={() => {
                        setFilter(item.kind);
                        setMenuOpen(false);
                      }}
                      className="rounded-full border px-3 py-1.5"
                      style={{
                        borderColor: active ? j.chipActiveBorder : j.chipInactiveBorder,
                        backgroundColor: active ? j.chipActiveBackground : j.chipInactiveBackground,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Inter_500Medium",
                          fontSize: 12,
                          color: active ? j.chipActiveText : j.chipInactiveText,
                        }}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View ref={sortRef} collapsable={false}>
              <Text
                className="mt-3 text-[11px] uppercase tracking-[0.16em]"
                style={{ fontFamily: "Inter_500Medium", color: j.dateHeading }}
              >
                Sort
              </Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {SORT_MENU_ITEMS.map((item) => {
                  const active = item.kind === sort;
                  return (
                    <Pressable
                      key={item.kind}
                      onPress={() => {
                        setSort(item.kind);
                        setMenuOpen(false);
                      }}
                      className="rounded-full border px-3 py-1.5"
                      style={{
                        borderColor: active ? j.chipActiveBorder : j.chipInactiveBorder,
                        backgroundColor: active ? j.chipActiveBackground : j.chipInactiveBackground,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Inter_500Medium",
                          fontSize: 12,
                          color: active ? j.chipActiveText : j.chipInactiveText,
                        }}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {loading && entries.length === 0 ? (
        <ScreenLoadingSkeleton lines={7} caption="Loading entries…" style={{ paddingTop: 24 }} />
      ) : (
        <FlatList
          ref={listRef}
          className="flex-1 px-4"
          data={rows}
          keyExtractor={keyExtractor}
          ItemSeparatorComponent={JournalListRowSeparator}
          removeClippedSubviews={Platform.OS === "android"}
          getItemLayout={getJournalItemLayout}
          windowSize={10}
          maxToRenderPerBatch={8}
          initialNumToRender={6}
          scrollEventThrottle={16}
          refreshControl={refreshControl}
          contentContainerStyle={listContentContainerStyle}
          ListEmptyComponent={journalListEmpty}
          renderItem={renderJournalRow}
        />
      )}
      </View>

      {/* Full-screen layer so the FAB/sheet sit above FlatList native stacking (iOS/Android native tabs). */}
      <View
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, styles.fabOverlay]}
        collapsable={false}
      >
        {newEntryOpen ? (
          <Pressable
            accessibilityLabel="Dismiss new entry"
            accessibilityRole="button"
            onPress={requestCloseNewEntrySheet}
            style={[styles.sheetBackdrop, StyleSheet.absoluteFill]}
          />
        ) : null}

        {newEntryOpen ? (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.sheetWrap,
              {
                left: sheetLeft,
                width: sheetWidth,
                bottom: cardBottom,
                height: sheetMaxHeight,
                maxHeight: sheetMaxHeight,
                opacity: sheetOpacity,
                transform: [{ translateY: sheetTranslate }],
              },
            ]}
          >
            <View style={styles.sheetKeyboardView}>
              <View style={sheetCardThemed}>
                <View
                  {...newEntryHandlePanResponder.panHandlers}
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    paddingTop: 6,
                    paddingBottom: 4,
                    backgroundColor: j.newEntryDragAreaBackground,
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: "rgba(123,106,86,0.35)",
                    }}
                  />
                </View>
                <View
                  style={{
                    flex: 1,
                    minHeight: 0,
                    paddingHorizontal: 0,
                    paddingTop: 4,
                    paddingBottom: 8,
                  }}
                >
                  <JournalNewEntryForm
                    ref={newEntryFormRef}
                    key={newEntrySheetKey}
                    contentScrollMaxHeight={sheetMaxHeight - 42}
                    contentHorizontalPadding={10}
                    onDirtyChange={setNewEntryHasDraft}
                    onSaveToast={showJournalToast}
                    onAfterSave={() => {
                      closeNewEntrySheet();
                      void load();
                    }}
                  />
                </View>
              </View>
            </View>
          </Animated.View>
        ) : null}

        <View
          pointerEvents="box-none"
          style={[styles.fabAnchor, { bottom: fabBottom }]}
          collapsable={false}
        >
          <Pressable
            ref={createFromBibleRef}
            accessibilityRole="button"
            accessibilityLabel={newEntryOpen ? "Close new entry" : "New journal entry"}
            onPress={toggleNewEntrySheet}
            style={({ pressed }) => [
              styles.fab,
              {
                opacity: pressed ? 0.92 : 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            <LinearGradient
              colors={[...j.fabGradient]}
              locations={[0, 0.52, 1]}
              start={{ x: 0.15, y: 0.1 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabGrad}
            >
              <Animated.View style={{ transform: [{ rotate: fabIconRotate }] }}>
                <FabPlusIcon />
              </Animated.View>
            </LinearGradient>
          </Pressable>
        </View>

        {toast ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.toastWrap,
              {
                opacity: toastOpacity,
                bottom: fabBottom + FAB_SIZE_PX + 20,
              },
            ]}
          >
            <View style={styles.toastBubble}>
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          </Animated.View>
        ) : null}
      </View>

      <JournalOnboardingLayer
        visible={journalOnboarding.showLayer}
        step={journalOnboarding.currentStep}
        stepAnchor={journalOnboarding.stepAnchor}
        colors={{
          tooltipBackground: colors.brown800,
          tooltipText: "#f5f2ec",
          arrow: "#FFFFFF",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toastWrap: {
    position: "absolute",
    left: 24,
    right: 24,
    alignItems: "center",
    zIndex: 400,
  },
  toastBubble: {
    maxWidth: 320,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: Platform.OS === "android" ? 24 : 999,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(44, 36, 22, 0.92)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
    color: "#f5f2ec",
    textAlign: "center",
    width: "100%",
    ...(Platform.OS === "android" ? { alignSelf: "center" as const } : null),
  },
  fabOverlay: {
    zIndex: 200,
    elevation: 200,
  },
  fabAnchor: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  sheetBackdrop: {
    backgroundColor: "rgba(36, 36, 35, 0.42)",
    zIndex: 1,
  },
  /** Horizontal inset is `insets.left/right + 2` inline (matches reader new-entry sheet). */
  sheetWrap: {
    position: "absolute",
    zIndex: 2,
  },
  sheetKeyboardView: {
    flex: 1,
    maxHeight: "100%",
  },
  sheetCard: {
    flex: 1,
    minHeight: 280,
    borderRadius: 24,
    backgroundColor: "#fdfbf7",
    borderWidth: 1,
    borderColor: "#ece7dd",
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    maxHeight: "100%",
    overflow: "hidden",
    shadowColor: "#2c2416",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 10,
  },
  fab: {
    width: FAB_SIZE_PX,
    height: FAB_SIZE_PX,
    borderRadius: FAB_SIZE_PX / 2,
    overflow: "hidden",
    shadowColor: "#242423",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 14,
    zIndex: 3,
  },
  fabGrad: {
    flex: 1,
    width: FAB_SIZE_PX,
    height: FAB_SIZE_PX,
    borderRadius: FAB_SIZE_PX / 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(245, 233, 214, 0.09)",
    alignItems: "center",
    justifyContent: "center",
  },
});
