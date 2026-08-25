import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type KeyboardEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import type {
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import {
  FlatList as GHFlatList,
  PanGestureHandler,
  TouchableOpacity as GestureHandlerTouchableOpacity,
  State,
} from "react-native-gesture-handler";
import {
  getExternalApiId,
  getInternalIdFromApiId,
  isTranslationId,
} from "@sinag-bible/core/bible-translations";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import type { BibleBookNavItem } from "@sinag-bible/types";
import { FilterListIcon } from "@/components/icons/FilterListIcon";
import { SheetContentSkeleton } from "@/components/sheet-content-skeleton";
import {
  NESTED_SHEET_OPEN_DURATION_MS,
  SHEET_OPEN_DURATION_MS,
  SHEET_SCRIM_DURATION_MS,
} from "@/lib/device-capability";
import { useDeferSheetContentMount } from "@/lib/use-defer-sheet-content";
import {
  compareTranslationPickerAbbreviations,
  getTranslationPickerAbbreviation,
  type TranslationPickerItem,
} from "@/lib/use-translation-picker";
import { getTranslationLanguageFilterOptions } from "@/lib/translation-language-sections";
import { hapticLightImpact } from "@/lib/haptics";
import { getReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import { MAX_PINNED_TRANSLATIONS } from "@/lib/default-pinned-translations";
import type { ToggleFavoriteTranslationResult } from "@/lib/use-favorite-translations";
import { prefetchTranslationChaptersForReader } from "@/lib/reader-chapter-load";
import { isOnWifi } from "@/lib/use-translation-download";
import {
  isTranslationFullyDownloaded,
  supportsFullTranslationDownload,
} from "@/lib/translation-offline-capability";
import { startTranslationDownload } from "@/lib/translation-download";
import { TranslationOfflineStatus } from "@/src/features/reader/TranslationOfflineStatus";
import { nativeTabSheetBottomInsetPx } from "@/lib/native-tab-chrome";
import { isTabletLayout } from "@/lib/tablet-layout";
import { readerPickerSheetMaxWidthPx } from "@/src/features/reader/readerSettingsPanelChrome";
import { READER_MENU_SLIDE_FROM_PX } from "@/src/features/reader/useReaderGestures";
import { pickerFlashListPerfProps } from "@/src/features/reader/pickerFlashListChrome";
import { M3Snackbar } from "@/src/components/m3/M3Snackbar";

const PIN_LIMIT_SNACKBAR_MESSAGE = `You can pin up to ${MAX_PINNED_TRANSLATIONS} translations. Unpin older ones to add another.`;

const M3_SHEET_TOP_RADIUS_PX = 28;

type TranslationPinButtonProps = {
  isPinned: boolean;
  onPress: () => void;
  ui: MobileAppThemeBundle["ui"];
};

function TranslationPinButton({ isPinned, onPress, ui }: TranslationPinButtonProps) {
  const isAndroidM3 = Platform.OS === "android";
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={isPinned ? "Unpin translation" : "Pin translation"}
      style={
        isAndroidM3
          ? {
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isPinned ? `${ui.gold}33` : "transparent",
            }
          : {
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isPinned ? `${ui.gold}40` : `${ui.goldMuted}28`,
              borderWidth: 1.5,
              borderColor: isPinned ? ui.gold : `${ui.goldMuted}99`,
            }
      }
    >
      <Ionicons
        name={isPinned ? "star" : "star-outline"}
        size={isAndroidM3 ? 22 : 20}
        color={isPinned ? ui.gold : isAndroidM3 ? ui.brown500 : ui.goldMuted}
      />
    </TouchableOpacity>
  );
}

export type TranslationPickerSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectTranslation: (translationId: string) => void;
  sheetTopPx: number;
  bundle: MobileAppThemeBundle;
  insets: { top: number; bottom: number; left: number; right: number };
  translationPickerItems: TranslationPickerItem[];
  favoriteTranslationIds: string[];
  toggleFavoriteTranslation: (id: string) => ToggleFavoriteTranslationResult;
  resolvedTranslationId: string;
  /** Current reader chapter — used to prefetch chapters when pinning a translation. */
  readerBookSlug?: string;
  readerChapterNumber?: number;
  readerBooks?: BibleBookNavItem[] | null;
};

