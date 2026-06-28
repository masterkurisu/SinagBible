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
import {
  isTranslationId,
  getExternalApiId,
  getInternalIdFromApiId,
} from "@sinag-bible/core/bible-translations";
import { getUsfmBookId } from "@sinag-bible/core";
import type { TranslationPickerItem } from "@/lib/use-translation-picker";
import type { BibleBookNavItem, BibleChapter } from "@sinag-bible/types";
import { mobileAppThemePickerOptions } from "@sinag-bible/tokens";
import { ReaderFontSizeSlider } from "@/components/reader-font-size-slider";
import {
  JournalNewEntryForm,
  type JournalNewEntryFormHandle,
  type JournalNewEntryInitialParams,
} from "@/components/journal-new-entry-form";
import { BookIcon } from "@/components/icons/BookIcon";
import { FilterListIcon } from "@/components/icons/FilterListIcon";
import { StudyNotesResearchIcon } from "@/components/icons/StudyNotesResearchIcon";
import { ReaderFontSettingsIcon } from "@/components/icons/ReaderFontSettingsIcon";
import { CreditsIcon } from "@/components/icons/CreditsIcon";
import { ReaderThemesPaletteIcon } from "@/components/icons/ReaderThemesPaletteIcon";
import { DeleteMyDataIcon } from "@/components/icons/DeleteMyDataIcon";
import type { ReaderSettingsOnboardingStepId } from "@/src/features/reader/readerSettingsOnboardingSteps";
import {
  ReaderAlignCenterIcon,
  ReaderAlignJustifyIcon,
  ReaderAlignLeftIcon,
  ReaderAlignRightIcon,
} from "@/components/icons/ReaderFontSheetAlignIcons";
import { BOOK_GENRE_BY_SLUG } from "@/lib/book-genre-by-slug";
import { nativeTabSheetBottomInsetPx } from "@/lib/native-tab-chrome";
import { hapticLightImpact } from "@/lib/haptics";
import {
  READER_VERSE_BODY_FONT_OPTIONS,
  readerVerseBodyFontFamily,
  type ReaderVerseBodyFontId,
} from "@/lib/reader-verse-body-font";
import { READER_MENU_SLIDE_FROM_PX } from "./useReaderGestures";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";

export type ReaderToolsDropdown = "book" | "translation" | "theme";
export type BookSelectorViewMode = "grid" | "az" | "testament";
export type SelectorTestamentTab = "old" | "new";
type ReaderVerseTextAlign = "left" | "right" | "center" | "justify";


function readerThemeSwatchRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return null;
  const n = Number.parseInt(normalized, 16);
  if (!Number.isFinite(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** WCAG-style relative luminance for sRGB hex (used for on-tile label + selection ring). */
function readerThemeSwatchLuminance(hex: string): number {
  const rgb = readerThemeSwatchRgb(hex);
  if (!rgb) return 0;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = lin(rgb.r);
  const G = lin(rgb.g);
  const B = lin(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function readerThemeTileChrome(swatchHex: string): {
  label: string;
  idleBorder: string;
} {
  const L = readerThemeSwatchLuminance(swatchHex);
  const lightTile = L > 0.5;
  return {
    label: lightTile ? "rgba(24,20,16,0.92)" : "rgba(255,255,255,0.96)",
    idleBorder: lightTile ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.20)",
  };
}

/** Parchment gold — not `bundle.ui.gold` (Spectrum et al. use accent colors that are not gold). */
const READER_THEME_TILE_ACTIVE_BORDER = "#c9a96e";

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

const READER_MOBILE_SETTINGS_PANEL_BG = "#2e2e2e";
const READER_MOBILE_SETTINGS_ROW = "rgba(255,255,255,0.1)";
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
  /** Top padding so the first row clears the reader header / tool pill (z-index above this strip). */
  scrollPaddingTop: number;
  padH: number;
  onSelectFontSettings: () => void;
  onSelectThemes: () => void;
  onSelectCredits: () => void;
  onSelectTranslation: () => void;
  onSelectCommentary: () => void;
  onSelectDeleteMyData: () => void;
  settingsOnboardingRowRefs?: Partial<
    Record<ReaderSettingsOnboardingStepId, RefObject<View | null>>
  >;
  onSettingsPanelLayout?: () => void;
};

const SETTINGS_MENU_ICON_COLOR = "#ffffff";
const SETTINGS_MENU_ICON_SIZE = 26;
const SETTINGS_MENU_OPTICAL_ICON_SIZE = 24;
const SETTINGS_MENU_LABEL_SIZE = 14;

type ReaderSettingsMenuIconProps = { size?: number; color?: string };

/**
 * Rows span the full under-reader surface; only the **right** strip is visible when the menu is open.
 * Align label + icon to the **end** (right) so they sit in the revealed area, not under the reader pane.
 */
const READER_MOBILE_SETTINGS_MENU_ROW = {
  width: "100%" as const,
  paddingLeft: 12,
  /** Tight to scroll `paddingRight` (5px + safe inset) so labels/icons sit near the screen edge. */
  paddingRight: 10,
  paddingVertical: 14,
  borderRadius: 10,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "flex-end" as const,
  gap: 12,
} as const;

/** Dark strip behind the reader; revealed when the reader slides left (phone layout). */
export function ReaderMobileSettingsPanel(props: ReaderMobileSettingsPanelProps) {
  const {
    insets,
    scrollPaddingTop,
    padH,
    onSelectFontSettings,
    onSelectThemes,
    onSelectCredits,
    onSelectTranslation,
    onSelectCommentary,
    onSelectDeleteMyData,
    settingsOnboardingRowRefs,
    onSettingsPanelLayout,
  } = props;
  const deleteMyDataBottomPx =
    nativeTabSheetBottomInsetPx(insets.bottom, 10) + (Platform.OS === "ios" ? 30 : 70);

  const rows: {
    id: ReaderSettingsOnboardingStepId;
    label: string;
    onPress: () => void;
    Icon: ComponentType<ReaderSettingsMenuIconProps>;
    iconSize?: number;
  }[] = [
    {
      id: "translation",
      label: "Translation",
      onPress: onSelectTranslation,
      Icon: BookIcon,
      iconSize: SETTINGS_MENU_OPTICAL_ICON_SIZE,
    },
    {
      id: "study-notes",
      label: "Study Notes",
      onPress: onSelectCommentary,
      Icon: StudyNotesResearchIcon,
    },
    {
      id: "font-settings",
      label: "Font settings",
      onPress: onSelectFontSettings,
      Icon: ReaderFontSettingsIcon,
      iconSize: SETTINGS_MENU_OPTICAL_ICON_SIZE,
    },
    {
      id: "themes",
      label: "Themes",
      onPress: onSelectThemes,
      Icon: ReaderThemesPaletteIcon,
      iconSize: SETTINGS_MENU_OPTICAL_ICON_SIZE,
    },
    {
      id: "credits",
      label: "Credits",
      onPress: onSelectCredits,
      Icon: CreditsIcon,
    },
  ];

  return (
    <View
      style={[StyleSheet.absoluteFillObject, { backgroundColor: READER_MOBILE_SETTINGS_PANEL_BG, zIndex: 0 }]}
      onLayout={onSettingsPanelLayout}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces
        contentContainerStyle={{
          paddingTop: scrollPaddingTop,
          paddingBottom: deleteMyDataBottomPx + 86,
          paddingLeft: padH,
          paddingRight: 10 + insets.right,
        }}
      >
        <View className="gap-2.5">
        {rows.map(({ id, label, onPress, Icon, iconSize }) => (
          <TouchableOpacity
            key={id}
            style={{ width: "100%" }}
            onPress={() => {
              hapticLightImpact();
              onPress();
            }}
            activeOpacity={0.75}
            accessibilityLabel={label}
            accessibilityRole="button"
          >
            <View
              ref={settingsOnboardingRowRefs?.[id]}
              collapsable={false}
              style={[
                READER_MOBILE_SETTINGS_MENU_ROW,
                { backgroundColor: READER_MOBILE_SETTINGS_ROW },
              ]}
            >
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: SETTINGS_MENU_LABEL_SIZE,
                  color: "#ffffff",
                  textAlign: "right",
                }}
              >
                {label}
              </Text>
              <Icon size={iconSize ?? SETTINGS_MENU_ICON_SIZE} color={SETTINGS_MENU_ICON_COLOR} />
            </View>
          </TouchableOpacity>
        ))}
        </View>
      </ScrollView>
      <TouchableOpacity
        style={{
          position: "absolute",
          left: padH,
          right: 10 + insets.right,
          bottom: deleteMyDataBottomPx,
        }}
        onPress={() => {
          hapticLightImpact();
          onSelectDeleteMyData();
        }}
        activeOpacity={0.75}
        accessibilityLabel="Delete My Data"
        accessibilityRole="button"
      >
        <View
          ref={settingsOnboardingRowRefs?.["delete-my-data"]}
          collapsable={false}
          style={[READER_MOBILE_SETTINGS_MENU_ROW, { backgroundColor: "rgba(193, 18, 31, 0.2)" }]}
        >
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: SETTINGS_MENU_LABEL_SIZE,
              color: "#ffb3b3",
              textAlign: "right",
            }}
          >
            Delete My Data
          </Text>
          <DeleteMyDataIcon size={SETTINGS_MENU_ICON_SIZE} color="#ffb3b3" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const READER_FONT_CARD_PADDING_TOP_PX = 12;
