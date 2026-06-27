import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { GestureResponderEvent, PanResponderGestureState } from "react-native";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  useWindowDimensions,
  BackHandler,
  PanResponder,
  InteractionManager,
  unstable_batchedUpdates,
  type LayoutRectangle,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useReaderStorage } from "@/lib/use-reader-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { FlashListRef, ListRenderItemInfo } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type {
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { State } from "react-native-gesture-handler";
import {
  formatTranslationDropdownLabel,
  getBookNavForTranslation,
  getChapterBySlugForTranslation,
  getInternalIdFromApiId,
  isTranslationId,
  type TranslationId,
} from "@sinag-bible/core/bible-translations";
import { getUsfmBookId } from "@sinag-bible/core";
import { fetchChapter as fetchApiChapter } from "@/lib/bible-api-service";
import {
  getCachedReaderChapter,
  readerChapterCacheKey,
  setCachedReaderChapter,
} from "@/lib/reader-chapter-cache";
import {
  fetchReaderChapterContent,
  primeReaderChapterFetch,
  readerUsesPerChapterFetch,
  resolveReaderBooksForTranslation,
} from "@/lib/reader-chapter-load";
import {
  collectPrefetchChapterTargets,
  getReaderChapterNeighbors,
  type ChapterNavTarget,
} from "@/lib/reader-chapter-nav";
import { mergeVerseInlineFromHelloaoChapter } from "@/lib/merge-helloao-verse-inline";
import { useTranslationPicker } from "@/lib/use-translation-picker";
import { useFavoriteTranslations } from "@/lib/use-favorite-translations";
import type { BibleBookNavItem, BibleChapter } from "@sinag-bible/types";
import { highlightColorOptions } from "@sinag-bible/ui";
import { mobileAppThemePickerOptions } from "@sinag-bible/tokens";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import {
  ReaderCopyIcon,
  ReaderHighlightIcon,
  ReaderJournalIcon,
  ReaderNoteIcon,
} from "@/components/reader-action-icons";
import { BibleBookIcon } from "@/components/icons/BibleBookIcon";
import { ReaderSettingsCogIcon } from "@/components/icons/ReaderSettingsCogIcon";
import { FilterListIcon } from "@/components/icons/FilterListIcon";
import { StudyNotesBookmarkIcon } from "@/components/icons/StudyNotesBookmarkIcon";
import {
  ReaderAlignCenterIcon,
  ReaderAlignJustifyIcon,
  ReaderAlignLeftIcon,
  ReaderAlignRightIcon,
} from "@/components/icons/ReaderFontSheetAlignIcons";
import { BOOK_GENRE_BY_SLUG } from "@/lib/book-genre-by-slug";
import {
  DEFAULT_READER_VERSE_BODY_FONT_ID,
  isReaderVerseBodyFontId,
  READER_VERSE_BODY_FONT_STORAGE_KEY,
  readerVerseBodyFontFamily,
  type ReaderVerseBodyFontId,
} from "@/lib/reader-verse-body-font";
import { ReaderFontSizeSlider } from "@/components/reader-font-size-slider";
import { ReaderVerseRow } from "@/components/reader-verse-row";
import { readerChapterScreenParams } from "@/lib/reader-navigation";
import { nativeTabFabOffsetPx, nativeTabSheetBottomInsetPx } from "@/lib/native-tab-chrome";
import { isTabletLayout, TABLET_NEW_ENTRY_SHEET_MAX_WIDTH_PX } from "@/lib/tablet-layout";
import {
  JournalNewEntryForm,
  type JournalNewEntryFormHandle,
  type JournalNewEntryInitialParams,
} from "@/components/journal-new-entry-form";
import { PrivacyPolicySheet } from "@/components/privacy-policy-sheet";
import { CreditsSheet } from "@/components/credits-sheet";
import { TermsOfServiceSheet } from "@/components/terms-of-service-sheet";
import { registerTabScrollRef } from "@/lib/tab-scroll-to-top";
import { hapticLightImpact, hapticSelection } from "@/lib/haptics";
import { deleteAllUserData } from "@/lib/delete-my-data";
import { LinearGradient } from "expo-linear-gradient";
import {
  buildReaderVerseFlashListData,
  readerVerseEstimatedFlashListItemSizePx,
  ReaderVerseList,
  READER_TABLET_TWO_COLUMN_GAP,
  splitVerseIndexForBalancedColumns,
} from "@/src/features/reader/ReaderVerseList";
import {
  chapterSwipeMoveShouldActivate,
  chapterSwipeMoveShouldSetCapture,
  chapterSwipeReleaseShouldNavigate,
  noopChapterSwipePan,
  READER_VERSES_FADE_IN_MS,
  type ReaderVerseFlashItem,
} from "@/src/features/reader/useReaderGestures";
import { useReaderSelection } from "@/src/features/reader/useReaderSelection";
import { ReaderHeader, READER_HEADER_TITLE_MAIN_PX, READER_HEADER_TITLE_TRANS_PX } from "@/src/features/reader/ReaderHeader";
import {
  ReaderChapterNavArrows,
  useReaderChapterNavArrowsVisibility,
} from "@/src/features/reader/ReaderChapterNavArrows";
import {
  ReaderModals,
  ReaderMobileSettingsPanel,
  type BookSelectorViewMode,
  type ReaderToolsDropdown,
  type SelectorTestamentTab,
} from "@/src/features/reader/ReaderModals";
import { ReaderActionBarOnboardingLayer } from "@/src/features/reader/ReaderActionBarOnboardingLayer";
import { ReaderFeatureOnboardingLayer } from "@/src/features/reader/ReaderFeatureOnboardingLayer";
import { ReaderSettingsOnboardingLayer } from "@/src/features/reader/ReaderSettingsOnboardingLayer";
import type { ReaderActionBarOnboardingStepId } from "@/src/features/reader/readerActionBarOnboardingSteps";
import { useReaderActionBarOnboarding } from "@/src/features/reader/useReaderActionBarOnboarding";
import { useReaderFeatureOnboarding, type ReaderOnboardingStep } from "@/src/features/reader/useReaderFeatureOnboarding";
import { useReaderSettingsOnboarding } from "@/src/features/reader/useReaderSettingsOnboarding";
import type { ReaderSettingsOnboardingStepId } from "@/src/features/reader/readerSettingsOnboardingSteps";

const TRANSLATION_IDS = [
  "KJV",
  "WEB",
  "OEB",
  "ADB1905",
  "BSB",
  "ENG_ASV",
  "ENG_BBE",
  "ENG_DARBY",
  "ENG_WEBBE",
] as const;
const TRANSLATION_LANGUAGE_BY_ID: Record<(typeof TRANSLATION_IDS)[number], string> = {
  KJV: "English",
  WEB: "English",
  ADB1905: "Tagalog",
  OEB: "English",
  BSB: "English",
  ENG_ASV: "English",
  ENG_BBE: "English",
  ENG_DARBY: "English",
  ENG_WEBBE: "English",
};

const READER_CHAPTER_PREFETCH_DEPTH = 2;

const READER_FONT_SCALE_STORAGE_KEY = "sb:reader:fontScale";
const READER_LINE_SPACING_STORAGE_KEY = "sb:reader:lineSpacingScale";
const READER_TEXT_ALIGN_STORAGE_KEY = "sb:reader:verseTextAlign";

type ReaderVerseTextAlign = "left" | "right" | "center" | "justify";

const READER_VERSE_TEXT_ALIGN_OPTIONS: readonly ReaderVerseTextAlign[] = [
  "left",
  "right",
  "center",
  "justify",
] as const;

function isReaderVerseTextAlign(raw: string): raw is ReaderVerseTextAlign {
  return (READER_VERSE_TEXT_ALIGN_OPTIONS as readonly string[]).includes(raw);
}

function readerVerseTextAlignLabel(a: ReaderVerseTextAlign): string {
  switch (a) {
    case "left":
      return "Left";
    case "right":
      return "Right";
    case "center":
      return "Center";
    case "justify":
      return "Justify";
  }
}

const FONT_SHEET_ALIGN_ROW: readonly {
  align: ReaderVerseTextAlign;
  Icon: typeof ReaderAlignLeftIcon;
}[] = [
  { align: "left", Icon: ReaderAlignLeftIcon },
  { align: "center", Icon: ReaderAlignCenterIcon },
  { align: "right", Icon: ReaderAlignRightIcon },
  { align: "justify", Icon: ReaderAlignJustifyIcon },
];

/** Font settings card: top inset inside the card (`ScrollView` content `paddingTop`). */
const READER_FONT_CARD_PADDING_TOP_PX = 12;
/** Font settings card: space between font-size slider and the “Font spacing” label (`marginTop` on that label). */
const READER_FONT_CARD_GAP_AFTER_SIZE_SLIDER_PX = 5;
/** Font settings card: space between font-spacing slider and the align icon row (`marginTop` on that row). */
const READER_FONT_CARD_GAP_AFTER_SPACING_SLIDER_PX = 5;
const FONT_SCALE_MIN = 0.5;
const FONT_SCALE_MAX = 3;
/** Multiplier on verse line height (base 28px at scale 1); slider range 60%–200%. */
const LINE_SPACING_MIN = 0.6;
const LINE_SPACING_MAX = 2;

const BOOK_SELECTOR_VIEW_STORAGE_KEY = "sb:reader:bookSelectorView";

function persistReaderPref(key: string, value: string): void {
  void AsyncStorage.setItem(key, value).catch(() => {
    /* ignore storage write errors */
  });
}

function hasChapterInlineAnnotations(chapter: BibleChapter): boolean {
  return (chapter.verseInlineContent ?? []).some((segments) => segments.length > 0);
}

/** Share of screen width the reader translates left when settings are open (phones). */
const READER_MOBILE_SETTINGS_SLIDE_RATIO = 0.4;
/** Phone only: extra slide distance so the menu strip is wider; tablets use ratio-only slide. */
const READER_MOBILE_SETTINGS_PHONE_EXTRA_SLIDE_PX = 20;
/**
 * Tablet: revealed settings strip as a fraction of `windowWidth` (matches hand-tuned drag targets).
 * Portrait ~25%, landscape ~20%.
 */
const READER_MOBILE_SETTINGS_TABLET_PORTRAIT_SLIDE_RATIO = 0.25;
const READER_MOBILE_SETTINGS_TABLET_LANDSCAPE_SLIDE_RATIO = 0.2;

/** Present follow-up sheets after the phone settings strip finishes sliding away. */
const READER_MOBILE_MENU_CLOSE_MS = 260;

const readerVerseListStyles = StyleSheet.create({
  flashItemBase: {
    flex: 1,
  },
  leftColumnPadding: {
    paddingRight: READER_TABLET_TWO_COLUMN_GAP / 2,
  },
  rightColumnPadding: {
    paddingLeft: READER_TABLET_TWO_COLUMN_GAP / 2,
  },
});

