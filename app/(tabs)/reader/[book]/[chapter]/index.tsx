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
import Reanimated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  formatTranslationDropdownLabel,
  getExternalApiId,
  getInternalIdFromApiId,
  isTranslationId,
  type TranslationId,
} from "@sinag-bible/core/bible-translations";
import { formatReaderChapterHeading } from "@/lib/reader-chapter-label";
import { getReaderTranslationLanguageLabel } from "@/lib/reader-translation-language";
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
import { nativeTabFabOffsetPx, readerAndroidListBottomPaddingPx, readerAndroidTabBarClearancePx } from "@/lib/native-tab-chrome";
import { READER_SCROLL_JS_BRIDGE_DELTA_PX } from "@/lib/device-capability";
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
import { ReaderMoreSettingsSheet } from "@/src/features/reader/ReaderMoreSettingsSheet";
import { readerExpandedNavRailWidthPx, READER_M3_APP_BAR_CONTENT_HEIGHT_PX } from "@/src/features/reader/readerSettingsPanelChrome";
import { useReaderChapter } from "@/src/features/reader/useReaderChapter";
import { useReaderPreferences } from "@/src/features/reader/useReaderPreferences";
import { useReaderTabBarAutoHide } from "@/src/features/reader/useReaderTabBarAutoHide";