export function TranslationPickerSheet({
  isOpen,
  onClose,
  onSelectTranslation,
  sheetTopPx,
  bundle,
  insets,
  translationPickerItems,
  favoriteTranslationIds,
  toggleFavoriteTranslation,
  resolvedTranslationId,
  readerBookSlug,
  readerChapterNumber,
  readerBooks,
}: TranslationPickerSheetProps) {
  const colors = bundle.ui;
  const rc = bundle.reader;
  const sheetChrome = useMemo(() => getReaderSheetChrome(bundle), [bundle]);

  const resolvedTranslationApiId: string = isTranslationId(resolvedTranslationId)
    ? getExternalApiId(resolvedTranslationId)
    : resolvedTranslationId;

  const [searchQuery, setSearchQuery] = useState("");
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const [langSheetKeyboardHeight, setLangSheetKeyboardHeight] = useState(0);
  const [searchKeyboardHeight, setSearchKeyboardHeight] = useState(0);
  const [langSearch, setLangSearch] = useState("");
  const [langFilter, setLangFilter] = useState<string | null>(null);
  const [pinLimitSnackbarVisible, setPinLimitSnackbarVisible] = useState(false);

  const screenHeight = Dimensions.get("screen").height;
  const dropSlideAnim = useRef(new Animated.Value(0)).current;
  const dropOpacityAnim = useRef(new Animated.Value(0)).current;
  const translationPickerSheetTranslateY = useRef(new Animated.Value(0)).current;
  const translationPickerSheetClosingRef = useRef(false);
  const translationPickerSheetDragStartYRef = useRef(0);
  const langSheetTranslateY = useRef(new Animated.Value(0)).current;
  const langSheetClosingRef = useRef(false);
  const langSheetDragStartYRef = useRef(0);
  const langSearchInputRef = useRef<TextInput>(null);
  const translationListFlashListRef = useRef<FlashListRef<TranslationPickerItem>>(null);

  const { contentReady, notifySheetAnimatedIn } = useDeferSheetContentMount(isOpen);
  const { contentReady: langListReady, notifySheetAnimatedIn: notifyLangSheetAnimatedIn } =
    useDeferSheetContentMount(langSheetOpen, NESTED_SHEET_OPEN_DURATION_MS);

  const availableLanguages = useMemo(
    () => getTranslationLanguageFilterOptions(translationPickerItems),
    [translationPickerItems],
  );

  const filteredLanguages = useMemo(() => {
    const q = langSearch.trim().toLowerCase();
    if (!q) return availableLanguages;
    return availableLanguages.filter((l) => l.toLowerCase().includes(q));
  }, [availableLanguages, langSearch]);

  const isFilteringTranslations = useMemo(
    () => searchQuery.trim().length > 0 || langFilter != null,
    [searchQuery, langFilter],
  );

  const filteredTranslations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = translationPickerItems.filter((item) => {
      if (langFilter && item.languageSection !== langFilter) return false;
      if (!query) return true;
      const abbr = getTranslationPickerAbbreviation(item).toLowerCase();
      const language = item.languageSection.toLowerCase();
      return (
        item.label.toLowerCase().includes(query) ||
        abbr.includes(query) ||
        language.includes(query)
      );
    });
    if (langFilter != null) {
      return filtered.slice().sort(compareTranslationPickerAbbreviations);
    }
    return filtered;
  }, [langFilter, searchQuery, translationPickerItems]);

  /** Full browse list; pinned rows stay in the header when not filtering. */
  const translationListData = useMemo(() => {
    if (isFilteringTranslations) return filteredTranslations;
    const pinnedSet = new Set(favoriteTranslationIds);
    return filteredTranslations.filter((item) => !pinnedSet.has(item.id));
  }, [favoriteTranslationIds, filteredTranslations, isFilteringTranslations]);

  const showResults = translationListData.length > 0 || isFilteringTranslations;
  const languageFilterActive = langFilter != null;
  const showPinnedInPicker = !languageFilterActive;

  const sheetKeyboardMode = searchKeyboardHeight > 0;
  const sheetKeyboardTopPx = useMemo(() => insets.top + 8, [insets.top]);
  const sheetKeyboardBottomPx = useMemo(
    () => searchKeyboardHeight + Math.max(insets.bottom, 12),
    [searchKeyboardHeight, insets.bottom],
  );

  const translationSheetViewportMaxH = useMemo(
    () => Math.max(280, screenHeight - sheetTopPx - Math.max(insets.bottom, 12) - 10),
    [screenHeight, sheetTopPx, insets.bottom],
  );

  const translationCompactScrollMaxH = useMemo(
    () => Math.max(160, translationSheetViewportMaxH - 268),
    [translationSheetViewportMaxH],
  );

  const langSheetTopPx = useMemo(() => Math.max(insets.top + 66, 38), [insets.top]);
  const langSheetDefaultMaxH = useMemo(
    () =>
      Math.min(
        screenHeight * 0.82,
        screenHeight - langSheetTopPx - Math.max(insets.bottom, 12) - 8,
      ),
    [screenHeight, langSheetTopPx, insets.bottom],
  );
  const langSheetMaxHeight = useMemo(() => {
    if (langSheetKeyboardHeight <= 0) return langSheetDefaultMaxH;
    return Math.max(
      220,
      Math.min(langSheetDefaultMaxH, screenHeight - langSheetTopPx - langSheetKeyboardHeight - 12),
    );
  }, [langSheetKeyboardHeight, langSheetDefaultMaxH, screenHeight, langSheetTopPx]);
  const langSheetListBodyHeight = useMemo(() => Math.max(120, langSheetMaxHeight - 254), [langSheetMaxHeight]);

  const dismissLangSearchKeyboard = useCallback(() => {
    langSearchInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const closeLangSheet = useCallback(() => {
    langSearchInputRef.current?.blur();
    Keyboard.dismiss();
    setLangSheetOpen(false);
    setLangSearch("");
    langSheetTranslateY.setValue(0);
  }, [langSheetTranslateY]);

  const animateCloseTranslationPickerSheet = useCallback(
    (velocityY = 0, draggedY = 0) => {
      if (translationPickerSheetClosingRef.current) return;
      translationPickerSheetClosingRef.current = true;
      const h = Dimensions.get("window").height;
      const targetY = h + 56;
      const vel = Math.max(0, velocityY);
      const duration = Math.max(170, Math.min(340, Math.round(300 - Math.min(1.85, vel) * 88)));
      translationPickerSheetTranslateY.stopAnimation();
      const clamped = Math.max(0, draggedY);
      if (clamped > 0) translationPickerSheetTranslateY.setValue(clamped);
      Animated.timing(translationPickerSheetTranslateY, {
        toValue: targetY,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        translationPickerSheetClosingRef.current = false;
        translationPickerSheetTranslateY.setValue(0);
        onClose();
      });
    },
    [translationPickerSheetTranslateY, onClose],
  );

  const onTranslationPickerDismissGestureEvent = useCallback(
    (e: PanGestureHandlerGestureEvent) => {
      if (translationPickerSheetClosingRef.current) return;
      const ty = e.nativeEvent.translationY;
      translationPickerSheetTranslateY.setValue(
        Math.max(0, translationPickerSheetDragStartYRef.current + ty),
      );
    },
    [translationPickerSheetTranslateY],
  );

  const onTranslationPickerDismissGestureStateChange = useCallback(
    (e: PanGestureHandlerStateChangeEvent) => {
      const { state, oldState, velocityY, translationY } = e.nativeEvent;
      if (state === State.ACTIVE && oldState !== State.ACTIVE) {
        translationPickerSheetTranslateY.stopAnimation((value: number) => {
          translationPickerSheetDragStartYRef.current = value;
        });
      }
      if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
        if (translationPickerSheetClosingRef.current) return;
        const ty = translationY ?? 0;
        const y = Math.max(0, translationPickerSheetDragStartYRef.current + ty);
        const vyPxPerS = Math.abs(velocityY ?? 0);
        const velForCloseAnim = Math.min(1.85, vyPxPerS / 520);
        if (y > 90 || vyPxPerS > 520) {
          animateCloseTranslationPickerSheet(velForCloseAnim, y);
          return;
        }
        Animated.spring(translationPickerSheetTranslateY, {
          toValue: 0,
          velocity: Math.max(0, (velocityY ?? 0) / 1000),
          friction: 9,
          tension: 75,
          useNativeDriver: true,
        }).start();
      }
    },
    [animateCloseTranslationPickerSheet, translationPickerSheetTranslateY],
  );

  const animateCloseLangSheetSlide = useCallback(
    (velocityY = 0, draggedY = 0) => {
      if (langSheetClosingRef.current) return;
      langSheetClosingRef.current = true;
      const h = Dimensions.get("window").height;
      const targetY = h + 56;
      const vel = Math.max(0, velocityY);
      const duration = Math.max(170, Math.min(340, Math.round(300 - Math.min(1.85, vel) * 88)));
      langSheetTranslateY.stopAnimation();
      const clamped = Math.max(0, draggedY);
      if (clamped > 0) langSheetTranslateY.setValue(clamped);
      Animated.timing(langSheetTranslateY, {
        toValue: targetY,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        langSheetClosingRef.current = false;
        langSheetTranslateY.setValue(0);
        closeLangSheet();
      });
    },
    [langSheetTranslateY, closeLangSheet],
  );

  const onLangSheetDismissGestureEvent = useCallback(
    (e: PanGestureHandlerGestureEvent) => {
      if (langSheetClosingRef.current) return;
      const ty = e.nativeEvent.translationY;
      langSheetTranslateY.setValue(Math.max(0, langSheetDragStartYRef.current + ty));
    },
    [langSheetTranslateY],
  );

  const onLangSheetDismissGestureStateChange = useCallback(
    (e: PanGestureHandlerStateChangeEvent) => {
      const { state, oldState, velocityY, translationY } = e.nativeEvent;
      if (state === State.ACTIVE && oldState !== State.ACTIVE) {
        langSheetTranslateY.stopAnimation((value: number) => {
          langSheetDragStartYRef.current = value;
        });
      }
      if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
        if (langSheetClosingRef.current) return;
        const ty = translationY ?? 0;
        const y = Math.max(0, langSheetDragStartYRef.current + ty);
        const vyPxPerS = Math.abs(velocityY ?? 0);
        const velForCloseAnim = Math.min(1.85, vyPxPerS / 520);
        if (y > 90 || vyPxPerS > 520) {
          animateCloseLangSheetSlide(velForCloseAnim, y);
          return;
        }
        Animated.spring(langSheetTranslateY, {
          toValue: 0,
          velocity: Math.max(0, (velocityY ?? 0) / 1000),
          friction: 9,
          tension: 75,
          useNativeDriver: true,
        }).start();
      }
    },
    [animateCloseLangSheetSlide, langSheetTranslateY],
  );

  const onLangSheetBackdropPress = useCallback(() => {
    dismissLangSearchKeyboard();
    if (langSheetClosingRef.current) return;
    hapticLightImpact();
    animateCloseLangSheetSlide(0, 0);
  }, [animateCloseLangSheetSlide, dismissLangSearchKeyboard]);

  const renderLangSheetItem = useCallback(
    ({ item }: { item: string }) => {
      const selected = item === langFilter;
      const ui = bundle.ui;
      const isAndroidM3 = Platform.OS === "android";
      return (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            dismissLangSearchKeyboard();
            hapticLightImpact();
            setLangFilter(item);
            closeLangSheet();
          }}
          style={
            isAndroidM3
              ? {
                  minHeight: 48,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  backgroundColor: selected ? sheetChrome.surfaceContainer : "transparent",
                }
              : {
                  minHeight: 44,
                  borderBottomWidth: 1,
                  borderBottomColor: ui.borderSolid,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 12,
                  backgroundColor: selected ? `${ui.gold}22` : "transparent",
                }
          }
        >
          <Text
            style={{
              fontFamily: isAndroidM3 ? "Inter_400Regular" : "Inter_400Regular",
              fontSize: 16,
              color: isAndroidM3 ? sheetChrome.onSurface : ui.brown800,
            }}
          >
            {item}
          </Text>
          {selected ? (
            <Ionicons name="checkmark" size={20} color={isAndroidM3 ? ui.gold : ui.gold} />
          ) : null}
        </TouchableOpacity>
      );
    },
    [langFilter, closeLangSheet, bundle.ui, dismissLangSearchKeyboard],
  );

  const onBackdropPress = useCallback(() => {
    Keyboard.dismiss();
    if (translationPickerSheetClosingRef.current) return;
    hapticLightImpact();
    animateCloseTranslationPickerSheet(0, 0);
  }, [animateCloseTranslationPickerSheet]);

  const selectTranslation = useCallback(
    (id: string) => {
      Keyboard.dismiss();
      hapticLightImpact();
      if (readerBookSlug && readerChapterNumber != null) {
        const internalId = getInternalIdFromApiId(id);
        prefetchTranslationChaptersForReader(
          internalId ?? id,
          readerBookSlug,
          readerChapterNumber,
          readerBooks,
        );
      }
      onClose();
      const internalId = getInternalIdFromApiId(id);
      onSelectTranslation(internalId ?? id);
    },
    [onClose, onSelectTranslation, readerBookSlug, readerChapterNumber, readerBooks],
  );

  const handleTogglePin = useCallback(
    (id: string, isPinned: boolean) => {
      Keyboard.dismiss();
      const result = toggleFavoriteTranslation(id);
      if (result === "limit_reached") {
        setPinLimitSnackbarVisible(true);
        return;
      }
      if (result === "pinned" && readerBookSlug && readerChapterNumber != null) {
        const internalId = getInternalIdFromApiId(id);
        prefetchTranslationChaptersForReader(
          internalId ?? id,
          readerBookSlug,
          readerChapterNumber,
          readerBooks,
        );
      }
      if (result === "pinned") {
        const internalId = getInternalIdFromApiId(id) ?? id;
        if (
          supportsFullTranslationDownload(internalId) &&
          !isTranslationFullyDownloaded(internalId)
        ) {
          void isOnWifi().then((onWifi) => {
            if (onWifi) {
              void startTranslationDownload(internalId).catch(() => {
                /* progress surfaced in picker row */
              });
            }
          });
        }
      }
    },
    [toggleFavoriteTranslation, readerBookSlug, readerChapterNumber, readerBooks],
  );

  const dismissPinLimitSnackbar = useCallback(() => {
    setPinLimitSnackbarVisible(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      translationPickerSheetClosingRef.current = false;
      translationPickerSheetTranslateY.stopAnimation();
      translationPickerSheetTranslateY.setValue(0);
      setLangSheetOpen(false);
      setLangFilter(null);
      setLangSearch("");
      setSearchQuery("");
      setSearchKeyboardHeight(0);
      setPinLimitSnackbarVisible(false);
      dropSlideAnim.setValue(0);
      dropOpacityAnim.setValue(0);
      return;
    }
    dropSlideAnim.setValue(0);
    dropOpacityAnim.setValue(0);
    if (Platform.OS === "android") {
      Animated.timing(dropOpacityAnim, {
        toValue: 1,
        duration: SHEET_SCRIM_DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      translationPickerSheetTranslateY.setValue(Dimensions.get("window").height);
      Animated.timing(translationPickerSheetTranslateY, {
        toValue: 0,
        duration: SHEET_OPEN_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) notifySheetAnimatedIn();
      });
      return;
    }
    Animated.parallel([
      Animated.timing(dropSlideAnim, {
        toValue: 1,
        duration: SHEET_OPEN_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dropOpacityAnim, {
        toValue: 1,
        duration: SHEET_SCRIM_DURATION_MS + 40,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) notifySheetAnimatedIn();
    });
  }, [isOpen, dropSlideAnim, dropOpacityAnim, translationPickerSheetTranslateY, notifySheetAnimatedIn]);

  useEffect(() => {
    if (!isOpen || Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (langSheetOpen) {
        onLangSheetBackdropPress();
        return true;
      }
      onBackdropPress();
      return true;
    });
    return () => sub.remove();
  }, [isOpen, langSheetOpen, onBackdropPress, onLangSheetBackdropPress]);

  useEffect(() => {
    if (!langSheetOpen || Platform.OS !== "android") return;
    langSheetTranslateY.setValue(Dimensions.get("window").height * 0.35);
    Animated.timing(langSheetTranslateY, {
      toValue: 0,
      duration: NESTED_SHEET_OPEN_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) notifyLangSheetAnimatedIn();
    });
  }, [langSheetOpen, langSheetTranslateY, notifyLangSheetAnimatedIn]);

  useEffect(() => {
    if (!langSheetOpen) {
      langSheetClosingRef.current = false;
      langSheetTranslateY.stopAnimation();
      langSheetTranslateY.setValue(0);
    }
  }, [langSheetOpen, langSheetTranslateY]);

  useEffect(() => {
    if (!langSheetOpen) {
      setLangSheetKeyboardHeight(0);
      return;
    }
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: KeyboardEvent) => setLangSheetKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setLangSheetKeyboardHeight(0);
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [langSheetOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearchKeyboardHeight(0);
      return;
    }
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: KeyboardEvent) => setSearchKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setSearchKeyboardHeight(0);
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [isOpen]);

  const pinnedTranslations = useMemo(() => {
    const byId = new Map(translationPickerItems.map((item) => [item.id, item]));
    return favoriteTranslationIds
      .map((id) => byId.get(id))
      .filter((item): item is TranslationPickerItem => item != null);
  }, [translationPickerItems, favoriteTranslationIds]);
  const ui = colors;
  const { width: screenW, height: windowH } = useWindowDimensions();
  const isAndroidSheet = Platform.OS === "android";
  const isTablet = isTabletLayout(screenW, windowH);
  const pickerMaxW = readerPickerSheetMaxWidthPx(screenW, isTablet);
  const sheetOuterW = isAndroidSheet
    ? pickerMaxW
    : Math.min(pickerMaxW, screenW - (insets.left + 5) - (insets.right + 5));
  const sheetLeftPx =
    isAndroidSheet || isTablet ? (screenW - sheetOuterW) / 2 : insets.left + 5;
  const m3SheetBottomPad = nativeTabSheetBottomInsetPx(insets.bottom, 0);
  const m3SheetMaxHeight = Math.min(screenHeight * 0.92, screenHeight - insets.top - 48);

  const translationRowStyle = useCallback(
    (isSelected: boolean, isFirstPinned = false) => {
      if (isAndroidSheet) {
        return {
          minHeight: 56,
          borderRadius: 12,
          backgroundColor: isSelected
            ? sheetChrome.surfaceContainer
            : isFirstPinned
              ? `${ui.gold}18`
              : "transparent",
          paddingHorizontal: 16,
          paddingVertical: 10,
          flexDirection: "row" as const,
          alignItems: "center" as const,
          gap: 12,
        };
      }
      return {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: ui.borderSolid,
        backgroundColor: isSelected || isFirstPinned ? `${ui.gold}22` : rc.popoverRow,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 10,
      };
    },
    [isAndroidSheet, rc.popoverRow, ui.borderSolid, ui.gold],
  );

  const sheetSurfaceStyle = isAndroidSheet
    ? {
        backgroundColor: rc.sceneSurface,
        borderTopLeftRadius: M3_SHEET_TOP_RADIUS_PX,
        borderTopRightRadius: M3_SHEET_TOP_RADIUS_PX,
        overflow: "hidden" as const,
        elevation: 10,
        shadowColor: rc.popoverShadow,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
      }
    : {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.borderSolid,
        backgroundColor: rc.popoverSurface,
        overflow: "hidden" as const,
        shadowColor: rc.popoverShadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
        elevation: 8,
      };

  const sheetContentBg = isAndroidSheet ? rc.sceneSurface : ui.parchment;
  const sheetTitleColor = isAndroidSheet ? sheetChrome.onSurface : ui.brown800;
  const sheetMutedColor = isAndroidSheet ? sheetChrome.onSurfaceVariant : ui.tan300;
  const skeletonBoneColor = isAndroidSheet ? sheetChrome.surfaceContainer : `${ui.borderSolid}99`;
  const searchFieldStyle = isAndroidSheet
    ? {
        flex: 1,
        height: 48,
        borderRadius: 24,
        backgroundColor: sheetChrome.surfaceContainer,
        paddingHorizontal: 16,
        justifyContent: "center" as const,
      }
    : {
        flex: 1,
        height: 42,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: ui.borderSolid,
        backgroundColor: rc.popoverRow,
        paddingHorizontal: 14,
        justifyContent: "center" as const,
      };
  const filterButtonStyle = isAndroidSheet
    ? {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center" as const,
        justifyContent: "center" as const,
      }
    : {
        width: 36,
        height: 36,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: ui.borderSolid,
        backgroundColor: rc.popoverRow,
        alignItems: "center" as const,
        justifyContent: "center" as const,
      };

  const renderTranslationRow = (
    item: TranslationPickerItem,
    opts: { isPinned: boolean; isFirstPinned?: boolean; keyPrefix?: string },
  ) => {
    const isSelected = item.id === resolvedTranslationApiId;
    const abbr = getTranslationPickerAbbreviation(item);
    const showDivider = !isAndroidSheet;
    const rowKey = opts.keyPrefix ? `${opts.keyPrefix}-${item.id}` : item.id;
    return (
      <View key={rowKey}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => selectTranslation(item.id)}
          style={translationRowStyle(isSelected, opts.isFirstPinned)}
        >
          <Text
            style={{
              fontFamily: "Lora_400Regular_Italic",
              fontSize: isAndroidSheet ? 13 : 12,
              color: isAndroidSheet ? sheetChrome.onSurfaceVariant : ui.brown800,
              width: 48,
            }}
          >
            {abbr}
          </Text>
          {showDivider ? (
            <View
              style={{
                width: 1,
                alignSelf: "stretch",
                backgroundColor: isSelected ? `${ui.gold}73` : ui.borderSolid,
                opacity: isSelected ? 1 : 0.9,
              }}
            />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: isAndroidSheet ? "Inter_400Regular" : "Inter_400Regular",
                fontSize: isAndroidSheet ? 16 : 14,
                color: isAndroidSheet ? sheetChrome.onSurface : ui.brown800,
              }}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: isAndroidSheet ? 14 : 11,
                color: sheetMutedColor,
              }}
            >
              {item.languageSection}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {isSelected ? <Ionicons name="checkmark" size={isAndroidSheet ? 20 : 15} color={ui.gold} /> : null}
            <TranslationPinButton
              isPinned={opts.isPinned}
              onPress={() => handleTogglePin(item.id, opts.isPinned)}
              ui={ui}
            />
          </View>
        </TouchableOpacity>
        <View style={{ paddingLeft: isAndroidSheet ? 64 : 60, paddingRight: 16, paddingBottom: 8 }}>
          <TranslationOfflineStatus
            translationId={item.id}
            ui={ui}
            mutedColor={sheetMutedColor}
          />
        </View>
      </View>
    );
  };

  const renderTranslationListItem = useCallback(
    ({ item }: { item: TranslationPickerItem }) =>
      renderTranslationRow(item, {
        isPinned: favoriteTranslationIds.includes(item.id),
        keyPrefix: showResults ? "result" : undefined,
      }),
    [favoriteTranslationIds, showResults],
  );

  const renderTranslationPickerHeader = useCallback(() => {
    return (
      <>
        {showPinnedInPicker ? (
          <>
            <Pressable
              onPress={Keyboard.dismiss}
              accessibilityRole="button"
              accessibilityLabel="Hide keyboard"
            >
              <Text
                style={{
                  fontFamily: isAndroidSheet ? "Inter_500Medium" : "Inter_400Regular",
                  fontSize: isAndroidSheet ? 14 : 10,
                  letterSpacing: isAndroidSheet ? 0.1 : 1,
                  textTransform: isAndroidSheet ? "none" : "uppercase",
                  color: sheetMutedColor,
                  opacity: isAndroidSheet ? 1 : 0.75,
                  marginBottom: 8,
                }}
              >
                Pinned
              </Text>
            </Pressable>

            <View style={{ gap: isAndroidSheet ? 2 : 8, marginBottom: 16 }}>
              {pinnedTranslations.length > 0 ? (
                pinnedTranslations.map((item, index) =>
                  renderTranslationRow(item, { isPinned: true, isFirstPinned: index === 0 }),
                )
              ) : (
                <Pressable
                  onPress={Keyboard.dismiss}
                  accessibilityRole="button"
                  accessibilityLabel="Hide keyboard"
                >
                  <View style={{ gap: 6, paddingVertical: 6 }}>
                    {!isAndroidSheet ? (
                      <>
                        <View
                          style={{
                            height: 4,
                            width: "72%",
                            borderRadius: 999,
                            backgroundColor: ui.borderSolid,
                          }}
                        />
                        <View
                          style={{
                            height: 4,
                            width: "58%",
                            borderRadius: 999,
                            backgroundColor: ui.borderSolid,
                          }}
                        />
                        <View
                          style={{
                            height: 4,
                            width: "43%",
                            borderRadius: 999,
                            backgroundColor: ui.borderSolid,
                          }}
                        />
                      </>
                    ) : null}
                    <Text
                      style={{
                        fontFamily: isAndroidSheet ? "Inter_400Regular" : "Lora_400Regular_Italic",
                        fontSize: isAndroidSheet ? 14 : 12,
                        color: sheetMutedColor,
                      }}
                    >
                      Star a translation to pin it here
                    </Text>
                  </View>
                </Pressable>
              )}
            </View>
          </>
        ) : null}

        {showResults && languageFilterActive ? (
          <Text
            style={{
              fontFamily: isAndroidSheet ? "Inter_500Medium" : "Inter_400Regular",
              fontSize: isAndroidSheet ? 14 : 10,
              letterSpacing: isAndroidSheet ? 0.1 : 1,
              textTransform: isAndroidSheet ? "none" : "uppercase",
              color: sheetMutedColor,
              opacity: isAndroidSheet ? 1 : 0.75,
              marginBottom: 4,
            }}
          >
            {langFilter}
          </Text>
        ) : null}

        {showResults && !isFilteringTranslations && translationListData.length > 0 ? (
          <Text
            style={{
              fontFamily: isAndroidSheet ? "Inter_500Medium" : "Inter_400Regular",
              fontSize: isAndroidSheet ? 14 : 10,
              letterSpacing: isAndroidSheet ? 0.1 : 1,
              textTransform: isAndroidSheet ? "none" : "uppercase",
              color: sheetMutedColor,
              opacity: isAndroidSheet ? 1 : 0.75,
              marginBottom: 8,
            }}
          >
            All translations
          </Text>
        ) : null}
      </>
    );
  }, [
    isAndroidSheet,
    langFilter,
    languageFilterActive,
    pinnedTranslations,
    sheetMutedColor,
    isFilteringTranslations,
    showPinnedInPicker,
    showResults,
    translationListData.length,
    ui.borderSolid,
  ]);

  const renderTranslationPickerEmpty = useCallback(() => {
    if (!isFilteringTranslations) return null;
    return (
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: isAndroidSheet ? 14 : 13,
          color: sheetMutedColor,
          paddingVertical: 8,
        }}
      >
        No translations found{langFilter ? ` for ${langFilter}` : ""}.
      </Text>
    );
  }, [isAndroidSheet, isFilteringTranslations, langFilter, sheetMutedColor]);

  const translationListExtraData = useMemo(
    () => ({
      resolvedTranslationApiId,
      favoriteTranslationIds,
      langFilter,
      searchQuery,
      listCount: translationListData.length,
    }),
    [favoriteTranslationIds, langFilter, resolvedTranslationApiId, searchQuery, translationListData.length],
  );

  const pickerBody = (
    <>
      <PanGestureHandler
        onGestureEvent={onTranslationPickerDismissGestureEvent}
        onHandlerStateChange={onTranslationPickerDismissGestureStateChange}
        activeOffsetY={8}
        failOffsetX={[-32, 32]}
      >
        <GestureHandlerTouchableOpacity
          activeOpacity={1}
          onPress={Keyboard.dismiss}
          accessibilityLabel="Translation picker sheet"
          accessibilityHint="Tap to hide keyboard, or swipe down on the handle to close"
          style={{
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: isAndroidSheet ? 12 : 6,
            paddingBottom: isAndroidSheet ? 4 : 8,
            minHeight: 44,
          }}
        >
          <View
            pointerEvents="none"
            style={{
              width: isAndroidSheet ? 32 : 40,
              height: isAndroidSheet ? 4 : 5,
              borderRadius: 2,
              backgroundColor: isAndroidSheet ? "rgba(28,27,31,0.4)" : "rgba(0,0,0,0.22)",
            }}
          />
        </GestureHandlerTouchableOpacity>
      </PanGestureHandler>
      <View
        style={{
          ...(showResults ? { flex: 1, minHeight: 0 } : {}),
          backgroundColor: sheetContentBg,
          paddingHorizontal: isAndroidSheet ? 24 : 16,
          paddingTop: isAndroidSheet ? 0 : 6,
          paddingBottom: isAndroidSheet ? 16 : 14,
        }}
      >
        <Pressable onPress={Keyboard.dismiss} accessibilityRole="button" accessibilityLabel="Hide keyboard">
          <Text
            style={{
              fontFamily: isAndroidSheet ? "Inter_500Medium" : "Inter_600SemiBold",
              fontSize: isAndroidSheet ? 22 : 20,
              lineHeight: isAndroidSheet ? 28 : undefined,
              color: sheetTitleColor,
              marginBottom: isAndroidSheet ? 16 : 14,
              textAlign: isAndroidSheet ? "left" : "left",
            }}
          >
            Choose a Translation
          </Text>
        </Pressable>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <View style={searchFieldStyle}>
            <TextInput
              placeholder="Search translation"
              placeholderTextColor={sheetMutedColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: isAndroidSheet ? 16 : 14,
                color: isAndroidSheet ? sheetChrome.onSurface : ui.brown800,
              }}
            />
          </View>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              Keyboard.dismiss();
              requestAnimationFrame(() => {
                setSearchQuery("");
                langSheetTranslateY.setValue(0);
                setLangSheetOpen(true);
              });
            }}
            style={filterButtonStyle}
            accessibilityRole="button"
            accessibilityLabel="Filter by language"
          >
            <FilterListIcon size={isAndroidSheet ? 24 : 16} color={isAndroidSheet ? sheetChrome.onSurface : ui.brown800} />
          </TouchableOpacity>
        </View>

        {languageFilterActive ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <View
              style={
                isAndroidSheet
                  ? {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: sheetChrome.surfaceContainer,
                      paddingLeft: 12,
                      paddingRight: 4,
                    }
                  : {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: ui.borderSolid,
                      backgroundColor: `${ui.gold}18`,
                      paddingLeft: 12,
                      paddingRight: 4,
                      paddingVertical: 4,
                    }
              }
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: isAndroidSheet ? 14 : 13,
                  color: isAndroidSheet ? sheetChrome.onSurface : ui.brown800,
                }}
              >
                {langFilter}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setLangFilter(null);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Clear ${langFilter} language filter`}
                style={
                  isAndroidSheet
                    ? {
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        alignItems: "center",
                        justifyContent: "center",
                      }
                    : undefined
                }
              >
                <Ionicons
                  name="close"
                  size={isAndroidSheet ? 18 : 16}
                  color={isAndroidSheet ? sheetChrome.onSurfaceVariant : ui.tan300}
                />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {!isAndroidSheet ? (
          <Pressable
            onPress={Keyboard.dismiss}
            accessibilityRole="button"
            accessibilityLabel="Hide keyboard"
            style={{ marginBottom: 12, minHeight: 12, justifyContent: "center" }}
          >
            <View style={{ height: 1, backgroundColor: ui.borderSolid, opacity: 0.9 }} />
          </Pressable>
        ) : null}

        {contentReady ? (
          <FlashList
            ref={translationListFlashListRef}
            data={translationListData}
            keyExtractor={(item) => item.id}
            renderItem={renderTranslationListItem}
            ListHeaderComponent={renderTranslationPickerHeader}
            ListEmptyComponent={renderTranslationPickerEmpty}
            extraData={translationListExtraData}
            {...({ estimatedItemSize: isAndroidSheet ? 72 : 64 } as Record<string, unknown>)}
            style={
              showResults
                ? { flex: 1, minHeight: 0 }
                : isAndroidSheet
                  ? { maxHeight: Math.min(m3SheetMaxHeight * 0.5, 320) }
                  : { maxHeight: translationCompactScrollMaxH }
            }
            contentContainerStyle={{ gap: isAndroidSheet ? 2 : 8, paddingBottom: 16 }}
            showsVerticalScrollIndicator={isAndroidSheet}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "on-drag" : "none"}
            onScrollBeginDrag={() => Keyboard.dismiss()}
            nestedScrollEnabled={isAndroidSheet}
            {...pickerFlashListPerfProps}
          />
        ) : (
          <SheetContentSkeleton
            boneColor={skeletonBoneColor}
            rowHeight={isAndroidSheet ? 56 : 52}
            rows={showResults ? 6 : 4}
            style={
              showResults
                ? { flex: 1, minHeight: 0 }
                : isAndroidSheet
                  ? { maxHeight: Math.min(m3SheetMaxHeight * 0.5, 320) }
                  : { maxHeight: translationCompactScrollMaxH }
            }
          />
        )}

        {!isAndroidSheet ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              Keyboard.dismiss();
              if (translationPickerSheetClosingRef.current) return;
              hapticLightImpact();
              animateCloseTranslationPickerSheet(0, 0);
            }}
            style={{
              width: "100%",
              borderRadius: 999,
              paddingVertical: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: ui.brown800,
            }}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: ui.parchment }}>Done</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  );

  const renderLangSheetContent = () => (
    <View>
      <PanGestureHandler
        onGestureEvent={onLangSheetDismissGestureEvent}
        onHandlerStateChange={onLangSheetDismissGestureStateChange}
        activeOffsetY={8}
        failOffsetX={[-32, 32]}
      >
        <GestureHandlerTouchableOpacity
          activeOpacity={1}
          onPress={dismissLangSearchKeyboard}
          accessibilityLabel="Language filters sheet"
          accessibilityHint="Tap to hide keyboard, or swipe down on the handle to close"
          style={{
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: isAndroidSheet ? 12 : 8,
            paddingBottom: isAndroidSheet ? 4 : 6,
            minHeight: 44,
          }}
        >
          <View
            pointerEvents="none"
            style={{
              width: isAndroidSheet ? 32 : 40,
              height: isAndroidSheet ? 4 : 5,
              borderRadius: 2,
              backgroundColor: isAndroidSheet ? "rgba(28,27,31,0.4)" : "rgba(0,0,0,0.22)",
            }}
          />
        </GestureHandlerTouchableOpacity>
      </PanGestureHandler>
      <View style={{ paddingHorizontal: isAndroidSheet ? 24 : 16, paddingBottom: 10 }}>
        <View
          style={{
            alignItems: isAndroidSheet ? "flex-start" : "center",
            justifyContent: "center",
            marginBottom: 10,
            minHeight: 24,
          }}
        >
          <GestureHandlerTouchableOpacity
            activeOpacity={1}
            onPress={dismissLangSearchKeyboard}
            accessibilityRole="button"
            accessibilityLabel="Hide keyboard"
          >
            <Text
              style={{
                fontFamily: isAndroidSheet ? "Inter_500Medium" : "Inter_600SemiBold",
                fontSize: isAndroidSheet ? 22 : 18,
                color: isAndroidSheet ? sheetChrome.onSurface : bundle.ui.brown800,
              }}
            >
              Language
            </Text>
          </GestureHandlerTouchableOpacity>
          {langFilter != null ? (
            <TouchableOpacity
              style={{ position: "absolute", right: 0, top: 0, bottom: 0, justifyContent: "center" }}
              onPress={() => {
                dismissLangSearchKeyboard();
                setLangFilter(null);
                closeLangSheet();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 14,
                  color: isAndroidSheet ? ui.gold : bundle.ui.tan300,
                }}
              >
                Clear
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View
          style={
            isAndroidSheet
              ? {
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: sheetChrome.surfaceContainer,
                  paddingHorizontal: 16,
                  justifyContent: "center",
                  marginBottom: 8,
                }
              : {
                  height: 42,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: bundle.ui.borderSolid,
                  backgroundColor: bundle.reader.popoverRow,
                  paddingHorizontal: 14,
                  justifyContent: "center",
                  marginBottom: 8,
                }
          }
        >
          <TextInput
            ref={langSearchInputRef}
            value={langSearch}
            onChangeText={setLangSearch}
            placeholder="Search language"
            placeholderTextColor={isAndroidSheet ? sheetChrome.onSurfaceVariant : bundle.ui.tan300}
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: isAndroidSheet ? 16 : 14,
              color: isAndroidSheet ? sheetChrome.onSurface : bundle.ui.brown800,
            }}
          />
        </View>
      </View>
      {langListReady ? (
      <GHFlatList
        key={langSheetOpen ? "lang-sheet-open" : "lang-sheet-closed"}
        data={filteredLanguages}
        extraData={filteredLanguages}
        keyExtractor={(item) => item}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "on-drag" : "none"}
        onScrollBeginDrag={dismissLangSearchKeyboard}
        style={{ height: langSheetListBodyHeight }}
        showsVerticalScrollIndicator
        persistentScrollbar={Platform.OS === "android"}
        indicatorStyle="black"
        removeClippedSubviews={false}
        initialNumToRender={16}
        windowSize={8}
        contentContainerStyle={{ paddingHorizontal: isAndroidSheet ? 0 : 16, paddingBottom: 10 }}
        ListFooterComponent={
          <Pressable
            style={{ minHeight: isAndroidSheet ? 24 : 72 }}
            onPress={dismissLangSearchKeyboard}
            accessibilityRole="button"
            accessibilityLabel="Hide keyboard"
          />
        }
        renderItem={renderLangSheetItem}
      />
      ) : (
        <SheetContentSkeleton
          boneColor={skeletonBoneColor}
          rowHeight={isAndroidSheet ? 48 : 44}
          rows={8}
          style={{ height: langSheetListBodyHeight, paddingHorizontal: isAndroidSheet ? 24 : 16 }}
        />
      )}
      {!isAndroidSheet ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 12) + 8 }}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              dismissLangSearchKeyboard();
              if (langSheetClosingRef.current) return;
              hapticLightImpact();
              closeLangSheet();
            }}
            style={{
              width: "100%",
              borderRadius: 999,
              paddingVertical: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: bundle.ui.brown800,
            }}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: bundle.ui.parchment }}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  return (
    <Modal visible={isOpen} transparent animationType="none" statusBarTranslucent onRequestClose={onBackdropPress}>
      <View style={{ flex: 1 }} pointerEvents="box-none">
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: rc.menuScrim, opacity: dropOpacityAnim }]}
          pointerEvents="none"
        />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onBackdropPress}
          accessibilityLabel="Dismiss translation picker"
        />
        {isAndroidSheet ? (
          <View
            pointerEvents="box-none"
            style={{
              flex: 1,
              justifyContent: sheetKeyboardMode ? "flex-start" : "flex-end",
              alignItems: "center",
            }}
          >
            <Animated.View
              pointerEvents="box-none"
              style={{
                width: sheetOuterW,
                ...(sheetKeyboardMode
                  ? {
                      position: "absolute",
                      top: sheetKeyboardTopPx,
                      left: sheetLeftPx,
                      width: sheetOuterW,
                      bottom: sheetKeyboardBottomPx,
                    }
                  : showResults
                    ? {
                        height: m3SheetMaxHeight,
                        maxHeight: m3SheetMaxHeight,
                      }
                    : {
                        maxHeight: Math.min(m3SheetMaxHeight, screenHeight * 0.72),
                      }),
                transform: [{ translateY: translationPickerSheetTranslateY }],
              }}
            >
              <View
                style={{
                  ...sheetSurfaceStyle,
                  ...(sheetKeyboardMode || showResults ? { flex: 1, minHeight: 0 } : {}),
                  paddingBottom: m3SheetBottomPad,
                }}
              >
                <Animated.View
                  style={{
                    ...(sheetKeyboardMode || showResults ? { flex: 1, minHeight: 0 } : {}),
                  }}
                >
                  {pickerBody}
                </Animated.View>
              </View>
            </Animated.View>
          </View>
        ) : (
          <Animated.View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              ...(sheetKeyboardMode || showResults
                ? {
                    top: sheetKeyboardMode ? sheetKeyboardTopPx : insets.top + 8,
                    left: sheetLeftPx,
                    width: sheetOuterW,
                    bottom: sheetKeyboardMode ? sheetKeyboardBottomPx : insets.bottom + 10,
                  }
                : {
                    top: sheetTopPx,
                    left: sheetLeftPx,
                    width: sheetOuterW,
                    maxHeight: translationSheetViewportMaxH,
                  }),
              opacity: dropOpacityAnim,
              transform: [
                {
                  translateY: dropSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-READER_MENU_SLIDE_FROM_PX, 0],
                  }),
                },
              ],
            }}
          >
            <View
              style={{
                ...sheetSurfaceStyle,
                ...(showResults ? { flex: 1, minHeight: 0 } : {}),
              }}
            >
              <Animated.View
                style={{
                  ...(showResults ? { flex: 1, minHeight: 0 } : {}),
                  transform: [{ translateY: translationPickerSheetTranslateY }],
                }}
              >
                {pickerBody}
              </Animated.View>
            </View>
          </Animated.View>
        )}
        {langSheetOpen ? (
          <View
            pointerEvents="box-none"
            style={{
              ...StyleSheet.absoluteFill,
              zIndex: 5,
            }}
          >
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: `${bundle.ui.brown800}66` }]}
              onPress={onLangSheetBackdropPress}
              accessibilityRole="button"
              accessibilityLabel="Dismiss language filters"
            />
            {isAndroidSheet ? (
              <View pointerEvents="box-none" style={{ flex: 1, justifyContent: "flex-end", alignItems: "center" }}>
                <Animated.View
                  pointerEvents="box-none"
                  style={{
                    width: sheetOuterW,
                    maxHeight: Math.min(langSheetMaxHeight, screenHeight * 0.75),
                    backgroundColor: rc.sceneSurface,
                    borderTopLeftRadius: M3_SHEET_TOP_RADIUS_PX,
                    borderTopRightRadius: M3_SHEET_TOP_RADIUS_PX,
                    overflow: "hidden",
                    elevation: 12,
                    paddingBottom: m3SheetBottomPad,
                    transform: [{ translateY: langSheetTranslateY }],
                  }}
                >
                  {renderLangSheetContent()}
                </Animated.View>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={onLangSheetBackdropPress}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss language filters"
                />
                <Animated.View
                  style={{
                    position: "absolute",
                    left: sheetLeftPx,
                    width: sheetOuterW,
                    top: langSheetTopPx,
                    maxHeight: langSheetMaxHeight,
                    backgroundColor: bundle.ui.parchment,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: bundle.ui.borderSolid,
                    overflow: "hidden",
                    transform: [{ translateY: langSheetTranslateY }],
                  }}
                >
                  {renderLangSheetContent()}
                </Animated.View>
              </View>
            )}
          </View>
        ) : null}
        <M3Snackbar
          message={PIN_LIMIT_SNACKBAR_MESSAGE}
          visible={pinLimitSnackbarVisible}
          onDismiss={dismissPinLimitSnackbar}
          bottomInset={m3SheetBottomPad + 8}
        />
      </View>
    </Modal>
  );
}
