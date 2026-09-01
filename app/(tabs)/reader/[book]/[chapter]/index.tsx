import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { GestureResponderEvent, PanResponderGestureState, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  View,
  Text,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
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
import { useFocusEffect } from "expo-router/react-navigation";
import type { ReaderChapterScrollHandle } from "@/src/features/reader/readerChapterScrollRef";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type {
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { State } from "react-native-gesture-handler";
import Reanimated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  getExternalApiId,
  getInternalIdFromApiId,
  isTranslationId,
  type TranslationId,
} from "@sinag-bible/core/bible-translations";
import { formatReaderChapterHeading } from "@/lib/reader-chapter-label";
import { getReaderTranslationLanguageLabel } from "@/lib/reader-translation-language";
import { getTranslationDisplayAbbreviation } from "@/lib/translation-display-label";
import { primeReaderChapterFetch } from "@/lib/reader-chapter-load";
import {
  getReaderChapterNeighbors,
  type ChapterNavTarget,
} from "@/lib/reader-chapter-nav";
import { useTranslationPicker } from "@/lib/use-translation-picker";
import { useFavoriteTranslations } from "@/lib/use-favorite-translations";
import type { BibleBookNavItem, BibleChapter } from "@sinag-bible/types";
import { mobileAppThemePickerOptions } from "@sinag-bible/tokens";
import { BibleBookIcon } from "@/components/icons/BibleBookIcon";
import { ReaderSettingsCogIcon } from "@/components/icons/ReaderSettingsCogIcon";
import { ReaderFontSettingsIcon } from "@/components/icons/ReaderFontSettingsIcon";
import { FilterListIcon } from "@/components/icons/FilterListIcon";
import { BOOK_GENRE_BY_SLUG } from "@/lib/book-genre-by-slug";
import { readerChapterScreenParams } from "@/lib/reader-navigation";
import {
  readerActionBarBottomPx,
  READER_CHAPTER_FOOTER_ABOVE_TAB_BAR_PX,
} from "@/lib/native-tab-chrome";
import { shouldFireHighRefreshJsBridge } from "@/lib/high-refresh-scroll";
import { useReaderTabBarScrollHidden, useRegisterReaderSettingsSlideProgress } from "@/lib/reader-tab-bar-visibility-context";
import {
  READER_SETTINGS_MENU_SPRING_CLOSE,
  READER_SETTINGS_MENU_SPRING_OPEN,
} from "@/lib/reader-settings-menu-motion";
import { isTabletLayout, isReaderTabletLandscapeTwoColumn } from "@/lib/tablet-layout";
import {
  type JournalNewEntryFormHandle,
  type JournalNewEntryInitialParams,
} from "@/components/journal-new-entry-form";
import {
  JournalNewEntrySheet,
  type JournalNewEntrySheetHandle,
} from "@/src/features/journal/JournalNewEntrySheet";
import { PrivacyPolicySheet } from "@/components/privacy-policy-sheet";
import { ChangelogsSheet } from "@/components/changelogs-sheet";
import { CreditsSheet } from "@/components/credits-sheet";
import { TermsOfServiceSheet } from "@/components/terms-of-service-sheet";
import { registerTabScrollRef } from "@/lib/tab-scroll-to-top";
import { hapticLightImpact, hapticSelection } from "@/lib/haptics";
import { deleteAllUserData } from "@/lib/delete-my-data";
import { LinearGradient } from "expo-linear-gradient";
import {
  buildReaderVerseFlashListData,
  readerFlashListChromeStyles,
  readerVerseEstimatedFlashListItemSizePx,
  scrollReaderFlashListToVerseCentered,
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
import {
  ReaderSelectionLayer,
  type ReaderSelectionActivity,
} from "@/src/features/reader/ReaderSelectionLayer";
import { ReaderHeader, ReaderIosScrollChapterTitle } from "@/src/features/reader/ReaderHeader";
import { ReaderAndroidAppBar } from "@/src/features/reader/ReaderAndroidAppBar";
import { ReaderM3IconButton } from "@/src/features/reader/ReaderM3IconButton";
import {
  ReaderChapterNavArrows,
  useReaderChapterNavArrowsVisibility,
} from "@/src/features/reader/ReaderChapterNavArrows";
import {
  ReaderScrollToTopFab,
  READER_SCROLL_TO_TOP_FAB_BOTTOM_EDGE_INSET_PX,
  useReaderScrollToTopFabVisibility,
} from "@/src/features/reader/ReaderScrollToTopFab";
import {
  ReaderModals,
  ReaderMobileSettingsPanel,
  type ReaderToolsDropdown,
} from "@/src/features/reader/ReaderModals";
import "@/lib/book-selector-view-prefs";
import { ReaderFeatureOnboardingLayer } from "@/src/features/reader/ReaderFeatureOnboardingLayer";
import { useReaderFeatureOnboarding, type ReaderOnboardingStep } from "@/src/features/reader/useReaderFeatureOnboarding";
import { TranslationPickerSheet } from "@/src/features/reader/TranslationPickerSheet";
import { useReaderChapterTransitionPhase } from "@/src/features/reader/ReaderTranslationLoadingOverlay";
import {
  subscribeReaderDataImportAbort,
  subscribeReaderDataImportBegin,
  subscribeReaderDataImportEnd,
  subscribeReaderDataImportPickingBegin,
  subscribeReaderDataImportPickingEnd,
} from "@/lib/reader-data-import-sync";
import { ReaderDataBackupSheet } from "@/src/features/reader/ReaderDataBackupSheet";
import { ReaderDeleteMyDataDialog } from "@/src/features/reader/ReaderDeleteMyDataDialog";
import { ReaderFontSettingsSheet } from "@/src/features/reader/ReaderFontSettingsSheet";
import { ReaderMoreSettingsSheet } from "@/src/features/reader/ReaderMoreSettingsSheet";
import { readerSettingsSideSheetWidthPx, READER_M3_APP_BAR_CONTENT_HEIGHT_PX } from "@/src/features/reader/readerSettingsPanelChrome";
import { useReaderChapter } from "@/src/features/reader/useReaderChapter";
import { ReaderYvpFootnoteSheet } from "@/src/features/reader/ReaderYvpFootnoteSheet";
import type { YvpFootnoteBody } from "@sinag-bible/types";
import { useReaderPreferences } from "@/src/features/reader/useReaderPreferences";
import { useReaderTabBarScrollDriver } from "@/src/features/reader/useReaderTabBarScrollDriver";
import { TAB_BAR_SLIDE_SHOW_MS } from "@/lib/reader-tab-bar-scroll-worklet";

const READER_FONT_CARD_PADDING_TOP_PX = 12;
/** Keep tab bar visible through verse deep-link scroll + one slide settle window. */
const VERSE_DEEP_LINK_TAB_BAR_SETTLE_MS = TAB_BAR_SLIDE_SHOW_MS + 200;

function persistReaderPref(key: string, value: string): void {
  void AsyncStorage.setItem(key, value).catch(() => {
    /* ignore storage write errors */
  });
}

/** Share of screen width the reader translates left when settings are open (tablets). */
const READER_MOBILE_SETTINGS_TABLET_PORTRAIT_SLIDE_RATIO = 0.25;
const READER_MOBILE_SETTINGS_TABLET_LANDSCAPE_SLIDE_RATIO = 0.2;

/** Present follow-up sheets after the settings strip finishes sliding away. */
const READER_MOBILE_MENU_CLOSE_MS = 260;

export default function ReaderChapterScreen() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isTabletReaderLayout = isTabletLayout(windowWidth, windowHeight);
  const { book: bookSlug, chapter: chapterParam, translation, verse: verseParam } = useLocalSearchParams<{
    book: string;
    chapter: string;
    translation?: string;
    verse?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    prefs,
    bundle,
    setFontFamily: setReaderVerseBodyFontIdPersisted,
    setFontScale: setFontSizeScalePersisted,
    setLineSpacingScale: setLineSpacingScalePersisted,
    setVerseTextAlign: setVerseTextAlignPersisted,
    setVerseLayout: setVerseLayoutPersisted,
    setThemeId,
    readerVerseFontSize,
    readerVerseLineHeight,
    readerVerseBodyFontFamily,
  } = useReaderPreferences();
  const { fontScale: fontSizeScale, fontFamilyId: readerVerseBodyFontId, lineSpacingScale, verseTextAlign, verseLayout, themeId } =
    prefs;
  const colors = bundle.ui;
  const rc = bundle.reader;

  const chapterNumber = parseInt(chapterParam ?? "1", 10);
  const initialScrollVerse = useMemo(() => {
    if (typeof verseParam !== "string" || !verseParam.trim()) return null;
    const n = parseInt(verseParam, 10);
    return Number.isFinite(n) && n >= 1 ? n : null;
  }, [verseParam]);
  const pendingScrollVerseRef = useRef<number | null>(null);
  const verseDeepLinkSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [verseDeepLinkTabBarSuppress, setVerseDeepLinkTabBarSuppress] = useState(
    () => initialScrollVerse != null,
  );
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

  const {
    chapter,
    books,
    resolvedTranslationId,
    isContentSynced,
    isLoading: readerChapterLoading,
    error: readerChapterError,
  } = useReaderChapter(bookSlug ?? "", chapterNumber, requestedTranslationId);

  const {
    annotations,
    notes,
    removeAnnotationsFromVerses,
    applyAnnotationToVerses,
    persistNoteForVerse,
  } = useReaderStorage(chapter ?? undefined, resolvedTranslationId);

  const { items: translationPickerItems } = useTranslationPicker();
  const { favoriteTranslationIds, toggleFavoriteTranslation } = useFavoriteTranslations();

  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [readerPrivacyPolicyOpen, setReaderPrivacyPolicyOpen] = useState(false);
  const [readerTermsOpen, setReaderTermsOpen] = useState(false);
  const [readerCreditsOpen, setReaderCreditsOpen] = useState(false);
  const [readerChangelogsOpen, setReaderChangelogsOpen] = useState(false);
  const [dataBackupSheetOpen, setDataBackupSheetOpen] = useState(false);
  const [readerDataImportReloading, setReaderDataImportReloading] = useState(false);
  const [readerDataImportPicking, setReaderDataImportPicking] = useState(false);
  const [commentaryPanelOpen, setCommentaryPanelOpen] = useState(false);
  const mobileSettingsFollowUpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetFollowUpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fontSettingsSheetOpen, setFontSettingsSheetOpen] = useState(false);
  const [moreSettingsSheetOpen, setMoreSettingsSheetOpen] = useState(false);
  const [deleteMyDataDialogOpen, setDeleteMyDataDialogOpen] = useState(false);
  const [activeYvpFootnote, setActiveYvpFootnote] = useState<YvpFootnoteBody | null>(null);
  const [readerDropdown, setReaderDropdown] = useState<ReaderToolsDropdown | null>(null);
  const [dropdownAnchor, setDropdownAnchor] = useState<LayoutRectangle | null>(null);

  const bookFanRef = useRef<View | null>(null);
  const settingsButtonRef = useRef<View | null>(null);
  const fontSettingsButtonRef = useRef<View | null>(null);
  const selectionBannerAnchorRef = useRef<View | null>(null);
  const selectionBannerLiveRef = useRef<View | null>(null);
  const clearVerseSelectionRef = useRef<(() => void) | null>(null);
  const dismissVerseSelection = useCallback(() => {
    clearVerseSelectionRef.current?.();
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        dismissVerseSelection();
      };
    }, [dismissVerseSelection]),
  );

  const headerToolsGroupRef = useRef<View | null>(null);
  const chapterNavPrevArrowRef = useRef<View | null>(null);
  const chapterNavNextArrowRef = useRef<View | null>(null);
  const [headerToolsLayoutEpoch, setHeaderToolsLayoutEpoch] = useState(0);
  const translationFanRef = useRef<View | null>(null);
  const themesFanRef = useRef<View | null>(null);

  const dropSlideAnim = useRef(new Animated.Value(0)).current;
  const dropOpacityAnim = useRef(new Animated.Value(0)).current;
  /** When false, vertical list has scrolled — swipe-to-dismiss stays off so scrolling wins. */
  /** True from the moment the sheet close animation starts until `closeReaderDropdown` runs — shows native header chrome during the slide-out. */
  const [bookSheetExitAnimationStarted, setBookSheetExitAnimationStarted] = useState(false);
  const readerVersesOpacityAnim = useRef(new Animated.Value(1)).current;
  /** True after translation switch desync — not used for same-translation chapter navigation. */
  const readerVersesHadDesyncRef = useRef(false);
  const readerDataImportReloadingRef = useRef(false);
  const readerDataImportPickingRef = useRef(false);
  const readerDataImportSkipDoneRef = useRef(false);
  const readerChapterScrollKeyRef = useRef("");

  const [newEntrySheetOpen, setNewEntrySheetOpen] = useState(false);
  const [newEntrySheetKey, setNewEntrySheetKey] = useState(0);
  const [newEntryInitialParams, setNewEntryInitialParams] =
    useState<JournalNewEntryInitialParams | null>(null);
  const [selectionActivity, setSelectionActivity] = useState<ReaderSelectionActivity>(() => ({
    selectedVerses: [],
    noteModalVisible: false,
  }));
  const handleSelectionActivityChange = useCallback((activity: ReaderSelectionActivity) => {
    setSelectionActivity((prev) => {
      if (
        prev.noteModalVisible === activity.noteModalVisible &&
        prev.selectedVerses.length === activity.selectedVerses.length &&
        prev.selectedVerses.every((verse, index) => verse === activity.selectedVerses[index])
      ) {
        return prev;
      }
      return activity;
    });
  }, []);
  const { selectedVerses, noteModalVisible } = selectionActivity;
  const readerScrollRef = useRef<ReaderChapterScrollHandle | null>(null);
  /** Drives cross-fade between in-content heading and stack header title (UI-thread scroll). */
  const readerScrollY = useSharedValue(0);
  const lastScrollBridgeY = useSharedValue(-1);
  const latestScrollMetricsRef = useRef({ y: 0, contentHeight: 0, viewportHeight: 0 });
  const [readerPageHeadingHeight, setReaderPageHeadingHeight] = useState(96);
  const onReaderPageHeadingLayout = useCallback((height: number) => {
    setReaderPageHeadingHeight((prev) => (Math.abs(prev - height) > 1 ? height : prev));
  }, []);
  const readerHeadingFadeEndPx = Math.max(40, Math.round(readerPageHeadingHeight * 0.82));
  const readerPageHeadingAnimatedStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(
        readerScrollY.value,
        [0, readerHeadingFadeEndPx],
        [1, 0],
        Extrapolation.CLAMP,
      ),
    }),
    [readerHeadingFadeEndPx],
  );
  const readerHeaderTitleAnimatedStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(
        readerScrollY.value,
        [0, readerHeadingFadeEndPx],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    }),
    [readerHeadingFadeEndPx],
  );
  const newEntryFormRef = useRef<JournalNewEntryFormHandle | null>(null);
  const newEntrySheetRef = useRef<JournalNewEntrySheetHandle | null>(null);

  const readerSettingsSlideProgress = useRef(new Animated.Value(0)).current;
  const readerSettingsMenuDragStartProgressRef = useRef(1);
  const readerSettingsMenuDragLastProgressRef = useRef(1);
  /** Tablet: content slide distance. Phone: side sheet width (onboarding fallback only). */
  const settingsPanelWidthPx = useMemo(() => {
    if (isTabletReaderLayout) {
      const r =
        windowWidth > windowHeight
          ? READER_MOBILE_SETTINGS_TABLET_LANDSCAPE_SLIDE_RATIO
          : READER_MOBILE_SETTINGS_TABLET_PORTRAIT_SLIDE_RATIO;
      return windowWidth * r;
    }
    return readerSettingsSideSheetWidthPx(windowWidth);
  }, [isTabletReaderLayout, windowWidth, windowHeight]);

  const readerMobileSettingsSlideTranslateX = useMemo(
    () =>
      readerSettingsSlideProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, settingsPanelWidthPx],
      }),
    [readerSettingsSlideProgress, settingsPanelWidthPx],
  );

  useEffect(() => {
    if (!isTabletReaderLayout) {
      readerSettingsSlideProgress.setValue(0);
      return;
    }
    readerSettingsSlideProgress.stopAnimation();
    Animated.timing(readerSettingsSlideProgress, {
      ...(toolsMenuOpen ? READER_SETTINGS_MENU_SPRING_OPEN : READER_SETTINGS_MENU_SPRING_CLOSE),
      toValue: toolsMenuOpen ? 1 : 0,
    }).start();
  }, [isTabletReaderLayout, toolsMenuOpen, readerSettingsSlideProgress]);

  useRegisterReaderSettingsSlideProgress(readerSettingsSlideProgress, isTabletReaderLayout);

  /** When orientation (or breakpoint) changes with the menu open, re-apply full slide so `translateX` matches the new distance. */
  const readerMenuSlidePxWhileOpenRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isTabletReaderLayout || !toolsMenuOpen) {
      readerMenuSlidePxWhileOpenRef.current = null;
      return;
    }
    const prev = readerMenuSlidePxWhileOpenRef.current;
    readerMenuSlidePxWhileOpenRef.current = settingsPanelWidthPx;
    if (prev != null && prev !== settingsPanelWidthPx) {
      readerSettingsSlideProgress.setValue(1);
    }
  }, [isTabletReaderLayout, toolsMenuOpen, settingsPanelWidthPx, readerSettingsSlideProgress]);

  useEffect(() => {
    return () => {
      if (mobileSettingsFollowUpTimeoutRef.current != null) {
        clearTimeout(mobileSettingsFollowUpTimeoutRef.current);
      }
    };
  }, []);

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
    pendingScrollVerseRef.current = initialScrollVerse;
  }, [bookSlug, chapterNumber, requestedTranslationId, initialScrollVerse]);

  const clearVerseDeepLinkSettleTimer = useCallback(() => {
    if (verseDeepLinkSettleTimerRef.current != null) {
      clearTimeout(verseDeepLinkSettleTimerRef.current);
      verseDeepLinkSettleTimerRef.current = null;
    }
  }, []);

  const scheduleVerseDeepLinkTabBarUnsuppress = useCallback(() => {
    clearVerseDeepLinkSettleTimer();
    verseDeepLinkSettleTimerRef.current = setTimeout(() => {
      verseDeepLinkSettleTimerRef.current = null;
      setVerseDeepLinkTabBarSuppress(false);
    }, VERSE_DEEP_LINK_TAB_BAR_SETTLE_MS);
  }, [clearVerseDeepLinkSettleTimer]);

  useEffect(() => {
    clearVerseDeepLinkSettleTimer();
    if (initialScrollVerse != null) {
      setVerseDeepLinkTabBarSuppress(true);
    } else {
      setVerseDeepLinkTabBarSuppress(false);
    }
  }, [bookSlug, chapterNumber, initialScrollVerse, clearVerseDeepLinkSettleTimer]);

  useEffect(() => () => clearVerseDeepLinkSettleTimer(), [clearVerseDeepLinkSettleTimer]);

  useEffect(() => {
    if (pendingScrollVerseRef.current != null) return;
    readerScrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    readerScrollY.value = 0;
    lastScrollBridgeY.value = -1;
  }, [bookSlug, chapterNumber, requestedTranslationId, readerScrollY, lastScrollBridgeY, initialScrollVerse]);

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

  const clearSheetFollowUpTimeout = useCallback(() => {
    if (sheetFollowUpTimeoutRef.current != null) {
      clearTimeout(sheetFollowUpTimeoutRef.current);
      sheetFollowUpTimeoutRef.current = null;
    }
  }, []);

  const scheduleSheetFollowUp = useCallback(
    (fn: () => void, delayMs = 0) => {
      clearSheetFollowUpTimeout();
      sheetFollowUpTimeoutRef.current = setTimeout(() => {
        sheetFollowUpTimeoutRef.current = null;
        fn();
      }, delayMs);
    },
    [clearSheetFollowUpTimeout],
  );

  useEffect(
    () => () => {
      clearMobileSettingsFollowUp();
      clearSheetFollowUpTimeout();
    },
    [clearMobileSettingsFollowUp, clearSheetFollowUpTimeout],
  );

  const closeToolsMenu = useCallback(() => {
    clearMobileSettingsFollowUp();
    setToolsMenuOpen(false);
    setFontSettingsSheetOpen(false);
    setMoreSettingsSheetOpen(false);
    setDeleteMyDataDialogOpen(false);
    setReaderDropdown(null);
    setDropdownAnchor(null);
  }, [clearMobileSettingsFollowUp]);

  const closeFontSettingsPopup = useCallback(() => {
    clearMobileSettingsFollowUp();
    setFontSettingsSheetOpen(false);
  }, [clearMobileSettingsFollowUp]);

  const closeMoreSettingsPopup = useCallback(() => {
    clearMobileSettingsFollowUp();
    setMoreSettingsSheetOpen(false);
  }, [clearMobileSettingsFollowUp]);

  const closeDeleteMyDataDialog = useCallback(() => {
    clearMobileSettingsFollowUp();
    setDeleteMyDataDialogOpen(false);
  }, [clearMobileSettingsFollowUp]);

  const openFontSettingsSheet = useCallback(() => {
    hapticLightImpact();
    if (!isTabletReaderLayout) return;
    setToolsMenuOpen(false);
    setReaderDropdown(null);
    setDropdownAnchor(null);
    setFontSettingsSheetOpen(true);
  }, [isTabletReaderLayout]);

  const openMobileReaderFontSettingsFromMenu = useCallback(() => {
    closeToolsMenu();
    scheduleAfterMobileReaderMenuClose(() => {
      setFontSettingsSheetOpen(true);
    });
  }, [closeToolsMenu, scheduleAfterMobileReaderMenuClose]);

  const openReaderFontSettingsFromAppBar = useCallback(() => {
    hapticLightImpact();
    dismissVerseSelection();
    setToolsMenuOpen(false);
    setReaderDropdown(null);
    setDropdownAnchor(null);
    setFontSettingsSheetOpen(true);
  }, [dismissVerseSelection]);

  const openMobileReaderMoreFromMenu = useCallback(() => {
    closeToolsMenu();
    scheduleAfterMobileReaderMenuClose(() => {
      setMoreSettingsSheetOpen(true);
    });
  }, [closeToolsMenu, scheduleAfterMobileReaderMenuClose]);

  const openCreditsFromMoreSheet = useCallback(() => {
    closeMoreSettingsPopup();
    scheduleSheetFollowUp(() => {
      setReaderCreditsOpen(true);
    });
  }, [closeMoreSettingsPopup, scheduleSheetFollowUp]);

  const openChangelogsFromMoreSheet = useCallback(() => {
    closeMoreSettingsPopup();
    scheduleSheetFollowUp(() => {
      setReaderChangelogsOpen(true);
    });
  }, [closeMoreSettingsPopup, scheduleSheetFollowUp]);

  const openDataBackupFromMoreSheet = useCallback(() => {
    closeMoreSettingsPopup();
    scheduleSheetFollowUp(() => {
      setDataBackupSheetOpen(true);
    });
  }, [closeMoreSettingsPopup, scheduleSheetFollowUp]);

  const openDataBackupFromDeleteReminder = useCallback(() => {
    closeDeleteMyDataDialog();
    scheduleSheetFollowUp(() => {
      setDataBackupSheetOpen(true);
    });
  }, [closeDeleteMyDataDialog, scheduleSheetFollowUp]);

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

  const openMobileReaderCommentaryFromMenu = useCallback(() => {
    closeToolsMenu();
    scheduleAfterMobileReaderMenuClose(() => {
      setCommentaryPanelOpen(true);
    });
  }, [closeToolsMenu, scheduleAfterMobileReaderMenuClose]);

  const openDeleteMyDataConfirmFromMenu = useCallback(() => {
    closeToolsMenu();
    scheduleAfterMobileReaderMenuClose(() => {
      setDeleteMyDataDialogOpen(true);
    });
  }, [closeToolsMenu, scheduleAfterMobileReaderMenuClose]);

  const confirmDeleteMyData = useCallback(async () => {
    await deleteAllUserData();
    router.replace("/");
  }, [router]);

  /** Close credits first so only one RN `Modal` is active; avoids stacking quirks and nested-Text press issues. */
  const openPrivacyPolicyFromCredits = useCallback(() => {
    setReaderCreditsOpen(false);
    scheduleSheetFollowUp(() => {
      setReaderPrivacyPolicyOpen(true);
    });
  }, [scheduleSheetFollowUp]);

  const openTermsFromCredits = useCallback(() => {
    setReaderCreditsOpen(false);
    scheduleSheetFollowUp(() => {
      setReaderTermsOpen(true);
    });
  }, [scheduleSheetFollowUp]);

  const readerSettingsMenuPanResponder = useMemo(() => {
    if (!isTabletReaderLayout) return PanResponder.create({});
    const maxSlide = settingsPanelWidthPx;
    const finishDrag = (g: PanResponderGestureState, menuOpen: boolean) => {
      if (!menuOpen) return;
      const p = readerSettingsMenuDragLastProgressRef.current;
      const shouldClose = p < 0.38 || (g.vx < -0.45 && p < 0.72);
      if (shouldClose) {
        closeToolsMenu();
      } else {
        Animated.timing(readerSettingsSlideProgress, {
          ...READER_SETTINGS_MENU_SPRING_OPEN,
          toValue: 1,
        }).start();
      }
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_e, gestureState) => {
        if (!toolsMenuOpen) return false;
        const { dx, dy } = gestureState;
        return dx < -10 && Math.abs(dx) > Math.abs(dy) * 1.15;
      },
      onMoveShouldSetPanResponder: (_e, gestureState) => {
        if (!toolsMenuOpen) return false;
        const { dx, dy } = gestureState;
        return dx < -10 && Math.abs(dx) > Math.abs(dy) * 1.15;
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
        const p = Math.min(1, Math.max(0, start + gestureState.dx / maxSlide));
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
  }, [
    closeToolsMenu,
    isTabletReaderLayout,
    readerSettingsSlideProgress,
    settingsPanelWidthPx,
    toolsMenuOpen,
  ]);

  const onboardingStepRef = useRef<ReaderOnboardingStep | null>(null);
  const completeOnboardingInteractionRef = useRef<() => void>(() => {});

  const handleOpenJournalFromSelection = useCallback((params: JournalNewEntryInitialParams) => {
    setNewEntryInitialParams(params);
    setNewEntrySheetKey((k) => k + 1);
    setNewEntrySheetOpen(true);
  }, []);

  const handleOpenStudyNotesFromSelection = useCallback(() => {
    setCommentaryPanelOpen(true);
  }, []);

  const handleYvpFootnotePress = useCallback(
    (noteId: number) => {
      const footnote = chapter?.yvpFootnotes?.[noteId];
      if (!footnote) return;
      setActiveYvpFootnote(footnote);
    },
    [chapter?.yvpFootnotes],
  );

  const closeNewEntrySheet = useCallback(() => {
    setNewEntrySheetOpen(false);
  }, []);

  const measureAndSetDropdown = useCallback(
    (ref: RefObject<View | null>, kind: ReaderToolsDropdown) => {
      if (!isTabletReaderLayout && (kind === "translation" || kind === "theme")) {
        return;
      }
      if (readerDropdown === kind) {
        setBookSheetExitAnimationStarted(false);
        setReaderDropdown(null);
        setDropdownAnchor(null);
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

  const openBookTools = useCallback(() => {
    hapticLightImpact();
    dismissVerseSelection();
    setToolsMenuOpen(false);
    setFontSettingsSheetOpen(false);
    setMoreSettingsSheetOpen(false);
    setBookSheetExitAnimationStarted(false);
    measureAndSetDropdown(bookFanRef, "book");
  }, [dismissVerseSelection, measureAndSetDropdown]);

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
        setMoreSettingsSheetOpen(false);
        setReaderDropdown(null);
        setDropdownAnchor(null);
        return false;
      }
      dismissVerseSelection();
      clearMobileSettingsFollowUp();
      setFontSettingsSheetOpen(false);
      setMoreSettingsSheetOpen(false);
      setDeleteMyDataDialogOpen(false);
      setReaderDropdown(null);
      setDropdownAnchor(null);
      return true;
    });
  }, [clearMobileSettingsFollowUp, dismissVerseSelection]);

  const closeReaderDropdown = useCallback(() => {
    clearMobileSettingsFollowUp();
    setBookSheetExitAnimationStarted(false);
    setReaderDropdown(null);
    setDropdownAnchor(null);
  }, [clearMobileSettingsFollowUp]);

  const dismissReaderChromeFromBackgroundPress = useCallback(() => {
    if (toolsMenuOpen) closeToolsMenu();
    else if (fontSettingsSheetOpen) closeFontSettingsPopup();
    else if (moreSettingsSheetOpen) closeMoreSettingsPopup();
    else if (dataBackupSheetOpen) setDataBackupSheetOpen(false);
    else if (deleteMyDataDialogOpen) closeDeleteMyDataDialog();
    else if (readerPrivacyPolicyOpen) setReaderPrivacyPolicyOpen(false);
    else if (readerCreditsOpen) setReaderCreditsOpen(false);
    else if (readerChangelogsOpen) setReaderChangelogsOpen(false);
    else if (commentaryPanelOpen) setCommentaryPanelOpen(false);
    else if (readerDropdown === "translation" || readerDropdown === "theme") closeReaderDropdown();
  }, [
    toolsMenuOpen,
    closeToolsMenu,
    fontSettingsSheetOpen,
    closeFontSettingsPopup,
    moreSettingsSheetOpen,
    closeMoreSettingsPopup,
    dataBackupSheetOpen,
    deleteMyDataDialogOpen,
    closeDeleteMyDataDialog,
    readerPrivacyPolicyOpen,
    readerCreditsOpen,
    readerChangelogsOpen,
    commentaryPanelOpen,
    readerDropdown,
    closeReaderDropdown,
  ]);

  const onReaderScrollBeginDrag = useCallback(() => {
    dismissReaderChromeFromBackgroundPress();
  }, [dismissReaderChromeFromBackgroundPress]);

  useEffect(() => {
    if (!toolsMenuOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeToolsMenu();
      return true;
    });
    return () => sub.remove();
  }, [toolsMenuOpen, closeToolsMenu]);

  const isReaderContentCurrent = Boolean(
    isContentSynced && books && resolvedTranslationId,
  );

  const isTranslationSwitching = Boolean(
    resolvedTranslationId && requestedTranslationId !== resolvedTranslationId,
  );

  const isChapterContentTransitioning = isTranslationSwitching || readerDataImportReloading;

  const chapterTransitionPhase = useReaderChapterTransitionPhase(isChapterContentTransitioning, {
    skipDoneRef: readerDataImportSkipDoneRef,
  });

  const importOverlayActive =
    readerDataImportPicking ||
    readerDataImportReloading ||
    readerDataImportReloadingRef.current;

  const importOverlayPhase = importOverlayActive
    ? chapterTransitionPhase === "idle"
      ? "loading"
      : chapterTransitionPhase
    : "idle";

  useEffect(() => {
    const unsubPickingBegin = subscribeReaderDataImportPickingBegin(() => {
      readerDataImportPickingRef.current = true;
      unstable_batchedUpdates(() => {
        setReaderDataImportPicking(true);
      });
    });
    const unsubPickingEnd = subscribeReaderDataImportPickingEnd(() => {
      readerDataImportPickingRef.current = false;
      setReaderDataImportPicking(false);
    });
    const unsubBegin = subscribeReaderDataImportBegin(() => {
      readerDataImportReloadingRef.current = true;
      unstable_batchedUpdates(() => {
        setReaderDataImportReloading(true);
      });
    });
    const unsubEnd = subscribeReaderDataImportEnd(() => {
      readerDataImportReloadingRef.current = false;
      setReaderDataImportReloading(false);
    });
    const unsubAbort = subscribeReaderDataImportAbort(() => {
      readerDataImportSkipDoneRef.current = true;
      readerDataImportReloadingRef.current = false;
      setReaderDataImportReloading(false);
      readerVersesOpacityAnim.stopAnimation();
      readerVersesOpacityAnim.setValue(1);
    });
    return () => {
      unsubPickingBegin();
      unsubPickingEnd();
      unsubBegin();
      unsubEnd();
      unsubAbort();
    };
  }, [readerVersesOpacityAnim]);

  useEffect(() => {
    if (isChapterContentTransitioning) {
      readerVersesHadDesyncRef.current = true;
      readerVersesOpacityAnim.stopAnimation();
      readerVersesOpacityAnim.setValue(0);
      return;
    }

    if (chapterTransitionPhase !== "idle") {
      readerVersesOpacityAnim.stopAnimation();
      readerVersesOpacityAnim.setValue(0);
      return;
    }

    if (!isReaderContentCurrent) {
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
  }, [
    isReaderContentCurrent,
    isChapterContentTransitioning,
    chapterTransitionPhase,
    readerVersesOpacityAnim,
  ]);

  const chapterNav = useMemo(() => {
    if (!chapter || !books) {
      return { prevChapter: null as ChapterNavTarget | null, nextChapter: null as ChapterNavTarget | null };
    }
    const slug = bookSlug ?? "";
    const tid = resolvedTranslationId;
    const synced =
      chapter.bookSlug === slug && chapter.chapterNumber === chapterNumber && tid === requestedTranslationId;
    const navChapter: BibleChapter = synced
      ? chapter
      : {
          bookName: books.find((b) => b.slug === slug)?.name ?? chapter.bookName,
          bookSlug: slug,
          chapterNumber,
          verses: chapter.verses,
          ...(chapter.verseInlineContent ? { verseInlineContent: chapter.verseInlineContent } : {}),
        };
    return getReaderChapterNeighbors(books, navChapter, chapterNumber);
  }, [chapter, books, resolvedTranslationId, bookSlug, chapterNumber, requestedTranslationId]);

  const chapterNavRouteKey = `${bookSlug ?? ""}:${chapterNumber}:${requestedTranslationId}`;
  const chapterNavArrowsOverlayOpen =
    toolsMenuOpen ||
    fontSettingsSheetOpen ||
    moreSettingsSheetOpen ||
    dataBackupSheetOpen ||
    deleteMyDataDialogOpen ||
    readerDropdown != null ||
    readerPrivacyPolicyOpen ||
    readerCreditsOpen ||
    readerChangelogsOpen ||
    noteModalVisible ||
    newEntrySheetOpen;
  const chapterNavArrowsEnabled =
    !chapterNavArrowsOverlayOpen &&
    selectedVerses.length === 0 &&
    (chapterNav.prevChapter != null || chapterNav.nextChapter != null) &&
    resolvedTranslationId === requestedTranslationId;

  const goToPrevChapter = useCallback(() => {
    const target = chapterNav.prevChapter;
    if (!target) return;
    const tid = resolvedTranslationId ?? requestedTranslationId;
    primeReaderChapterFetch(tid, target, books);
    if (books) {
      primeReaderChapterFetch(
        tid,
        getReaderChapterNeighbors(
          books,
          { bookSlug: target.slug, chapterNumber: target.chapter },
          target.chapter,
        ).prevChapter,
        books,
      );
    }
    closeToolsMenu();
    goToReaderChapter(target.slug, target.chapter, tid);
  }, [
    chapterNav.prevChapter,
    closeToolsMenu,
    goToReaderChapter,
    books,
    resolvedTranslationId,
    requestedTranslationId,
  ]);

  const goToNextChapter = useCallback(() => {
    const target = chapterNav.nextChapter;
    if (!target) return;
    const tid = resolvedTranslationId ?? requestedTranslationId;
    primeReaderChapterFetch(tid, target, books);
    if (books) {
      primeReaderChapterFetch(
        tid,
        getReaderChapterNeighbors(
          books,
          { bookSlug: target.slug, chapterNumber: target.chapter },
          target.chapter,
        ).nextChapter,
        books,
      );
    }
    closeToolsMenu();
    goToReaderChapter(target.slug, target.chapter, tid);
  }, [
    chapterNav.nextChapter,
    closeToolsMenu,
    goToReaderChapter,
    books,
    resolvedTranslationId,
    requestedTranslationId,
  ]);

  const readerTabletLandscapeTwoColumn =
    chapter != null && isReaderTabletLandscapeTwoColumn(windowWidth, windowHeight);

  /** Paragraph mode always uses a single flowing column — two-column split truncates scroll at ~half the chapter. */
  const verseListUsesTwoColumn =
    readerTabletLandscapeTwoColumn && verseLayout !== "paragraph";

  const readerTwoColumnSplitIndex = useMemo(
    () => (chapter ? splitVerseIndexForBalancedColumns(chapter.verses) : 0),
    [chapter],
  );

  const verseFlashListData = useMemo((): ReaderVerseFlashItem[] => {
    if (!chapter) return [];
    return buildReaderVerseFlashListData(
      chapter.verses,
      verseListUsesTwoColumn,
      readerTwoColumnSplitIndex,
      chapter.verseInlineContent,
      verseLayout,
    );
  }, [chapter, verseListUsesTwoColumn, readerTwoColumnSplitIndex, verseLayout]);

  const verseFlashListDataForList = useMemo(
    () => (isTranslationSwitching ? [] : verseFlashListData),
    [isTranslationSwitching, verseFlashListData],
  );

  const readerChapterScrollKey = `${bookSlug ?? ""}:${chapterNumber}:${requestedTranslationId}`;
  useEffect(() => {
    if (!isReaderContentCurrent || isTranslationSwitching) return;
    if (readerChapterScrollKeyRef.current === readerChapterScrollKey) return;
    readerChapterScrollKeyRef.current = readerChapterScrollKey;
    requestAnimationFrame(() => {
      readerScrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [isReaderContentCurrent, isTranslationSwitching, readerChapterScrollKey]);

  /** Typical single-line verse row height; FlashList v2 measures real layouts (no `estimatedItemSize` prop). */
  const readerVerseEstimatedItemSize = readerVerseEstimatedFlashListItemSizePx(readerVerseLineHeight);

  useEffect(() => {
    const targetVerse = pendingScrollVerseRef.current;
    if (targetVerse == null || !isReaderContentCurrent || verseFlashListDataForList.length === 0) {
      return;
    }
    // Paragraph ScrollView scroll-to-verse is phase 4; FlashList path only (line-by-line).
    if (verseLayout === "paragraph") {
      return;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        const flashListRef = readerScrollRef.current?.getFlashListRef?.() ?? null;
        const didScroll = scrollReaderFlashListToVerseCentered(
          flashListRef,
          verseFlashListDataForList,
          targetVerse,
          readerVerseEstimatedItemSize,
          { animated: true },
        );
        if (didScroll) {
          pendingScrollVerseRef.current = null;
          scheduleVerseDeepLinkTabBarUnsuppress();
        }
      });
    });

    return () => task.cancel();
  }, [
    isReaderContentCurrent,
    verseFlashListDataForList,
    bookSlug,
    chapterNumber,
    initialScrollVerse,
    readerVerseEstimatedItemSize,
    scheduleVerseDeepLinkTabBarUnsuppress,
    verseLayout,
  ]);

  const readerChapterFlashListFooter = useCallback(() => {
    if (resolvedTranslationId !== requestedTranslationId) return null;
    return (
      <Animated.View style={{ opacity: readerVersesOpacityAnim }}>
        <Pressable
          onPress={dismissReaderChromeFromBackgroundPress}
          style={{ height: READER_CHAPTER_FOOTER_ABOVE_TAB_BAR_PX }}
          android_ripple={null}
          accessible={false}
        />
      </Animated.View>
    );
  }, [
    resolvedTranslationId,
    requestedTranslationId,
    readerVersesOpacityAnim,
    dismissReaderChromeFromBackgroundPress,
  ]);

  const readerOverlayOpen =
    toolsMenuOpen ||
    fontSettingsSheetOpen ||
    moreSettingsSheetOpen ||
    dataBackupSheetOpen ||
    deleteMyDataDialogOpen ||
    readerDropdown != null ||
    readerPrivacyPolicyOpen ||
    readerCreditsOpen ||
    readerChangelogsOpen ||
    noteModalVisible ||
    newEntrySheetOpen;

  const readerAndroidTopToolsTopPx = Math.max(insets.top, 8) + 2;
  const readerAndroidAppBarBottomPx = readerAndroidTopToolsTopPx + READER_M3_APP_BAR_CONTENT_HEIGHT_PX;

  /** Below stack header / in-screen app bar so the toast is not under native header touch targets. */
  const selectionBannerTopPx =
    (Platform.OS === "ios"
      ? insets.top + 44 + 10
      : readerAndroidAppBarBottomPx + 10) +
    (isTabletLayout(windowWidth, windowHeight) ? 55 : 0);

  /**
   * Top inset for the book/settings pill when it lives in the left settings rail (iOS phone).
   */
  const readerMobileSettingsToolsTopPx =
    Platform.OS === "ios" ? insets.top + 4 : readerAndroidTopToolsTopPx;

  /**
   * First settings destination row — below the app bar on Android, or embedded header tools on iOS phone.
   */
  const readerMobileSettingsScrollPaddingTop = isTabletReaderLayout
    ? Platform.OS === "android"
      ? readerAndroidAppBarBottomPx + 22
      : (Platform.OS === "ios"
          ? insets.top + 44 + 12
          : Math.max(insets.top + 56, readerAndroidTopToolsTopPx + 44 + 12)) +
        10 +
        10
    : Platform.OS === "android"
      ? readerAndroidAppBarBottomPx + 10
      : readerMobileSettingsToolsTopPx + 44 + 10;

  const actionBarBottomPx = readerActionBarBottomPx(insets.bottom, false);

  const actionBarBottomPxHidden =
    Platform.OS === "android" ? readerActionBarBottomPx(insets.bottom, true) : actionBarBottomPx;

  const readerTabBarScrollHidden = useReaderTabBarScrollHidden();

  const bumpHeaderToolsLayoutEpoch = useCallback(() => {
    setHeaderToolsLayoutEpoch((epoch) => epoch + 1);
  }, []);

  const readerFeatureOnboarding = useReaderFeatureOnboarding({
    readerContentReady: !readerChapterLoading && readerChapterError == null && chapter != null,
    readerOverlayOpen,
    headerToolsGroupRef,
    bookButtonRef: bookFanRef,
    settingsButtonRef,
    fontButtonRef: fontSettingsButtonRef,
    selectionBannerRef: selectionBannerLiveRef,
    chapterNavPrevArrowRef,
    chapterNavNextArrowRef,
    headerToolsLayoutEpoch,
    insets,
    screenW: windowWidth,
    screenH: windowHeight,
    hasPrevChapter: chapterNav.prevChapter != null,
    hasNextChapter: chapterNav.nextChapter != null,
    selectionBannerTopPx,
    androidTopToolsTopPx: readerAndroidTopToolsTopPx,
    headerToolsTopPx: readerMobileSettingsToolsTopPx,
    isNavigationRailLayout: !isTabletReaderLayout,
    toolsOnLeft: true,
    selectedVerseCount: selectedVerses.length,
    onTourComplete: () => clearVerseSelectionRef.current?.(),
  });

  onboardingStepRef.current = readerFeatureOnboarding.currentStep;
  completeOnboardingInteractionRef.current = readerFeatureOnboarding.completeInteractionStep;

  const scrollToTopFabEnabled =
    !chapterNavArrowsOverlayOpen &&
    selectedVerses.length === 0 &&
    !readerFeatureOnboarding.showLayer &&
    resolvedTranslationId === requestedTranslationId;

  const tabBarAutoHideForceVisible =
    (fontSettingsSheetOpen ||
      moreSettingsSheetOpen ||
      dataBackupSheetOpen ||
      deleteMyDataDialogOpen ||
      readerDropdown != null ||
      readerPrivacyPolicyOpen ||
      readerCreditsOpen ||
    readerChangelogsOpen ||
      noteModalVisible ||
      newEntrySheetOpen) ||
    selectedVerses.length > 0 ||
    readerFeatureOnboarding.showLayer ||
    verseDeepLinkTabBarSuppress;

  const {
    contentHeightSV,
    viewportHeightSV,
    onTabBarContentSizeChange,
    onTabBarListLayout,
  } = useReaderTabBarScrollDriver({
    chapterRouteKey: chapterNavRouteKey,
    enabled: Platform.OS === "android",
    forceVisible: tabBarAutoHideForceVisible,
    readerScrollY,
  });

  const {
    opacityAnim: chapterNavArrowsOpacityAnim,
    scaleAnim: chapterNavArrowsScaleAnim,
    pointerEventsEnabled: chapterNavArrowsPointerEventsEnabled,
    onScrollBeginDrag: onChapterNavArrowsScrollBeginDrag,
    onScrollEndDrag: onChapterNavArrowsScrollEndDrag,
    onMomentumScrollEnd: onChapterNavArrowsMomentumScrollEnd,
    onScroll: onChapterNavArrowsScroll,
    hideFromMotion: hideChapterNavArrowsFromMotion,
  } = useReaderChapterNavArrowsVisibility(
    chapterNavRouteKey,
    chapterNavArrowsEnabled,
    readerFeatureOnboarding.forceChapterNavArrowsVisible,
  );

  const {
    opacityAnim: scrollToTopFabOpacityAnim,
    scaleAnim: scrollToTopFabScaleAnim,
    pointerEventsEnabled: scrollToTopFabPointerEventsEnabled,
    onScrollBeginDrag: onScrollToTopFabScrollBeginDrag,
    onScrollEndDrag: onScrollToTopFabScrollEndDrag,
    onMomentumScrollEnd: onScrollToTopFabMomentumScrollEnd,
    onScrollBridge: onScrollToTopFabBridge,
    hideFab: hideScrollToTopFab,
    onFabPressIn: onScrollToTopFabPressIn,
    onFabPressOut: onScrollToTopFabPressOut,
    syncFromScrollOffset: syncScrollToTopFabFromOffset,
  } = useReaderScrollToTopFabVisibility(chapterNavRouteKey, scrollToTopFabEnabled);

  useEffect(() => {
    if (!scrollToTopFabEnabled) return;
    let cancelled = false;
    const syncFabWithCurrentScroll = () => {
      if (cancelled) return;
      const y = Math.max(latestScrollMetricsRef.current.y, readerScrollY.value);
      syncScrollToTopFabFromOffset(y, { revealWhenIdle: true });
    };
    syncFabWithCurrentScroll();
    const frame = requestAnimationFrame(syncFabWithCurrentScroll);
    const timeout = setTimeout(syncFabWithCurrentScroll, 150);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [scrollToTopFabEnabled, chapterNavRouteKey, syncScrollToTopFabFromOffset]);

  const publishReaderScrollMetrics = useCallback(
    (y: number, contentHeight: number, viewportHeight: number) => {
      latestScrollMetricsRef.current = { y, contentHeight, viewportHeight };
      lastScrollBridgeY.value = y;
      const nativeEvent = {
        contentOffset: { y, x: 0 },
        contentSize: { height: contentHeight, width: 0 },
        layoutMeasurement: { height: viewportHeight, width: 0 },
      } as NativeScrollEvent;
      onChapterNavArrowsScroll({ nativeEvent } as NativeSyntheticEvent<NativeScrollEvent>);
      onScrollToTopFabBridge(y);
    },
    [lastScrollBridgeY, onChapterNavArrowsScroll, onScrollToTopFabBridge],
  );

  const onReaderScrollSideEffects = useCallback(
    (y: number, contentHeight: number, viewportHeight: number) => {
      publishReaderScrollMetrics(y, contentHeight, viewportHeight);
    },
    [publishReaderScrollMetrics],
  );

  const scrollReaderToTop = useCallback(() => {
    readerScrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    readerScrollY.value = 0;
    lastScrollBridgeY.value = 0;
    const { contentHeight, viewportHeight } = latestScrollMetricsRef.current;
    syncScrollToTopFabFromOffset(0);
    onReaderScrollSideEffects(0, contentHeight, viewportHeight);
    hideScrollToTopFab();
  }, [
    readerScrollY,
    lastScrollBridgeY,
    syncScrollToTopFabFromOffset,
    onReaderScrollSideEffects,
    hideScrollToTopFab,
  ]);

  const flushReaderScrollSideEffects = useCallback(() => {
    const { y, contentHeight, viewportHeight } = latestScrollMetricsRef.current;
    onReaderScrollSideEffects(y, contentHeight, viewportHeight);
    lastScrollBridgeY.value = y;
  }, [onReaderScrollSideEffects, lastScrollBridgeY]);

  const onReaderScrollBeginDragWithChapterNav = useCallback(() => {
    onReaderScrollBeginDrag();
    onChapterNavArrowsScrollBeginDrag();
    onScrollToTopFabScrollBeginDrag();
    flushReaderScrollSideEffects();
  }, [
    onReaderScrollBeginDrag,
    onChapterNavArrowsScrollBeginDrag,
    onScrollToTopFabScrollBeginDrag,
    flushReaderScrollSideEffects,
  ]);

  const onReaderScrollEndDragWithChapterNav = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      publishReaderScrollMetrics(
        contentOffset.y,
        contentSize.height,
        layoutMeasurement.height,
      );
      onChapterNavArrowsScrollEndDrag(event);
      onScrollToTopFabScrollEndDrag(event);
    },
    [
      publishReaderScrollMetrics,
      onChapterNavArrowsScrollEndDrag,
      onScrollToTopFabScrollEndDrag,
    ],
  );

  const onReaderMomentumScrollEndWithChapterNav = useCallback(() => {
    const y = readerScrollY.value;
    const { contentHeight, viewportHeight } = latestScrollMetricsRef.current;
    publishReaderScrollMetrics(y, contentHeight, viewportHeight);
    onChapterNavArrowsMomentumScrollEnd();
    onScrollToTopFabMomentumScrollEnd();
  }, [
    readerScrollY,
    publishReaderScrollMetrics,
    onChapterNavArrowsMomentumScrollEnd,
    onScrollToTopFabMomentumScrollEnd,
  ]);

  const onReaderScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      readerScrollY.value = y;
      contentHeightSV.value = event.contentSize.height;
      viewportHeightSV.value = event.layoutMeasurement.height;
      const contentHeight = event.contentSize.height;
      const viewportHeight = event.layoutMeasurement.height;
      if (shouldFireHighRefreshJsBridge(y, lastScrollBridgeY.value)) {
        lastScrollBridgeY.value = y;
        runOnJS(onReaderScrollSideEffects)(y, contentHeight, viewportHeight);
      }
    },
  });

  const chapterSwipePan = useMemo(() => {
    const tid = resolvedTranslationId;
    if (!tid) return noopChapterSwipePan;
    const { prevChapter, nextChapter } = chapterNav;
    const releaseThresholdPx = Platform.OS === "android" ? 72 : 52;
    const tryChapterSwipeNavigate = (g: PanResponderGestureState) => {
      if (!chapterSwipeReleaseShouldNavigate(g, releaseThresholdPx)) return;
      if (g.dx <= -releaseThresholdPx && nextChapter) {
        primeReaderChapterFetch(tid, nextChapter, books);
        goToReaderChapter(nextChapter.slug, nextChapter.chapter, tid);
      } else if (g.dx >= releaseThresholdPx && prevChapter) {
        primeReaderChapterFetch(tid, prevChapter, books);
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
  }, [chapterNav, resolvedTranslationId, books, goToReaderChapter, hideChapterNavArrowsFromMotion]);

  if (readerChapterError) {
    const errorMessage =
      readerChapterError === "not_downloaded_offline"
        ? "This translation isn't downloaded for offline use."
        : readerChapterError === "load_failed"
          ? "Couldn't load this chapter. Check your connection and try again."
          : "Chapter not found.";
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: rc.sceneSurface }}>
        <Text style={{ fontFamily: "Inter_400Regular", color: colors.tan300, textAlign: "center" }}>
          {errorMessage}
        </Text>
      </View>
    );
  }

  if (readerChapterLoading || !chapter || !books || !resolvedTranslationId) {
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
  const readerHeaderLanguageLabel = getReaderTranslationLanguageLabel(
    readerHeaderTranslationId,
    translationPickerItems,
  );
  const readerHeaderTranslationLabel = getTranslationDisplayAbbreviation(
    readerHeaderTranslationId,
    translationPickerItems,
  );

  const readerChapterPageHeading = (
    <Reanimated.View
      style={[readerFlashListChromeStyles.pageHeading, readerPageHeadingAnimatedStyle]}
      onLayout={(e) => onReaderPageHeadingLayout(e.nativeEvent.layout.height)}
    >
      <Text
        style={[readerFlashListChromeStyles.pageHeadingTranslation, { fontFamily: "Inter_400Regular", color: colors.gold }]}
      >
        {readerHeaderTranslationLabel} ({readerHeaderLanguageLabel})
      </Text>
      <Text
        style={{ fontFamily: "Lora_400Regular", fontSize: 36, lineHeight: 42, color: colors.brown800 }}
        numberOfLines={2}
      >
        {readerHeaderBookName}
      </Text>
      <Text
        style={[readerFlashListChromeStyles.pageHeadingChapter, { fontFamily: "Inter_400Regular", color: colors.tan200 }]}
      >
        {formatReaderChapterHeading(readerHeaderLanguageLabel, chapterNumber)}
      </Text>
    </Reanimated.View>
  );

  const { prevChapter, nextChapter } = chapterNav;

  /**
   * Do not tie chapter swipes to `isReaderContentCurrent`: after `setParams`, the route updates
   * immediately but chapter data is still the previous chapter until the async load finishes.
   * That made `noop` pan handlers run so the next swipe did nothing (often read as “one swipe only”).
   * `chapterNav` already uses URL params for neighbors while payload catches up.
   */
  const chapterSwipePanHandlers = (readerOverlayOpen ? noopChapterSwipePan : chapterSwipePan).panHandlers;

  /** Book picker sheet: 20px gap above the bottom safe area (full-window overlay; not tab-bar offset). */
  const readerBookSheetBottomPx = insets.bottom + 20;
  /**
   * Extra gap above the tab bar so the sheet clears the floating tab pill. Phones use a larger lift;
   * tablets need less or the in-card layout leaves a big empty band above the save row.
   */
  const readerNewEntrySheetBottomLiftPx = isTabletLayout(windowWidth, windowHeight) ? 12 : 50;

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
  /** Keep a floor so theme/translation popovers always get a sane width (avoids 0‑width tiles when `screenW` is briefly 0). */
  const readerDropdownMaxW = Math.min(340, Math.max(200, screenW - 24));
  const fontSettingsPopupPadH = 16;
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
  const readerHeaderToolsHidden = readerDropdown === "book" && !bookSheetExitAnimationStarted;

  const androidAppBarRipple = bundle.chrome.androidRipple;

  const readerSettingsToolsRow =
    Platform.OS === "android" ? (
      <ReaderM3IconButton
        buttonRef={settingsButtonRef}
        onPress={toggleToolsMenu}
        accessibilityLabel={toolsMenuOpen ? "Close reader tools" : "Reader settings"}
        accessibilityState={{ expanded: toolsMenuOpen }}
        selected={toolsMenuOpen}
        rippleColor={androidAppBarRipple}
        suppressHaptic
      >
        <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center", transform: [{ translateX: 2 }, { translateY: -4 }] }}>
          <ReaderSettingsCogIcon size={26} color={colors.brown800} />
        </View>
      </ReaderM3IconButton>
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
          <ReaderSettingsCogIcon size={26} color={colors.brown800} />
        </View>
      </Pressable>
    </View>
    );

  const readerHeaderBookButton =
    Platform.OS === "android" ? (
      <ReaderM3IconButton
        buttonRef={bookFanRef}
        onPress={openBookTools}
        accessibilityLabel={readerDropdown === "book" ? "Close book list" : "Choose a Bible book"}
        accessibilityState={{ selected: readerDropdown === "book" }}
        selected={readerDropdown === "book"}
        rippleColor={androidAppBarRipple}
        suppressHaptic
      >
        <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center", transform: [{ translateY: -4 }] }}>
          <BibleBookIcon
            size={21}
            color={readerDropdown === "book" ? colors.gold : colors.brown800}
          />
        </View>
      </ReaderM3IconButton>
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
            color={readerDropdown === "book" ? colors.gold : colors.brown800}
          />
        </View>
      </Pressable>
    </View>
    );

  const readerHeaderFontButton =
    Platform.OS === "android" ? (
      <ReaderM3IconButton
        buttonRef={fontSettingsButtonRef}
        onPress={openReaderFontSettingsFromAppBar}
        accessibilityLabel="Font settings"
        selected={fontSettingsSheetOpen}
        rippleColor={androidAppBarRipple}
        suppressHaptic
      >
        <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>
          <ReaderFontSettingsIcon size={24} color={colors.brown800} />
        </View>
      </ReaderM3IconButton>
    ) : null;

  const readerHeaderToolsGroup = (
    <View
      ref={headerToolsGroupRef}
      collapsable={false}
      onLayout={bumpHeaderToolsLayoutEpoch}
      className="flex-row items-center rounded-full"
      style={{
        height: 44,
        width: 92,
        justifyContent: "space-evenly",
        paddingHorizontal: Platform.OS === "android" ? 2 : 0,
        gap: 0,
        backgroundColor:
          Platform.OS === "android" ? rc.sceneSurface : "transparent",
        borderWidth: 0,
        marginRight: 0,
        marginLeft: 0,
      }}
    >
      {readerHeaderBookButton}
      {readerSettingsToolsRow}
    </View>
  );

  const readerSettingsPanelProps = {
    insets,
    scrollPaddingTop: readerMobileSettingsScrollPaddingTop,
    padH: fontSettingsPopupPadH,
    isTabletReaderLayout,
    screenWidth: windowWidth,
    toolsMenuOpen,
    onCloseToolsMenu: closeToolsMenu,
    headerTools: Platform.OS === "android" ? null : readerHeaderToolsGroup,
    hideFontSettings: Platform.OS === "android",
    onSelectFontSettings:
      Platform.OS === "android" ? undefined : openMobileReaderFontSettingsFromMenu,
    onSelectThemes: openMobileReaderThemesFromMenu,
    onSelectMore: openMobileReaderMoreFromMenu,
    onSelectTranslation: openMobileReaderTranslationFromMenu,
    onSelectCommentary: openMobileReaderCommentaryFromMenu,
    onSelectDeleteMyData: openDeleteMyDataConfirmFromMenu,
    panelBackgroundColor: rc.sceneSurface,
    rippleColor: Platform.OS === "android" ? androidAppBarRipple : undefined,
    /** Match the journal settings panel everywhere — always the M3 side sheet, never the tablet slide-aside panel. */
    forceSideSheet: true,
  };
  const readerSettingsUsesTabletSlidePanel = false;

  return (
    <View style={{ flex: 1, backgroundColor: rc.sceneSurface, overflow: "visible" }}>
      <ReaderMobileSettingsPanel {...readerSettingsPanelProps} />
      <Animated.View
        {...(readerSettingsUsesTabletSlidePanel && toolsMenuOpen ? readerSettingsMenuPanResponder.panHandlers : {})}
        pointerEvents={readerSettingsUsesTabletSlidePanel && toolsMenuOpen ? "box-none" : "auto"}
        style={{
          flex: 1,
          backgroundColor: rc.sceneSurface,
          ...(readerSettingsUsesTabletSlidePanel
            ? { transform: [{ translateX: readerMobileSettingsSlideTranslateX }] }
            : null),
          zIndex: 1,
        }}
      >
      <ReaderHeader
        readerHeaderChromeHidden={readerHeaderToolsHidden}
        rc={rc}
        colors={colors}
        readerHeaderToolsGroup={isTabletReaderLayout ? readerHeaderToolsGroup : null}
        readerHeaderToolsSide="left"
      />

      <ReaderSelectionLayer
        chapter={chapter}
        resolvedTranslationId={resolvedTranslationId}
        annotations={annotations}
        notes={notes}
        removeAnnotationsFromVerses={removeAnnotationsFromVerses}
        applyAnnotationToVerses={applyAnnotationToVerses}
        persistNoteForVerse={persistNoteForVerse}
        bookSlug={bookSlug}
        chapterNumber={chapterNumber}
        requestedTranslationId={requestedTranslationId}
        translationPickerItems={translationPickerItems}
        toolsMenuOpen={toolsMenuOpen}
        closeToolsMenu={closeToolsMenu}
        isTabletReaderLayout={isTabletReaderLayout}
        themeId={themeId}
        colors={colors}
        rc={rc}
        readerVerseFontSize={readerVerseFontSize}
        readerVerseLineHeight={readerVerseLineHeight}
        readerVerseBodyFontFamily={readerVerseBodyFontFamily}
        verseTextAlign={verseTextAlign}
        verseLayout={verseLayout}
        readerScrollRef={readerScrollRef}
        chapterSwipePanHandlers={chapterSwipePanHandlers}
        readerVerseEstimatedItemSize={readerVerseEstimatedItemSize}
        readerListContentKey={readerChapterScrollKey}
        onScroll={onReaderScroll}
        onScrollBeginDrag={onReaderScrollBeginDragWithChapterNav}
        onScrollEndDrag={onReaderScrollEndDragWithChapterNav}
        onMomentumScrollEnd={onReaderMomentumScrollEndWithChapterNav}
        dismissReaderChromeFromBackgroundPress={dismissReaderChromeFromBackgroundPress}
        verseFlashListDataForList={verseFlashListDataForList}
        readerTabletLandscapeTwoColumn={readerTabletLandscapeTwoColumn}
        readerVersesOpacityAnim={readerVersesOpacityAnim}
        listHeader={readerChapterPageHeading}
        readerChapterFlashListFooter={readerChapterFlashListFooter}
        actionBarBottomPx={actionBarBottomPx}
        actionBarBottomPxHidden={actionBarBottomPxHidden}
        tabBarScrollHidden={Platform.OS === "android" ? readerTabBarScrollHidden : undefined}
        onListContentSizeChange={onTabBarContentSizeChange}
        onListLayoutHeight={onTabBarListLayout}
        selectionBannerTopPx={selectionBannerTopPx}
        screenW={screenW}
        readerOverlayOpenFromParent={
          toolsMenuOpen ||
          fontSettingsSheetOpen ||
          moreSettingsSheetOpen ||
          dataBackupSheetOpen ||
          deleteMyDataDialogOpen ||
          readerDropdown != null ||
          readerPrivacyPolicyOpen ||
          readerCreditsOpen ||
    readerChangelogsOpen ||
          newEntrySheetOpen
        }
        readerFeatureOnboardingActive={readerFeatureOnboarding.showLayer}
        featureOnboardingStep={readerFeatureOnboarding.currentStep}
        selectionBannerRef={selectionBannerLiveRef}
        onboardingStepRef={onboardingStepRef}
        completeOnboardingInteractionRef={completeOnboardingInteractionRef}
        clearVerseSelectionRef={clearVerseSelectionRef}
        onOpenJournal={handleOpenJournalFromSelection}
        onOpenStudyNotes={handleOpenStudyNotesFromSelection}
        onSelectionActivityChange={handleSelectionActivityChange}
        translationLoadingPhase={importOverlayPhase}
        translationLoadingShowLabel={
          !readerDataImportPicking &&
          !readerDataImportPickingRef.current &&
          !readerDataImportReloading &&
          !readerDataImportReloadingRef.current
        }
        translationLoadingAccentColor={colors.gold}
        yvpFootnotes={chapter.yvpFootnotes}
        onYvpFootnotePress={handleYvpFootnotePress}
        androidHideVerseList={Platform.OS === "android" && readerDropdown === "book"}
        androidRestoreScrollY={
          Platform.OS === "android" && readerDropdown === "book"
            ? Math.max(latestScrollMetricsRef.current.y, readerScrollY.value)
            : 0
        }
      />

      </Animated.View>

      <ReaderChapterNavArrows
        opacityAnim={chapterNavArrowsOpacityAnim}
        scaleAnim={chapterNavArrowsScaleAnim}
        pointerEventsEnabled={
          chapterNavArrowsPointerEventsEnabled || readerFeatureOnboarding.forceChapterNavArrowsVisible
        }
        prevChapter={chapterNav.prevChapter}
        nextChapter={chapterNav.nextChapter}
        onPrev={goToPrevChapter}
        onNext={goToNextChapter}
        prevArrowRef={chapterNavPrevArrowRef}
        nextArrowRef={chapterNavNextArrowRef}
      />

      <ReaderScrollToTopFab
        opacityAnim={scrollToTopFabOpacityAnim}
        scaleAnim={scrollToTopFabScaleAnim}
        pointerEventsEnabled={scrollToTopFabPointerEventsEnabled}
        onPress={scrollReaderToTop}
        onPressIn={onScrollToTopFabPressIn}
        onPressOut={onScrollToTopFabPressOut}
        colors={colors}
        buttonBackgroundColor={rc.popoverSurface}
        shadowColor={rc.popoverShadow}
        rippleColor={bundle.journal.fabRipple}
        bottomInsetPx={READER_SCROLL_TO_TOP_FAB_BOTTOM_EDGE_INSET_PX}
      />

      {Platform.OS === "android" ? (
        <ReaderAndroidAppBar
          hidden={readerHeaderToolsHidden}
          topInsetPx={readerAndroidTopToolsTopPx}
          backgroundColor={rc.sceneSurface}
          insets={insets}
          screenW={screenW}
          titleAnimatedStyle={readerHeaderTitleAnimatedStyle}
          bookName={readerHeaderBookName}
          chapterNumber={chapterNumber}
          colors={colors}
          bookButton={readerHeaderBookButton}
          settingsButton={readerSettingsToolsRow}
          fontButton={readerHeaderFontButton}
          toolsMenuOpen={toolsMenuOpen}
          barRef={headerToolsGroupRef}
          onLayout={bumpHeaderToolsLayoutEpoch}
        />
      ) : (
        <ReaderIosScrollChapterTitle
          hidden={readerHeaderToolsHidden}
          topInsetPx={insets.top}
          screenW={screenW}
          titleAnimatedStyle={readerHeaderTitleAnimatedStyle}
          bookName={readerHeaderBookName}
          chapterNumber={chapterNumber}
          colors={colors}
          rc={rc}
          hasHeaderTools={isTabletReaderLayout}
          toolsOnLeft
        />
      )}

      <JournalNewEntrySheet
        ref={newEntrySheetRef}
        open={newEntrySheetOpen}
        onClose={closeNewEntrySheet}
        sheetKey={newEntrySheetKey}
        variant="reader"
        formRef={newEntryFormRef}
        initialParams={newEntryInitialParams ?? undefined}
        readerBottomLiftPx={readerNewEntrySheetBottomLiftPx}
        onAfterSave={closeNewEntrySheet}
      />

      <ReaderModals
        bundle={bundle}
        chapter={chapter}
        commentaryPanelOpen={commentaryPanelOpen}
        closeCommentaryPanel={() => setCommentaryPanelOpen(false)}
        closeReaderDropdown={closeReaderDropdown}
        colors={colors}
        dropOpacityAnim={dropOpacityAnim}
        dropSlideAnim={dropSlideAnim}
        dropdownAnchor={dropdownAnchor}
        goToReaderChapter={goToReaderChapter}
        books={books}
        setBookSheetExitAnimationStarted={setBookSheetExitAnimationStarted}
        insets={insets}
        isTabletReaderLayout={isTabletReaderLayout}
        measureAndSetDropdown={measureAndSetDropdown}
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
        resolvedTranslationId={resolvedTranslationId}
        translationLanguageLabel={readerHeaderLanguageLabel}
        selectedVerses={selectedVerses}
        setThemeId={setThemeId}
        settingsMutedTextColor={settingsMutedTextColor}
        themesFanRef={themesFanRef}
        themeId={themeId}
        translationFanRef={translationFanRef}
      />
      <TranslationPickerSheet
        isOpen={readerDropdown === "translation"}
        onClose={closeReaderDropdown}
        onSelectTranslation={(translationId) => router.setParams({ translation: translationId })}
        sheetTopPx={readerDropdownTop}
        bundle={bundle}
        insets={insets}
        translationPickerItems={translationPickerItems}
        favoriteTranslationIds={favoriteTranslationIds}
        toggleFavoriteTranslation={toggleFavoriteTranslation}
        resolvedTranslationId={resolvedTranslationId}
        readerBookSlug={bookSlug}
        readerChapterNumber={chapterNumber}
        readerBooks={books}
      />
      <ReaderFontSettingsSheet
        isOpen={fontSettingsSheetOpen}
        onClose={closeFontSettingsPopup}
        bundle={bundle}
        insets={insets}
        isTabletReaderLayout={isTabletReaderLayout}
        fontSizeScale={fontSizeScale}
        setFontSizeScalePersisted={setFontSizeScalePersisted}
        lineSpacingScale={lineSpacingScale}
        setLineSpacingScalePersisted={setLineSpacingScalePersisted}
        verseTextAlign={verseTextAlign}
        setVerseTextAlignPersisted={setVerseTextAlignPersisted}
        verseLayout={verseLayout}
        setVerseLayoutPersisted={setVerseLayoutPersisted}
        readerVerseBodyFontId={readerVerseBodyFontId}
        setReaderVerseBodyFontIdPersisted={setReaderVerseBodyFontIdPersisted}
        settingsMutedTextColor={settingsMutedTextColor}
      />
      <ReaderMoreSettingsSheet
        isOpen={moreSettingsSheetOpen}
        onClose={closeMoreSettingsPopup}
        onSelectCredits={openCreditsFromMoreSheet}
        onSelectChangelogs={openChangelogsFromMoreSheet}
        onSelectImportExport={openDataBackupFromMoreSheet}
        bundle={bundle}
        insets={insets}
        isTabletReaderLayout={isTabletReaderLayout}
        settingsMutedTextColor={settingsMutedTextColor}
      />
      <ReaderDataBackupSheet
        isOpen={dataBackupSheetOpen}
        onClose={() => setDataBackupSheetOpen(false)}
        bundle={bundle}
        insets={insets}
        isTabletReaderLayout={isTabletReaderLayout}
      />
      <CreditsSheet
        visible={readerCreditsOpen}
        onClose={() => setReaderCreditsOpen(false)}
        onOpenPrivacyPolicy={openPrivacyPolicyFromCredits}
        onOpenTermsOfService={openTermsFromCredits}
        bundle={bundle}
        insets={insets}
        isTabletReaderLayout={isTabletReaderLayout}
      />
      <ChangelogsSheet
        visible={readerChangelogsOpen}
        onClose={() => setReaderChangelogsOpen(false)}
        bundle={bundle}
        insets={insets}
        isTabletReaderLayout={isTabletReaderLayout}
      />
      <PrivacyPolicySheet
        visible={readerPrivacyPolicyOpen}
        onClose={() => setReaderPrivacyPolicyOpen(false)}
        bundle={bundle}
        insets={insets}
        isTabletReaderLayout={isTabletReaderLayout}
      />
      <TermsOfServiceSheet visible={readerTermsOpen} onClose={() => setReaderTermsOpen(false)} />
      <ReaderDeleteMyDataDialog
        isOpen={deleteMyDataDialogOpen}
        onClose={closeDeleteMyDataDialog}
        onOpenBackup={openDataBackupFromDeleteReminder}
        onConfirmDelete={confirmDeleteMyData}
        bundle={bundle}
        isTabletReaderLayout={isTabletReaderLayout}
      />

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
        spotlightTargetsStep={readerFeatureOnboarding.spotlightTargetsStep}
        coachMarkAnchor={readerFeatureOnboarding.coachMarkAnchor}
        onDismiss={readerFeatureOnboarding.dismissCurrentStep}
        onSkipTour={readerFeatureOnboarding.skipTour}
        colors={{
          tooltipBackground: rc.selectionBackground,
          tooltipText: rc.selectionText,
          scrim: "rgba(0,0,0,0.45)",
        }}
      />

      <ReaderYvpFootnoteSheet
        visible={activeYvpFootnote != null}
        footnote={activeYvpFootnote}
        onClose={() => setActiveYvpFootnote(null)}
        backgroundColor={rc.sceneSurface}
        textColor={colors.brown800}
      />

    </View>
  );
}
