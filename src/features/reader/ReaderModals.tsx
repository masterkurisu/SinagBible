import React, { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode, type RefObject } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  type KeyboardEvent,
  type LayoutRectangle,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type {
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import {
  FlatList as GHFlatList,
  NativeViewGestureHandler,
  PanGestureHandler,
  ScrollView as GHScrollView,
  State,
  TouchableOpacity as GestureHandlerTouchableOpacity,
} from "react-native-gesture-handler";
import { FullWindowOverlay } from "react-native-screens";
import { getUsfmBookId } from "@sinag-bible/core";
import type { BibleBookNavItem, BibleChapter } from "@sinag-bible/types";
import { BookIcon } from "@/components/icons/BookIcon";
import { StudyNotesResearchIcon } from "@/components/icons/StudyNotesResearchIcon";
import { ReaderFontSettingsIcon } from "@/components/icons/ReaderFontSettingsIcon";
import { ReaderThemesPaletteIcon } from "@/components/icons/ReaderThemesPaletteIcon";
import { DeleteMyDataIcon } from "@/components/icons/DeleteMyDataIcon";
import { SettingsMoreIcon } from "@/components/icons/SettingsMoreIcon";
import { ReaderSettingsSideSheet } from "@/src/features/reader/ReaderSettingsSideSheet";
import { ReaderThemePickerSheet } from "@/src/features/reader/ReaderThemePickerSheet";
import { M3RichTooltipOverlay } from "@/src/components/m3/M3RichTooltipOverlay";
import {
  getReaderSettingsTooltip,
  type ReaderSettingsTooltipId,
} from "@/src/features/reader/readerSettingsOnboardingSteps";
import { useSettingsRowTooltip } from "@/src/features/reader/useSettingsRowTooltip";
import { measureOnboardingTarget } from "@/src/components/feature-onboarding/measureOnboardingTarget";
import {
  READER_M3_ERROR,
  READER_M3_ERROR_CONTAINER,
  READER_M3_ON_ERROR_CONTAINER,
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
  READER_M3_SURFACE_CONTAINER,
} from "@/src/features/reader/readerSettingsPanelChrome";
import { nativeTabSheetBottomInsetPx, readerSettingsDeleteMyDataPanelBottomPx } from "@/lib/native-tab-chrome";
import { hapticLightImpact, hapticSoftPop } from "@/lib/haptics";
import { BookPickerSheet } from "@/src/features/reader/BookPickerSheet";
export type { BookSelectorViewMode, SelectorTestamentTab } from "@/src/features/reader/BookPickerSheet";
export { ReaderBookSheetWindowOverlay } from "@/src/features/reader/BookPickerSheet";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";

export type ReaderToolsDropdown = "book" | "translation" | "theme";

export { READER_MOBILE_SETTINGS_PANEL_BG } from "@/src/features/reader/readerSettingsPanelChrome";
const COMMENTARY_STORAGE_KEY = "selectedCommentary";
const COMMENTARY_DEFAULT_ID = "tyndale";
const COMMENTARY_API_BASE_URL = "https://bible.helloao.org/api";
const COMMENTARY_REQUEST_TIMEOUT_MS = 10000;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = COMMENTARY_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("request timeout")), timeoutMs);
  });
  try {
    const response = await Promise.race([fetch(input, init), timeoutPromise]);
    return response as Response;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export type ReaderMobileSettingsPanelProps = {
  insets: { top: number; bottom: number; left: number; right: number };
  /** Top padding for the header tools row (safe area + nav chrome). */
  scrollPaddingTop: number;
  padH: number;
  isTabletReaderLayout: boolean;
  screenWidth: number;
  toolsMenuOpen: boolean;
  onCloseToolsMenu: () => void;
  headerTools?: React.ReactNode;
  hideFontSettings?: boolean;
  hideTranslationAndStudyNotes?: boolean;
  onSelectFontSettings?: () => void;
  onSelectThemes: () => void;
  onSelectMore: () => void;
  onSelectTranslation: () => void;
  onSelectCommentary: () => void;
  onSelectDeleteMyData: () => void;
  onSelectVerseCarousel?: () => void;
  /** Theme page background for the settings side sheet. */
  panelBackgroundColor: string;
  /** Theme-aware M3 ripple for settings destinations (Android). */
  rippleColor?: string;
  onSettingsPanelLayout?: () => void;
};

const SETTINGS_MENU_ICON_SIZE = 26;
const SETTINGS_MENU_OPTICAL_ICON_SIZE = 24;
const SETTINGS_MENU_LABEL_SIZE = 14;
const READER_MOBILE_SETTINGS_DELETE_ROW_HEIGHT = 54;
const READER_MOBILE_SETTINGS_DELETE_SCROLL_EXTRA_PX = 16;

type ReaderSettingsMenuIconProps = { size?: number; color?: string };

/**
 * Rows span the full under-reader surface; only the **left** strip is visible when the menu is open.
 * Align label + icon to the **start** so they sit in the revealed area.
 */
const READER_MOBILE_SETTINGS_MENU_ROW = {
  width: "100%" as const,
  paddingLeft: 10,
  paddingRight: 12,
  paddingVertical: 14,
  borderRadius: 10,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "flex-start" as const,
  gap: 12,
} as const;

/** Phone: M3 side sheet. Tablet: full-width settings panel behind sliding content. */
export function ReaderMobileSettingsPanel(props: ReaderMobileSettingsPanelProps) {
  if (!props.isTabletReaderLayout) {
    return (
      <ReaderSettingsSideSheet
        open={props.toolsMenuOpen}
        onClose={props.onCloseToolsMenu}
        screenWidth={props.screenWidth}
        insets={props.insets}
        scrollPaddingTop={props.scrollPaddingTop}
        headerTools={props.headerTools ?? null}
        hideFontSettings={props.hideFontSettings}
        hideTranslationAndStudyNotes={props.hideTranslationAndStudyNotes}
        onSelectFontSettings={props.onSelectFontSettings}
        onSelectThemes={props.onSelectThemes}
        onSelectMore={props.onSelectMore}
        onSelectTranslation={props.onSelectTranslation}
        onSelectCommentary={props.onSelectCommentary}
        onSelectDeleteMyData={props.onSelectDeleteMyData}
        onSelectVerseCarousel={props.onSelectVerseCarousel}
        panelBackgroundColor={props.panelBackgroundColor}
        rippleColor={props.rippleColor}
        onSettingsPanelLayout={props.onSettingsPanelLayout}
      />
    );
  }
  return <ReaderMobileSettingsPanelTablet {...props} />;
}

/** Tablet: horizontal label + icon rows (legacy layout). */
function ReaderMobileSettingsPanelTablet(props: ReaderMobileSettingsPanelProps) {
  const {
    insets,
    scrollPaddingTop,
    padH,
    panelBackgroundColor,
    hideFontSettings = false,
    hideTranslationAndStudyNotes = false,
    onSelectFontSettings,
    onSelectThemes,
    onSelectMore,
    onSelectTranslation,
    onSelectCommentary,
    onSelectDeleteMyData,
    onSettingsPanelLayout,
  } = props;
  const deleteMyDataBottomPx = readerSettingsDeleteMyDataPanelBottomPx();
  const { tooltip, showTooltip, dismissTooltip, tooltipVisible } = useSettingsRowTooltip();
  const deleteRowRef = useRef<View | null>(null);

  const rows: {
    id: ReaderSettingsTooltipId;
    label: string;
    onPress: () => void;
    Icon: ComponentType<ReaderSettingsMenuIconProps>;
    iconSize?: number;
  }[] = [
    ...(hideTranslationAndStudyNotes
      ? []
      : [
          {
            id: "translation" as const,
            label: "Translation",
            onPress: onSelectTranslation,
            Icon: BookIcon,
            iconSize: SETTINGS_MENU_OPTICAL_ICON_SIZE,
          },
          {
            id: "study-notes" as const,
            label: "Study Notes",
            onPress: onSelectCommentary,
            Icon: StudyNotesResearchIcon,
          },
        ]),
    ...(hideFontSettings || onSelectFontSettings == null
      ? []
      : [
          {
            id: "font-settings" as const,
            label: "Font settings",
            onPress: onSelectFontSettings,
            Icon: ReaderFontSettingsIcon,
            iconSize: SETTINGS_MENU_OPTICAL_ICON_SIZE,
          },
        ]),
    {
      id: "themes",
      label: "Themes",
      onPress: onSelectThemes,
      Icon: ReaderThemesPaletteIcon,
      iconSize: SETTINGS_MENU_OPTICAL_ICON_SIZE,
    },
  ];

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: panelBackgroundColor, zIndex: 0 }]}
      onLayout={onSettingsPanelLayout}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces
        contentContainerStyle={{
          paddingTop: scrollPaddingTop,
          paddingBottom:
            deleteMyDataBottomPx +
            READER_MOBILE_SETTINGS_DELETE_ROW_HEIGHT +
            READER_MOBILE_SETTINGS_DELETE_SCROLL_EXTRA_PX,
          paddingLeft: padH + insets.left,
          paddingRight: 10,
        }}
      >
        <View className="gap-2.5">
        {rows.map(({ id, label, onPress, Icon, iconSize }) => {
          const tooltipContent = getReaderSettingsTooltip(id);
          return (
          <SettingsTabletRow
            key={id}
            label={label}
            onPress={onPress}
            Icon={Icon}
            iconSize={iconSize ?? SETTINGS_MENU_ICON_SIZE}
            tooltipTitle={tooltipContent?.title}
            tooltipDescription={tooltipContent?.description}
            onShowTooltip={tooltipContent ? showTooltip : undefined}
          />
        );
        })}
          <SettingsTabletRow
            label="More"
            onPress={onSelectMore}
            Icon={SettingsMoreIcon}
            iconSize={SETTINGS_MENU_ICON_SIZE}
            tooltipTitle={getReaderSettingsTooltip("more")?.title}
            tooltipDescription={getReaderSettingsTooltip("more")?.description}
            onShowTooltip={getReaderSettingsTooltip("more") ? showTooltip : undefined}
          />
        </View>
      </ScrollView>
      <TouchableOpacity
        style={{
          position: "absolute",
          left: padH + insets.left,
          right: 10,
          bottom: deleteMyDataBottomPx,
        }}
        onPress={() => {
          hapticLightImpact();
          onSelectDeleteMyData();
        }}
        onLongPress={() => {
          const deleteTooltip = getReaderSettingsTooltip("delete-my-data");
          if (!deleteTooltip) return;
          hapticSoftPop();
          void (async () => {
            const measured = await measureOnboardingTarget(deleteRowRef, {
              minWidth: 40,
              minHeight: 20,
            });
            if (!measured) return;
            showTooltip({
              anchor: measured,
              title: deleteTooltip.title,
              description: deleteTooltip.description,
            });
          })();
        }}
        delayLongPress={420}
        activeOpacity={0.75}
        accessibilityLabel="Delete My Data"
        accessibilityHint="Press and hold for more information"
        accessibilityRole="button"
      >
        <View
          ref={deleteRowRef}
          collapsable={false}
          style={[READER_MOBILE_SETTINGS_MENU_ROW, { backgroundColor: READER_M3_ERROR_CONTAINER }]}
        >
          <DeleteMyDataIcon size={SETTINGS_MENU_ICON_SIZE} color={READER_M3_ERROR} />
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: SETTINGS_MENU_LABEL_SIZE,
              color: READER_M3_ON_ERROR_CONTAINER,
              textAlign: "left",
              flex: 1,
            }}
          >
            Delete My Data
          </Text>
        </View>
      </TouchableOpacity>
      {tooltip ? (
        <M3RichTooltipOverlay
          visible={tooltipVisible}
          anchor={tooltip.anchor}
          title={tooltip.title}
          description={tooltip.description}
          onDismiss={dismissTooltip}
        />
      ) : null}
    </View>
  );
}

