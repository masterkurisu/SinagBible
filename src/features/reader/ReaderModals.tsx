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
import { getUsfmBookId } from "@sinag-bible/core";
import type { BibleBookNavItem, BibleChapter } from "@sinag-bible/types";
import { mobileAppThemePickerOptions } from "@sinag-bible/tokens";
import {
  JournalNewEntryForm,
  type JournalNewEntryFormHandle,
  type JournalNewEntryInitialParams,
} from "@/components/journal-new-entry-form";
import { BookIcon } from "@/components/icons/BookIcon";
import { StudyNotesResearchIcon } from "@/components/icons/StudyNotesResearchIcon";
import { ReaderFontSettingsIcon } from "@/components/icons/ReaderFontSettingsIcon";
import { CreditsIcon } from "@/components/icons/CreditsIcon";
import { ReaderThemesPaletteIcon } from "@/components/icons/ReaderThemesPaletteIcon";
import { DeleteMyDataIcon } from "@/components/icons/DeleteMyDataIcon";
import type { ReaderSettingsOnboardingStepId } from "@/src/features/reader/readerSettingsOnboardingSteps";
import { BOOK_GENRE_BY_SLUG } from "@/lib/book-genre-by-slug";
import { nativeTabSheetBottomInsetPx } from "@/lib/native-tab-chrome";
import { hapticLightImpact } from "@/lib/haptics";
import { READER_MENU_SLIDE_FROM_PX } from "./useReaderGestures";
import { BookPickerSheet } from "@/src/features/reader/BookPickerSheet";
export type { BookSelectorViewMode, SelectorTestamentTab } from "@/src/features/reader/BookPickerSheet";
export { ReaderBookSheetWindowOverlay } from "@/src/features/reader/BookPickerSheet";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";

export type ReaderToolsDropdown = "book" | "translation" | "theme";

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

export type ReaderModalsProps = {
  bundle: MobileAppThemeBundle;
  chapter: BibleChapter;
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
  goToReaderChapter: (nextBookSlug: string, nextChapter: number, translationId: string) => void;
  books: BibleBookNavItem[];
  setBookSheetExitAnimationStarted: React.Dispatch<React.SetStateAction<boolean>>;
  insets: { top: number; bottom: number; left: number; right: number };
  isTabletReaderLayout: boolean;
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
  saveNoteFromModal: () => void;
  selectedVerses: number[];
  setNewEntryHasDraft: (v: boolean) => void;
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
    closeNewEntrySheet,
    closeReaderDropdown,
    colors,
    dropOpacityAnim,
    dropSlideAnim,
    dropdownAnchor,
    goToReaderChapter,
    insets,
    isTabletReaderLayout,
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
    saveNoteFromModal,
    selectedVerses,
    setNewEntryHasDraft,
    setNoteDraft,
    setNoteModalVisible,
    setNoteTargetVerse,
    setThemeId,
    settingsMutedTextColor,
    themesFanRef,
    themeId,
    translationFanRef,
  } = props;

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
  visible={readerDropdown === "theme"}
  transparent
  animationType="none"
  statusBarTranslucent
  onRequestClose={closeReaderDropdown}
>
  <View style={{ flex: 1 }}>
    <Pressable
      style={[StyleSheet.absoluteFill, { backgroundColor: rc.menuScrim }]}
      onPress={() => {
        hapticLightImpact();
        closeReaderDropdown();
      }}
      accessibilityLabel="Dismiss menu"
    />
    {readerDropdown === "theme" && dropdownAnchor != null ? (
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: readerDropdownTop,
          left: insets.left + 5,
          right: insets.right + 1,
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
            width: readerThemeDropdownW,
            alignSelf: "center",
          }}
        >
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
        </View>
      </Animated.View>
    ) : null}
  </View>
</Modal>


<BookPickerSheet
  isOpen={readerDropdown === "book"}
  onClose={closeReaderDropdown}
  onExitAnimationStart={() => setBookSheetExitAnimationStarted(true)}
  chapter={chapter}
  books={books}
  resolvedTranslationId={resolvedTranslationId}
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