const READER_FONT_CARD_GAP_AFTER_SIZE_SLIDER_PX = 5;
const READER_FONT_CARD_GAP_AFTER_SPACING_SLIDER_PX = 5;

const FONT_SCALE_MIN = 0.5;
const FONT_SCALE_MAX = 3;
const LINE_SPACING_MIN = 0.6;
const LINE_SPACING_MAX = 2;

export type ReaderModalsProps = {
  bundle: MobileAppThemeBundle;
  activeBookViewLabel: string;
  animateCloseBookSheet: (velocityY?: number, draggedY?: number) => void;
  applyBookSelectorView: (view: "grid" | "az" | "old" | "new") => void;
  azSortedBooks: BibleBookNavItem[];
  bookPickerBook: BibleBookNavItem | null;
  bookPickerStep: "books" | "chapters";
  bookSelectorViewMode: BookSelectorViewMode;
  bookSheetDismissPanEnabled: boolean;
  onBookSheetScroll: (scrollY: number) => void;
  onBookSheetDismissGestureEvent: (e: PanGestureHandlerGestureEvent) => void;
  onBookSheetDismissGestureStateChange: (e: PanGestureHandlerStateChangeEvent) => void;
  bookSheetTranslateY: Animated.Value;
  bookViewMenuOpen: boolean;
  chapter: BibleChapter;
  closeFontSettingsPopup: () => void;
  closeCommentaryPanel: () => void;
  closeNewEntrySheet: () => void;
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
  fontSettingsFanRef: React.RefObject<View | null>;
  fontSettingsPopupMaxH: number;
  fontSettingsPopupMaxW: number;
  fontSettingsPopupOpacityAnim: Animated.Value;
  fontSettingsPopupPadBottom: number;
  fontSettingsPopupPadH: number;
  fontSettingsPopupPadTop: number;
  fontSettingsPopupSlideAnim: Animated.Value;
  fontSettingsSectionLabelSize: number;
  fontSettingsAlignIconSize: number;
  fontSettingsScale: number;
  fontSettingsSheetOpen: boolean;
  fontSizeScale: number;
  readerVerseBodyFontId: ReaderVerseBodyFontId;
  setReaderVerseBodyFontIdPersisted: (id: ReaderVerseBodyFontId) => void;
  goToReaderChapter: (nextBookSlug: string, nextChapter: number, translationId: string) => void;
  translationPickerItems: TranslationPickerItem[];
  translationPickerLoading: boolean;
  favoriteTranslationIds: string[];
  toggleFavoriteTranslation: (id: string) => void;
  gridSectionsForPicker: readonly {
    id: "ot" | "nt";
    label: string;
    items: BibleBookNavItem[];
  }[];
  insets: { top: number; bottom: number; left: number; right: number };
  isTabletReaderLayout: boolean;
  lineSpacingScale: number;
  measureAndSetDropdown: (
    ref: React.RefObject<View | null>,
    kind: ReaderToolsDropdown,
  ) => void;
  newEntryFormRef: React.RefObject<JournalNewEntryFormHandle | null>;
  newEntryHandlePanResponder: ReturnType<typeof import("react-native").PanResponder.create>;
  newEntryInitialParams: JournalNewEntryInitialParams | null;
  newEntrySheetBottomPx: number;
  newEntrySheetKey: number;
  newEntrySheetLeft: number;
  newEntrySheetOpacity: Animated.Value;
  newEntrySheetOpen: boolean;
  newEntrySheetTopPx: number;
  newEntrySheetTranslate: Animated.Value;
  newEntrySheetWidth: number;
  noteDraft: string;
  noteModalVisible: boolean;
  commentaryPanelOpen: boolean;
  noteTargetVerse: number | null;
  oldTestamentBooks: BibleBookNavItem[];
  newTestamentBooks: BibleBookNavItem[];
  openFontSettingsSheet: () => void;
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
  readerNewEntrySheetBottomLiftPx: number;
  requestCloseReaderNewEntrySheet: () => void;
  resolvedTranslationId: string;
  router: { setParams: (p: { translation?: string }) => void };
  saveNoteFromModal: () => void;
  selectedVerses: number[];
  selectorTestamentTab: SelectorTestamentTab;
  setBookPickerBook: React.Dispatch<React.SetStateAction<BibleBookNavItem | null>>;
  setBookPickerStep: React.Dispatch<React.SetStateAction<"books" | "chapters">>;
  setBookViewMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFontSizeScalePersisted: (v: number) => void;
  setLineSpacingScalePersisted: (v: number) => void;
  setNewEntryHasDraft: (v: boolean) => void;
  setNoteDraft: React.Dispatch<React.SetStateAction<string>>;
  setNoteModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setNoteTargetVerse: React.Dispatch<React.SetStateAction<number | null>>;
  setThemeId: (id: import("@sinag-bible/tokens").MobileAppThemeId) => void;
  setVerseTextAlignPersisted: (a: ReaderVerseTextAlign) => void;
  settingsMutedTextColor: string;
  themesFanRef: React.RefObject<View | null>;
  themeId: import("@sinag-bible/tokens").MobileAppThemeId;
  translationFanRef: React.RefObject<View | null>;
  verseTextAlign: ReaderVerseTextAlign;
};