type SettingsTabletRowProps = {
  label: string;
  onPress: () => void;
  Icon: ComponentType<ReaderSettingsMenuIconProps>;
  iconSize: number;
  tooltipTitle?: string;
  tooltipDescription?: string;
  onShowTooltip?: (payload: {
    anchor: LayoutRectangle;
    title: string;
    description: string;
  }) => void;
};

function SettingsTabletRow({
  label,
  onPress,
  Icon,
  iconSize,
  tooltipTitle,
  tooltipDescription,
  onShowTooltip,
}: SettingsTabletRowProps) {
  const rowRef = useRef<View | null>(null);
  const hasTooltip = tooltipTitle != null && onShowTooltip != null;

  const handleLongPress = useCallback(() => {
    if (!hasTooltip || !tooltipTitle || !onShowTooltip) return;
    hapticSoftPop();
    void (async () => {
      const measured = await measureOnboardingTarget(rowRef, {
        minWidth: 40,
        minHeight: 20,
      });
      if (!measured) return;
      onShowTooltip({
        anchor: measured,
        title: tooltipTitle,
        description: tooltipDescription ?? "",
      });
    })();
  }, [hasTooltip, onShowTooltip, tooltipDescription, tooltipTitle]);

  return (
    <TouchableOpacity
      style={{ width: "100%" }}
      onPress={() => {
        hapticLightImpact();
        onPress();
      }}
      onLongPress={hasTooltip ? handleLongPress : undefined}
      delayLongPress={420}
      activeOpacity={0.75}
      accessibilityLabel={label}
      accessibilityHint={hasTooltip ? "Press and hold for more information" : undefined}
      accessibilityRole="button"
    >
      <View
        ref={rowRef}
        collapsable={false}
        style={[READER_MOBILE_SETTINGS_MENU_ROW, { backgroundColor: READER_M3_SURFACE_CONTAINER }]}
      >
        <Icon size={iconSize} color={READER_M3_ON_SURFACE_VARIANT} />
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: SETTINGS_MENU_LABEL_SIZE,
            color: READER_M3_ON_SURFACE,
            textAlign: "left",
            flex: 1,
          }}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export type ReaderModalsProps = {
  bundle: MobileAppThemeBundle;
  chapter: BibleChapter;
  closeCommentaryPanel: () => void;
  closeReaderDropdown: () => void;
  colors: {
    borderSolid: string;
    brown800: string;
    gold: string;
    parchment: string;
    parchmentDark: string;
    parchmentMid: string;
    tan200: string;
    tan300: string;
  };
  dropOpacityAnim: Animated.Value;
  dropSlideAnim: Animated.Value;
  dropdownAnchor: import("react-native").LayoutRectangle | null;
  goToReaderChapter: (nextBookSlug: string, nextChapter: number, translationId: string) => void;
  books: BibleBookNavItem[];
  setBookSheetExitAnimationStarted: React.Dispatch<React.SetStateAction<boolean>>;
  insets: { top: number; bottom: number; left: number; right: number };
  isTabletReaderLayout: boolean;
  measureAndSetDropdown: (
    ref: React.RefObject<View | null>,
    kind: ReaderToolsDropdown,
  ) => void;
  noteDraft: string;
  noteModalVisible: boolean;
  commentaryPanelOpen: boolean;
  noteTargetVerse: number | null;
  rc: MobileAppThemeBundle["reader"];
  readerBookGridCellW: number;
  readerBookGridGap: number;
  readerBookSheetBottomPx: number;
  readerBookSheetPad: number;
  readerBookSheetScreenEdgePad: number;
  readerChapterCols: number;
  readerChapterGridCellW: number;
  readerDropdown: ReaderToolsDropdown | null;
  readerDropdownLeft: number;
  readerDropdownMaxW: number;
  readerDropdownTop: number;
  resolvedTranslationId: string;
  translationLanguageLabel: string;
  saveNoteFromModal: () => void;
  selectedVerses: number[];
  setNoteDraft: React.Dispatch<React.SetStateAction<string>>;
  setNoteModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setNoteTargetVerse: React.Dispatch<React.SetStateAction<number | null>>;
  setThemeId: (id: import("@sinag-bible/tokens").MobileAppThemeId) => void;
  settingsMutedTextColor: string;
  themesFanRef: React.RefObject<View | null>;
  themeId: import("@sinag-bible/tokens").MobileAppThemeId;
  translationFanRef: React.RefObject<View | null>;
};