export default function ReaderChapterScreen() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isTabletReaderLayout = isTabletLayout(windowWidth, windowHeight);
  const { book: bookSlug, chapter: chapterParam, translation } = useLocalSearchParams<{
    book: string;
    chapter: string;
    translation?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bundle, themeId, setThemeId } = useMobileAppTheme();
  const colors = bundle.ui;
  const rc = bundle.reader;

  const chapterNumber = parseInt(chapterParam ?? "1", 10);
  const requestedTranslationRaw = translation?.trim() ?? "";
  // Prefer the internal TranslationId (uppercase) for known translations so the
  // existing core data layer handles them. Fall through to the raw API ID for
  // brand-new translations that only exist in the external API.
  const requestedTranslationId: string = (() => {
    const upper = requestedTranslationRaw.toUpperCase();
    if (isTranslationId(upper)) return upper;
    // Also accept when the raw value itself is an API ID resolvable to a
    // known internal ID (e.g. "eng_asv" → "ENG_ASV").
    const resolved = getInternalIdFromApiId(requestedTranslationRaw);
    if (resolved) return resolved;
    return requestedTranslationRaw || "KJV";
  })();

  const goToReaderChapter = useCallback(
    (nextBookSlug: string, nextChapter: number, translationId: string) => {
      router.setParams(readerChapterScreenParams(nextBookSlug, nextChapter, translationId));
    },
    [router],
  );

  const [readerPayload, setReaderPayload] = useState<{
    resolvedTranslationId: string;
    books: BibleBookNavItem[];
    chapter: BibleChapter;
  } | null>(null);
  const readerPayloadRef = useRef(readerPayload);
  readerPayloadRef.current = readerPayload;
  const [chapterMissing, setChapterMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const slug = bookSlug ?? "";
    const resolved = requestedTranslationId;
    const cacheKey = readerChapterCacheKey(resolved, slug, chapterNumber);
    const memHit = getCachedReaderChapter(cacheKey);
    if (memHit) {
      setReaderPayload(memHit);
      return;
    }

    void (async () => {
      try {
        setChapterMissing(false);

        let resolvedTranslation = resolved;
        const cachedPayload = readerPayloadRef.current;
        const cachedBooks =
          cachedPayload?.resolvedTranslationId === resolvedTranslation && cachedPayload.books.length > 0
            ? cachedPayload.books
            : null;

        let books: BibleBookNavItem[];
        let chapter: BibleChapter | null;

        if (resolvedTranslation === "KJV" || !readerUsesPerChapterFetch(resolvedTranslation)) {
          if (isTranslationId(resolvedTranslation)) {
            if (cachedBooks) {
              books = cachedBooks;
              chapter = await getChapterBySlugForTranslation(resolvedTranslation, slug, chapterNumber);
            } else {
              [books, chapter] = await Promise.all([
                getBookNavForTranslation(resolvedTranslation),
                getChapterBySlugForTranslation(resolvedTranslation, slug, chapterNumber),
              ]);
            }
          } else {
            books = cachedBooks ?? (await resolveReaderBooksForTranslation(resolvedTranslation, null));
            chapter = await fetchReaderChapterContent(resolvedTranslation, slug, chapterNumber);
          }
        } else {
          books = await resolveReaderBooksForTranslation(resolvedTranslation, cachedBooks);
          if (!cachedBooks && isTranslationId(resolvedTranslation)) {
            void getBookNavForTranslation(resolvedTranslation).then((nav) => {
              if (cancelled) return;
              setReaderPayload((curr) =>
                curr?.resolvedTranslationId === resolvedTranslation ? { ...curr, books: nav } : curr,
              );
            });
          }
          chapter = await fetchReaderChapterContent(resolvedTranslation, slug, chapterNumber);
        }

        if (!chapter) {
          resolvedTranslation = "KJV";
          books = await getBookNavForTranslation("KJV");
          chapter = await getChapterBySlugForTranslation("KJV", slug, chapterNumber);
        }

        if (cancelled) return;

        if (!chapter) {
          setReaderPayload(null);
          setChapterMissing(true);
          return;
        }

        const payload = { resolvedTranslationId: resolvedTranslation, books, chapter };
        setCachedReaderChapter(cacheKey, payload);
        setReaderPayload(payload);
      } catch {
        if (!cancelled) {
          setReaderPayload(null);
          setChapterMissing(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requestedTranslationId, bookSlug, chapterNumber]);

  const kjvInlineEnrichmentKey =
    readerPayload?.resolvedTranslationId === "KJV" &&
    !hasChapterInlineAnnotations(readerPayload.chapter)
      ? `${readerPayload.chapter.bookSlug}:${readerPayload.chapter.chapterNumber}`
      : null;

  useEffect(() => {
    if (!kjvInlineEnrichmentKey) return;
    const [chapterBookSlug, chapterNumRaw] = kjvInlineEnrichmentKey.split(":");
    const chapterNum = Number(chapterNumRaw);
    const usfm = getUsfmBookId(chapterBookSlug);
    if (!usfm) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      // Keep first paint fast; enrich KJV inline spans after initial chapter render and gestures settle.
      void (async () => {
        try {
          const helloKjv = await fetchApiChapter("eng_kjv", usfm, chapterNum);
          if (cancelled) return;
          setReaderPayload((curr) => {
            if (!curr) return curr;
            if (
              curr.resolvedTranslationId !== "KJV" ||
              curr.chapter.bookSlug !== chapterBookSlug ||
              curr.chapter.chapterNumber !== chapterNum
            ) {
              return curr;
            }
            return {
              ...curr,
              chapter: mergeVerseInlineFromHelloaoChapter(curr.chapter, helloKjv),
            };
          });
        } catch {
          /* offline or API error — keep unannotated KJV */
        }
      })();
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [kjvInlineEnrichmentKey]);

  useEffect(() => {
    const tid = requestedTranslationId;
    if (tid === "KJV") return;
    const booksForPrefetch =
      readerPayload?.books ?? readerPayloadRef.current?.books ?? [];
    if (booksForPrefetch.length === 0) return;
    const slug = bookSlug ?? "";
    const targets = collectPrefetchChapterTargets(
      booksForPrefetch,
      slug,
      chapterNumber,
      READER_CHAPTER_PREFETCH_DEPTH,
    );
    for (const target of targets) {
      primeReaderChapterFetch(tid, target);
    }
  }, [requestedTranslationId, bookSlug, chapterNumber, readerPayload?.books]);

  const resolvedTranslationId = readerPayload?.resolvedTranslationId;
  const books = readerPayload?.books;
  const chapter = readerPayload?.chapter;

  const {
    highlights,
    notes,
    removeHighlightsFromVerses,
    applyHighlightToVerses,
    persistNoteForVerse,
  } = useReaderStorage(chapter, resolvedTranslationId);

  const { items: translationPickerItems, loading: translationPickerLoading } = useTranslationPicker();
  const { favoriteTranslationIds, toggleFavoriteTranslation } = useFavoriteTranslations();

  const [fontSizeScale, setFontSizeScale] = useState(1);
  const fontScaleUserTouchedRef = useRef(false);
  const [lineSpacingScale, setLineSpacingScale] = useState(1);
  const lineSpacingUserTouchedRef = useRef(false);
  const [verseTextAlign, setVerseTextAlign] = useState<ReaderVerseTextAlign>("justify");
  const verseTextAlignUserTouchedRef = useRef(false);
  const [readerVerseBodyFontId, setReaderVerseBodyFontId] =
    useState<ReaderVerseBodyFontId>(DEFAULT_READER_VERSE_BODY_FONT_ID);
  const readerVerseBodyFontUserTouchedRef = useRef(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [readerPrivacyPolicyOpen, setReaderPrivacyPolicyOpen] = useState(false);
  const [readerTermsOpen, setReaderTermsOpen] = useState(false);
  const [readerCreditsOpen, setReaderCreditsOpen] = useState(false);
  const [commentaryPanelOpen, setCommentaryPanelOpen] = useState(false);
  const mobileSettingsFollowUpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fontSettingsSheetOpen, setFontSettingsSheetOpen] = useState(false);
  const [readerDropdown, setReaderDropdown] = useState<ReaderToolsDropdown | null>(null);
  const [bookPickerStep, setBookPickerStep] = useState<"books" | "chapters">("books");
  const [bookPickerBook, setBookPickerBook] = useState<BibleBookNavItem | null>(null);
  const [bookSelectorViewMode, setBookSelectorViewMode] = useState<BookSelectorViewMode>("testament");
  const [selectorTestamentTab, setSelectorTestamentTab] = useState<SelectorTestamentTab>("new");
  const [bookViewMenuOpen, setBookViewMenuOpen] = useState(false);
  const [bookSelectorStorageReady, setBookSelectorStorageReady] = useState(false);
  const [dropdownAnchor, setDropdownAnchor] = useState<LayoutRectangle | null>(null);

  const bookFanRef = useRef<View | null>(null);
  const settingsButtonRef = useRef<View | null>(null);
  const selectionBannerAnchorRef = useRef<View | null>(null);
  const selectionBannerLiveRef = useRef<View | null>(null);
  const headerToolsGroupRef = useRef<View | null>(null);
  const [headerToolsPillRect, setHeaderToolsPillRect] = useState<LayoutRectangle | null>(null);
  const [headerToolsLayoutEpoch, setHeaderToolsLayoutEpoch] = useState(0);
  const settingsOnboardingTranslationRef = useRef<View | null>(null);
  const settingsOnboardingStudyNotesRef = useRef<View | null>(null);
  const settingsOnboardingFontSettingsRef = useRef<View | null>(null);
  const settingsOnboardingThemesRef = useRef<View | null>(null);
  const settingsOnboardingCreditsRef = useRef<View | null>(null);
  const settingsOnboardingDeleteMyDataRef = useRef<View | null>(null);
  const actionBarOnboardingStudyNotesRef = useRef<View | null>(null);
  const actionBarOnboardingHighlightRef = useRef<View | null>(null);
  const actionBarOnboardingCopyRef = useRef<View | null>(null);
  const actionBarOnboardingNoteRef = useRef<View | null>(null);
  const actionBarOnboardingJournalRef = useRef<View | null>(null);
  const settingsOnboardingRowRefs = useMemo(
    (): Record<ReaderSettingsOnboardingStepId, React.RefObject<View | null>> => ({
      translation: settingsOnboardingTranslationRef,
      "study-notes": settingsOnboardingStudyNotesRef,
      "font-settings": settingsOnboardingFontSettingsRef,
      themes: settingsOnboardingThemesRef,
      credits: settingsOnboardingCreditsRef,
      "delete-my-data": settingsOnboardingDeleteMyDataRef,
    }),
    [],
  );
  const actionBarOnboardingButtonRefs = useMemo(
    (): Record<ReaderActionBarOnboardingStepId, React.RefObject<View | null>> => ({
      "study-notes": actionBarOnboardingStudyNotesRef,
      highlight: actionBarOnboardingHighlightRef,
      copy: actionBarOnboardingCopyRef,
      note: actionBarOnboardingNoteRef,
      journal: actionBarOnboardingJournalRef,
    }),
    [],
  );
  const translationFanRef = useRef<View | null>(null);
  const themesFanRef = useRef<View | null>(null);
  const fontSettingsFanRef = useRef<View | null>(null);

  const dropSlideAnim = useRef(new Animated.Value(0)).current;
  const dropOpacityAnim = useRef(new Animated.Value(0)).current;
  const bookSheetTranslateY = useRef(new Animated.Value(0)).current;
  const bookSheetClosingRef = useRef(false);
  const bookSheetDragStartYRef = useRef(0);
  /** When false, vertical list has scrolled — swipe-to-dismiss stays off so scrolling wins. */
  const [bookSheetDismissPanEnabled, setBookSheetDismissPanEnabled] = useState(true);
  /** True from the moment the sheet close animation starts until `closeReaderDropdown` runs — shows native header chrome during the slide-out. */
  const [bookSheetExitAnimationStarted, setBookSheetExitAnimationStarted] = useState(false);
  const fontSettingsPopupSlideAnim = useRef(new Animated.Value(0)).current;
  const fontSettingsPopupOpacityAnim = useRef(new Animated.Value(0)).current;
  const readerVersesOpacityAnim = useRef(new Animated.Value(1)).current;
  /** True after we've shown synced content then lost sync (chapter change), not initial null payload. */
  const readerVersesHadDesyncRef = useRef(false);

  const [newEntrySheetOpen, setNewEntrySheetOpen] = useState(false);
  const [newEntrySheetKey, setNewEntrySheetKey] = useState(0);
  const [newEntryInitialParams, setNewEntryInitialParams] =
    useState<JournalNewEntryInitialParams | null>(null);
  const [newEntryHasDraft, setNewEntryHasDraft] = useState(false);
  const readerScrollRef = useRef<FlashListRef<ReaderVerseFlashItem> | null>(null);
  /** Drives cross-fade between in-content heading and stack header title (native scroll events). */
  const readerScrollYAnim = useRef(new Animated.Value(0)).current;
  const [readerPageHeadingHeight, setReaderPageHeadingHeight] = useState(96);
  const readerHeadingFadeEndPx = Math.max(40, Math.round(readerPageHeadingHeight * 0.82));
  const readerPageHeadingOpacityAnim = useMemo(
    () =>
      readerScrollYAnim.interpolate({
        inputRange: [0, readerHeadingFadeEndPx],
        outputRange: [1, 0],
        extrapolate: "clamp",
      }),
    [readerScrollYAnim, readerHeadingFadeEndPx],
  );
  const readerHeaderTitleOpacityAnim = useMemo(
    () =>
      readerScrollYAnim.interpolate({
        inputRange: [0, readerHeadingFadeEndPx],
        outputRange: [0, 1],
        extrapolate: "clamp",
      }),
    [readerScrollYAnim, readerHeadingFadeEndPx],
  );
  const newEntryFormRef = useRef<JournalNewEntryFormHandle | null>(null);

  const newEntrySheetOpacity = useRef(new Animated.Value(0)).current;
  const newEntrySheetTranslate = useRef(new Animated.Value(20)).current;
  const newEntrySheetClosingRef = useRef(false);

  const readerSettingsSlideProgress = useRef(new Animated.Value(0)).current;
  const readerSettingsMenuDragStartProgressRef = useRef(1);
  const readerSettingsMenuDragLastProgressRef = useRef(1);
  /** Total horizontal slide (px) when the settings menu is fully open. */
  const readerMobileSettingsSlidePx = useMemo(() => {
    if (isTabletReaderLayout) {
      const r =
        windowWidth > windowHeight
          ? READER_MOBILE_SETTINGS_TABLET_LANDSCAPE_SLIDE_RATIO
          : READER_MOBILE_SETTINGS_TABLET_PORTRAIT_SLIDE_RATIO;
      return windowWidth * r;
    }
    return windowWidth * READER_MOBILE_SETTINGS_SLIDE_RATIO + READER_MOBILE_SETTINGS_PHONE_EXTRA_SLIDE_PX;
  }, [isTabletReaderLayout, windowWidth, windowHeight]);

  const readerMobileSettingsSlideTranslateX = useMemo(
    () =>
      readerSettingsSlideProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -readerMobileSettingsSlidePx],
      }),
    [readerSettingsSlideProgress, readerMobileSettingsSlidePx],
  );

  useEffect(() => {
    Animated.timing(readerSettingsSlideProgress, {
      toValue: toolsMenuOpen ? 1 : 0,
      duration: toolsMenuOpen ? 280 : 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [toolsMenuOpen, readerSettingsSlideProgress]);

  /** When orientation (or breakpoint) changes with the menu open, re-apply full slide so `translateX` matches the new distance. */
  const readerMenuSlidePxWhileOpenRef = useRef<number | null>(null);
  useEffect(() => {
    if (!toolsMenuOpen) {
      readerMenuSlidePxWhileOpenRef.current = null;
      return;
    }
    const prev = readerMenuSlidePxWhileOpenRef.current;
    readerMenuSlidePxWhileOpenRef.current = readerMobileSettingsSlidePx;
    if (prev != null && prev !== readerMobileSettingsSlidePx) {
      readerSettingsSlideProgress.setValue(1);
    }
  }, [toolsMenuOpen, readerMobileSettingsSlidePx, readerSettingsSlideProgress]);

  useEffect(() => {
    return () => {
      if (mobileSettingsFollowUpTimeoutRef.current != null) {
        clearTimeout(mobileSettingsFollowUpTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    fontScaleUserTouchedRef.current = false;
    lineSpacingUserTouchedRef.current = false;
    verseTextAlignUserTouchedRef.current = false;
    readerVerseBodyFontUserTouchedRef.current = false;
    let cancelled = false;
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([
          READER_FONT_SCALE_STORAGE_KEY,
          READER_LINE_SPACING_STORAGE_KEY,
          READER_TEXT_ALIGN_STORAGE_KEY,
          READER_VERSE_BODY_FONT_STORAGE_KEY,
          BOOK_SELECTOR_VIEW_STORAGE_KEY,
        ]);
        if (cancelled) return;
        const valuesByKey = new Map(pairs);

        let nextFontSizeScale: number | null = null;
        const rawFontScale = valuesByKey.get(READER_FONT_SCALE_STORAGE_KEY);
        if (rawFontScale && !fontScaleUserTouchedRef.current) {
          const n = parseFloat(rawFontScale);
          if (Number.isFinite(n) && n >= FONT_SCALE_MIN && n <= FONT_SCALE_MAX) {
            nextFontSizeScale = n;
          }
        }

        let nextLineSpacingScale: number | null = null;
        const rawLineSpacing = valuesByKey.get(READER_LINE_SPACING_STORAGE_KEY);
        if (rawLineSpacing && !lineSpacingUserTouchedRef.current) {
          const n = parseFloat(rawLineSpacing);
          if (Number.isFinite(n) && n >= LINE_SPACING_MIN && n <= LINE_SPACING_MAX) {
            nextLineSpacingScale = n;
          }
        }

        let nextVerseTextAlign: ReaderVerseTextAlign | null = null;
        const rawTextAlign = valuesByKey.get(READER_TEXT_ALIGN_STORAGE_KEY);
        if (rawTextAlign && !verseTextAlignUserTouchedRef.current && isReaderVerseTextAlign(rawTextAlign)) {
          nextVerseTextAlign = rawTextAlign;
        }

        let nextReaderVerseBodyFontId: ReaderVerseBodyFontId | null = null;
        const rawReaderVerseBodyFont = valuesByKey.get(READER_VERSE_BODY_FONT_STORAGE_KEY);
        if (
          rawReaderVerseBodyFont &&
          !readerVerseBodyFontUserTouchedRef.current &&
          isReaderVerseBodyFontId(rawReaderVerseBodyFont)
        ) {
          nextReaderVerseBodyFontId = rawReaderVerseBodyFont;
        }

        let nextBookSelectorViewMode: BookSelectorViewMode | null = null;
        let nextSelectorTestamentTab: SelectorTestamentTab | null = null;
        const rawBookSelectorView = valuesByKey.get(BOOK_SELECTOR_VIEW_STORAGE_KEY);
        if (rawBookSelectorView) {
          try {
            const parsed = JSON.parse(rawBookSelectorView) as {
              mode?: BookSelectorViewMode;
              testamentTab?: SelectorTestamentTab;
            };
            if (parsed.mode === "grid" || parsed.mode === "az" || parsed.mode === "testament") {
              nextBookSelectorViewMode = parsed.mode;
            }
            if (parsed.testamentTab === "old" || parsed.testamentTab === "new") {
              nextSelectorTestamentTab = parsed.testamentTab;
            }
          } catch {
            // ignore corrupt storage
          }
        }

        unstable_batchedUpdates(() => {
          if (nextFontSizeScale != null) setFontSizeScale(nextFontSizeScale);
          if (nextLineSpacingScale != null) setLineSpacingScale(nextLineSpacingScale);
          if (nextVerseTextAlign != null) setVerseTextAlign(nextVerseTextAlign);
          if (nextReaderVerseBodyFontId != null) setReaderVerseBodyFontId(nextReaderVerseBodyFontId);
          if (nextBookSelectorViewMode != null) setBookSelectorViewMode(nextBookSelectorViewMode);
          if (nextSelectorTestamentTab != null) setSelectorTestamentTab(nextSelectorTestamentTab);
          setBookSelectorStorageReady(true);
        });
      } catch {
        // ignore corrupt storage
        if (!cancelled) {
          unstable_batchedUpdates(() => {
            setBookSelectorStorageReady(true);
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bookSelectorStorageReady) return;
    persistReaderPref(
      BOOK_SELECTOR_VIEW_STORAGE_KEY,
      JSON.stringify({
        mode: bookSelectorViewMode,
        testamentTab: selectorTestamentTab,
      }),
    );
  }, [bookSelectorStorageReady, bookSelectorViewMode, selectorTestamentTab]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      registerTabScrollRef("reader", {
        scrollToOffset: ({ offset, animated = true }) => {
          readerScrollRef.current?.scrollToOffset({ offset, animated });
        },
      });
    });
    return () => {
      task.cancel();
    };
  }, []);

  useEffect(() => {
    readerScrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    readerScrollYAnim.setValue(0);
  }, [bookSlug, chapterNumber, requestedTranslationId, readerScrollYAnim]);

  const setFontSizeScalePersisted = useCallback((v: number) => {
    fontScaleUserTouchedRef.current = true;
    const next = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, v));
    setFontSizeScale(next);
    persistReaderPref(READER_FONT_SCALE_STORAGE_KEY, String(next));
  }, []);

  const setLineSpacingScalePersisted = useCallback((v: number) => {
    lineSpacingUserTouchedRef.current = true;
    const next = Math.min(LINE_SPACING_MAX, Math.max(LINE_SPACING_MIN, v));
    setLineSpacingScale(next);
    persistReaderPref(READER_LINE_SPACING_STORAGE_KEY, String(next));
  }, []);

  const setVerseTextAlignPersisted = useCallback((a: ReaderVerseTextAlign) => {
    hapticLightImpact();
    verseTextAlignUserTouchedRef.current = true;
    setVerseTextAlign(a);
    persistReaderPref(READER_TEXT_ALIGN_STORAGE_KEY, a);
  }, []);

  const setReaderVerseBodyFontIdPersisted = useCallback((id: ReaderVerseBodyFontId) => {
    readerVerseBodyFontUserTouchedRef.current = true;
    setReaderVerseBodyFontId(id);
    persistReaderPref(READER_VERSE_BODY_FONT_STORAGE_KEY, id);
  }, []);

  const clearMobileSettingsFollowUp = useCallback(() => {
    if (mobileSettingsFollowUpTimeoutRef.current != null) {
      clearTimeout(mobileSettingsFollowUpTimeoutRef.current);
      mobileSettingsFollowUpTimeoutRef.current = null;
    }
  }, []);

  const scheduleAfterMobileReaderMenuClose = useCallback(
    (fn: () => void) => {
      clearMobileSettingsFollowUp();
      mobileSettingsFollowUpTimeoutRef.current = setTimeout(() => {
        mobileSettingsFollowUpTimeoutRef.current = null;
        fn();
      }, READER_MOBILE_MENU_CLOSE_MS);
    },
    [clearMobileSettingsFollowUp],
  );

  const closeToolsMenu = useCallback(() => {
    clearMobileSettingsFollowUp();
    setToolsMenuOpen(false);
    setFontSettingsSheetOpen(false);
    setReaderDropdown(null);
    setDropdownAnchor(null);
    setBookPickerStep("books");
    setBookPickerBook(null);
    setBookViewMenuOpen(false);
  }, [clearMobileSettingsFollowUp]);

  const closeFontSettingsPopup = useCallback(() => {
    clearMobileSettingsFollowUp();
    setFontSettingsSheetOpen(false);
  }, [clearMobileSettingsFollowUp]);

  const openFontSettingsSheet = useCallback(() => {
    hapticLightImpact();
    if (!isTabletReaderLayout) return;
    setToolsMenuOpen(false);
    setReaderDropdown(null);
    setDropdownAnchor(null);
    setBookPickerStep("books");
    setBookPickerBook(null);
    setBookViewMenuOpen(false);
    setFontSettingsSheetOpen(true);
  }, [isTabletReaderLayout]);

  const openMobileReaderFontSettingsFromMenu = useCallback(() => {
    closeToolsMenu();
    scheduleAfterMobileReaderMenuClose(() => {
      setFontSettingsSheetOpen(true);
    });
  }, [closeToolsMenu, scheduleAfterMobileReaderMenuClose]);

  const openMobileReaderThemesFromMenu = useCallback(() => {
    closeToolsMenu();
    scheduleAfterMobileReaderMenuClose(() => {
      setDropdownAnchor({ x: Math.floor(windowWidth / 2), y: insets.top + 52, width: 0, height: 0 });
      setReaderDropdown("theme");
    });
  }, [closeToolsMenu, scheduleAfterMobileReaderMenuClose, windowWidth, insets.top]);

  const openMobileReaderTranslationFromMenu = useCallback(() => {
    closeToolsMenu();
    scheduleAfterMobileReaderMenuClose(() => {
      setDropdownAnchor({ x: Math.floor(windowWidth / 2), y: insets.top + 52, width: 0, height: 0 });
      setReaderDropdown("translation");
    });
  }, [closeToolsMenu, scheduleAfterMobileReaderMenuClose, windowWidth, insets.top]);

  const openMobileReaderCreditsFromMenu = useCallback(() => {
    closeToolsMenu();
    scheduleAfterMobileReaderMenuClose(() => {
      setReaderCreditsOpen(true);
    });
  }, [closeToolsMenu, scheduleAfterMobileReaderMenuClose]);

  const openMobileReaderCommentaryFromMenu = useCallback(() => {
    closeToolsMenu();
    scheduleAfterMobileReaderMenuClose(() => {
      setCommentaryPanelOpen(true);
    });
  }, [closeToolsMenu, scheduleAfterMobileReaderMenuClose]);

  const openDeleteMyDataConfirmFromMenu = useCallback(() => {
    closeToolsMenu();
    scheduleAfterMobileReaderMenuClose(() => {
      Alert.alert(
        "Delete My Data?",
        [
          "This permanently deletes all local data on this device:",
          "• Journal entries",
          "• Bookmarks",
          "• Highlights",
          "• Reading history",
          "• Locally stored preferences",
          "",
          "This cannot be undone. Sinag Bible mobile does not currently sync to cloud services.",
        ].join("\n"),
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete My Data",
            style: "destructive",
            onPress: () => {
              void (async () => {
                try {
                  await deleteAllUserData();
                  router.replace("/");
                } catch {
                  Alert.alert("Unable to delete data", "Please try again.");
                }
              })();
            },
          },
        ],
      );
    });
  }, [closeToolsMenu, scheduleAfterMobileReaderMenuClose, router]);

  /** Close credits first so only one RN `Modal` is active; avoids stacking quirks and nested-Text press issues. */
  const openPrivacyPolicyFromCredits = useCallback(() => {
    setReaderCreditsOpen(false);
    setTimeout(() => {
      setReaderPrivacyPolicyOpen(true);
    }, 0);
  }, []);

  const openTermsFromCredits = useCallback(() => {
    setReaderCreditsOpen(false);
    setTimeout(() => {
      setReaderTermsOpen(true);
    }, 0);
  }, []);

  const readerSettingsMenuPanResponder = useMemo(() => {
    const maxSlide = readerMobileSettingsSlidePx;
    const finishDrag = (g: PanResponderGestureState, menuOpen: boolean) => {
      if (!menuOpen) return;
      const p = readerSettingsMenuDragLastProgressRef.current;
      const shouldClose = p < 0.38 || (g.vx > 0.45 && p < 0.72);
      if (shouldClose) {
        closeToolsMenu();
      } else {
        Animated.spring(readerSettingsSlideProgress, {
          toValue: 1,
          friction: 9,
          tension: 88,
          useNativeDriver: true,
        }).start();
      }
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_e, gestureState) => {
        if (!toolsMenuOpen) return false;
        const { dx, dy } = gestureState;
        return dx > 10 && Math.abs(dx) > Math.abs(dy) * 1.15;
      },
      onMoveShouldSetPanResponder: (_e, gestureState) => {
        if (!toolsMenuOpen) return false;
        const { dx, dy } = gestureState;
        return dx > 10 && Math.abs(dx) > Math.abs(dy) * 1.15;
      },
      onPanResponderGrant: () => {
        readerSettingsSlideProgress.stopAnimation((v: number) => {
          readerSettingsMenuDragStartProgressRef.current = v;
          readerSettingsMenuDragLastProgressRef.current = v;
        });
      },
      onPanResponderMove: (_e, gestureState) => {
        if (!toolsMenuOpen) return;
        const start = readerSettingsMenuDragStartProgressRef.current;
        const p = Math.min(1, Math.max(0, start - gestureState.dx / maxSlide));
        readerSettingsMenuDragLastProgressRef.current = p;
        readerSettingsSlideProgress.setValue(p);
      },
      onPanResponderRelease: (_e, gestureState) => {
        finishDrag(gestureState, toolsMenuOpen);
      },
      onPanResponderTerminate: (_e, gestureState) => {
        finishDrag(gestureState, toolsMenuOpen);
      },
      onPanResponderTerminationRequest: () => true,
    });
  }, [toolsMenuOpen, windowWidth, closeToolsMenu, readerSettingsSlideProgress, readerMobileSettingsSlidePx]);

  const {
    selectedVerseNumbers,
    noteModalVisible,
    setNoteModalVisible,
    noteTargetVerse,
    setNoteTargetVerse,
    noteDraft,
    setNoteDraft,
    actionBarMode,
    setActionBarMode,
    suppressNextVerseTapRef,
    pickedHighlightColor,
    setPickedHighlightColor,
    copyToastVisible,
    setCopyToastVisible,
    clearVerseSelection,
    toggleVerseSelection,
    handleVerseTap,
    handleVerseLongPress,
    selectedVerses,
    copySelectedVerses,
    removeHighlightsFromSelection,
    applyPickedHighlightToSelection,
    openNoteForSelection,
    saveNoteFromModal,
  } = useReaderSelection({
    chapter: chapter ?? null,
    resolvedTranslationId,
    highlights,
    notes,
    removeHighlightsFromVerses,
    applyHighlightToVerses,
    persistNoteForVerse,
    bookSlug,
    chapterNumber,
    requestedTranslationId,
    toolsMenuOpen,
    closeToolsMenu,
  });

  const onboardingStepRef = useRef<ReaderOnboardingStep | null>(null);
  const completeOnboardingInteractionRef = useRef<() => void>(() => {});
  const clearSelectionPrimedRef = useRef(false);

  const handleVerseTapForOnboarding = useCallback(
    (verseNum: number) => {
      const onClearStep = onboardingStepRef.current === "clear-selection";
      const wasSelected = selectedVerseNumbers.has(verseNum);
      handleVerseTap(verseNum);
      if (onboardingStepRef.current === "tap-select-verse") {
        completeOnboardingInteractionRef.current();
      } else if (onClearStep && wasSelected) {
        completeOnboardingInteractionRef.current();
      }
    },
    [handleVerseTap, selectedVerseNumbers],
  );

  const handleVerseLongPressForOnboarding = useCallback(
    (verseNum: number) => {
      handleVerseLongPress(verseNum);
      if (onboardingStepRef.current === "long-press-highlight") {
        completeOnboardingInteractionRef.current();
      }
    },
    [handleVerseLongPress],
  );

  /** `onPressIn` clears without waiting for lift; `onPress` covers VoiceOver. No time debounce — a missed tap must register immediately on retry. */
  const selectionToastHapticGuardRef = useRef(0);
  const dismissSelectionToast = useCallback(() => {
    const t = Date.now();
    if (t - selectionToastHapticGuardRef.current > 55) {
      selectionToastHapticGuardRef.current = t;
      hapticSelection();
    }
    if (onboardingStepRef.current === "clear-selection") {
      completeOnboardingInteractionRef.current();
    }
    clearVerseSelection();
  }, [clearVerseSelection]);

  const openJournalFromSelection = useCallback(() => {
    const ch = readerPayload?.chapter;
    const tid = readerPayload?.resolvedTranslationId;
    if (!ch || !tid || selectedVerses.length === 0) return;
    hapticLightImpact();
    const first = selectedVerses[0]!;
    const last = selectedVerses[selectedVerses.length - 1]!;
    setNewEntryInitialParams({
      book: ch.bookSlug,
      chapter: String(ch.chapterNumber),
      verseStart: String(first),
      verseEnd: String(last),
      translation: tid,
    });
    setNewEntrySheetKey((k) => k + 1);
    setNewEntrySheetOpen(true);
    clearVerseSelection();
  }, [readerPayload?.chapter, readerPayload?.resolvedTranslationId, selectedVerses, clearVerseSelection]);

  const openStudyNotesFromSelection = useCallback(() => {
    if (selectedVerses.length === 0) return;
    hapticLightImpact();
    setCommentaryPanelOpen(true);
  }, [selectedVerses.length]);

  const animateCloseNewEntrySheet = useCallback(
    (velocityY = 0, draggedY = 0) => {
      if (newEntrySheetClosingRef.current) return;
      newEntrySheetClosingRef.current = true;

      const screenHeight = Dimensions.get("window").height;
      const sheetMaxHeight = Math.min(660, screenHeight * 0.8);
      const targetTranslateY = sheetMaxHeight + 40;
      const clampedDragY = Math.max(0, draggedY);
      const velocity = Math.max(0, velocityY);
      const duration = Math.max(150, Math.min(320, Math.round(280 - Math.min(1.8, velocity) * 90)));

      Animated.parallel([
        Animated.timing(newEntrySheetTranslate, {
          toValue: targetTranslateY,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(newEntrySheetOpacity, {
          toValue: 0,
          duration: Math.max(180, duration + 90),
          delay: 80,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        newEntrySheetClosingRef.current = false;
        setNewEntrySheetOpen(false);
        newEntrySheetTranslate.setValue(20);
        newEntrySheetOpacity.setValue(0);
      });

      if (clampedDragY > 0) {
        newEntrySheetTranslate.setValue(clampedDragY);
      }
    },
    [newEntrySheetOpacity, newEntrySheetTranslate],
  );

  const closeNewEntrySheet = useCallback(() => {
    animateCloseNewEntrySheet(0.45, 0);
  }, [animateCloseNewEntrySheet]);

  const springReaderNewEntryOpen = useCallback(() => {
    Animated.parallel([
      Animated.spring(newEntrySheetTranslate, {
        toValue: 0,
        friction: 9,
        tension: 75,
        useNativeDriver: true,
      }),
      Animated.timing(newEntrySheetOpacity, {
        toValue: 1,
        duration: 170,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [newEntrySheetOpacity, newEntrySheetTranslate]);

  const confirmReaderNewEntryDraftClose = useCallback(() => {
    Alert.alert("Save or discard?", "You have unsaved text in this draft.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Save", onPress: () => newEntryFormRef.current?.save() },
      { text: "Discard", style: "destructive", onPress: closeNewEntrySheet },
    ]);
  }, [closeNewEntrySheet]);

  const requestCloseReaderNewEntrySheet = useCallback(() => {
    if (!newEntryHasDraft) {
      closeNewEntrySheet();
      return;
    }
    confirmReaderNewEntryDraftClose();
  }, [newEntryHasDraft, closeNewEntrySheet, confirmReaderNewEntryDraftClose]);

  useEffect(() => {
    if (!newEntrySheetOpen) return;
    newEntrySheetClosingRef.current = false;
    newEntrySheetOpacity.setValue(0);
    newEntrySheetTranslate.setValue(20);
    Animated.parallel([
      Animated.timing(newEntrySheetOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(newEntrySheetTranslate, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();
  }, [newEntrySheetOpen, newEntrySheetOpacity, newEntrySheetTranslate]);

  const newEntryHandlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => newEntrySheetOpen,
        onMoveShouldSetPanResponder: (_e, g) =>
          newEntrySheetOpen && g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderTerminationRequest: () => true,
        onPanResponderGrant: () => {
          newEntrySheetTranslate.stopAnimation();
          newEntrySheetOpacity.stopAnimation();
        },
        onPanResponderMove: (_e, g) => {
          if (!newEntrySheetOpen || newEntrySheetClosingRef.current) return;
          const dragY = Math.max(0, g.dy);
          newEntrySheetTranslate.setValue(dragY);
          newEntrySheetOpacity.setValue(Math.max(0.82, 1 - dragY / 900));
        },
        onPanResponderRelease: (_e, g) => {
          if (!newEntrySheetOpen || newEntrySheetClosingRef.current) return;
          const dragY = Math.max(0, g.dy);
          const shouldClose = dragY > 90 || g.vy > 0.55;
          if (shouldClose) {
            if (newEntryHasDraft) {
              springReaderNewEntryOpen();
              confirmReaderNewEntryDraftClose();
              return;
            }
            animateCloseNewEntrySheet(g.vy, dragY);
            return;
          }
          Animated.parallel([
            Animated.spring(newEntrySheetTranslate, {
              toValue: 0,
              velocity: Math.max(0, g.vy),
              friction: 9,
              tension: 75,
              useNativeDriver: true,
            }),
            Animated.timing(newEntrySheetOpacity, {
              toValue: 1,
              duration: 170,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start();
        },
        onPanResponderTerminate: (_e, g) => {
          if (!newEntrySheetOpen || newEntrySheetClosingRef.current) return;
          const dragY = Math.max(0, g.dy);
          const shouldClose = dragY > 90 || g.vy > 0.55;
          if (shouldClose) {
            if (newEntryHasDraft) {
              springReaderNewEntryOpen();
              confirmReaderNewEntryDraftClose();
              return;
            }
            animateCloseNewEntrySheet(g.vy, dragY);
            return;
          }
          Animated.parallel([
            Animated.spring(newEntrySheetTranslate, {
              toValue: 0,
              velocity: Math.max(0, g.vy),
              friction: 9,
              tension: 75,
              useNativeDriver: true,
            }),
            Animated.timing(newEntrySheetOpacity, {
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
      confirmReaderNewEntryDraftClose,
      newEntryHasDraft,
      newEntrySheetOpen,
      newEntrySheetOpacity,
      newEntrySheetTranslate,
      springReaderNewEntryOpen,
    ],
  );

  const measureAndSetDropdown = useCallback(
    (ref: RefObject<View | null>, kind: ReaderToolsDropdown) => {
      if (!isTabletReaderLayout && (kind === "translation" || kind === "theme")) {
        return;
      }
      if (readerDropdown === kind) {
        setBookSheetExitAnimationStarted(false);
        setReaderDropdown(null);
        setDropdownAnchor(null);
        setBookPickerStep("books");
        setBookPickerBook(null);
        setBookViewMenuOpen(false);
        return;
      }
      if (kind === "book") {
        // Book picker is a full-screen sheet and does not need anchor measurement.
        // Open immediately so Android taps feel instant and avoid double-tap misfires.
        setToolsMenuOpen(false);
        setReaderDropdown("book");
        return;
      }
      requestAnimationFrame(() => {
        ref.current?.measureInWindow((x, y, width, height) => {
          if (kind === "translation" || kind === "theme") {
            setToolsMenuOpen(false);
          }
          setDropdownAnchor({ x, y, width, height });
          setReaderDropdown(kind);
        });
      });
    },
    [readerDropdown, isTabletReaderLayout],
  );

  const getBookAzSortKey = useCallback(
    (bookName: string) => bookName.replace(/^[0-9]+\s*/u, "").trim().toLowerCase(),
    [],
  );

  const { oldTestamentBooks, newTestamentBooks } = useMemo(() => {
    const b = readerPayload?.books ?? [];
    const OT_COUNT = 39;
    return {
      oldTestamentBooks: b.slice(0, OT_COUNT),
      newTestamentBooks: b.slice(OT_COUNT),
    };
  }, [readerPayload?.books]);

  const azSortedBooks = useMemo(
    () =>
      [...(readerPayload?.books ?? [])].sort((a, b) =>
        getBookAzSortKey(a.name).localeCompare(getBookAzSortKey(b.name)),
      ),
    [readerPayload?.books, getBookAzSortKey],
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

  const openBookTools = useCallback(() => {
    hapticLightImpact();
    setToolsMenuOpen(false);
    setFontSettingsSheetOpen(false);
    setBookPickerStep("books");
    setBookPickerBook(null);
    setBookSheetExitAnimationStarted(false);
    measureAndSetDropdown(bookFanRef, "book");
  }, [measureAndSetDropdown]);

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

  const toggleToolsMenu = useCallback(() => {
    hapticLightImpact();
    setToolsMenuOpen((open) => {
      if (open) {
        setFontSettingsSheetOpen(false);
        setReaderDropdown(null);
        setDropdownAnchor(null);
        setBookPickerStep("books");
        setBookPickerBook(null);
        setBookViewMenuOpen(false);
        return false;
      }
      clearMobileSettingsFollowUp();
      setFontSettingsSheetOpen(false);
      setReaderDropdown(null);
      setDropdownAnchor(null);
      setBookPickerStep("books");
      setBookPickerBook(null);
      setBookViewMenuOpen(false);
      return true;
    });
  }, [clearMobileSettingsFollowUp]);

  const closeReaderDropdown = useCallback(() => {
    clearMobileSettingsFollowUp();
    bookSheetTranslateY.stopAnimation();
    bookSheetClosingRef.current = false;
    bookSheetTranslateY.setValue(0);
    setBookSheetExitAnimationStarted(false);
    setReaderDropdown(null);
    setDropdownAnchor(null);
    setBookPickerStep("books");
    setBookPickerBook(null);
    setBookViewMenuOpen(false);
  }, [bookSheetTranslateY, clearMobileSettingsFollowUp]);

  const dismissReaderChromeFromBackgroundPress = useCallback(() => {
    if (toolsMenuOpen) closeToolsMenu();
    else if (fontSettingsSheetOpen) closeFontSettingsPopup();
    else if (readerPrivacyPolicyOpen) setReaderPrivacyPolicyOpen(false);
    else if (readerCreditsOpen) setReaderCreditsOpen(false);
    else if (commentaryPanelOpen) setCommentaryPanelOpen(false);
    else if (readerDropdown === "translation" || readerDropdown === "theme") closeReaderDropdown();
  }, [
    toolsMenuOpen,
    closeToolsMenu,
    fontSettingsSheetOpen,
    closeFontSettingsPopup,
    readerPrivacyPolicyOpen,
    readerCreditsOpen,
    commentaryPanelOpen,
    readerDropdown,
    closeReaderDropdown,
  ]);

  const onReaderScrollBeginDrag = useCallback(() => {
    dismissReaderChromeFromBackgroundPress();
  }, [dismissReaderChromeFromBackgroundPress]);

  const onBookSheetScroll = useCallback((scrollY: number) => {
    // Android often reports a small positive offset near top; keep dismiss enabled within a tolerance.
    const atTop = scrollY <= (Platform.OS === "android" ? 16 : 2);
    setBookSheetDismissPanEnabled((prev) => (prev === atTop ? prev : atTop));
  }, []);

  const animateCloseBookSheet = useCallback(
    (velocityY = 0, draggedY = 0) => {
      if (bookSheetClosingRef.current) return;
      bookSheetClosingRef.current = true;
      setBookSheetExitAnimationStarted(true);
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
          animateCloseBookSheet(velForCloseAnim, y);
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
    [animateCloseBookSheet, bookSheetTranslateY, setBookViewMenuOpen],
  );

  useEffect(() => {
    if (readerDropdown !== "book") return;
    bookSheetClosingRef.current = false;
    bookSheetTranslateY.stopAnimation();
    if (Platform.OS === "android") {
      // Keep Android open transition snappy to remove perceived tap lag.
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
  }, [readerDropdown, bookSheetTranslateY]);

  useEffect(() => {
    if (readerDropdown !== "book") return;
    setBookSheetDismissPanEnabled(true);
  }, [readerDropdown, bookPickerStep, bookSelectorViewMode, selectorTestamentTab]);

  useEffect(() => {
    if (readerDropdown !== "book") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      animateCloseBookSheet(0.45, 0);
      return true;
    });
    return () => sub.remove();
  }, [readerDropdown, animateCloseBookSheet]);

  useEffect(() => {
    if (!toolsMenuOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeToolsMenu();
      return true;
    });
    return () => sub.remove();
  }, [toolsMenuOpen, closeToolsMenu]);

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

  const isReaderContentCurrent = Boolean(
    readerPayload &&
      readerPayload.chapter.bookSlug === (bookSlug ?? "") &&
      readerPayload.chapter.chapterNumber === chapterNumber &&
      readerPayload.resolvedTranslationId === requestedTranslationId,
  );

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

  const chapterNav = useMemo(() => {
    if (!readerPayload?.chapter || !readerPayload.books) {
      return { prevChapter: null as ChapterNavTarget | null, nextChapter: null as ChapterNavTarget | null };
    }
    const slug = bookSlug ?? "";
    const ch = readerPayload.chapter;
    const tid = readerPayload.resolvedTranslationId;
    const synced =
      ch.bookSlug === slug && ch.chapterNumber === chapterNumber && tid === requestedTranslationId;
    const navChapter: BibleChapter = synced
      ? ch
      : {
          bookName: readerPayload.books.find((b) => b.slug === slug)?.name ?? ch.bookName,
          bookSlug: slug,
          chapterNumber,
          verses: ch.verses,
          ...(ch.verseInlineContent ? { verseInlineContent: ch.verseInlineContent } : {}),
        };
    return getReaderChapterNeighbors(readerPayload.books, navChapter, chapterNumber);
  }, [readerPayload, bookSlug, chapterNumber, requestedTranslationId]);

  const chapterNavRouteKey = `${bookSlug ?? ""}:${chapterNumber}:${requestedTranslationId}`;
  const chapterNavArrowsOverlayOpen =
    toolsMenuOpen ||
    fontSettingsSheetOpen ||
    readerDropdown != null ||
    readerPrivacyPolicyOpen ||
    readerCreditsOpen ||
    noteModalVisible ||
    newEntrySheetOpen;
  const chapterNavArrowsEnabled =
    !chapterNavArrowsOverlayOpen &&
    selectedVerses.length === 0 &&
    (chapterNav.prevChapter != null || chapterNav.nextChapter != null) &&
    readerPayload?.resolvedTranslationId === requestedTranslationId;
  const {
    opacityAnim: chapterNavArrowsOpacityAnim,
    pointerEventsEnabled: chapterNavArrowsPointerEventsEnabled,
    onScrollBeginDrag: onChapterNavArrowsScrollBeginDrag,
    onScrollEndDrag: onChapterNavArrowsScrollEndDrag,
    onMomentumScrollEnd: onChapterNavArrowsMomentumScrollEnd,
    onScroll: onChapterNavArrowsScroll,
    hideFromMotion: hideChapterNavArrowsFromMotion,
  } = useReaderChapterNavArrowsVisibility(chapterNavRouteKey, chapterNavArrowsEnabled);

  const onReaderScrollBeginDragWithChapterNav = useCallback(() => {
    onReaderScrollBeginDrag();
    onChapterNavArrowsScrollBeginDrag();
  }, [onReaderScrollBeginDrag, onChapterNavArrowsScrollBeginDrag]);

  const onReaderScroll = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: readerScrollYAnim } } }],
        {
          useNativeDriver: true,
          listener: onChapterNavArrowsScroll,
        },
      ),
    [readerScrollYAnim, onChapterNavArrowsScroll],
  );

  const goToPrevChapter = useCallback(() => {
    const target = chapterNav.prevChapter;
    if (!target) return;
    const tid = resolvedTranslationId ?? requestedTranslationId;
    primeReaderChapterFetch(tid, target);
    if (readerPayload?.books) {
      primeReaderChapterFetch(
        tid,
        getReaderChapterNeighbors(
          readerPayload.books,
          { bookSlug: target.slug, chapterNumber: target.chapter },
          target.chapter,
        ).prevChapter,
      );
    }
    closeToolsMenu();
    goToReaderChapter(target.slug, target.chapter, tid);
  }, [
    chapterNav.prevChapter,
    closeToolsMenu,
    goToReaderChapter,
    readerPayload?.books,
    resolvedTranslationId,
    requestedTranslationId,
  ]);

  const goToNextChapter = useCallback(() => {
    const target = chapterNav.nextChapter;
    if (!target) return;
    const tid = resolvedTranslationId ?? requestedTranslationId;
    primeReaderChapterFetch(tid, target);
    if (readerPayload?.books) {
      primeReaderChapterFetch(
        tid,
        getReaderChapterNeighbors(
          readerPayload.books,
          { bookSlug: target.slug, chapterNumber: target.chapter },
          target.chapter,
        ).nextChapter,
      );
    }
    closeToolsMenu();
    goToReaderChapter(target.slug, target.chapter, tid);
  }, [
    chapterNav.nextChapter,
    closeToolsMenu,
    goToReaderChapter,
    readerPayload?.books,
    resolvedTranslationId,
    requestedTranslationId,
  ]);

  const chapterSwipePan = useMemo(() => {
    const tid = readerPayload?.resolvedTranslationId;
    if (!tid) return noopChapterSwipePan;
    const { prevChapter, nextChapter } = chapterNav;
    const releaseThresholdPx = Platform.OS === "android" ? 72 : 52;
    const tryChapterSwipeNavigate = (g: PanResponderGestureState) => {
      if (!chapterSwipeReleaseShouldNavigate(g, releaseThresholdPx)) return;
      if (g.dx <= -releaseThresholdPx && nextChapter) {
        primeReaderChapterFetch(tid, nextChapter);
        goToReaderChapter(nextChapter.slug, nextChapter.chapter, tid);
      } else if (g.dx >= releaseThresholdPx && prevChapter) {
        primeReaderChapterFetch(tid, prevChapter);
        goToReaderChapter(prevChapter.slug, prevChapter.chapter, tid);
      }
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        const active = chapterSwipeMoveShouldActivate(g);
        if (active) hideChapterNavArrowsFromMotion();
        return active;
      },
      onMoveShouldSetPanResponderCapture: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        const active = chapterSwipeMoveShouldSetCapture() && chapterSwipeMoveShouldActivate(g);
        if (active) hideChapterNavArrowsFromMotion();
        return active;
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        tryChapterSwipeNavigate(g);
      },
      onPanResponderTerminate: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        tryChapterSwipeNavigate(g);
      },
    });
  }, [chapterNav, readerPayload?.resolvedTranslationId, goToReaderChapter, hideChapterNavArrowsFromMotion]);

  const readerTabletLandscapeTwoColumn =
    chapter != null &&
    isTabletLayout(windowWidth, windowHeight) &&
    windowWidth > windowHeight;

  const readerTwoColumnSplitIndex = useMemo(
    () => (chapter ? splitVerseIndexForBalancedColumns(chapter.verses) : 0),
    [chapter],
  );

  const readerVerseFontSize = 16 * fontSizeScale;
  const readerVerseLineHeight = 28 * fontSizeScale * lineSpacingScale;

  const verseFlashListData = useMemo((): ReaderVerseFlashItem[] => {
    if (!chapter) return [];
    return buildReaderVerseFlashListData(
      chapter.verses,
      readerTabletLandscapeTwoColumn,
      readerTwoColumnSplitIndex,
      chapter.verseInlineContent,
    );
  }, [chapter, readerTabletLandscapeTwoColumn, readerTwoColumnSplitIndex]);

  const verseFlashListDataForList = useMemo(
    () => (isReaderContentCurrent ? verseFlashListData : []),
    [isReaderContentCurrent, verseFlashListData],
  );

  /** Typical single-line verse row height; FlashList v2 measures real layouts (no `estimatedItemSize` prop). */
  const readerVerseEstimatedItemSize = readerVerseEstimatedFlashListItemSizePx(readerVerseLineHeight);

  const stableVisualData = useMemo(
    () => ({
      themeId,
      selectionBackground: rc.selectionBackground,
      selectionText: rc.selectionText,
      verseNumberColor: rc.verseNumberColor,
      noteBelowVerseBackground: rc.noteBelowVerseBackground,
      bodyTextColor: colors.brown800,
      readerVerseFontSize,
      readerVerseLineHeight,
      readerVerseBodyFontFamily: readerVerseBodyFontFamily(readerVerseBodyFontId),
      verseTextAlign,
    }),
    [
      themeId,
      rc.selectionBackground,
      rc.selectionText,
      rc.verseNumberColor,
      rc.noteBelowVerseBackground,
      colors.brown800,
      readerVerseFontSize,
      readerVerseLineHeight,
      readerVerseBodyFontId,
      verseTextAlign,
    ],
  );

  const interactionData = useMemo(
    () => ({
      selectedVerseNumbers,
      highlights,
      notes,
    }),
    [selectedVerseNumbers, highlights, notes],
  );

  type ReaderVerseInteractionData = typeof interactionData;
  type ReaderVerseStableVisualData = typeof stableVisualData;
  const flashListExtraData = useMemo(
    () => ({ interactionData, stableVisualData }),
    [interactionData, stableVisualData],
  );

  type ReaderVerseFlashRowProps = {
    item: Extract<ReaderVerseFlashItem, { kind: "verse" }>;
    index: number;
    interactionData: ReaderVerseInteractionData;
    stableVisualData: ReaderVerseStableVisualData;
    readerTabletLandscapeTwoColumn: boolean;
    readerVersesOpacityAnim: Animated.Value;
    onVersePress: (verseNum: number) => void;
    onVerseLongPress: (verseNum: number) => void;
  };

  const MemoizedReaderVerseFlashRow = useMemo(
    () =>
      memo(
        ({
          item,
          index,
          interactionData,
          stableVisualData: vd,
          readerTabletLandscapeTwoColumn,
          readerVersesOpacityAnim,
          onVersePress,
          onVerseLongPress,
        }: ReaderVerseFlashRowProps) => {
          const verseNum = item.verseIndex + 1;
          const twoColumnPaddingStyle =
            readerTabletLandscapeTwoColumn
              ? index % 2 === 0
                ? readerVerseListStyles.leftColumnPadding
                : readerVerseListStyles.rightColumnPadding
              : null;
          return (
            <Animated.View
              style={[
                readerVerseListStyles.flashItemBase,
                twoColumnPaddingStyle,
                { opacity: readerVersesOpacityAnim },
              ]}
            >
              <ReaderVerseRow
                verseNum={verseNum}
                verseText={item.verseText}
                verseInlineContent={item.verseInlineContent}
                isSelected={interactionData.selectedVerseNumbers.has(verseNum)}
                highlight={interactionData.highlights[verseNum]}
                noteText={interactionData.notes[verseNum]?.trim()}
                themeId={vd.themeId}
                selectionBackground={vd.selectionBackground}
                selectionText={vd.selectionText}
                verseNumberColor={vd.verseNumberColor}
                noteBelowVerseBackground={vd.noteBelowVerseBackground}
                bodyTextColor={vd.bodyTextColor}
                readerVerseFontSize={vd.readerVerseFontSize}
                readerVerseLineHeight={vd.readerVerseLineHeight}
                readerVerseBodyFontFamily={vd.readerVerseBodyFontFamily}
                verseTextAlign={vd.verseTextAlign}
                onVersePress={onVersePress}
                onVerseLongPress={onVerseLongPress}
              />
            </Animated.View>
          );
        },
        (prevProps, nextProps) => {
          if (prevProps.item.verseIndex !== nextProps.item.verseIndex) return false;
          if (prevProps.item.verseText !== nextProps.item.verseText) return false;
          if (prevProps.item.verseInlineContent !== nextProps.item.verseInlineContent) return false;
          if (prevProps.index !== nextProps.index) return false;
          if (prevProps.readerTabletLandscapeTwoColumn !== nextProps.readerTabletLandscapeTwoColumn) return false;
          if (prevProps.readerVersesOpacityAnim !== nextProps.readerVersesOpacityAnim) return false;
          if (prevProps.onVersePress !== nextProps.onVersePress) return false;
          if (prevProps.onVerseLongPress !== nextProps.onVerseLongPress) return false;
          if (prevProps.stableVisualData !== nextProps.stableVisualData) return false;

          const verseNum = prevProps.item.verseIndex + 1;
          const prevSelected = prevProps.interactionData.selectedVerseNumbers.has(verseNum);
          const nextSelected = nextProps.interactionData.selectedVerseNumbers.has(verseNum);
          if (prevSelected !== nextSelected) return false;
          if (prevProps.interactionData.highlights[verseNum] !== nextProps.interactionData.highlights[verseNum]) {
            return false;
          }
          const prevNote = prevProps.interactionData.notes[verseNum]?.trim();
          const nextNote = nextProps.interactionData.notes[verseNum]?.trim();
          if (prevNote !== nextNote) return false;
          return true;
        },
      ),
    [],
  );

  const renderReaderVerseFlashItem = useCallback(
    ({ item, index }: ListRenderItemInfo<ReaderVerseFlashItem>) => {
      if (item.kind === "empty") {
        const twoColumnPaddingStyle =
          readerTabletLandscapeTwoColumn
            ? index % 2 === 0
              ? readerVerseListStyles.leftColumnPadding
              : readerVerseListStyles.rightColumnPadding
            : null;
        return (
          <View style={[readerVerseListStyles.flashItemBase, twoColumnPaddingStyle]} />
        );
      }
      return (
        <MemoizedReaderVerseFlashRow
          item={item}
          index={index}
          interactionData={interactionData}
          stableVisualData={stableVisualData}
          readerTabletLandscapeTwoColumn={readerTabletLandscapeTwoColumn}
          readerVersesOpacityAnim={readerVersesOpacityAnim}
          onVersePress={handleVerseTapForOnboarding}
          onVerseLongPress={handleVerseLongPressForOnboarding}
        />
      );
    },
    [
      MemoizedReaderVerseFlashRow,
      interactionData,
      stableVisualData,
      readerVersesOpacityAnim,
      handleVerseTapForOnboarding,
      handleVerseLongPressForOnboarding,
      readerTabletLandscapeTwoColumn,
    ],
  );

  const readerVerseFlashKeyExtractor = useCallback((item: ReaderVerseFlashItem) => {
    if (item.kind === "verse") return `v-${item.verseIndex}`;
    return `e-${item.side}-${item.row}`;
  }, []);

  const readerChapterFlashListFooter = useCallback(() => {
    if (readerPayload?.resolvedTranslationId !== requestedTranslationId) return null;
    const { prevChapter, nextChapter } = chapterNav;
    return (
      <Animated.View style={{ opacity: readerVersesOpacityAnim }}>
        <View className="flex-row justify-between mt-8 gap-3">
          {prevChapter ? (
            <TouchableOpacity
              className="flex-1 rounded-full py-3 px-4 items-center"
              style={{ backgroundColor: colors.parchmentDark }}
              onPress={() => {
                closeToolsMenu();
                goToReaderChapter(
                  prevChapter.slug,
                  prevChapter.chapter,
                  resolvedTranslationId ?? requestedTranslationId,
                );
              }}
            >
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: colors.brown800 }}>
                ← Previous
              </Text>
            </TouchableOpacity>
          ) : (
            <View className="flex-1" />
          )}

          {nextChapter ? (
            <TouchableOpacity
              className="flex-1 rounded-full py-3 px-4 items-center"
              style={{ backgroundColor: colors.parchmentDark }}
              onPress={() => {
                closeToolsMenu();
                goToReaderChapter(
                  nextChapter.slug,
                  nextChapter.chapter,
                  resolvedTranslationId ?? requestedTranslationId,
                );
              }}
            >
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: colors.brown800 }}>
                Next →
              </Text>
            </TouchableOpacity>
          ) : (
            <View className="flex-1" />
          )}
        </View>
        <Pressable
          onPress={dismissReaderChromeFromBackgroundPress}
          style={{ flexGrow: 1, minHeight: Math.max(36, insets.bottom + 46) }}
          android_ripple={null}
          accessible={false}
        />
      </Animated.View>
    );
  }, [
    readerPayload?.resolvedTranslationId,
    requestedTranslationId,
    readerVersesOpacityAnim,
    chapterNav,
    colors.parchmentDark,
    colors.brown800,
    resolvedTranslationId,
    requestedTranslationId,
    goToReaderChapter,
    closeToolsMenu,
    dismissReaderChromeFromBackgroundPress,
    insets.bottom,
  ]);

  const readerOverlayOpen =
    toolsMenuOpen ||
    fontSettingsSheetOpen ||
    readerDropdown != null ||
    readerPrivacyPolicyOpen ||
    readerCreditsOpen ||
    noteModalVisible ||
    newEntrySheetOpen;

  const readerAndroidTopToolsTopPx = Math.max(insets.top, 8) + 2;

  /** Below stack header / in-screen tool pill so the toast is not under native header touch targets. */
  const selectionBannerTopPx =
    (Platform.OS === "ios"
      ? insets.top + 44 + 10
      : readerAndroidTopToolsTopPx + 44 + 10) +
    (isTabletLayout(windowWidth, windowHeight) ? 55 : 0);

  /**
   * Reader chrome (stack header + 44px tool pill) sits above the settings strip; pad past it.
   * Extra clearance so the first row (Translation) is not under native `headerRight` / tools — that
   * blocked taps. +10px lowers all menu rows together.
   */
  const readerMobileSettingsScrollPaddingTop =
    (Platform.OS === "ios"
      ? insets.top + 44 + 12
      : Math.max(insets.top + 56, readerAndroidTopToolsTopPx + 44 + 12)) +
    (isTabletReaderLayout ? 10 : 0) +
    10;

  const actionBarBottomPx =
    nativeTabFabOffsetPx(insets.bottom) +
    (Platform.OS === "android" ? 52 : 0) +
    (Platform.OS === "ios" && !isTabletReaderLayout ? 30 : 0);

  const measureHeaderToolsPill = useCallback(() => {
    headerToolsGroupRef.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      const next = { x, y, width, height };
      setHeaderToolsPillRect((prev) => {
        if (
          prev &&
          Math.abs(prev.x - next.x) < 1 &&
          Math.abs(prev.y - next.y) < 1 &&
          Math.abs(prev.width - next.width) < 1 &&
          Math.abs(prev.height - next.height) < 1
        ) {
          return prev;
        }
        return next;
      });
    });
  }, []);

  useEffect(() => {
    if (!headerToolsPillRect) return;
    setHeaderToolsLayoutEpoch((epoch) => epoch + 1);
  }, [headerToolsPillRect]);

  const readerFeatureOnboarding = useReaderFeatureOnboarding({
    readerContentReady: readerPayload != null && !chapterMissing,
    readerOverlayOpen,
    bookButtonRef: bookFanRef,
    settingsButtonRef,
    selectionBannerRef: selectionBannerLiveRef,
    headerToolsPillRect,
    headerToolsLayoutEpoch,
    insets,
    screenW: windowWidth,
    screenH: windowHeight,
    hasPrevChapter: chapterNav.prevChapter != null,
    hasNextChapter: chapterNav.nextChapter != null,
    selectionBannerTopPx,
    androidTopToolsTopPx: readerAndroidTopToolsTopPx,
    selectedVerseCount: selectedVerses.length,
    onTourComplete: clearVerseSelection,
  });

  onboardingStepRef.current = readerFeatureOnboarding.currentStep;
  completeOnboardingInteractionRef.current = readerFeatureOnboarding.completeInteractionStep;

  const readerSettingsOnboarding = useReaderSettingsOnboarding({
    toolsMenuOpen,
    rowRefs: settingsOnboardingRowRefs,
    scrollPaddingTop: readerMobileSettingsScrollPaddingTop,
    screenW: windowWidth,
    screenH: windowHeight,
    insets,
  });

  const readerActionBarOnboarding = useReaderActionBarOnboarding({
    hasVerseSelection: selectedVerses.length > 0,
    actionBarMode,
    readerOverlayOpen,
    readerFeatureOnboardingActive: readerFeatureOnboarding.showLayer,
    buttonRefs: actionBarOnboardingButtonRefs,
    screenW: windowWidth,
    actionBarBottomPx,
  });

  useEffect(() => {
    if (readerFeatureOnboarding.currentStep !== "clear-selection") {
      clearSelectionPrimedRef.current = false;
      return;
    }
    if (clearSelectionPrimedRef.current) return;
    if (selectedVerses.length > 0) {
      clearSelectionPrimedRef.current = true;
      return;
    }
    if (!chapter?.verses?.length) return;
    clearSelectionPrimedRef.current = true;
    toggleVerseSelection(1);
  }, [
    readerFeatureOnboarding.currentStep,
    selectedVerses.length,
    chapter?.verses?.length,
    toggleVerseSelection,
  ]);

  useEffect(() => {
    if (readerFeatureOnboarding.forceChapterNavArrowsVisible) {
      chapterNavArrowsOpacityAnim.setValue(1);
    }
  }, [readerFeatureOnboarding.forceChapterNavArrowsVisible, chapterNavArrowsOpacityAnim]);

  if (chapterMissing) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: rc.sceneSurface }}>
        <Text style={{ fontFamily: "Inter_400Regular", color: colors.tan300, textAlign: "center" }}>
          Chapter not found.
        </Text>
      </View>
    );
  }

  if (!readerPayload || !chapter || !books || !resolvedTranslationId) {
    return (
      <View className="flex-1 items-center justify-center gap-3" style={{ backgroundColor: rc.sceneSurface }}>
        <ActivityIndicator color={colors.brown800} />
        <Text style={{ fontFamily: "Inter_400Regular", color: colors.tan300, fontSize: 14 }}>
          Loading chapter…
        </Text>
      </View>
    );
  }

  const readerHeaderBookName =
    books.find((b) => b.slug === (bookSlug ?? ""))?.name ?? chapter.bookName;
  const readerHeaderTranslationId = isReaderContentCurrent
    ? resolvedTranslationId
    : requestedTranslationId;

  const readerChapterPageHeading = (
    <Animated.View
      className="mb-3"
      style={{ opacity: readerPageHeadingOpacityAnim }}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        setReaderPageHeadingHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
      }}
    >
      <Text
        className="text-xs tracking-widest uppercase mb-1.5"
        style={{ fontFamily: "Inter_400Regular", color: colors.gold }}
      >
        {readerHeaderTranslationId} ({TRANSLATION_LANGUAGE_BY_ID[readerHeaderTranslationId as keyof typeof TRANSLATION_LANGUAGE_BY_ID] ?? "English"})
      </Text>
      <Text
        style={{ fontFamily: "Lora_400Regular", fontSize: 36, lineHeight: 42, color: colors.brown800 }}
        numberOfLines={2}
      >
        {readerHeaderBookName}
      </Text>
      <Text
        className="text-sm tracking-widest uppercase mt-0.5"
        style={{ fontFamily: "Inter_400Regular", color: colors.tan200 }}
      >
        Chapter {chapterNumber}
      </Text>
    </Animated.View>
  );

  const { prevChapter, nextChapter } = chapterNav;

  /**
   * Do not tie chapter swipes to `isReaderContentCurrent`: after `setParams`, the route updates
   * immediately but `readerPayload` is still the previous chapter until the async load finishes.
   * That made `noop` pan handlers run so the next swipe did nothing (often read as “one swipe only”).
   * `chapterNav` already uses URL params for neighbors while payload catches up.
   */
  const chapterSwipePanHandlers = (readerOverlayOpen ? noopChapterSwipePan : chapterSwipePan).panHandlers;

  const hasVerseSelection = selectedVerses.length > 0;
  const actionBarIconBoxPx = 24;
  const actionBarIconSizePx = 22;
  const actionBarIconScale = {
    studyNotes: 1.01,
    highlight: 1.19,
    copy: 1.31,
    note: 1.08,
    journal: 1.08,
  } as const;
  const selectedVerseFeedbackLabel =
    selectedVerses.length === 0
      ? ""
      : selectedVerses.length === 1
        ? "1 verse selected"
        : `${selectedVerses.length} verses selected`;
  const newEntrySheetBottomPx = nativeTabSheetBottomInsetPx(insets.bottom, 10);
  /** Book picker sheet: 20px gap above the bottom safe area (full-window overlay; not tab-bar offset). */
  const readerBookSheetBottomPx = insets.bottom + 20;
  /**
   * Extra gap above the tab bar so the sheet clears the floating tab pill. Phones use a larger lift;
   * tablets need less or the in-card layout leaves a big empty band above the save row.
   */
  const readerNewEntrySheetBottomLiftPx = isTabletLayout(windowWidth, windowHeight) ? 12 : 50;
  const newEntrySheetTopGutterPx = insets.top + 8;
  const newEntrySheetBottomInsetWithLiftPx = newEntrySheetBottomPx + readerNewEntrySheetBottomLiftPx;
  const newEntrySheetAvailableHeightPx = Math.max(
    320,
    windowHeight - newEntrySheetTopGutterPx - newEntrySheetBottomInsetWithLiftPx,
  );
  /**
   * Reader new-entry sheet:
   * - iOS/tablet: keep existing fill behavior from top gutter to bottom inset.
   * - Android phones: cap height so very tall screens do not introduce a large empty area.
   */
  const newEntrySheetTargetHeightPx =
    Platform.OS === "android" && !isTabletReaderLayout
      ? Math.min(newEntrySheetAvailableHeightPx, Math.round(windowHeight * 0.76))
      : newEntrySheetAvailableHeightPx;
  const newEntrySheetTopPx =
    windowHeight - newEntrySheetBottomInsetWithLiftPx - newEntrySheetTargetHeightPx;
  const copyToastTopPx = selectionBannerTopPx + (hasVerseSelection ? 22 : 36);

  const screenW = windowWidth;
  /** Horizontal gap between sheet card and window edge. */
  const readerBookSheetScreenEdgePad = 5;
  const readerBookSheetContentW =
    screenW - (insets.left + readerBookSheetScreenEdgePad) - (insets.right + readerBookSheetScreenEdgePad);
  const readerBookSheetPad = 16;
  const readerBookGridGap = 8;
  const readerBookGridCellW =
    (readerBookSheetContentW - readerBookSheetPad * 2 - readerBookGridGap * 2) / 3;
  const readerChapterCols = 5;
  const readerChapterGridCellW =
    (readerBookSheetContentW - readerBookSheetPad * 2 - readerBookGridGap * (readerChapterCols - 1)) /
    readerChapterCols;
  const newEntrySheetHorizontalInset = insets.left + 2;
  const newEntrySheetWidth = Math.min(
    windowWidth - newEntrySheetHorizontalInset * 2,
    isTabletLayout(windowWidth, windowHeight)
      ? TABLET_NEW_ENTRY_SHEET_MAX_WIDTH_PX
      : windowWidth - newEntrySheetHorizontalInset * 2,
  );
  const newEntrySheetLeft = Math.max(newEntrySheetHorizontalInset, (windowWidth - newEntrySheetWidth) / 2);
  /** Keep a floor so theme/translation popovers always get a sane width (avoids 0‑width tiles when `screenW` is briefly 0). */
  const readerDropdownMaxW = Math.min(340, Math.max(200, screenW - 24));
  const fontSettingsScale = isTabletReaderLayout ? 1.5 : 1;
  const fontSettingsPopupMaxW = Math.min(isTabletReaderLayout ? 510 : 340, screenW - 24);
  const fontSettingsPopupMaxH = Dimensions.get("window").height * (isTabletReaderLayout ? 0.7 : 0.78);
  const fontSettingsPopupPadH = 16 * fontSettingsScale;
  const fontSettingsPopupPadTop = READER_FONT_CARD_PADDING_TOP_PX * fontSettingsScale;
  const fontSettingsPopupPadBottom = 12 * fontSettingsScale;
  const fontSettingsSectionLabelSize = 10 * fontSettingsScale;
  const fontSettingsAlignIconSize = 22 * fontSettingsScale;
  const readerDropdownTop =
    dropdownAnchor != null ? dropdownAnchor.y + dropdownAnchor.height + 8 : 0;
  const readerDropdownLeft =
    readerDropdown === "translation" || readerDropdown === "theme"
      ? Math.max(12, (screenW - readerDropdownMaxW) / 2)
      : dropdownAnchor != null
        ? Math.min(
            Math.max(12, dropdownAnchor.x + dropdownAnchor.width - readerDropdownMaxW),
            screenW - readerDropdownMaxW - 12,
          )
        : 0;
  const settingsMutedTextColor = themeId === "spectrum" ? colors.brown600 : colors.tan200;
  const androidMenuActiveHeaderIconColor =
    Platform.OS === "android" && toolsMenuOpen ? rc.selectionText : null;
  const readerHeaderToolsHidden = readerDropdown === "book" && !bookSheetExitAnimationStarted;

  const readerSettingsToolsRow =
    Platform.OS === "android" ? (
      <View ref={settingsButtonRef} collapsable={false} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
        <TouchableOpacity
          onPress={toggleToolsMenu}
          activeOpacity={0.7}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          accessibilityRole="button"
          accessibilityLabel={toolsMenuOpen ? "Close reader tools" : "Reader settings"}
          accessibilityState={{ expanded: toolsMenuOpen }}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center", transform: [{ translateX: 2 }, { translateY: -4 }] }}>
            <ReaderSettingsCogIcon size={26} color={androidMenuActiveHeaderIconColor ?? colors.brown800} />
          </View>
        </TouchableOpacity>
      </View>
    ) : (
    <View ref={settingsButtonRef} collapsable={false} className="h-11 w-11 items-center justify-center">
      <Pressable
        className="h-11 w-11 items-center justify-center rounded-full"
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        onPress={toggleToolsMenu}
        accessibilityRole="button"
        accessibilityLabel={toolsMenuOpen ? "Close reader tools" : "Reader settings"}
        accessibilityState={{ expanded: toolsMenuOpen }}
      >
        <View className="h-6 w-6 items-center justify-center" style={{ transform: [{ translateX: 2 }, { translateY: -4 }] }}>
          <ReaderSettingsCogIcon size={26} color={androidMenuActiveHeaderIconColor ?? colors.brown800} />
        </View>
      </Pressable>
    </View>
    );

  const readerHeaderBookButton =
    Platform.OS === "android" ? (
      <View ref={bookFanRef} collapsable={false} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
        <TouchableOpacity
          onPress={openBookTools}
          activeOpacity={0.7}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          accessibilityRole="button"
          accessibilityLabel={readerDropdown === "book" ? "Close book list" : "Choose a Bible book"}
          accessibilityState={{ selected: readerDropdown === "book" }}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center", transform: [{ translateY: -4 }] }}>
            <BibleBookIcon
              size={21}
              color={
                androidMenuActiveHeaderIconColor ??
                (readerDropdown === "book" ? colors.gold : colors.brown800)
              }
            />
          </View>
        </TouchableOpacity>
      </View>
    ) : (
    <View ref={bookFanRef} collapsable={false} className="h-11 w-11 items-center justify-center">
      <Pressable
        className="h-11 w-11 items-center justify-center rounded-full"
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        onPress={openBookTools}
        accessibilityRole="button"
        accessibilityLabel={readerDropdown === "book" ? "Close book list" : "Choose a Bible book"}
        accessibilityState={{ selected: readerDropdown === "book" }}
      >
        <View className="h-6 w-6 items-center justify-center" style={{ transform: [{ translateY: -4 }] }}>
          <BibleBookIcon
            size={21}
            color={
              androidMenuActiveHeaderIconColor ??
              (readerDropdown === "book" ? colors.gold : colors.brown800)
            }
          />
        </View>
      </Pressable>
    </View>
    );

  const readerHeaderToolsGroup = (
    <View
      ref={headerToolsGroupRef}
      collapsable={false}
      onLayout={measureHeaderToolsPill}
      className="flex-row items-center rounded-full"
      style={{
        height: 44,
        width: 92,
        justifyContent: "space-evenly",
        paddingHorizontal: Platform.OS === "android" ? 2 : 0,
        gap: 0,
        backgroundColor:
          Platform.OS === "android" ? (toolsMenuOpen ? "transparent" : rc.sceneSurface) : "transparent",
        borderWidth: 0,
        marginRight: 0,
      }}
    >
      {readerHeaderBookButton}
      {readerSettingsToolsRow}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: rc.sceneSurface }}>
      <ReaderMobileSettingsPanel
        insets={insets}
        scrollPaddingTop={readerMobileSettingsScrollPaddingTop}
        padH={fontSettingsPopupPadH}
        onSelectFontSettings={openMobileReaderFontSettingsFromMenu}
        onSelectThemes={openMobileReaderThemesFromMenu}
        onSelectCredits={openMobileReaderCreditsFromMenu}
        onSelectTranslation={openMobileReaderTranslationFromMenu}
        onSelectCommentary={openMobileReaderCommentaryFromMenu}
        onSelectDeleteMyData={openDeleteMyDataConfirmFromMenu}
        settingsOnboardingRowRefs={settingsOnboardingRowRefs}
      />
      <Animated.View
        {...(toolsMenuOpen ? readerSettingsMenuPanResponder.panHandlers : {})}
        pointerEvents={toolsMenuOpen ? "box-none" : "auto"}
        style={{
          flex: 1,
          backgroundColor: rc.sceneSurface,
          transform: [{ translateX: readerMobileSettingsSlideTranslateX }],
          zIndex: 1,
          ...(!toolsMenuOpen
            ? {}
            : {
                shadowColor: "#000000",
                shadowOpacity: 0.4,
                shadowOffset: { width: 4, height: 0 },
                shadowRadius: 16,
                elevation: 14,
              }),
        }}
      >
      <ReaderHeader
        readerHeaderChromeHidden={readerHeaderToolsHidden}
        rc={rc}
        colors={colors}
        screenW={screenW}
        readerHeaderTitleOpacityAnim={readerHeaderTitleOpacityAnim}
        readerHeaderBookName={readerHeaderBookName}
        chapterNumber={chapterNumber}
        readerHeaderTranslationId={readerHeaderTranslationId}
        readerHeaderToolsGroup={readerHeaderToolsGroup}
      />

      <ReaderVerseList
        rc={rc}
        readerScrollRef={readerScrollRef}
        chapterSwipePanHandlers={chapterSwipePanHandlers}
        readerVerseEstimatedItemSize={readerVerseEstimatedItemSize}
        onScroll={onReaderScroll}
        onScrollBeginDrag={onReaderScrollBeginDragWithChapterNav}
        onScrollEndDrag={onChapterNavArrowsScrollEndDrag}
        onMomentumScrollEnd={onChapterNavArrowsMomentumScrollEnd}
        dismissReaderChromeFromBackgroundPress={dismissReaderChromeFromBackgroundPress}
        verseFlashListDataForList={verseFlashListDataForList}
        renderReaderVerseFlashItem={renderReaderVerseFlashItem}
        readerVerseFlashKeyExtractor={readerVerseFlashKeyExtractor}
        flashListExtraData={flashListExtraData}
        readerTabletLandscapeTwoColumn={readerTabletLandscapeTwoColumn}
        listHeader={readerChapterPageHeading}
        readerChapterFlashListFooter={readerChapterFlashListFooter}
        hasVerseSelection={hasVerseSelection}
        actionBarMode={actionBarMode}
        actionBarBottomPx={actionBarBottomPx}
      />

      <ReaderChapterNavArrows
        opacityAnim={chapterNavArrowsOpacityAnim}
        pointerEventsEnabled={
          chapterNavArrowsPointerEventsEnabled || readerFeatureOnboarding.forceChapterNavArrowsVisible
        }
        prevChapter={chapterNav.prevChapter}
        nextChapter={chapterNav.nextChapter}
        onPrev={goToPrevChapter}
        onNext={goToNextChapter}
        colors={colors}
        rc={rc}
        insets={insets}
      />

      {copyToastVisible ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 51 }]}>
          <View
            style={{
              position: "absolute",
              top: copyToastTopPx,
              left: 0,
              right: 0,
              alignItems: "center",
              paddingHorizontal: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: colors.brown800,
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 8,
                shadowColor: rc.popoverShadow,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Text style={{ color: rc.selectionText, fontSize: 15 }}>✓</Text>
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 12,
                  color: rc.selectionText,
                }}
              >
                Copied
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {hasVerseSelection ? (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 45 }]}>
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              bottom: actionBarBottomPx,
              left: 0,
              right: 0,
              alignItems: "center",
              paddingLeft: 16,
              paddingRight: actionBarMode === "highlight" ? 4 : 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                flexWrap: "wrap",
                rowGap: 10,
                columnGap: 6,
                backgroundColor: colors.parchmentMid,
                borderRadius: 999,
                paddingLeft: actionBarMode === "highlight" ? 12 : 10,
                paddingRight: actionBarMode === "highlight" ? 12 : 10,
                paddingVertical: actionBarMode === "highlight" ? 7 : 3,
                borderWidth: 1,
                borderColor: colors.borderSolid,
                shadowColor: "#242423",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 4,
                maxWidth: "100%",
              }}
            >
              {actionBarMode === "highlight" ? (
                <>
                  <TouchableOpacity
                    onPress={() => setActionBarMode("default")}
                    accessibilityLabel="Back from highlight"
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      borderWidth: 1,
                      borderColor: colors.borderSolid,
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={{ fontFamily: "Inter_400Regular", color: colors.tan300 }}>←</Text>
                    <Text style={{ fontFamily: "Inter_500Medium", color: colors.brown800 }}>Back</Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {highlightColorOptions.map((opt) => {
                      const picked = pickedHighlightColor === opt.id;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          onPress={() => setPickedHighlightColor(opt.id)}
                          accessibilityLabel={`Use ${opt.id} highlight`}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: opt.swatch,
                            borderWidth: picked ? 3 : 1,
                            borderColor: picked ? opt.ring : "rgba(0,0,0,0.06)",
                          }}
                        />
                      );
                    })}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
                    <TouchableOpacity
                      onPress={removeHighlightsFromSelection}
                      accessibilityLabel="Remove highlight"
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Text style={{ fontFamily: "Inter_400Regular", color: colors.tan300 }}>Remove</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={applyPickedHighlightToSelection}
                      accessibilityLabel="Apply highlight"
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Text
                        style={{
                          fontFamily: "Inter_500Medium",
                          color: colors.brown800,
                          fontWeight: "600",
                        }}
                      >
                        Apply
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View ref={actionBarOnboardingStudyNotesRef} collapsable={false} className="h-[47px] w-[47px]">
                    <TouchableOpacity
                      onPress={openStudyNotesFromSelection}
                      accessibilityLabel="Open study notes for selection"
                      className="h-[47px] w-[47px] rounded-full items-center justify-center"
                      activeOpacity={0.7}
                    >
                      <View
                        style={{
                          width: actionBarIconBoxPx,
                          height: actionBarIconBoxPx,
                          alignItems: "center",
                          justifyContent: "center",
                          transform: [{ scale: actionBarIconScale.studyNotes }],
                        }}
                      >
                        <StudyNotesBookmarkIcon color={rc.actionIconMuted} size={actionBarIconSizePx} />
                      </View>
                    </TouchableOpacity>
                  </View>
                  <View ref={actionBarOnboardingHighlightRef} collapsable={false} className="h-[47px] w-[47px]">
                    <TouchableOpacity
                      onPress={() => {
                        const first = selectedVerses[0];
                        const existing = first != null ? highlights[first] : undefined;
                        if (existing) setPickedHighlightColor(existing);
                        setActionBarMode("highlight");
                      }}
                      accessibilityLabel="Highlight"
                      className="h-[47px] w-[47px] rounded-full items-center justify-center"
                      activeOpacity={0.7}
                    >
                      <View
                        style={{
                          width: actionBarIconBoxPx,
                          height: actionBarIconBoxPx,
                          alignItems: "center",
                          justifyContent: "center",
                          transform: [{ scale: actionBarIconScale.highlight }],
                        }}
                      >
                        <ReaderHighlightIcon color={rc.actionIconMuted} size={actionBarIconSizePx} />
                      </View>
                    </TouchableOpacity>
                  </View>
                  <View ref={actionBarOnboardingCopyRef} collapsable={false} className="h-[47px] w-[47px]">
                    <TouchableOpacity
                      onPress={() => {
                        void copySelectedVerses();
                      }}
                      accessibilityLabel="Copy"
                      className="h-[47px] w-[47px] rounded-full items-center justify-center"
                      activeOpacity={0.7}
                    >
                      <View
                        style={{
                          width: actionBarIconBoxPx,
                          height: actionBarIconBoxPx,
                          alignItems: "center",
                          justifyContent: "center",
                          transform: [{ scale: actionBarIconScale.copy }],
                        }}
                      >
                        <ReaderCopyIcon color={rc.actionIconMuted} size={actionBarIconSizePx} />
                      </View>
                    </TouchableOpacity>
                  </View>
                  <View ref={actionBarOnboardingNoteRef} collapsable={false} className="h-[47px] w-[47px]">
                    <TouchableOpacity
                      onPress={openNoteForSelection}
                      accessibilityLabel="Note"
                      className="h-[47px] w-[47px] rounded-full items-center justify-center"
                      activeOpacity={0.7}
                    >
                      <View
                        style={{
                          width: actionBarIconBoxPx,
                          height: actionBarIconBoxPx,
                          alignItems: "center",
                          justifyContent: "center",
                          transform: [{ scale: actionBarIconScale.note }],
                        }}
                      >
                        <ReaderNoteIcon color={rc.actionIconMuted} size={actionBarIconSizePx} />
                      </View>
                    </TouchableOpacity>
                  </View>
                  <View ref={actionBarOnboardingJournalRef} collapsable={false} className="h-[47px] w-[47px]">
                    <TouchableOpacity
                      onPress={openJournalFromSelection}
                      accessibilityLabel="New journal entry from selection"
                      className="h-[47px] w-[47px] rounded-full items-center justify-center"
                      style={{ backgroundColor: colors.brown800 }}
                      activeOpacity={0.85}
                    >
                      <View
                        style={{
                          width: actionBarIconBoxPx,
                          height: actionBarIconBoxPx,
                          alignItems: "center",
                          justifyContent: "center",
                          transform: [{ scale: actionBarIconScale.journal }],
                        }}
                      >
                        <ReaderJournalIcon color={rc.selectionText} size={actionBarIconSizePx} />
                      </View>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      ) : null}

      </Animated.View>

      {Platform.OS === "android" && !readerHeaderToolsHidden ? (
        <View
          pointerEvents="box-none"
          collapsable={false}
          style={{
            position: "absolute",
            top: readerAndroidTopToolsTopPx,
            left: Math.max(insets.left, 10),
            right: Math.max(insets.right, 10),
            height: 44,
            zIndex: 100,
            elevation: 100,
          }}
        >
          {!toolsMenuOpen ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
              opacity: readerHeaderTitleOpacityAnim,
            }}
          >
            <View
              style={{
                backgroundColor: rc.sceneSurface,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
                maxWidth: screenW * 0.42,
              }}
            >
              <View className="flex-row items-baseline justify-center" style={{ flexShrink: 1 }}>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: READER_HEADER_TITLE_MAIN_PX,
                    lineHeight: Math.ceil(READER_HEADER_TITLE_MAIN_PX * 1.25),
                    color: colors.brown800,
                  }}
                  numberOfLines={1}
                >
                  {readerHeaderBookName} {chapterNumber}
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: READER_HEADER_TITLE_TRANS_PX,
                    lineHeight: Math.ceil(READER_HEADER_TITLE_TRANS_PX * 1.25),
                    color: colors.gold,
                  }}
                  numberOfLines={1}
                >{` (${readerHeaderTranslationId})`}</Text>
              </View>
            </View>
          </Animated.View>
          ) : null}
          <View
            pointerEvents="auto"
            collapsable={false}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              height: 44,
              justifyContent: "center",
            }}
          >
            {readerHeaderToolsGroup}
          </View>
        </View>
      ) : null}

      {hasVerseSelection ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            StyleSheet.absoluteFill,
            {
              zIndex: 4000,
              transform: [{ translateX: readerMobileSettingsSlideTranslateX }],
              ...Platform.select({ android: { elevation: 48 } }),
            },
          ]}
        >
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              top: selectionBannerTopPx,
              left: 0,
              right: 0,
              alignItems: "center",
              paddingHorizontal: Math.round(16 * 1.2),
            }}
          >
            <View ref={selectionBannerLiveRef} pointerEvents="auto" collapsable={false}>
              <Pressable
                onPressIn={dismissSelectionToast}
                onPress={dismissSelectionToast}
                pressRetentionOffset={{ top: 32, bottom: 32, left: 48, right: 48 }}
                hitSlop={{ top: 20, bottom: 20, left: 24, right: 24 }}
                accessibilityRole="button"
                accessibilityLabel={
                  selectedVerses.length === 1
                    ? "1 verse selected, clear selection"
                    : `${selectedVerses.length} verses selected, clear selection`
                }
                accessibilityHint="Clears the current verse selection"
                style={({ pressed }) => ({
                  alignSelf: "center",
                  // Match widest label width so a single-verse pill is not fully under the native title chip.
                  minWidth: Math.min(220, screenW - 48),
                  minHeight: 44,
                  justifyContent: "center",
                  alignItems: "center",
                  maxWidth: "100%",
                  borderRadius: 999,
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: rc.selectionBackground,
                    borderRadius: 999,
                    paddingHorizontal: Math.round(12 * 1.2),
                    paddingVertical: Math.round(4 * 1.2),
                    shadowColor: rc.popoverShadow,
                    shadowOffset: { width: 0, height: Math.round(3 * 1.2) },
                    shadowOpacity: 0.2,
                    shadowRadius: Math.round(10 * 1.2),
                    elevation: Math.round(4 * 1.2),
                  }}
                >
                  <Text
                    pointerEvents="none"
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: Math.round(11 * 1.2),
                      lineHeight: Math.round(11 * 1.2 * 1.35),
                      color: rc.selectionText,
                      paddingVertical: Math.round(2 * 1.2),
                      textAlign: "center",
                    }}
                    numberOfLines={1}
                  >
                    {selectedVerseFeedbackLabel}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      ) : null}

      <ReaderModals
        bundle={bundle}
        activeBookViewLabel={activeBookViewLabel}
        animateCloseBookSheet={animateCloseBookSheet}
        applyBookSelectorView={applyBookSelectorView}
        azSortedBooks={azSortedBooks}
        bookPickerBook={bookPickerBook}
        bookPickerStep={bookPickerStep}
        bookSelectorViewMode={bookSelectorViewMode}
        bookSheetDismissPanEnabled={bookSheetDismissPanEnabled}
        onBookSheetScroll={onBookSheetScroll}
        onBookSheetDismissGestureEvent={onBookSheetDismissGestureEvent}
        onBookSheetDismissGestureStateChange={onBookSheetDismissGestureStateChange}
        bookSheetTranslateY={bookSheetTranslateY}
        bookViewMenuOpen={bookViewMenuOpen}
        chapter={chapter}
        commentaryPanelOpen={commentaryPanelOpen}
        closeFontSettingsPopup={closeFontSettingsPopup}
        closeCommentaryPanel={() => setCommentaryPanelOpen(false)}
        closeNewEntrySheet={closeNewEntrySheet}
        closeReaderDropdown={closeReaderDropdown}
        colors={colors}
        dropOpacityAnim={dropOpacityAnim}
        dropSlideAnim={dropSlideAnim}
        dropdownAnchor={dropdownAnchor}
        fontSettingsFanRef={fontSettingsFanRef}
        fontSettingsPopupMaxH={fontSettingsPopupMaxH}
        fontSettingsPopupMaxW={fontSettingsPopupMaxW}
        fontSettingsPopupOpacityAnim={fontSettingsPopupOpacityAnim}
        fontSettingsPopupPadBottom={fontSettingsPopupPadBottom}
        fontSettingsPopupPadH={fontSettingsPopupPadH}
        fontSettingsPopupPadTop={fontSettingsPopupPadTop}
        fontSettingsPopupSlideAnim={fontSettingsPopupSlideAnim}
        fontSettingsSectionLabelSize={fontSettingsSectionLabelSize}
        fontSettingsAlignIconSize={fontSettingsAlignIconSize}
        fontSettingsScale={fontSettingsScale}
        fontSettingsSheetOpen={fontSettingsSheetOpen}
        fontSizeScale={fontSizeScale}
        readerVerseBodyFontId={readerVerseBodyFontId}
        setReaderVerseBodyFontIdPersisted={setReaderVerseBodyFontIdPersisted}
        goToReaderChapter={goToReaderChapter}
        gridSectionsForPicker={gridSectionsForPicker}
        insets={insets}
        isTabletReaderLayout={isTabletReaderLayout}
        lineSpacingScale={lineSpacingScale}
        measureAndSetDropdown={measureAndSetDropdown}
        newEntryFormRef={newEntryFormRef}
        newEntryHandlePanResponder={newEntryHandlePanResponder}
        newEntryInitialParams={newEntryInitialParams}
        newEntrySheetBottomPx={newEntrySheetBottomPx}
        newEntrySheetKey={newEntrySheetKey}
        newEntrySheetLeft={newEntrySheetLeft}
        newEntrySheetOpacity={newEntrySheetOpacity}
        newEntrySheetOpen={newEntrySheetOpen}
        newEntrySheetTopPx={newEntrySheetTopPx}
        newEntrySheetTranslate={newEntrySheetTranslate}
        newEntrySheetWidth={newEntrySheetWidth}
        noteDraft={noteDraft}
        noteModalVisible={noteModalVisible}
        noteTargetVerse={noteTargetVerse}
        oldTestamentBooks={oldTestamentBooks}
        newTestamentBooks={newTestamentBooks}
        openFontSettingsSheet={openFontSettingsSheet}
        rc={rc}
        readerBookGridCellW={readerBookGridCellW}
        readerBookGridGap={readerBookGridGap}
        readerBookSheetBottomPx={readerBookSheetBottomPx}
        readerBookSheetPad={readerBookSheetPad}
        readerBookSheetScreenEdgePad={readerBookSheetScreenEdgePad}
        readerChapterCols={readerChapterCols}
        readerChapterGridCellW={readerChapterGridCellW}
        readerDropdown={readerDropdown}
        readerDropdownLeft={readerDropdownLeft}
        readerDropdownMaxW={readerDropdownMaxW}
        readerDropdownTop={readerDropdownTop}
        readerNewEntrySheetBottomLiftPx={readerNewEntrySheetBottomLiftPx}
        requestCloseReaderNewEntrySheet={requestCloseReaderNewEntrySheet}
        resolvedTranslationId={resolvedTranslationId}
        router={router}
        saveNoteFromModal={saveNoteFromModal}
        selectedVerses={selectedVerses}
        selectorTestamentTab={selectorTestamentTab}
        setBookPickerBook={setBookPickerBook}
        setBookPickerStep={setBookPickerStep}
        setBookViewMenuOpen={setBookViewMenuOpen}
        setFontSizeScalePersisted={setFontSizeScalePersisted}
        setLineSpacingScalePersisted={setLineSpacingScalePersisted}
        setNewEntryHasDraft={setNewEntryHasDraft}
        setNoteDraft={setNoteDraft}
        setNoteModalVisible={setNoteModalVisible}
        setNoteTargetVerse={setNoteTargetVerse}
        setThemeId={setThemeId}
        settingsMutedTextColor={settingsMutedTextColor}
        setVerseTextAlignPersisted={setVerseTextAlignPersisted}
        themesFanRef={themesFanRef}
        themeId={themeId}
        translationFanRef={translationFanRef}
        translationPickerItems={translationPickerItems}
        translationPickerLoading={translationPickerLoading}
        favoriteTranslationIds={favoriteTranslationIds}
        toggleFavoriteTranslation={toggleFavoriteTranslation}
        verseTextAlign={verseTextAlign}
      />
      <CreditsSheet
        visible={readerCreditsOpen}
        onClose={() => setReaderCreditsOpen(false)}
        onOpenPrivacyPolicy={openPrivacyPolicyFromCredits}
        onOpenTermsOfService={openTermsFromCredits}
      />
      <PrivacyPolicySheet visible={readerPrivacyPolicyOpen} onClose={() => setReaderPrivacyPolicyOpen(false)} />
      <TermsOfServiceSheet visible={readerTermsOpen} onClose={() => setReaderTermsOpen(false)} />

      <View
        ref={selectionBannerAnchorRef}
        pointerEvents="none"
        collapsable={false}
        style={{
          position: "absolute",
          top: selectionBannerTopPx,
          alignSelf: "center",
          left: "50%",
          marginLeft: -90,
          width: 180,
          height: 44,
          opacity: 0,
          zIndex: 1,
        }}
      />

      <ReaderFeatureOnboardingLayer
        visible={readerFeatureOnboarding.showLayer}
        step={readerFeatureOnboarding.currentStep}
        isSpotlightStep={readerFeatureOnboarding.isSpotlightStep}
        isInteractionCoachMark={readerFeatureOnboarding.isInteractionCoachMark}
        message={readerFeatureOnboarding.message}
        subtitle={readerFeatureOnboarding.subtitle}
        spotlightTargets={readerFeatureOnboarding.spotlightTargets}
        coachMarkAnchor={readerFeatureOnboarding.coachMarkAnchor}
        onDismiss={readerFeatureOnboarding.dismissCurrentStep}
        colors={{
          tooltipBackground: rc.selectionBackground,
          tooltipText: rc.selectionText,
          scrim: "rgba(0,0,0,0.45)",
        }}
      />

      <ReaderSettingsOnboardingLayer
        visible={readerSettingsOnboarding.showLayer}
        step={readerSettingsOnboarding.currentStep}
        rowAnchor={readerSettingsOnboarding.rowAnchor}
        colors={{
          tooltipBackground: rc.selectionBackground,
          tooltipText: rc.selectionText,
          arrow: "#FFFFFF",
        }}
      />

      <ReaderActionBarOnboardingLayer
        visible={readerActionBarOnboarding.showLayer}
        step={readerActionBarOnboarding.currentStep}
        buttonAnchor={readerActionBarOnboarding.buttonAnchor}
        colors={{
          tooltipBackground: rc.selectionBackground,
          tooltipText: rc.selectionText,
          arrow: "#FFFFFF",
        }}
      />
    </View>
  );
}