type TranslationRowProps = {
  item: TranslationPickerItem;
  isActive: boolean;
  isFavorite: boolean;
  rc: ReaderModalsProps["rc"];
  settingsMutedTextColor: string;
  onPress: () => void;
  onToggleFavorite: () => void;
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

function TranslationRow({
  item,
  isActive,
  isFavorite,
  rc,
  settingsMutedTextColor,
  onPress,
  onToggleFavorite,
}: TranslationRowProps) {
  const pad = { paddingLeft: 12, paddingRight: 8, paddingVertical: 10, borderRadius: 10 };
  const label = (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          color: isActive ? "#ffffff" : settingsMutedTextColor,
          flex: 1,
          marginRight: 8,
        }}
        numberOfLines={1}
      >
        {item.label}
      </Text>
      <TouchableOpacity
        onPress={onToggleFavorite}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={isFavorite ? "Unpin translation" : "Pin translation"}
      >
        <Ionicons
          name={isFavorite ? "star" : "star-outline"}
          size={16}
          color={isFavorite ? (isActive ? "#ffffff" : rc.translationSelectedGradient[0]) : settingsMutedTextColor}
          style={{ opacity: isFavorite ? 1 : 0.5 }}
        />
      </TouchableOpacity>
    </View>
  );

  if (isActive) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} accessibilityState={{ selected: true }}>
        <LinearGradient
          colors={rc.translationSelectedGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={pad}
        >
          {label}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityLabel={item.label}
      accessibilityState={{ selected: false }}
    >
      <View style={[pad, { backgroundColor: rc.popoverRow }]}>
        {label}
      </View>
    </TouchableOpacity>
  );
}