type CommentaryApiInlineItem = string | { text?: string; content?: CommentaryApiInlineItem[] };
type CommentaryApiChapterItem =
  | { type: "heading"; content?: CommentaryApiInlineItem[] }
  | { type: "verse"; number?: number; content?: CommentaryApiInlineItem[] }
  | { type: "line_break" }
  | { type: "hebrew_subtitle"; content?: CommentaryApiInlineItem[] }
  | { type: string; content?: CommentaryApiInlineItem[]; number?: number };

type CommentaryApiChapterResponse = {
  chapter?: {
    content?: CommentaryApiChapterItem[];
  };
};

type CommentaryOption = {
  id: string;
  name: string;
};

function flattenCommentaryInline(items: CommentaryApiInlineItem[] | undefined): string {
  if (!items || items.length === 0) return "";
  return items
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item.text === "string") return item.text;
      if (Array.isArray(item.content)) return flattenCommentaryInline(item.content);
      return "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function ReaderModals(props: ReaderModalsProps) {

  const {
bundle,
    chapter,
    books,
    setBookSheetExitAnimationStarted,
    commentaryPanelOpen,
    closeCommentaryPanel,
    closeReaderDropdown,
    colors,
    dropOpacityAnim,
    dropSlideAnim,
    dropdownAnchor,
    goToReaderChapter,
    insets,
    isTabletReaderLayout,
    measureAndSetDropdown,
    noteDraft,
    noteModalVisible,
    noteTargetVerse,
    rc,
    readerBookGridCellW,
    readerBookGridGap,
    readerBookSheetBottomPx,
    readerBookSheetPad,
    readerBookSheetScreenEdgePad,
    readerChapterCols,
    readerChapterGridCellW,
    readerDropdown,
    readerDropdownLeft,
    readerDropdownMaxW,
    readerDropdownTop,
    resolvedTranslationId,
    translationLanguageLabel,
    saveNoteFromModal,
    selectedVerses,
    setNoteDraft,
    setNoteModalVisible,
    setNoteTargetVerse,
    setThemeId,
    settingsMutedTextColor,
    themesFanRef,
    themeId,
    translationFanRef,
  } = props;

  const [selectedCommentary, setSelectedCommentary] = useState(COMMENTARY_DEFAULT_ID);
  const [commentaryOptions, setCommentaryOptions] = useState<CommentaryOption[]>([]);
  const [commentaryListLoading, setCommentaryListLoading] = useState(false);
  const [commentaryListResolved, setCommentaryListResolved] = useState(false);
  const [commentaryListError, setCommentaryListError] = useState<string | null>(null);
  const [commentaryChapterLoading, setCommentaryChapterLoading] = useState(false);
  const [commentaryError, setCommentaryError] = useState<string | null>(null);
  const [commentaryEntries, setCommentaryEntries] = useState<CommentaryApiChapterItem[]>([]);
  const [commentarySelectionReady, setCommentarySelectionReady] = useState(false);
  const { height: windowHeight } = Dimensions.get("window");
  const commentarySheetMaxHeightPx = windowHeight * 0.78 + 30;
  const commentarySheetTranslateY = useRef(new Animated.Value(0)).current;
  const commentarySheetClosingRef = useRef(false);
  const commentarySheetDragStartYRef = useRef(0);

  const animateCloseCommentarySheet = useCallback(
    (velocityY = 0, draggedY = 0) => {
      if (commentarySheetClosingRef.current) return;
      commentarySheetClosingRef.current = true;
      const h = Dimensions.get("window").height;
      const targetY = h + 56;
      const vel = Math.max(0, velocityY);
      const duration = Math.max(170, Math.min(340, Math.round(300 - Math.min(1.85, vel) * 88)));
      commentarySheetTranslateY.stopAnimation();
      const clamped = Math.max(0, draggedY);
      if (clamped > 0) {
        commentarySheetTranslateY.setValue(clamped);
      }
      Animated.timing(commentarySheetTranslateY, {
        toValue: targetY,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        commentarySheetClosingRef.current = false;
        commentarySheetTranslateY.setValue(0);
        closeCommentaryPanel();
      });
    },
    [commentarySheetTranslateY, closeCommentaryPanel],
  );

  const onCommentarySheetDismissGestureEvent = useCallback(
    (e: PanGestureHandlerGestureEvent) => {
      if (commentarySheetClosingRef.current) return;
      const ty = e.nativeEvent.translationY;
      commentarySheetTranslateY.setValue(Math.max(0, commentarySheetDragStartYRef.current + ty));
    },
    [commentarySheetTranslateY],
  );

  const onCommentarySheetDismissGestureStateChange = useCallback(
    (e: PanGestureHandlerStateChangeEvent) => {
      const { state, oldState, velocityY, translationY } = e.nativeEvent;
      if (state === State.ACTIVE && oldState !== State.ACTIVE) {
        commentarySheetTranslateY.stopAnimation((value: number) => {
          commentarySheetDragStartYRef.current = value;
        });
      }
      if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
        if (commentarySheetClosingRef.current) return;
        const ty = translationY ?? 0;
        const y = Math.max(0, commentarySheetDragStartYRef.current + ty);
        const vyPxPerS = Math.abs(velocityY ?? 0);
        const velForCloseAnim = Math.min(1.85, vyPxPerS / 520);
        if (y > 90 || vyPxPerS > 520) {
          animateCloseCommentarySheet(velForCloseAnim, y);
          return;
        }
        Animated.spring(commentarySheetTranslateY, {
          toValue: 0,
          velocity: Math.max(0, (velocityY ?? 0) / 1000),
          friction: 9,
          tension: 75,
          useNativeDriver: true,
        }).start();
      }
    },
    [animateCloseCommentarySheet, commentarySheetTranslateY],
  );

  useEffect(() => {
    if (!commentaryPanelOpen) {
      commentarySheetClosingRef.current = false;
      commentarySheetTranslateY.stopAnimation();
      commentarySheetTranslateY.setValue(0);
    }
  }, [commentaryPanelOpen, commentarySheetTranslateY]);

  const onCommentaryBackdropPress = useCallback(() => {
    if (commentarySheetClosingRef.current) return;
    hapticLightImpact();
    animateCloseCommentarySheet(0, 0);
  }, [animateCloseCommentarySheet]);


  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(COMMENTARY_STORAGE_KEY);
        if (!cancelled && stored?.trim()) {
          setSelectedCommentary(stored.trim());
        }
      } catch {
        // Keep default commentary when storage read fails.
      } finally {
        if (!cancelled) setCommentarySelectionReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!commentarySelectionReady) return;
    void AsyncStorage.setItem(COMMENTARY_STORAGE_KEY, selectedCommentary).catch(() => {
      // Ignore persistence failures; selection still works for this session.
    });
  }, [commentarySelectionReady, selectedCommentary]);

  useEffect(() => {
    if (!commentaryPanelOpen) return;
    if (commentaryListResolved || commentaryListLoading) return;
    let cancelled = false;
    (async () => {
      setCommentaryListLoading(true);
      setCommentaryListError(null);
      try {
        const res = await fetchWithTimeout(
          `${COMMENTARY_API_BASE_URL}/available_commentaries.json`,
          undefined,
          COMMENTARY_REQUEST_TIMEOUT_MS,
        );
        if (!res.ok) throw new Error(`commentary list HTTP ${res.status}`);
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
          throw new Error("commentary list unexpected content-type");
        }
        const raw = (await res.json()) as
          | { commentaries?: { id?: string; name?: string }[] }
          | { id?: string; name?: string }[];
        const list = Array.isArray(raw) ? raw : Array.isArray(raw.commentaries) ? raw.commentaries : [];
        const normalized = list
          .filter((c) => typeof c.id === "string" && typeof c.name === "string")
          .map((c) => ({ id: c.id!.trim(), name: c.name!.trim() }))
          .filter((c) => c.id.length > 0 && c.name.length > 0);
        if (!cancelled) setCommentaryOptions(normalized);
      } catch {
        if (!cancelled) {
          setCommentaryListError("Commentary list unavailable right now.");
          setCommentaryError("Unable to load available commentaries right now.");
        }
      } finally {
        if (!cancelled) {
          setCommentaryListLoading(false);
          setCommentaryListResolved(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [commentaryPanelOpen, commentaryListResolved, commentaryListLoading]);

  useEffect(() => {
    if (!commentaryPanelOpen || commentaryListResolved) return;
    const timer = setTimeout(() => {
      setCommentaryListLoading(false);
      setCommentaryListResolved(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [commentaryPanelOpen, commentaryListResolved]);

  useEffect(() => {
    if (!commentaryPanelOpen) return;
    let cancelled = false;
    (async () => {
      setCommentaryChapterLoading(true);
      setCommentaryError(null);
      try {
        const commentaryBookId = getUsfmBookId(chapter.bookSlug);
        if (!commentaryBookId) {
          if (!cancelled) {
            setCommentaryEntries([]);
            setCommentaryError("Study notes are unavailable for this book.");
          }
          return;
        }
        const url = `${COMMENTARY_API_BASE_URL}/c/${encodeURIComponent(selectedCommentary)}/${encodeURIComponent(commentaryBookId)}/${chapter.chapterNumber}.json`;
        const res = await fetchWithTimeout(url, undefined, COMMENTARY_REQUEST_TIMEOUT_MS);
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) setCommentaryEntries([]);
            return;
          }
          throw new Error(`commentary chapter HTTP ${res.status}`);
        }
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
          throw new Error("commentary chapter unexpected content-type");
        }
        const raw = (await res.json()) as CommentaryApiChapterResponse;
        const items = Array.isArray(raw.chapter?.content) ? raw.chapter.content : [];
        if (!cancelled) setCommentaryEntries(items);
      } catch {
        if (!cancelled) {
          setCommentaryEntries([]);
          setCommentaryError("Unable to load this commentary chapter.");
        }
      } finally {
        if (!cancelled) setCommentaryChapterLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [commentaryPanelOpen, selectedCommentary, chapter.bookSlug, chapter.chapterNumber]);
  const filteredCommentaryEntries = useMemo(() => {
    if (selectedVerses.length === 0) return commentaryEntries;
    const selectedSet = new Set(selectedVerses);
    const output: CommentaryApiChapterItem[] = [];
    let pendingHeading: CommentaryApiChapterItem | null = null;
    let previousWasSelectedVerse = false;
    for (const entry of commentaryEntries) {
      if (entry.type === "heading" || entry.type === "hebrew_subtitle") {
        pendingHeading = entry;
        previousWasSelectedVerse = false;
        continue;
      }
      if (entry.type === "verse") {
        const selected = typeof entry.number === "number" && selectedSet.has(entry.number);
        if (selected) {
          if (pendingHeading) {
            output.push(pendingHeading);
            pendingHeading = null;
          }
          output.push(entry);
        }
        previousWasSelectedVerse = selected;
        continue;
      }
      if (entry.type === "line_break") {
        if (previousWasSelectedVerse) output.push(entry);
        continue;
      }
      if (previousWasSelectedVerse) output.push(entry);
    }
    return output;
  }, [commentaryEntries, selectedVerses]);
  const selectedVerseFeedbackLabel = useMemo(() => {
    if (selectedVerses.length === 0) return null;
    const first = selectedVerses[0]!;
    const last = selectedVerses[selectedVerses.length - 1]!;
    if (selectedVerses.length === 1) return `Showing study notes for verse ${first}`;
    if (last - first + 1 === selectedVerses.length) return `Showing study notes for verses ${first}-${last}`;
    return `Showing study notes for ${selectedVerses.length} selected verses`;
  }, [selectedVerses]);

  return (
    <>
<ReaderThemePickerSheet
  isOpen={readerDropdown === "theme"}
  onClose={closeReaderDropdown}
  bundle={bundle}
  insets={insets}
  isTabletReaderLayout={isTabletReaderLayout}
  themeId={themeId}
  setThemeId={setThemeId}
/>

<BookPickerSheet
  isOpen={readerDropdown === "book"}
  onClose={closeReaderDropdown}
  onExitAnimationStart={() => setBookSheetExitAnimationStarted(true)}
  chapter={chapter}
  books={books}
  resolvedTranslationId={resolvedTranslationId}
  translationLanguageLabel={translationLanguageLabel}
  goToReaderChapter={goToReaderChapter}
  colors={colors}
  rc={rc}
  insets={insets}
  readerBookSheetBottomPx={readerBookSheetBottomPx}
  readerBookSheetPad={readerBookSheetPad}
  readerBookSheetScreenEdgePad={readerBookSheetScreenEdgePad}
  readerBookGridGap={readerBookGridGap}
  readerBookGridCellW={readerBookGridCellW}
  readerChapterCols={readerChapterCols}
  readerChapterGridCellW={readerChapterGridCellW}
/>

<Modal
  visible={commentaryPanelOpen}
  transparent
  animationType="slide"
  statusBarTranslucent
  onRequestClose={closeCommentaryPanel}
>
  <View style={{ flex: 1, justifyContent: "flex-end" }}>
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={onCommentaryBackdropPress}
      accessibilityRole="button"
      accessibilityLabel="Dismiss study notes"
    />
    <Animated.View
      style={{
        marginHorizontal: 5,
        maxHeight: commentarySheetMaxHeightPx,
        backgroundColor: colors.parchmentMid,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderColor: colors.borderSolid,
        borderBottomWidth: 0,
        paddingTop: 0,
        paddingHorizontal: 14,
        paddingBottom: nativeTabSheetBottomInsetPx(insets.bottom, 12),
        shadowColor: "#2c2416",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 8,
        transform: [{ translateY: commentarySheetTranslateY }],
      }}
    >
      <PanGestureHandler
        onGestureEvent={onCommentarySheetDismissGestureEvent}
        onHandlerStateChange={onCommentarySheetDismissGestureStateChange}
        activeOffsetY={8}
        failOffsetX={[-32, 32]}
      >
        <View
          style={{
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 6,
            paddingBottom: 10,
            minHeight: 44,
          }}
          accessibilityLabel="Study notes sheet"
          accessibilityHint="Swipe down on the handle to close study notes, or tap outside the sheet"
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
      </PanGestureHandler>
      <View style={{ paddingBottom: 10 }}>
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 20,
            textAlign: "center",
            color: colors.brown800,
          }}
        >
          Study Notes
        </Text>
      </View>
      {selectedVerseFeedbackLabel ? (
        <View
          style={{
            alignSelf: "flex-start",
            borderRadius: 999,
            backgroundColor: colors.parchmentDark,
            borderWidth: 1,
            borderColor: colors.borderSolid,
            paddingHorizontal: 10,
            paddingVertical: 6,
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 12,
              color: colors.brown800,
            }}
          >
            {selectedVerseFeedbackLabel}
          </Text>
        </View>
      ) : null}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 8 }}
      >
        {commentaryChapterLoading && filteredCommentaryEntries.length === 0 ? (
          <View style={{ paddingVertical: 28, alignItems: "center" }}>
            <ActivityIndicator size="small" color={colors.gold} />
            <Text
              style={{
                marginTop: 10,
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                color: settingsMutedTextColor,
              }}
            >
              Loading commentary...
            </Text>
          </View>
        ) : commentaryError ? (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: settingsMutedTextColor,
              lineHeight: 20,
            }}
          >
            {commentaryError}
          </Text>
        ) : filteredCommentaryEntries.length === 0 ? (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: settingsMutedTextColor,
              lineHeight: 20,
            }}
          >
            {selectedVerses.length > 0
              ? "No study notes are available for the selected verse(s) in this chapter."
              : "No commentary is available for this chapter in the selected study notes."}
          </Text>
        ) : (
          filteredCommentaryEntries.map((entry, index) => {
            if (entry.type === "line_break") return <View key={`break-${index}`} style={{ height: 10 }} />;
            const text = flattenCommentaryInline("content" in entry ? entry.content : undefined);
            if (!text) return null;
            if (entry.type === "heading" || entry.type === "hebrew_subtitle") {
              return (
                <Text
                  key={`heading-${index}`}
                  style={{
                    fontFamily: "Lora_400Regular",
                    fontSize: 17,
                    color: colors.brown800,
                    marginTop: index === 0 ? 0 : 8,
                    marginBottom: 6,
                  }}
                >
                  {text}
                </Text>
              );
            }
            if (entry.type === "verse") {
              return (
                <Text
                  key={`verse-${entry.number ?? index}`}
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 15,
                    color: colors.brown800,
                    lineHeight: 24,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ fontFamily: "Inter_500Medium", color: colors.gold }}>
                    {typeof entry.number === "number" ? `${entry.number} ` : ""}
                  </Text>
                  {text}
                </Text>
              );
            }
            return (
              <Text
                key={`item-${index}`}
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 15,
                  color: colors.brown800,
                  lineHeight: 24,
                  marginBottom: 8,
                }}
              >
                {text}
              </Text>
            );
          })
        )}
      </ScrollView>
    </Animated.View>
  </View>
