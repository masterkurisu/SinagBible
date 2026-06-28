import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { GestureResponderEvent, PanResponderGestureState, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  View,
  Text,
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
import type { FlashListRef } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type {
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { State } from "react-native-gesture-handler";
import {
  formatTranslationDropdownLabel,
  getInternalIdFromApiId,
  isTranslationId,
  type TranslationId,
} from "@sinag-bible/core/bible-translations";
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
import { FilterListIcon } from "@/components/icons/FilterListIcon";
import { BOOK_GENRE_BY_SLUG } from "@/lib/book-genre-by-slug";
import { readerChapterScreenParams } from "@/lib/reader-navigation";
import { nativeTabFabOffsetPx, nativeTabSheetBottomInsetPx, readerAndroidListBottomPaddingPx, readerAndroidTabBarClearancePx } from "@/lib/native-tab-chrome";
import { useReaderTabBarHideProgress, useRegisterReaderSettingsSlideProgress } from "@/lib/reader-tab-bar-visibility-context";
import {
  READER_SETTINGS_MENU_SPRING_CLOSE,
  READER_SETTINGS_MENU_SPRING_OPEN,
} from "@/lib/reader-settings-menu-motion";
import { isTabletLayout, isReaderTabletLandscapeTwoColumn, TABLET_NEW_ENTRY_SHEET_MAX_WIDTH_PX } from "@/lib/tablet-layout";
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
  findFlashListIndexForVerseNumber,
  readerFlashListChromeStyles,
  readerVerseEstimatedFlashListItemSizePx,
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
import { ReaderHeader, READER_HEADER_TITLE_MAIN_PX, READER_HEADER_TITLE_TRANS_PX } from "@/src/features/reader/ReaderHeader";
import {
  ReaderChapterNavArrows,
  useReaderChapterNavArrowsVisibility,
} from "@/src/features/reader/ReaderChapterNavArrows";
import {
  ReaderModals,
  ReaderMobileSettingsPanel,
  type ReaderToolsDropdown,
} from "@/src/features/reader/ReaderModals";
import { ReaderFeatureOnboardingLayer } from "@/src/features/reader/ReaderFeatureOnboardingLayer";
import { ReaderSettingsOnboardingLayer } from "@/src/features/reader/ReaderSettingsOnboardingLayer";
import { useReaderFeatureOnboarding, type ReaderOnboardingStep } from "@/src/features/reader/useReaderFeatureOnboarding";
import { useReaderSettingsOnboarding } from "@/src/features/reader/useReaderSettingsOnboarding";
import type { ReaderSettingsOnboardingStepId } from "@/src/features/reader/readerSettingsOnboardingSteps";
import { TranslationPickerSheet } from "@/src/features/reader/TranslationPickerSheet";
import { ReaderFontSettingsSheet } from "@/src/features/reader/ReaderFontSettingsSheet";
import { useReaderChapter } from "@/src/features/reader/useReaderChapter";
import { useReaderPreferences } from "@/src/features/reader/useReaderPreferences";
import { useReaderTabBarAutoHide } from "@/src/features/reader/useReaderTabBarAutoHide";

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

const READER_FONT_CARD_PADDING_TOP_PX = 12;

function persistReaderPref(key: string, value: string): void {
  void AsyncStorage.setItem(key, value).catch(() => {
    /* ignore storage write errors */
  });
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
    setThemeId,
    readerVerseFontSize,
    readerVerseLineHeight,
    readerVerseBodyFontFamily,
  } = useReaderPreferences();
  const { fontScale: fontSizeScale, fontFamilyId: readerVerseBodyFontId, lineSpacingScale, verseTextAlign, themeId } =
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
    isLoading: readerChapterLoading,
    error: readerChapterError,
  } = useReaderChapter(bookSlug ?? "", chapterNumber, requestedTranslationId);

  const {
    highlights,
    notes,
    removeHighlightsFromVerses,
    applyHighlightToVerses,
    persistNoteForVerse,
  } = useReaderStorage(chapter, resolvedTranslationId);

  const { items: translationPickerItems } = useTranslationPicker();
  const { favoriteTranslationIds, toggleFavoriteTranslation } = useFavoriteTranslations();

  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [readerPrivacyPolicyOpen, setReaderPrivacyPolicyOpen] = useState(false);
  const [readerTermsOpen, setReaderTermsOpen] = useState(false);
  const [readerCreditsOpen, setReaderCreditsOpen] = useState(false);
  const [commentaryPanelOpen, setCommentaryPanelOpen] = useState(false);
  const mobileSettingsFollowUpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fontSettingsSheetOpen, setFontSettingsSheetOpen] = useState(false);
  const [readerDropdown, setReaderDropdown] = useState<ReaderToolsDropdown | null>(null);
  const [dropdownAnchor, setDropdownAnchor] = useState<LayoutRectangle | null>(null);

  const bookFanRef = useRef<View | null>(null);
  const settingsButtonRef = useRef<View | null>(null);
  const selectionBannerAnchorRef = useRef<View | null>(null);
  const selectionBannerLiveRef = useRef<View | null>(null);
  const clearVerseSelectionRef = useRef<(() => void) | null>(null);
  const headerToolsGroupRef = useRef<View | null>(null);
  const chapterNavPrevArrowRef = useRef<View | null>(null);
  const chapterNavNextArrowRef = useRef<View | null>(null);
  const [headerToolsLayoutEpoch, setHeaderToolsLayoutEpoch] = useState(0);
  const [settingsLayoutEpoch, setSettingsLayoutEpoch] = useState(0);
  const settingsOnboardingTranslationRef = useRef<View | null>(null);
  const settingsOnboardingStudyNotesRef = useRef<View | null>(null);
  const settingsOnboardingFontSettingsRef = useRef<View | null>(null);
  const settingsOnboardingThemesRef = useRef<View | null>(null);
  const settingsOnboardingCreditsRef = useRef<View | null>(null);
  const settingsOnboardingDeleteMyDataRef = useRef<View | null>(null);
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
  const translationFanRef = useRef<View | null>(null);
  const themesFanRef = useRef<View | null>(null);

  const dropSlideAnim = useRef(new Animated.Value(0)).current;
  const dropOpacityAnim = useRef(new Animated.Value(0)).current;
  /** When false, vertical list has scrolled — swipe-to-dismiss stays off so scrolling wins. */
  /** True from the moment the sheet close animation starts until `closeReaderDropdown` runs — shows native header chrome during the slide-out. */
  const [bookSheetExitAnimationStarted, setBookSheetExitAnimationStarted] = useState(false);
  const readerVersesOpacityAnim = useRef(new Animated.Value(1)).current;
  /** True after we've shown synced content then lost sync (chapter change), not initial null payload. */
  const readerVersesHadDesyncRef = useRef(false);

  const [newEntrySheetOpen, setNewEntrySheetOpen] = useState(false);
  const [newEntrySheetKey, setNewEntrySheetKey] = useState(0);
  const [newEntryInitialParams, setNewEntryInitialParams] =
    useState<JournalNewEntryInitialParams | null>(null);
  const [newEntryHasDraft, setNewEntryHasDraft] = useState(false);
  const [selectionActivity, setSelectionActivity] = useState<ReaderSelectionActivity>(() => ({
    selectedVerses: [],
    noteModalVisible: false,
    noteDraft: "",
    noteTargetVerse: null,
    saveNoteFromModal: () => {},
    setNoteModalVisible: () => {},
    setNoteDraft: () => {},
    setNoteTargetVerse: () => {},
  }));
  const handleSelectionActivityChange = useCallback((activity: ReaderSelectionActivity) => {
    setSelectionActivity(activity);
  }, []);
  const {
    selectedVerses,
    noteModalVisible,
    noteDraft,
    noteTargetVerse,
    saveNoteFromModal,
    setNoteModalVisible,
    setNoteDraft,
    setNoteTargetVerse,
  } = selectionActivity;
  const readerScrollRef = useRef<FlashListRef<ReaderVerseFlashItem> | null>(null);
  /** Drives cross-fade between in-content heading and stack header title (native scroll events). */
  const readerScrollYAnim = useRef(new Animated.Value(0)).current;
  const [readerPageHeadingHeight, setReaderPageHeadingHeight] = useState(96);
  const onReaderPageHeadingLayout = useCallback((height: number) => {
    setReaderPageHeadingHeight((prev) => (Math.abs(prev - height) > 1 ? height : prev));
  }, []);
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
    readerSettingsSlideProgress.stopAnimation();
    Animated.spring(readerSettingsSlideProgress, {
      ...(toolsMenuOpen ? READER_SETTINGS_MENU_SPRING_OPEN : READER_SETTINGS_MENU_SPRING_CLOSE),
      toValue: toolsMenuOpen ? 1 : 0,
    }).start();
  }, [toolsMenuOpen, readerSettingsSlideProgress]);

  useRegisterReaderSettingsSlideProgress(readerSettingsSlideProgress);

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

  useEffect(() => {
    if (pendingScrollVerseRef.current != null) return;
    readerScrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    readerScrollYAnim.setValue(0);
  }, [bookSlug, chapterNumber, requestedTranslationId, readerScrollYAnim, initialScrollVerse]);

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
    setToolsMenuOpen(false);
    setFontSettingsSheetOpen(false);
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
        return false;
      }
      clearMobileSettingsFollowUp();
      setFontSettingsSheetOpen(false);
      setReaderDropdown(null);
      setDropdownAnchor(null);
      return true;
    });
  }, [clearMobileSettingsFollowUp]);

  const closeReaderDropdown = useCallback(() => {
    clearMobileSettingsFollowUp();
    setBookSheetExitAnimationStarted(false);
    setReaderDropdown(null);
    setDropdownAnchor(null);
  }, [clearMobileSettingsFollowUp]);

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

  useEffect(() => {
    if (!toolsMenuOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeToolsMenu();
      return true;
    });
    return () => sub.remove();
  }, [toolsMenuOpen, closeToolsMenu]);

  const isReaderContentCurrent = Boolean(
    chapter &&
      books &&
      resolvedTranslationId &&
      chapter.bookSlug === (bookSlug ?? "") &&
      chapter.chapterNumber === chapterNumber &&
      resolvedTranslationId === requestedTranslationId,
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
    readerDropdown != null ||
    readerPrivacyPolicyOpen ||
    readerCreditsOpen ||
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
    primeReaderChapterFetch(tid, target);
    if (books) {
      primeReaderChapterFetch(
        tid,
        getReaderChapterNeighbors(
          books,
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
    books,
    resolvedTranslationId,
    requestedTranslationId,
  ]);

  const goToNextChapter = useCallback(() => {
    const target = chapterNav.nextChapter;
    if (!target) return;
    const tid = resolvedTranslationId ?? requestedTranslationId;
    primeReaderChapterFetch(tid, target);
    if (books) {
      primeReaderChapterFetch(
        tid,
        getReaderChapterNeighbors(
          books,
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
    books,
    resolvedTranslationId,
    requestedTranslationId,
  ]);

  const readerTabletLandscapeTwoColumn =
    chapter != null && isReaderTabletLandscapeTwoColumn(windowWidth, windowHeight);

  const readerTwoColumnSplitIndex = useMemo(
    () => (chapter ? splitVerseIndexForBalancedColumns(chapter.verses) : 0),
    [chapter],
  );

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

  useEffect(() => {
    const targetVerse = pendingScrollVerseRef.current;
    if (targetVerse == null || !isReaderContentCurrent || verseFlashListDataForList.length === 0) {
      return;
    }

    const listIndex = findFlashListIndexForVerseNumber(verseFlashListDataForList, targetVerse);
    if (listIndex == null) return;

    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        try {
          readerScrollRef.current?.scrollToIndex({
            index: listIndex,
            animated: true,
            viewOffset: 48,
          });
        } catch {
          readerScrollRef.current?.scrollToOffset({
            offset: Math.max(0, listIndex * readerVerseEstimatedItemSize),
            animated: true,
          });
        }
        pendingScrollVerseRef.current = null;
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
  ]);

  const readerChapterFlashListFooter = useCallback(() => {
    if (resolvedTranslationId !== requestedTranslationId) return null;
    const { prevChapter, nextChapter } = chapterNav;
    return (
      <Animated.View style={{ opacity: readerVersesOpacityAnim }}>
        <View style={readerFlashListChromeStyles.footerNavRow}>
          {prevChapter ? (
            <TouchableOpacity
              style={[readerFlashListChromeStyles.footerNavButton, { backgroundColor: colors.parchmentDark }]}
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
            <View style={readerFlashListChromeStyles.footerNavSpacer} />
          )}

          {nextChapter ? (
            <TouchableOpacity
              style={[readerFlashListChromeStyles.footerNavButton, { backgroundColor: colors.parchmentDark }]}
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
            <View style={readerFlashListChromeStyles.footerNavSpacer} />
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
    resolvedTranslationId,
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

  const actionBarBottomPxHidden =
    Platform.OS === "android" ? readerAndroidTabBarClearancePx(insets.bottom, true) : actionBarBottomPx;

  const androidListPaddingBottomHidden =
    Platform.OS === "android"
      ? readerAndroidListBottomPaddingPx(insets.bottom, true, false, 0)
      : 40;

  const tabBarHideProgress = useReaderTabBarHideProgress();

  const bumpHeaderToolsLayoutEpoch = useCallback(() => {
    setHeaderToolsLayoutEpoch((epoch) => epoch + 1);
  }, []);

  const bumpSettingsLayoutEpoch = useCallback(() => {
    setSettingsLayoutEpoch((epoch) => epoch + 1);
  }, []);

  const readerFeatureOnboarding = useReaderFeatureOnboarding({
    readerContentReady: !readerChapterLoading && readerChapterError == null && chapter != null,
    readerOverlayOpen,
    headerToolsGroupRef,
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
    selectedVerseCount: selectedVerses.length,
    onTourComplete: () => clearVerseSelectionRef.current?.(),
  });

  onboardingStepRef.current = readerFeatureOnboarding.currentStep;
  completeOnboardingInteractionRef.current = readerFeatureOnboarding.completeInteractionStep;

  const tabBarAutoHideForceVisible =
    (fontSettingsSheetOpen ||
      readerDropdown != null ||
      readerPrivacyPolicyOpen ||
      readerCreditsOpen ||
      noteModalVisible ||
      newEntrySheetOpen) ||
    selectedVerses.length > 0 ||
    readerFeatureOnboarding.showLayer;

  const {
    onTabBarScroll,
    onTabBarContentSizeChange,
    onTabBarListLayout,
  } = useReaderTabBarAutoHide({
    chapterRouteKey: chapterNavRouteKey,
    enabled: Platform.OS === "android",
    forceVisible: tabBarAutoHideForceVisible,
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
          listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            onChapterNavArrowsScroll(event);
            onTabBarScroll(event);
          },
        },
      ),
    [readerScrollYAnim, onChapterNavArrowsScroll, onTabBarScroll],
  );

  const chapterSwipePan = useMemo(() => {
    const tid = resolvedTranslationId;
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
  }, [chapterNav, resolvedTranslationId, goToReaderChapter, hideChapterNavArrowsFromMotion]);

  const readerSettingsOnboarding = useReaderSettingsOnboarding({
    toolsMenuOpen,
    rowRefs: settingsOnboardingRowRefs,
    scrollPaddingTop: readerMobileSettingsScrollPaddingTop,
    screenW: windowWidth,
    screenH: windowHeight,
    insets,
    settingsLayoutEpoch,
    settingsRevealedStripWidthPx: readerMobileSettingsSlidePx,
  });

  if (readerChapterError) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: rc.sceneSurface }}>
        <Text style={{ fontFamily: "Inter_400Regular", color: colors.tan300, textAlign: "center" }}>
          Chapter not found.
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

  const readerChapterPageHeading = (
    <Animated.View
      style={[readerFlashListChromeStyles.pageHeading, { opacity: readerPageHeadingOpacityAnim }]}
      onLayout={(e) => onReaderPageHeadingLayout(e.nativeEvent.layout.height)}
    >
      <Text
        style={[readerFlashListChromeStyles.pageHeadingTranslation, { fontFamily: "Inter_400Regular", color: colors.gold }]}
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
        style={[readerFlashListChromeStyles.pageHeadingChapter, { fontFamily: "Inter_400Regular", color: colors.tan200 }]}
      >
        Chapter {chapterNumber}
      </Text>
    </Animated.View>
  );

  const { prevChapter, nextChapter } = chapterNav;

  /**
   * Do not tie chapter swipes to `isReaderContentCurrent`: after `setParams`, the route updates
   * immediately but chapter data is still the previous chapter until the async load finishes.
   * That made `noop` pan handlers run so the next swipe did nothing (often read as “one swipe only”).
   * `chapterNav` already uses URL params for neighbors while payload catches up.
   */
  const chapterSwipePanHandlers = (readerOverlayOpen ? noopChapterSwipePan : chapterSwipePan).panHandlers;

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
  const fontSettingsPopupPadH = 16 * fontSettingsScale;
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
      onLayout={bumpHeaderToolsLayoutEpoch}
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
    <View style={{ flex: 1, backgroundColor: rc.sceneSurface, overflow: "visible" }}>
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
        onSettingsPanelLayout={bumpSettingsLayoutEpoch}
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

      <ReaderSelectionLayer
        chapter={chapter}
        resolvedTranslationId={resolvedTranslationId}
        highlights={highlights}
        notes={notes}
        removeHighlightsFromVerses={removeHighlightsFromVerses}
        applyHighlightToVerses={applyHighlightToVerses}
        persistNoteForVerse={persistNoteForVerse}
        bookSlug={bookSlug}
        chapterNumber={chapterNumber}
        requestedTranslationId={requestedTranslationId}
        toolsMenuOpen={toolsMenuOpen}
        closeToolsMenu={closeToolsMenu}
        themeId={themeId}
        colors={colors}
        rc={rc}
        readerVerseFontSize={readerVerseFontSize}
        readerVerseLineHeight={readerVerseLineHeight}
        readerVerseBodyFontFamily={readerVerseBodyFontFamily}
        verseTextAlign={verseTextAlign}
        readerScrollRef={readerScrollRef}
        chapterSwipePanHandlers={chapterSwipePanHandlers}
        readerVerseEstimatedItemSize={readerVerseEstimatedItemSize}
        onScroll={onReaderScroll}
        onScrollBeginDrag={onReaderScrollBeginDragWithChapterNav}
        onScrollEndDrag={onChapterNavArrowsScrollEndDrag}
        onMomentumScrollEnd={onChapterNavArrowsMomentumScrollEnd}
        dismissReaderChromeFromBackgroundPress={dismissReaderChromeFromBackgroundPress}
        verseFlashListDataForList={verseFlashListDataForList}
        readerTabletLandscapeTwoColumn={readerTabletLandscapeTwoColumn}
        readerVersesOpacityAnim={readerVersesOpacityAnim}
        listHeader={readerChapterPageHeading}
        readerChapterFlashListFooter={readerChapterFlashListFooter}
        actionBarBottomPx={actionBarBottomPx}
        actionBarBottomPxHidden={actionBarBottomPxHidden}
        tabBarHideProgress={Platform.OS === "android" ? tabBarHideProgress : null}
        androidListPaddingBottomHidden={androidListPaddingBottomHidden}
        onListContentSizeChange={onTabBarContentSizeChange}
        onListLayoutHeight={onTabBarListLayout}
        selectionBannerTopPx={selectionBannerTopPx}
        screenW={screenW}
        readerMobileSettingsSlideTranslateX={readerMobileSettingsSlideTranslateX}
        readerOverlayOpenFromParent={
          toolsMenuOpen ||
          fontSettingsSheetOpen ||
          readerDropdown != null ||
          readerPrivacyPolicyOpen ||
          readerCreditsOpen ||
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
        colors={colors}
        rc={rc}
        prevArrowRef={chapterNavPrevArrowRef}
        nextArrowRef={chapterNavNextArrowRef}
      />

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

      <ReaderModals
        bundle={bundle}
        chapter={chapter}
        commentaryPanelOpen={commentaryPanelOpen}
        closeCommentaryPanel={() => setCommentaryPanelOpen(false)}
        closeNewEntrySheet={closeNewEntrySheet}
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
        saveNoteFromModal={saveNoteFromModal}
        selectedVerses={selectedVerses}
        setNewEntryHasDraft={setNewEntryHasDraft}
        setNoteDraft={setNoteDraft}
        setNoteModalVisible={setNoteModalVisible}
        setNoteTargetVerse={setNoteTargetVerse}
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
        readerVerseBodyFontId={readerVerseBodyFontId}
        setReaderVerseBodyFontIdPersisted={setReaderVerseBodyFontIdPersisted}
        settingsMutedTextColor={settingsMutedTextColor}
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

    </View>
  );
}