export function ReaderModals(props: ReaderModalsProps) {

  const {
bundle,
    activeBookViewLabel,
    animateCloseBookSheet,
    applyBookSelectorView,
    azSortedBooks,
    bookPickerBook,
    bookPickerStep,
    bookSelectorViewMode,
    bookSheetDismissPanEnabled,
    onBookSheetScroll,
    onBookSheetDismissGestureEvent,
    onBookSheetDismissGestureStateChange,
    bookSheetTranslateY,
    bookViewMenuOpen,
    chapter,
    commentaryPanelOpen,
    closeFontSettingsPopup,
    closeCommentaryPanel,
    closeNewEntrySheet,
    closeReaderDropdown,
    colors,
    dropOpacityAnim,
    dropSlideAnim,
    dropdownAnchor,
    fontSettingsFanRef,
    fontSettingsPopupMaxH,
    fontSettingsPopupMaxW,
    fontSettingsPopupOpacityAnim,
    fontSettingsPopupPadBottom,
    fontSettingsPopupPadH,
    fontSettingsPopupPadTop,
    fontSettingsPopupSlideAnim,
    fontSettingsSectionLabelSize,
    fontSettingsAlignIconSize,
    fontSettingsScale,
    fontSettingsSheetOpen,
    fontSizeScale,
    readerVerseBodyFontId,
    setReaderVerseBodyFontIdPersisted,
    goToReaderChapter,
    gridSectionsForPicker,
    insets,
    isTabletReaderLayout,
    lineSpacingScale,
    measureAndSetDropdown,
    newEntryFormRef,
    newEntryHandlePanResponder,
    newEntryInitialParams,
    newEntrySheetBottomPx,
    newEntrySheetKey,
    newEntrySheetLeft,
    newEntrySheetOpacity,
    newEntrySheetOpen,
    newEntrySheetTopPx,
    newEntrySheetTranslate,
    newEntrySheetWidth,
    noteDraft,
    noteModalVisible,
    noteTargetVerse,
    oldTestamentBooks,
    newTestamentBooks,
    openFontSettingsSheet,
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
    readerNewEntrySheetBottomLiftPx,
    requestCloseReaderNewEntrySheet,
    resolvedTranslationId,
    router,
    saveNoteFromModal,
    selectedVerses,
    selectorTestamentTab,
    setBookPickerBook,
    setBookPickerStep,
    setBookViewMenuOpen,
    setFontSizeScalePersisted,
    setLineSpacingScalePersisted,
    setNewEntryHasDraft,
    setNoteDraft,
    setNoteModalVisible,
    setNoteTargetVerse,
    setThemeId,
    settingsMutedTextColor,
    setVerseTextAlignPersisted,
    themesFanRef,
    themeId,
    translationFanRef,
    translationPickerItems,
    translationPickerLoading,
    favoriteTranslationIds,
    toggleFavoriteTranslation,
    verseTextAlign
  } = props;

  /**
   * Normalise the active translation to an API-side ID so it can be compared
   * directly against `TranslationPickerItem.id` values from the API response.
   */
  const resolvedTranslationApiId: string = isTranslationId(resolvedTranslationId)
    ? getExternalApiId(resolvedTranslationId)
    : resolvedTranslationId;

  const readerThemeGridGap = 10;
  const readerThemeGridHPad = 32;
  const readerThemeGridInnerW = Math.max(
    80,
    readerDropdownMaxW - readerThemeGridHPad,
  );
  const readerThemeGridTileW =
    Math.min(86, (readerThemeGridInnerW - readerThemeGridGap * 2) / 3);
  const readerThemeDropdownW =
    readerThemeGridTileW * 3 + readerThemeGridGap * 2 + readerThemeGridHPad;
  const bookGridColumns = 3;
  const bookSheetInnerW = Math.max(
    240,
    Dimensions.get("window").width
      - (insets.left + insets.right)
      - readerBookSheetScreenEdgePad * 2
      - readerBookSheetPad * 2,
  );
  const readerBookGridCellWAdaptive = Math.floor(
    (bookSheetInnerW - readerBookGridGap * (bookGridColumns - 1)) / bookGridColumns,
  );
  const readerBookGridCellWResolved = Math.max(
    72,
    Math.min(readerBookGridCellW, readerBookGridCellWAdaptive),
  );

  const [readerFontPickerOpen, setReaderFontPickerOpen] = useState(false);
  const [selectedCommentary, setSelectedCommentary] = useState(COMMENTARY_DEFAULT_ID);
  const [commentaryOptions, setCommentaryOptions] = useState<CommentaryOption[]>([]);
  const [commentaryListLoading, setCommentaryListLoading] = useState(false);
  const [commentaryListResolved, setCommentaryListResolved] = useState(false);
  const [commentaryListError, setCommentaryListError] = useState<string | null>(null);
  const [commentaryChapterLoading, setCommentaryChapterLoading] = useState(false);
  const [commentaryError, setCommentaryError] = useState<string | null>(null);
  const [commentaryEntries, setCommentaryEntries] = useState<CommentaryApiChapterItem[]>([]);
  const [commentarySelectionReady, setCommentarySelectionReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const [langSheetKeyboardHeight, setLangSheetKeyboardHeight] = useState(0);
  const [langSearch, setLangSearch] = useState('');
  const [langFilter, setLangFilter] = useState<string | null>(null);
  const availableLanguages = useMemo(() => {
    const seen = new Set<string>();
    return translationPickerItems
      .map((t) => t.languageSection)
      .filter((l) => l && !seen.has(l) && seen.add(l))
      .sort();
  }, [translationPickerItems]);
  const filteredLanguages = useMemo(() => {
    const q = langSearch.trim().toLowerCase();
    if (!q) return availableLanguages;
    return availableLanguages.filter((l) => l.toLowerCase().includes(q));
  }, [availableLanguages, langSearch]);
  const { height: windowHeight } = Dimensions.get("window");
  /** Screen height avoids Android `window` shrinking with the keyboard (prevents FlatList maxHeight thrash / flicker). */
  const screenHeight = Dimensions.get("screen").height;
  const commentarySheetMaxHeightPx = windowHeight * 0.78 + 30;
  const commentarySheetTranslateY = useRef(new Animated.Value(0)).current;
  const commentarySheetClosingRef = useRef(false);
  const commentarySheetDragStartYRef = useRef(0);
  const langSheetTranslateY = useRef(new Animated.Value(0)).current;
  const langSearchInputRef = useRef<TextInput>(null);

  const dismissLangSearchKeyboard = useCallback(() => {
    langSearchInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

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

  const translationPickerSheetTranslateY = useRef(new Animated.Value(0)).current;
  const translationPickerSheetClosingRef = useRef(false);
  const translationPickerSheetDragStartYRef = useRef(0);

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
      if (clamped > 0) {
        translationPickerSheetTranslateY.setValue(clamped);
      }
      Animated.timing(translationPickerSheetTranslateY, {
        toValue: targetY,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        translationPickerSheetClosingRef.current = false;
        translationPickerSheetTranslateY.setValue(0);
        closeReaderDropdown();
      });
    },
    [translationPickerSheetTranslateY, closeReaderDropdown],
  );

  const onTranslationPickerDismissGestureEvent = useCallback(
    (e: PanGestureHandlerGestureEvent) => {
      if (translationPickerSheetClosingRef.current) return;
      const ty = e.nativeEvent.translationY;
      translationPickerSheetTranslateY.setValue(Math.max(0, translationPickerSheetDragStartYRef.current + ty));
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

  useEffect(() => {
    if (readerDropdown !== "translation") {
      translationPickerSheetClosingRef.current = false;
      translationPickerSheetTranslateY.stopAnimation();
      translationPickerSheetTranslateY.setValue(0);
    }
  }, [readerDropdown, translationPickerSheetTranslateY]);

  const onReaderToolsMenuBackdropPress = useCallback(() => {
    Keyboard.dismiss();
    if (readerDropdown === "translation") {
      if (translationPickerSheetClosingRef.current) return;
      hapticLightImpact();
      animateCloseTranslationPickerSheet(0, 0);
      return;
    }
    hapticLightImpact();
    closeReaderDropdown();
  }, [readerDropdown, animateCloseTranslationPickerSheet, closeReaderDropdown]);

  const closeLangSheet = useCallback(() => {
    langSearchInputRef.current?.blur();
    Keyboard.dismiss();
    setLangSheetOpen(false);
    setLangSearch("");
    langSheetTranslateY.setValue(0);
  }, [langSheetTranslateY]);

  const langSheetClosingRef = useRef(false);
  const langSheetDragStartYRef = useRef(0);

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
      if (clamped > 0) {
        langSheetTranslateY.setValue(clamped);
      }
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

  useEffect(() => {
    if (!langSheetOpen) {
      langSheetClosingRef.current = false;
      langSheetTranslateY.stopAnimation();
      langSheetTranslateY.setValue(0);
    }
  }, [langSheetOpen]);

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
      return (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            dismissLangSearchKeyboard();
            setLangFilter(item);
            closeLangSheet();
          }}
          style={{
            minHeight: 44,
            borderBottomWidth: 1,
            borderBottomColor: ui.borderSolid,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 12,
            backgroundColor: selected ? `${ui.gold}22` : "transparent",
          }}
        >
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: ui.brown800 }}>{item}</Text>
          {selected ? <Ionicons name="checkmark" size={16} color={ui.gold} /> : null}
        </TouchableOpacity>
      );
    },
    [langFilter, closeLangSheet, bundle.ui, dismissLangSearchKeyboard],
  );

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
  const filteredTranslations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return translationPickerItems.filter((item) => {
      if (langFilter && item.languageSection !== langFilter) return false;
      if (!query) return true;
      const abbr = item.label.split(" - ")[0]?.toLowerCase() ?? "";
      return item.label.toLowerCase().includes(query) || abbr.includes(query);
    });
  }, [langFilter, searchQuery, translationPickerItems]);

  const translationPickerShowResults = useMemo(
    () =>
      readerDropdown === "translation" &&
      (searchQuery.trim().length > 0 || langFilter != null),
    [readerDropdown, searchQuery, langFilter],
  );
  const translationSheetViewportMaxH = useMemo(
    () =>
      readerDropdown === "translation"
        ? Math.max(280, screenHeight - readerDropdownTop - Math.max(insets.bottom, 12) - 10)
        : 0,
    [readerDropdown, screenHeight, readerDropdownTop, insets.bottom],
  );
  /** Pinned-only mode: scroll region cap; sheet height follows content up to this. */
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
  /** Handle + title/search block + Done row (excludes scrollable list). */
  const langSheetListBodyHeight = useMemo(() => Math.max(120, langSheetMaxHeight - 254), [langSheetMaxHeight]);

  useEffect(() => {
    if (!fontSettingsSheetOpen) setReaderFontPickerOpen(false);
  }, [fontSettingsSheetOpen]);
  useEffect(() => {
    if (readerDropdown !== "translation") {
      setLangSheetOpen(false);
      setLangFilter(null);
      setLangSearch("");
      setSearchQuery("");
    }
  }, [readerDropdown]);

  const bookSheetPanRef = useRef<PanGestureHandler>(null);
  const bookSheetScrollNativeRef = useRef<NativeViewGestureHandler>(null);

  return (
    <>
<Modal
  visible={newEntrySheetOpen}
  transparent
  animationType="none"
  statusBarTranslucent
  onRequestClose={requestCloseReaderNewEntrySheet}
>
  <View pointerEvents="box-none" style={{ flex: 1 }}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Dismiss new entry"
      onPress={requestCloseReaderNewEntrySheet}
      style={[StyleSheet.absoluteFill, { backgroundColor: bundle.journal.newEntryRouteScrim }]}
    />
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: newEntrySheetLeft,
        width: newEntrySheetWidth,
        top: newEntrySheetTopPx,
        bottom: newEntrySheetBottomPx + readerNewEntrySheetBottomLiftPx,
        opacity: newEntrySheetOpacity,
        transform: [{ translateY: newEntrySheetTranslate }],
      }}
    >
      <View style={{ flex: 1, minHeight: 0 }}>
        <View
          style={{
            flex: 1,
            minHeight: 0,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: bundle.journal.newEntrySheetBorder,
            backgroundColor: bundle.journal.newEntrySheetBackground,
            overflow: "hidden",
            shadowColor: rc.popoverShadow,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.14,
            shadowRadius: 16,
            elevation: 10,
          }}
        >
          <View
            {...newEntryHandlePanResponder.panHandlers}
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 6,
              paddingBottom: 4,
              backgroundColor: bundle.journal.newEntryDragAreaBackground,
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
              initialParams={newEntryInitialParams ?? undefined}
              contentHorizontalPadding={10}
              readerNewEntryScrollable
              readerCardBottomLiftPx={readerNewEntrySheetBottomLiftPx}
              onDirtyChange={setNewEntryHasDraft}
              onAfterSave={() => {
                closeNewEntrySheet();
              }}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  </View>