</Modal>

<Modal visible={noteModalVisible} animationType="fade" transparent statusBarTranslucent>
  <KeyboardAvoidingView
    behavior={Platform.OS === "ios" ? "padding" : undefined}
    style={{ flex: 1 }}
  >
    <View style={{ flex: 1, justifyContent: "center" }}>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: rc.denseModalScrim }]}
        onPress={() => {
          setNoteModalVisible(false);
          setNoteTargetVerse(null);
          setNoteDraft("");
        }}
      />
      <View
        style={{
          marginHorizontal: 24,
          backgroundColor: colors.parchmentMid,
          borderRadius: 20,
          padding: 20,
          borderWidth: 1,
          borderColor: colors.borderSolid,
        }}
      >
        <Text
          style={{
            fontFamily: "Lora_400Regular",
            fontSize: 18,
            color: colors.brown800,
            marginBottom: 12,
          }}
        >
          Verse note
          {noteTargetVerse != null ? ` · ${noteTargetVerse}` : ""}
        </Text>
        <TextInput
          multiline
          value={noteDraft}
          onChangeText={setNoteDraft}
          placeholder="Write a note…"
          placeholderTextColor={colors.tan200}
          style={{
            minHeight: 120,
            borderWidth: 1,
            borderColor: colors.borderSolid,
            borderRadius: 12,
            padding: 12,
            textAlignVertical: "top",
            fontFamily: "Inter_400Regular",
            fontSize: 16,
            color: colors.brown800,
            backgroundColor: colors.parchment,
          }}
        />
        <View className="flex-row justify-end gap-3 mt-4">
          <TouchableOpacity
            className="px-4 py-2 rounded-full"
            onPress={() => {
              setNoteModalVisible(false);
              setNoteTargetVerse(null);
              setNoteDraft("");
            }}
            accessibilityLabel="Cancel note"
          >
            <Text style={{ fontFamily: "Inter_500Medium", color: colors.tan300 }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="px-5 py-2 rounded-full"
            style={{ backgroundColor: colors.parchmentDark }}
            onPress={saveNoteFromModal}
            accessibilityLabel="Save note"
          >
            <Text style={{ fontFamily: "Inter_500Medium", color: colors.brown800 }}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </KeyboardAvoidingView>
</Modal>

    </>
  );
}