const READER_FONT_CARD_PADDING_TOP_PX = 12;

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
  const [moreSettingsSheetOpen, setMoreSettingsSheetOpen] = useState(false);
  const [readerDropdown, setReaderDropdown] = useState<ReaderToolsDropdown | null>(null);
  const [dropdownAnchor, setDropdownAnchor] = useState<LayoutRectangle | null>(null);

  const bookFanRef = useRef<View | null>(null);
  const settingsButtonRef = useRef<View | null>(null);
  const fontSettingsButtonRef = useRef<View | null>(null);
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
  const settingsOnboardingDeleteMyDataRef = useRef<View | null>(null);
  const settingsOnboardingRowRefs = useMemo(
    (): Record<ReaderSettingsOnboardingStepId, React.RefObject<View | null>> => ({
      translation: settingsOnboardingTranslationRef,
      "study-notes": settingsOnboardingStudyNotesRef,
      "font-settings": settingsOnboardingFontSettingsRef,
      themes: settingsOnboardingThemesRef,
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
  /** Total horizontal slide (px) when the settings menu is fully open. */
  const readerMobileSettingsSlidePx = useMemo(() => {
    if (isTabletReaderLayout) {
      const r =
        windowWidth > windowHeight
          ? READER_MOBILE_SETTINGS_TABLET_LANDSCAPE_SLIDE_RATIO
          : READER_MOBILE_SETTINGS_TABLET_PORTRAIT_SLIDE_RATIO;
      return windowWidth * r;
    }
    return readerExpandedNavRailWidthPx(windowWidth);
  }, [isTabletReaderLayout, windowWidth, windowHeight]);

  const readerMobileSettingsSlideTranslateX = useMemo(
    () =>
      readerSettingsSlideProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, readerMobileSettingsSlidePx],
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

  const closeToolsMenu = useCallback(() => {
    clearMobileSettingsFollowUp();
    setToolsMenuOpen(false);
    setFontSettingsSheetOpen(false);
    setMoreSettingsSheetOpen(false);
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
    setToolsMenuOpen(false);
    setReaderDropdown(null);
    setDropdownAnchor(null);
    setFontSettingsSheetOpen(true);
  }, []);

  const openMobileReaderMoreFromMenu = useCallback(() => {
    closeToolsMenu();
    scheduleAfterMobileReaderMenuClose(() => {
      setMoreSettingsSheetOpen(true);
    });
  }, [closeToolsMenu, scheduleAfterMobileReaderMenuClose]);

  const openCreditsFromMoreSheet = useCallback(() => {
    closeMoreSettingsPopup();
    setTimeout(() => {
      setReaderCreditsOpen(true);
    }, 0);
  }, [closeMoreSettingsPopup]);

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
      const shouldClose = p < 0.38 || (g.vx < -0.45 && p < 0.72);
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
  }, [toolsMenuOpen, closeToolsMenu, readerSettingsSlideProgress, readerMobileSettingsSlidePx]);

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
    setToolsMenuOpen(false);
    setFontSettingsSheetOpen(false);
    setMoreSettingsSheetOpen(false);
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
        setMoreSettingsSheetOpen(false);
        setReaderDropdown(null);
        setDropdownAnchor(null);
        return false;
      }
      clearMobileSettingsFollowUp();
      setFontSettingsSheetOpen(false);
      setMoreSettingsSheetOpen(false);
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
    else if (moreSettingsSheetOpen) closeMoreSettingsPopup();
    else if (readerPrivacyPolicyOpen) setReaderPrivacyPolicyOpen(false);
    else if (readerCreditsOpen) setReaderCreditsOpen(false);
    else if (commentaryPanelOpen) setCommentaryPanelOpen(false);
    else if (readerDropdown === "translation" || readerDropdown === "theme") closeReaderDropdown();
  }, [
    toolsMenuOpen,
    closeToolsMenu,
    fontSettingsSheetOpen,
    closeFontSettingsPopup,
    moreSettingsSheetOpen,
    closeMoreSettingsPopup,
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
    moreSettingsSheetOpen ||
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

    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        const didScroll = scrollReaderFlashListToVerseCentered(
          readerScrollRef.current,
          verseFlashListDataForList,
          targetVerse,
          readerVerseEstimatedItemSize,
          { animated: true },
        );
        if (didScroll) {
          pendingScrollVerseRef.current = null;
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
    moreSettingsSheetOpen ||
    readerDropdown != null ||
    readerPrivacyPolicyOpen ||
    readerCreditsOpen ||
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

  const readerTabBarScrollHidden = useReaderTabBarScrollHidden();

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
    toolsOnLeft: true,
    selectedVerseCount: selectedVerses.length,
    onTourComplete: () => clearVerseSelectionRef.current?.(),
  });

  onboardingStepRef.current = readerFeatureOnboarding.currentStep;
  completeOnboardingInteractionRef.current = readerFeatureOnboarding.completeInteractionStep;

  const tabBarAutoHideForceVisible =
    (fontSettingsSheetOpen ||
      moreSettingsSheetOpen ||
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

  const onReaderScrollSideEffects = useCallback(
    (y: number, contentHeight: number, viewportHeight: number) => {
      latestScrollMetricsRef.current = { y, contentHeight, viewportHeight };
      const nativeEvent = {
        contentOffset: { y, x: 0 },
        contentSize: { height: contentHeight, width: 0 },
        layoutMeasurement: { height: viewportHeight, width: 0 },
      } as NativeScrollEvent;
      const event = { nativeEvent } as NativeSyntheticEvent<NativeScrollEvent>;
      onChapterNavArrowsScroll(event);
      onTabBarScroll(event);
    },
    [onChapterNavArrowsScroll, onTabBarScroll],
  );

  const flushReaderScrollSideEffects = useCallback(() => {
    const { y, contentHeight, viewportHeight } = latestScrollMetricsRef.current;
    onReaderScrollSideEffects(y, contentHeight, viewportHeight);
    lastScrollBridgeY.value = y;
  }, [onReaderScrollSideEffects, lastScrollBridgeY]);

  const onReaderScrollBeginDragWithChapterNav = useCallback(() => {
    onReaderScrollBeginDrag();
    onChapterNavArrowsScrollBeginDrag();
    flushReaderScrollSideEffects();
  }, [onReaderScrollBeginDrag, onChapterNavArrowsScrollBeginDrag, flushReaderScrollSideEffects]);

  const onReaderScrollEndDragWithChapterNav = useCallback(() => {
    onChapterNavArrowsScrollEndDrag();
    flushReaderScrollSideEffects();
  }, [onChapterNavArrowsScrollEndDrag, flushReaderScrollSideEffects]);

  const onReaderMomentumScrollEndWithChapterNav = useCallback(() => {
    onChapterNavArrowsMomentumScrollEnd();
    flushReaderScrollSideEffects();
  }, [onChapterNavArrowsMomentumScrollEnd, flushReaderScrollSideEffects]);

  const onReaderScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      readerScrollY.value = y;
      const contentHeight = event.contentSize.height;
      const viewportHeight = event.layoutMeasurement.height;
      const dy = Math.abs(y - lastScrollBridgeY.value);
      if (lastScrollBridgeY.value < 0 || dy >= READER_SCROLL_JS_BRIDGE_DELTA_PX) {
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
    isNavigationRailLayout: !isTabletReaderLayout,
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
  const readerHeaderLanguageLabel = getReaderTranslationLanguageLabel(
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
        {readerHeaderTranslationId} ({readerHeaderLanguageLabel})
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
          Platform.OS === "android"
            ? isTabletReaderLayout
              ? rc.sceneSurface
              : toolsMenuOpen
                ? "transparent"
                : rc.sceneSurface
            : "transparent",
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
    railWidthPx: readerMobileSettingsSlidePx,
    toolsMenuOpen,
    headerTools: Platform.OS === "android" ? null : readerHeaderToolsGroup,
    hideFontSettings: Platform.OS === "android",
    onSelectFontSettings:
      Platform.OS === "android" ? undefined : openMobileReaderFontSettingsFromMenu,
    onSelectThemes: openMobileReaderThemesFromMenu,
    onSelectMore: openMobileReaderMoreFromMenu,
    onSelectTranslation: openMobileReaderTranslationFromMenu,
    onSelectCommentary: openMobileReaderCommentaryFromMenu,
    onSelectDeleteMyData: openDeleteMyDataConfirmFromMenu,
    rippleColor: Platform.OS === "android" ? androidAppBarRipple : undefined,
    settingsOnboardingRowRefs,
    onSettingsPanelLayout: bumpSettingsLayoutEpoch,
  };

  return (
    <View style={{ flex: 1, backgroundColor: rc.sceneSurface, overflow: "visible" }}>
      <ReaderMobileSettingsPanel {...readerSettingsPanelProps} />
      <Animated.View
        {...(toolsMenuOpen ? readerSettingsMenuPanResponder.panHandlers : {})}
        pointerEvents={toolsMenuOpen ? "box-none" : "auto"}
        style={{
          flex: 1,
          backgroundColor: rc.sceneSurface,
          transform: [{ translateX: readerMobileSettingsSlideTranslateX }],
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
        androidListPaddingBottomHidden={androidListPaddingBottomHidden}
        onListContentSizeChange={onTabBarContentSizeChange}
        onListLayoutHeight={onTabBarListLayout}
        selectionBannerTopPx={selectionBannerTopPx}
        screenW={screenW}
        readerMobileSettingsSlideTranslateX={readerMobileSettingsSlideTranslateX}
        readerOverlayOpenFromParent={
          toolsMenuOpen ||
          fontSettingsSheetOpen ||
          moreSettingsSheetOpen ||
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
        resolvedTranslationId={resolvedTranslationId}
        translationLanguageLabel={readerHeaderLanguageLabel}
        saveNoteFromModal={saveNoteFromModal}
        selectedVerses={selectedVerses}
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
      <ReaderMoreSettingsSheet
        isOpen={moreSettingsSheetOpen}
        onClose={closeMoreSettingsPopup}
        onSelectCredits={openCreditsFromMoreSheet}
        bundle={bundle}
        insets={insets}
        isTabletReaderLayout={isTabletReaderLayout}
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
        railSide="left"
        colors={{
          tooltipBackground: rc.selectionBackground,
          tooltipText: rc.selectionText,
          arrow: "#FFFFFF",
        }}
      />

    </View>
  );
}