</Modal>

<Modal
  visible={readerDropdown != null && readerDropdown !== "book"}
  transparent
  animationType="none"
  statusBarTranslucent
  onRequestClose={() => {
    if (readerDropdown === "translation" && !translationPickerSheetClosingRef.current) {
      animateCloseTranslationPickerSheet(0, 0);
    } else {
      closeReaderDropdown();
    }
  }}
>
  <View style={{ flex: 1 }}>
    <Pressable
      style={[StyleSheet.absoluteFill, { backgroundColor: rc.menuScrim }]}
      onPress={onReaderToolsMenuBackdropPress}
      accessibilityLabel="Dismiss menu"
    />
    {readerDropdown != null && readerDropdown !== "book" && dropdownAnchor != null ? (
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: readerDropdownTop,
          left: insets.left + 5,
          right: readerDropdown === "theme" ? insets.right + 1 : undefined,
          width:
            readerDropdown === "theme"
              ? undefined
              : Math.max(0, Dimensions.get("window").width - (insets.left + insets.right + 2)),
          ...(readerDropdown === "translation"
            ? translationPickerShowResults
              ? { bottom: insets.bottom + 10 }
              : { maxHeight: translationSheetViewportMaxH }
            : {}),
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
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.borderSolid,
            backgroundColor: rc.popoverSurface,
            overflow: "hidden",
            shadowColor: rc.popoverShadow,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.16,
            shadowRadius: 14,
            elevation: 8,
            ...(readerDropdown === "theme"
              ? {
                  width: readerThemeDropdownW,
                  alignSelf: "center",
                }
              : {}),
            ...(readerDropdown === "translation" && translationPickerShowResults
              ? { flex: 1, minHeight: 0 }
              : {}),
          }}
        >
          {readerDropdown === "translation" ? (
            (() => {
              const ui = bundle.ui;
              const rc = bundle.reader;
              const pinnedTranslations = translationPickerItems.filter((item) =>
                favoriteTranslationIds.includes(item.id),
              );
              const showResults = searchQuery.trim().length > 0 || langFilter != null;
              const selectTranslation = (id: string) => {
                Keyboard.dismiss();
                hapticLightImpact();
                closeReaderDropdown();
                const internalId = getInternalIdFromApiId(id);
                router.setParams({ translation: internalId ?? id });
              };
              return (
            <Animated.View
              style={{
                ...(translationPickerShowResults ? { flex: 1, minHeight: 0 } : {}),
                transform: [{ translateY: translationPickerSheetTranslateY }],
              }}
            >
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
                    paddingTop: 6,
                    paddingBottom: 8,
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
                </GestureHandlerTouchableOpacity>
              </PanGestureHandler>
            <View
              style={{
                ...(translationPickerShowResults ? { flex: 1, minHeight: 0 } : {}),
                backgroundColor: ui.parchment,
                paddingHorizontal: 16,
                paddingTop: 6,
                paddingBottom: 14,
              }}
            >
              <Pressable onPress={Keyboard.dismiss} accessibilityRole="button" accessibilityLabel="Hide keyboard">
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 20,
                    color: ui.brown800,
                    marginBottom: 14,
                  }}
                >
                  Choose a Translation
                </Text>
              </Pressable>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <View
                  style={{
                    flex: 1,
                    height: 42,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: ui.borderSolid,
                    backgroundColor: rc.popoverRow,
                    paddingHorizontal: 14,
                    justifyContent: "center",
                  }}
                >
                  <TextInput
                    placeholder="Search translation"
                    placeholderTextColor={ui.tan300}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 14,
                      color: ui.brown800,
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
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: ui.borderSolid,
                    backgroundColor: rc.popoverRow,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FilterListIcon size={16} color={ui.brown800} />
                </TouchableOpacity>
              </View>

              <Pressable
                onPress={Keyboard.dismiss}
                accessibilityRole="button"
                accessibilityLabel="Hide keyboard"
                style={{ marginBottom: 12, minHeight: 12, justifyContent: "center" }}
              >
                <View style={{ height: 1, backgroundColor: ui.borderSolid, opacity: 0.9 }} />
              </Pressable>

              <ScrollView
                style={
                  translationPickerShowResults
                    ? { flex: 1, minHeight: 0 }
                    : { maxHeight: translationCompactScrollMaxH }
                }
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "on-drag" : "none"}
                onScrollBeginDrag={() => Keyboard.dismiss()}
              >
                <Pressable onPress={Keyboard.dismiss} accessibilityRole="button" accessibilityLabel="Hide keyboard">
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 10,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      color: ui.tan300,
                      opacity: 0.75,
                      marginBottom: 8,
                    }}
                  >
                    Pinned
                  </Text>
                </Pressable>

                <View style={{ gap: 8, marginBottom: 16 }}>
                  {pinnedTranslations.length > 0 ? pinnedTranslations.map((item, index) => {
                    const abbr = item.label.split(" - ")[0] ?? item.label;
                    return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.85}
                      onPress={() => selectTranslation(item.id)}
                      style={{
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: ui.borderSolid,
                        backgroundColor: index === 0 ? `${ui.gold}22` : rc.popoverRow,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Lora_400Regular_Italic",
                          fontSize: 12,
                          color: ui.brown800,
                          width: 48,
                        }}
                      >
                        {abbr}
                      </Text>
                      <View
                        style={{
                          width: 1,
                          alignSelf: "stretch",
                          backgroundColor: index === 0 ? `${ui.gold}73` : ui.borderSolid,
                          opacity: index === 0 ? 1 : 0.9,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: ui.brown800 }} numberOfLines={1}>
                          {item.label}
                        </Text>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: ui.tan300 }}>
                          {item.languageSection}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {item.id === resolvedTranslationApiId ? <Ionicons name="checkmark" size={15} color={ui.gold} /> : null}
                        <TouchableOpacity
                          onPress={() => {
                            Keyboard.dismiss();
                            toggleFavoriteTranslation(item.id);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="star" size={16} color={ui.gold} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );}) : (
                    <Pressable onPress={Keyboard.dismiss} accessibilityRole="button" accessibilityLabel="Hide keyboard">
                    <View style={{ gap: 6, paddingVertical: 6 }}>
                      <View style={{ height: 4, width: "72%", borderRadius: 999, backgroundColor: ui.borderSolid }} />
                      <View style={{ height: 4, width: "58%", borderRadius: 999, backgroundColor: ui.borderSolid }} />
                      <View style={{ height: 4, width: "43%", borderRadius: 999, backgroundColor: ui.borderSolid }} />
                      <Text style={{ fontFamily: "Lora_400Regular_Italic", fontSize: 12, color: ui.tan300 }}>
                        Star a translation to pin it here
                      </Text>
                    </View>
                    </Pressable>
                  )}
                </View>

                {showResults ? (
                  <View style={{ gap: 8, marginBottom: 16 }}>
                    {filteredTranslations.map((item) => {
                      const isPinned = favoriteTranslationIds.includes(item.id);
                      const abbr = item.label.split(" - ")[0] ?? item.label;
                      return (
                        <TouchableOpacity
                          key={`result-${item.id}`}
                          activeOpacity={0.85}
                          onPress={() => selectTranslation(item.id)}
                          style={{
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: ui.borderSolid,
                            backgroundColor: item.id === resolvedTranslationApiId ? `${ui.gold}22` : rc.popoverRow,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Lora_400Regular_Italic",
                              fontSize: 12,
                              color: ui.brown800,
                              width: 48,
                            }}
                          >
                            {abbr}
                          </Text>
                          <View
                            style={{
                              width: 1,
                              alignSelf: "stretch",
                              backgroundColor: item.id === resolvedTranslationApiId ? `${ui.gold}73` : ui.borderSolid,
                              opacity: item.id === resolvedTranslationApiId ? 1 : 0.9,
                            }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: ui.brown800 }} numberOfLines={1}>
                              {item.label}
                            </Text>
                            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: ui.tan300 }}>
                              {item.languageSection}
                            </Text>
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            {item.id === resolvedTranslationApiId ? <Ionicons name="checkmark" size={15} color={ui.gold} /> : null}
                            <TouchableOpacity
                              onPress={() => {
                                Keyboard.dismiss();
                                toggleFavoriteTranslation(item.id);
                              }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name={isPinned ? "star" : "star-outline"} size={16} color={isPinned ? ui.gold : ui.borderSolid} />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </ScrollView>

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
            </View>
            </Animated.View>
              );
            })()
          ) : null}
          {readerDropdown === "theme" ? (
            <View
              style={{
                backgroundColor: rc.popoverSurface,
                paddingHorizontal: 10,
                paddingBottom: 10,
                paddingTop: 5,
              }}
            >
              <Text
                className="tracking-widest uppercase mb-2"
                style={{
                  alignSelf: "stretch",
                  textAlign: "center",
                  fontFamily: "Inter_400Regular",
                  fontSize: 15.6,
                  color: settingsMutedTextColor,
                }}
              >
                Theme
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  /** Explicit gaps: `gap` + `flexWrap` is unreliable on some Android RN builds. */
                }}
              >
                {mobileAppThemePickerOptions.map((opt, index) => {
                  const isActive = opt.id === themeId;
                  const col = index % 3;
                  const chrome =
                    opt.id === "mono"
                      ? {
                          label: "rgba(18,18,18,0.92)",
                          idleBorder: "rgba(0,0,0,0.12)",
                        }
                      : readerThemeTileChrome(opt.swatchColor);
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => {
                        hapticLightImpact();
                        setThemeId(opt.id);
                        closeReaderDropdown();
                      }}
                      activeOpacity={0.85}
                      accessibilityLabel={opt.label}
                      accessibilityState={{ selected: isActive }}
                      style={{
                        width: readerThemeGridTileW,
                        marginRight: col < 2 ? readerThemeGridGap : 0,
                        marginBottom: index < 3 ? readerThemeGridGap : 0,
                      }}
                    >
                      <View
                        style={{
                          width: "100%",
                          aspectRatio: 1,
                          borderRadius: 14,
                          backgroundColor: opt.swatchColor,
                          borderWidth: isActive ? 4 : 1,
                          borderColor: isActive ? READER_THEME_TILE_ACTIVE_BORDER : chrome.idleBorder,
                          alignItems: "center",
                          justifyContent: "center",
                          paddingHorizontal: 6,
                          shadowColor: "#000000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.12,
                          shadowRadius: 3,
                          elevation: 2,
                        }}
                      >
                        <Text
                          numberOfLines={2}
                          adjustsFontSizeToFit
                          minimumFontScale={0.78}
                          style={{
                            fontFamily: "Inter_600SemiBold",
                            fontSize: 13,
                            letterSpacing: 0.2,
                            textAlign: "center",
                            color: chrome.label,
                          }}
                        >
                          {opt.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </Animated.View>
    ) : null}
    {langSheetOpen && readerDropdown === "translation" ? (
      <View
        pointerEvents="box-none"
        style={{
          ...StyleSheet.absoluteFillObject,
          zIndex: 5,
        }}
      >
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: `${bundle.ui.brown800}66`,
          }}
        />
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
              left: insets.left + 5,
              right: insets.right + 5,
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
                    paddingTop: 8,
                    paddingBottom: 6,
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
                </GestureHandlerTouchableOpacity>
              </PanGestureHandler>
              <View
                style={{ paddingHorizontal: 16, paddingBottom: 10 }}
              >
                <View style={{ alignItems: "center", justifyContent: "center", marginBottom: 10, minHeight: 24 }}>
                  <GestureHandlerTouchableOpacity
                    activeOpacity={1}
                    onPress={dismissLangSearchKeyboard}
                    accessibilityRole="button"
                    accessibilityLabel="Hide keyboard"
                  >
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 18, color: bundle.ui.brown800 }}>
                      Language
                    </Text>
                  </GestureHandlerTouchableOpacity>
                  {langFilter != null ? (
                    <TouchableOpacity
                      style={{ position: "absolute", right: 0 }}
                      onPress={() => {
                        dismissLangSearchKeyboard();
                        setLangFilter(null);
                        closeLangSheet();
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: bundle.ui.tan300 }}>Clear</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View
                  style={{
                    height: 42,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: bundle.ui.borderSolid,
                    backgroundColor: bundle.reader.popoverRow,
                    paddingHorizontal: 14,
                    justifyContent: "center",
                    marginBottom: 8,
                  }}
                >
                  <TextInput
                    ref={langSearchInputRef}
                    value={langSearch}
                    onChangeText={setLangSearch}
                    placeholder="Search language"
                    placeholderTextColor={bundle.ui.tan300}
                    style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: bundle.ui.brown800 }}
                  />
                </View>
              </View>
              <GHFlatList
                data={filteredLanguages}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "on-drag" : "none"}
                onScrollBeginDrag={dismissLangSearchKeyboard}
                style={{ height: langSheetListBodyHeight }}
                showsVerticalScrollIndicator
                persistentScrollbar
                indicatorStyle="black"
                removeClippedSubviews={false}
                initialNumToRender={16}
                windowSize={8}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10 }}
                ListFooterComponent={
                  <Pressable
                    style={{ minHeight: 72 }}
                    onPress={dismissLangSearchKeyboard}
                    accessibilityRole="button"
                    accessibilityLabel="Hide keyboard"
                  />
                }
                renderItem={renderLangSheetItem}
              />
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
            </View>
          </Animated.View>
        </View>
      </View>
    ) : null}
  </View>
</Modal>

{readerDropdown === "book" ? (
  <ReaderBookSheetWindowOverlay
    visible={readerDropdown === "book"}
    onRequestClose={() => animateCloseBookSheet(0, 0)}
  >
    <View
      style={[StyleSheet.absoluteFillObject, { zIndex: 9999, elevation: 32 }]}
      pointerEvents="box-none"
      accessibilityViewIsModal
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss book picker"
        onPress={() => animateCloseBookSheet(0, 0)}
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
      {bookPickerStep === "books" ? (
        <>
          <View style={{ paddingHorizontal: readerBookSheetPad, paddingTop: 0, paddingBottom: 6 }}>
            <View style={{ minHeight: 48, justifyContent: "center", zIndex: 1 }}>
              <TouchableOpacity
                onPress={() => setBookViewMenuOpen((o) => !o)}
                delayPressIn={0}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  justifyContent: "center",
                  alignItems: "center",
                  minWidth: 48,
                  minHeight: 44,
                  paddingLeft: 10,
                  paddingRight: 16,
                  zIndex: 10,
                  elevation: 10,
                }}
                /* Avoid a tall bottom hitSlop: it overlaps the book grid ScrollView and the OS
                 * waits to disambiguate scroll vs tap, which feels like lag or missed taps. */
                hitSlop={{ top: 10, bottom: 4, left: 8, right: 8 }}
                accessibilityLabel="Choose book list view"
                accessibilityState={{ expanded: bookViewMenuOpen }}
              >
                <FilterListIcon size={22} color={colors.gold} />
              </TouchableOpacity>
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
                              onPress={() => {
                                hapticLightImpact();
                                setBookPickerBook(b);
                                setBookPickerStep("chapters");
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
                      onPress={() => {
                        hapticLightImpact();
                        setBookPickerBook(b);
                        setBookPickerStep("chapters");
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
                        onPress={() => {
                          hapticLightImpact();
                          setBookPickerBook(b);
                          setBookPickerStep("chapters");
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
            </GHScrollView>
          </NativeViewGestureHandler>
        </>
      ) : bookPickerBook ? (
        <View style={{ flex: 1, paddingHorizontal: readerBookSheetPad }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <TouchableOpacity
              onPress={() => {
                hapticLightImpact();
                setBookPickerStep("books");
                setBookPickerBook(null);
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
            SELECT A CHAPTER
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
            {bookPickerBook.name.toUpperCase()}
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
            {Array.from({ length: bookPickerBook.chapterCount }, (_, i) => i + 1).map((chNum, index) => {
              const isCurrent =
                bookPickerBook.slug === chapter.bookSlug && chNum === chapter.chapterNumber;
              const mr = index % readerChapterCols === readerChapterCols - 1 ? 0 : readerBookGridGap;
              return (
                <TouchableOpacity
                  key={chNum}
                  onPress={() => {
                    hapticLightImpact();
                    closeReaderDropdown();
                    goToReaderChapter(bookPickerBook.slug, chNum, resolvedTranslationId);
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
                  accessibilityLabel={`Open ${bookPickerBook.name} chapter ${chNum}`}
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
    {bookViewMenuOpen && bookPickerStep === "books" ? (
      <View
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFillObject, { zIndex: 300 }]}
        collapsable={false}
      >
        <TouchableWithoutFeedback
          accessibilityRole="button"
          accessibilityLabel="Dismiss view options"
          onPress={() => setBookViewMenuOpen(false)}
        >
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "transparent" }]} />
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
    </View>
  </ReaderBookSheetWindowOverlay>
) : null}

<Modal
  visible={commentaryPanelOpen}
  transparent
  animationType="slide"
  statusBarTranslucent
  onRequestClose={closeCommentaryPanel}
>
  <View style={{ flex: 1, justifyContent: "flex-end" }}>
    <Pressable
      style={StyleSheet.absoluteFillObject}
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

<Modal
  visible={fontSettingsSheetOpen}
  transparent
  animationType="none"
  statusBarTranslucent
  onRequestClose={closeFontSettingsPopup}
>
  <View style={{ flex: 1 }}>
    <Pressable
      style={[StyleSheet.absoluteFill, { backgroundColor: rc.menuScrim }]}
      onPress={closeFontSettingsPopup}
      accessibilityLabel="Dismiss font settings"
    />
    <View
      pointerEvents="box-none"
      style={{
        flex: 1,
        justifyContent: isTabletReaderLayout ? "flex-start" : "flex-end",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingTop: isTabletReaderLayout ? Math.max(insets.top, 12) + 16 : 0,
        paddingBottom: isTabletReaderLayout ? 0 : nativeTabSheetBottomInsetPx(insets.bottom, 5),
      }}
    >
      <Animated.View
        style={{
          width: fontSettingsPopupMaxW,
          maxHeight: fontSettingsPopupMaxH,
          opacity: fontSettingsPopupOpacityAnim,
          transform: [
            {
              translateY: fontSettingsPopupSlideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-READER_MENU_SLIDE_FROM_PX, 0],
              }),
            },
          ],
        }}
      >
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.borderSolid,
            backgroundColor: rc.popoverSurface,
            overflow: "hidden",
            shadowColor: rc.popoverShadow,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.16,
            shadowRadius: 14,
            elevation: 8,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{
              paddingHorizontal: fontSettingsPopupPadH,
              paddingTop: fontSettingsPopupPadTop,
              paddingBottom: fontSettingsPopupPadBottom,
            }}
          >
            <View style={{ marginBottom: 10 * fontSettingsScale }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10 * fontSettingsScale,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: fontSettingsSectionLabelSize,
                    color: settingsMutedTextColor,
                  }}
                >
                  Font
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    hapticLightImpact();
                    setReaderFontPickerOpen((open) => !open);
                  }}
                  activeOpacity={0.8}
                  accessibilityLabel="Reader font"
                  accessibilityHint="Opens a list of fonts for Bible verse text"
                  accessibilityState={{ expanded: readerFontPickerOpen }}
                  style={{
                    flexShrink: 1,
                    maxWidth: "68%",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6 * fontSettingsScale,
                    paddingVertical: 8 * fontSettingsScale,
                    paddingHorizontal: 14 * fontSettingsScale,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.borderSolid,
                    backgroundColor: rc.popoverRow,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      flexShrink: 1,
                      fontFamily: readerVerseBodyFontFamily(readerVerseBodyFontId),
                      fontSize: 14 * fontSettingsScale,
                      color: colors.brown800,
                    }}
                  >
                    {READER_VERSE_BODY_FONT_OPTIONS.find((o) => o.id === readerVerseBodyFontId)?.label ??
                      "Lora"}
                  </Text>
                  <Ionicons
                    name={readerFontPickerOpen ? "chevron-up" : "chevron-down"}
                    size={Math.round(16 * fontSettingsScale)}
                    color={colors.tan300}
                  />
                </TouchableOpacity>
              </View>
              {readerFontPickerOpen ? (
                <View
                  style={{
                    marginTop: 8 * fontSettingsScale,
                    borderRadius: 12 * fontSettingsScale,
                    borderWidth: 1,
                    borderColor: colors.borderSolid,
                    backgroundColor: rc.popoverSurface,
                    maxHeight: 240 * fontSettingsScale,
                    overflow: "hidden",
                  }}
                >
                  <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator
                    bounces={false}
                  >
                    {READER_VERSE_BODY_FONT_OPTIONS.map((opt) => {
                      const selected = opt.id === readerVerseBodyFontId;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          onPress={() => {
                            hapticLightImpact();
                            setReaderVerseBodyFontIdPersisted(opt.id);
                            setReaderFontPickerOpen(false);
                          }}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          style={{
                            paddingVertical: 11 * fontSettingsScale,
                            paddingHorizontal: 12 * fontSettingsScale,
                            backgroundColor: selected ? rc.popoverRow : "transparent",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: readerVerseBodyFontFamily(opt.id),
                              fontSize: 16 * fontSettingsScale,
                              color: colors.brown800,
                            }}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
            </View>

            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: fontSettingsSectionLabelSize,
                color: settingsMutedTextColor,
                marginBottom: 8 * fontSettingsScale,
              }}
            >
              Font size
            </Text>
            <ReaderFontSizeSlider
              variant="sheet"
              value={fontSizeScale}
              min={FONT_SCALE_MIN}
              max={FONT_SCALE_MAX}
              onValueChange={setFontSizeScalePersisted}
              accessibilityLabel={`Font size ${Math.round(fontSizeScale * 100)} percent`}
            />

            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: fontSettingsSectionLabelSize,
                color: settingsMutedTextColor,
                marginTop: READER_FONT_CARD_GAP_AFTER_SIZE_SLIDER_PX * fontSettingsScale,
                marginBottom: 4 * fontSettingsScale,
              }}
            >
              Font spacing
            </Text>
            <ReaderFontSizeSlider
              variant="sheet"
              value={lineSpacingScale}
              min={LINE_SPACING_MIN}
              max={LINE_SPACING_MAX}
              onValueChange={setLineSpacingScalePersisted}
              accessibilityLabel={`Font spacing ${Math.round(lineSpacingScale * 100)} percent`}
            />

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "stretch",
                marginTop: READER_FONT_CARD_GAP_AFTER_SPACING_SLIDER_PX * fontSettingsScale,
                gap: 10 * fontSettingsScale,
              }}
            >
              {FONT_SHEET_ALIGN_ROW.map(({ align, Icon }) => {
                const isActive = verseTextAlign === align;
                const label = readerVerseTextAlignLabel(align);
                const cellStyle = {
                  width: "100%" as const,
                  minHeight: 48 * fontSettingsScale,
                  alignItems: "center" as const,
                  justifyContent: "center" as const,
                  paddingVertical: 12 * fontSettingsScale,
                  borderRadius: 12 * fontSettingsScale,
                };
                return (
                  <TouchableOpacity
                    key={align}
                    onPress={() => setVerseTextAlignPersisted(align)}
                    activeOpacity={0.75}
                    accessibilityLabel={`Verse text ${label.toLowerCase()} aligned`}
                    accessibilityState={{ selected: isActive }}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    {isActive ? (
                      <LinearGradient
                        colors={rc.translationSelectedGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={cellStyle}
                      >
                        <Icon size={fontSettingsAlignIconSize} color="#f5e9d6" />
                      </LinearGradient>
                    ) : (
                      <View style={[cellStyle, { backgroundColor: rc.popoverRow }]}>
                        <Icon size={fontSettingsAlignIconSize} color={colors.brown800} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </Animated.View>
    </View>
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
