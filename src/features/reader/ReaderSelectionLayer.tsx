import { memo, useCallback, useEffect, useMemo, useRef, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type Animated as AnimatedType,
} from "react-native";
import type { ListRenderItemInfo } from "@shopify/flash-list";
import type { HighlightColor } from "@sinag-bible/types";
import { highlightColorOptions } from "@sinag-bible/ui";
import {
  ReaderCopyIcon,
  ReaderHighlightIcon,
  ReaderJournalIcon,
  ReaderNoteIcon,
} from "@/components/reader-action-icons";
import { StudyNotesBookmarkIcon } from "@/components/icons/StudyNotesBookmarkIcon";
import type { JournalNewEntryInitialParams } from "@/components/journal-new-entry-form";
import { hapticLightImpact, hapticSelection } from "@/lib/haptics";
import { ReaderVerseRow } from "@/components/reader-verse-row";
import {
  ReaderVerseList,
  READER_TABLET_TWO_COLUMN_GAP,
} from "@/src/features/reader/ReaderVerseList";
import type { ReaderVerseFlashItem } from "@/src/features/reader/useReaderGestures";
import { useReaderSelection } from "@/src/features/reader/useReaderSelection";
import { ReaderActionBarOnboardingLayer } from "@/src/features/reader/ReaderActionBarOnboardingLayer";
import type { ReaderActionBarOnboardingStepId } from "@/src/features/reader/readerActionBarOnboardingSteps";
import { useReaderActionBarOnboarding } from "@/src/features/reader/useReaderActionBarOnboarding";
import type { ReaderOnboardingStep } from "@/src/features/reader/useReaderFeatureOnboarding";
import type { ReaderVerseTextAlign } from "@/src/features/reader/useReaderPreferences";

const readerVerseListStyles = StyleSheet.create({
  flashItemBase: {
    flex: 1,
    ...Platform.select({
      android: {
        alignSelf: "stretch",
        width: "100%",
      },
    }),
  },
  leftColumnPadding: {
    paddingRight: READER_TABLET_TWO_COLUMN_GAP / 2,
  },
  rightColumnPadding: {
    paddingLeft: READER_TABLET_TWO_COLUMN_GAP / 2,
  },
});

const ACTION_BAR_ICON_BOX_PX = 24;
const ACTION_BAR_ICON_SIZE_PX = 22;
const ACTION_BAR_ICON_SCALE = {
  studyNotes: 1.01,
  highlight: 1.19,
  copy: 1.31,
  note: 1.08,
  journal: 1.08,
} as const;

export type ReaderSelectionActivity = {
  selectedVerses: number[];
  noteModalVisible: boolean;
  noteDraft: string;
  noteTargetVerse: number | null;
  saveNoteFromModal: () => void;
  setNoteModalVisible: Dispatch<SetStateAction<boolean>>;
  setNoteDraft: Dispatch<SetStateAction<string>>;
  setNoteTargetVerse: Dispatch<SetStateAction<number | null>>;
};

type ReaderThemeColors = {
  brown800: string;
  tan300: string;
  parchmentMid: string;
  borderSolid: string;
};

type ReaderThemeBundle = {
  selectionBackground: string;
  selectionText: string;
  verseNumberColor: string;
  noteBelowVerseBackground: string;
  actionIconMuted: string;
  popoverShadow: string;
  sceneSurface: string;
};

type ReaderSelectionActionBarProps = {
  actionBarMode: "default" | "highlight";
  actionBarBottom: number | AnimatedType.AnimatedInterpolation<number>;
  colors: ReaderThemeColors;
  rc: ReaderThemeBundle;
  highlights: Record<number, HighlightColor | undefined>;
  selectedVerses: number[];
  pickedHighlightColor: HighlightColor;
  setActionBarMode: (mode: "default" | "highlight") => void;
  setPickedHighlightColor: (color: HighlightColor) => void;
  removeHighlightsFromSelection: () => void;
  applyPickedHighlightToSelection: () => void;
  openStudyNotesFromSelection: () => void;
  copySelectedVerses: () => void;
  openNoteForSelection: () => void;
  openJournalFromSelection: () => void;
  actionBarButtonRefs: Record<ReaderActionBarOnboardingStepId, RefObject<View | null>>;
};

const ReaderSelectionActionBar = memo(function ReaderSelectionActionBar({
  actionBarMode,
  actionBarBottom,
  colors,
  rc,
  highlights,
  selectedVerses,
  pickedHighlightColor,
  setActionBarMode,
  setPickedHighlightColor,
  removeHighlightsFromSelection,
  applyPickedHighlightToSelection,
  openStudyNotesFromSelection,
  copySelectedVerses,
  openNoteForSelection,
  openJournalFromSelection,
  actionBarButtonRefs,
}: ReaderSelectionActionBarProps) {
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 45 }]}>
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          bottom: actionBarBottom,
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
              <View ref={actionBarButtonRefs["study-notes"]} collapsable={false} className="h-[47px] w-[47px]">
                <TouchableOpacity
                  onPress={openStudyNotesFromSelection}
                  accessibilityLabel="Open study notes for selection"
                  className="h-[47px] w-[47px] rounded-full items-center justify-center"
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      width: ACTION_BAR_ICON_BOX_PX,
                      height: ACTION_BAR_ICON_BOX_PX,
                      alignItems: "center",
                      justifyContent: "center",
                      transform: [{ scale: ACTION_BAR_ICON_SCALE.studyNotes }],
                    }}
                  >
                    <StudyNotesBookmarkIcon color={rc.actionIconMuted} size={ACTION_BAR_ICON_SIZE_PX} />
                  </View>
                </TouchableOpacity>
              </View>
              <View ref={actionBarButtonRefs.highlight} collapsable={false} className="h-[47px] w-[47px]">
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
                      width: ACTION_BAR_ICON_BOX_PX,
                      height: ACTION_BAR_ICON_BOX_PX,
                      alignItems: "center",
                      justifyContent: "center",
                      transform: [{ scale: ACTION_BAR_ICON_SCALE.highlight }],
                    }}
                  >
                    <ReaderHighlightIcon color={rc.actionIconMuted} size={ACTION_BAR_ICON_SIZE_PX} />
                  </View>
                </TouchableOpacity>
              </View>
              <View ref={actionBarButtonRefs.copy} collapsable={false} className="h-[47px] w-[47px]">
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
                      width: ACTION_BAR_ICON_BOX_PX,
                      height: ACTION_BAR_ICON_BOX_PX,
                      alignItems: "center",
                      justifyContent: "center",
                      transform: [{ scale: ACTION_BAR_ICON_SCALE.copy }],
                    }}
                  >
                    <ReaderCopyIcon color={rc.actionIconMuted} size={ACTION_BAR_ICON_SIZE_PX} />
                  </View>
                </TouchableOpacity>
              </View>
              <View ref={actionBarButtonRefs.note} collapsable={false} className="h-[47px] w-[47px]">
                <TouchableOpacity
                  onPress={openNoteForSelection}
                  accessibilityLabel="Note"
                  className="h-[47px] w-[47px] rounded-full items-center justify-center"
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      width: ACTION_BAR_ICON_BOX_PX,
                      height: ACTION_BAR_ICON_BOX_PX,
                      alignItems: "center",
                      justifyContent: "center",
                      transform: [{ scale: ACTION_BAR_ICON_SCALE.note }],
                    }}
                  >
                    <ReaderNoteIcon color={rc.actionIconMuted} size={ACTION_BAR_ICON_SIZE_PX} />
                  </View>
                </TouchableOpacity>
              </View>
              <View ref={actionBarButtonRefs.journal} collapsable={false} className="h-[47px] w-[47px]">
                <TouchableOpacity
                  onPress={openJournalFromSelection}
                  accessibilityLabel="New journal entry from selection"
                  className="h-[47px] w-[47px] rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.brown800 }}
                  activeOpacity={0.85}
                >
                  <View
                    style={{
                      width: ACTION_BAR_ICON_BOX_PX,
                      height: ACTION_BAR_ICON_BOX_PX,
                      alignItems: "center",
                      justifyContent: "center",
                      transform: [{ scale: ACTION_BAR_ICON_SCALE.journal }],
                    }}
                  >
                    <ReaderJournalIcon color={rc.selectionText} size={ACTION_BAR_ICON_SIZE_PX} />
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Animated.View>
    </View>
  );
});

type ReaderVerseInteractionData = {
  selectedVerseNumbers: Set<number>;
  highlights: Record<number, HighlightColor | undefined>;
  notes: Record<number, string | undefined>;
};

type ReaderVerseStableVisualData = {
  themeId: string;
  selectionBackground: string;
  selectionText: string;
  verseNumberColor: string;
  noteBelowVerseBackground: string;
  bodyTextColor: string;
  readerVerseFontSize: number;
  readerVerseLineHeight: number;
  readerVerseBodyFontFamily: string;
  verseTextAlign: ReaderVerseTextAlign;
};

type ReaderVerseFlashRowProps = {
  item: Extract<ReaderVerseFlashItem, { kind: "verse" }>;
  index: number;
  interactionData: ReaderVerseInteractionData;
  stableVisualData: ReaderVerseStableVisualData;
  readerTabletLandscapeTwoColumn: boolean;
  readerVersesOpacityAnim: AnimatedType.Value;
  onVersePress: (verseNum: number) => void;
  onVerseLongPress: (verseNum: number) => void;
};

const MemoizedReaderVerseFlashRow = memo(
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
);

export type ReaderSelectionLayerProps = {
  chapter: {
    bookName: string;
    chapterNumber: number;
    verses: readonly string[];
    bookSlug: string;
  };
  resolvedTranslationId: string;
  highlights: Record<number, HighlightColor | undefined>;
  notes: Record<number, string | undefined>;
  removeHighlightsFromVerses: (verses: number[]) => void;
  applyHighlightToVerses: (verses: number[], color: HighlightColor) => void;
  persistNoteForVerse: (verse: number, text: string) => void;
  bookSlug: string | undefined;
  chapterNumber: number;
  requestedTranslationId: string;
  toolsMenuOpen: boolean;
  closeToolsMenu: () => void;
  themeId: string;
  colors: ReaderThemeColors;
  rc: ReaderThemeBundle;
  readerVerseFontSize: number;
  readerVerseLineHeight: number;
  readerVerseBodyFontFamily: string;
  verseTextAlign: ReaderVerseTextAlign;
  readerScrollRef: RefObject<import("@shopify/flash-list").FlashListRef<ReaderVerseFlashItem> | null>;
  chapterSwipePanHandlers: import("react-native").GestureResponderHandlers;
  readerVerseEstimatedItemSize: number;
  onScroll: import("react").ComponentProps<typeof ReaderVerseList>["onScroll"];
  onScrollBeginDrag: () => void;
  onScrollEndDrag?: () => void;
  onMomentumScrollEnd?: () => void;
  dismissReaderChromeFromBackgroundPress: () => void;
  verseFlashListDataForList: ReaderVerseFlashItem[];
  readerTabletLandscapeTwoColumn: boolean;
  readerVersesOpacityAnim: AnimatedType.Value;
  listHeader: ReactNode;
  readerChapterFlashListFooter: () => React.ReactElement | null;
  actionBarBottomPx: number;
  actionBarBottomPxHidden?: number;
  tabBarHideProgress?: AnimatedType.Value | null;
  androidListPaddingBottomHidden?: number;
  onListContentSizeChange?: (width: number, height: number) => void;
  onListLayoutHeight?: (height: number) => void;
  selectionBannerTopPx: number;
  screenW: number;
  readerMobileSettingsSlideTranslateX: AnimatedType.AnimatedInterpolation<number>;
  readerOverlayOpenFromParent: boolean;
  readerFeatureOnboardingActive: boolean;
  featureOnboardingStep: ReaderOnboardingStep | null;
  selectionBannerRef: RefObject<View | null>;
  onboardingStepRef: RefObject<ReaderOnboardingStep | null>;
  completeOnboardingInteractionRef: RefObject<() => void>;
  clearVerseSelectionRef?: RefObject<(() => void) | null>;
  onOpenJournal: (params: JournalNewEntryInitialParams) => void;
  onOpenStudyNotes: () => void;
  onSelectionActivityChange?: (activity: ReaderSelectionActivity) => void;
};

export const ReaderSelectionLayer = memo(function ReaderSelectionLayer({
  chapter,
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
  themeId,
  colors,
  rc,
  readerVerseFontSize,
  readerVerseLineHeight,
  readerVerseBodyFontFamily,
  verseTextAlign,
  readerScrollRef,
  chapterSwipePanHandlers,
  readerVerseEstimatedItemSize,
  onScroll,
  onScrollBeginDrag,
  onScrollEndDrag,
  onMomentumScrollEnd,
  dismissReaderChromeFromBackgroundPress,
  verseFlashListDataForList,
  readerTabletLandscapeTwoColumn,
  readerVersesOpacityAnim,
  listHeader,
  readerChapterFlashListFooter,
  actionBarBottomPx,
  actionBarBottomPxHidden,
  tabBarHideProgress,
  androidListPaddingBottomHidden,
  onListContentSizeChange,
  onListLayoutHeight,
  selectionBannerTopPx,
  screenW,
  readerMobileSettingsSlideTranslateX,
  readerOverlayOpenFromParent,
  readerFeatureOnboardingActive,
  featureOnboardingStep,
  selectionBannerRef,
  onboardingStepRef,
  completeOnboardingInteractionRef,
  clearVerseSelectionRef,
  onOpenJournal,
  onOpenStudyNotes,
  onSelectionActivityChange,
}: ReaderSelectionLayerProps) {
  const actionBarOnboardingStudyNotesRef = useRef<View | null>(null);
  const actionBarOnboardingHighlightRef = useRef<View | null>(null);
  const actionBarOnboardingCopyRef = useRef<View | null>(null);
  const actionBarOnboardingNoteRef = useRef<View | null>(null);
  const actionBarOnboardingJournalRef = useRef<View | null>(null);

  const actionBarButtonRefs = useMemo(
    (): Record<ReaderActionBarOnboardingStepId, RefObject<View | null>> => ({
      "study-notes": actionBarOnboardingStudyNotesRef,
      highlight: actionBarOnboardingHighlightRef,
      copy: actionBarOnboardingCopyRef,
      note: actionBarOnboardingNoteRef,
      journal: actionBarOnboardingJournalRef,
    }),
    [],
  );

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
    pickedHighlightColor,
    setPickedHighlightColor,
    copyToastVisible,
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
    chapter,
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

  const clearSelectionPrimedRef = useRef(false);
  const selectionToastHapticGuardRef = useRef(0);

  useEffect(() => {
    if (clearVerseSelectionRef) {
      clearVerseSelectionRef.current = clearVerseSelection;
    }
  }, [clearVerseSelection, clearVerseSelectionRef]);

  useEffect(() => {
    onSelectionActivityChange?.({
      selectedVerses,
      noteModalVisible,
      noteDraft,
      noteTargetVerse,
      saveNoteFromModal,
      setNoteModalVisible,
      setNoteDraft,
      setNoteTargetVerse,
    });
  }, [
    selectedVerses,
    noteModalVisible,
    noteDraft,
    noteTargetVerse,
    saveNoteFromModal,
    setNoteModalVisible,
    setNoteDraft,
    setNoteTargetVerse,
    onSelectionActivityChange,
  ]);

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
    [handleVerseTap, onboardingStepRef, completeOnboardingInteractionRef, selectedVerseNumbers],
  );

  const handleVerseLongPressForOnboarding = useCallback(
    (verseNum: number) => {
      handleVerseLongPress(verseNum);
      if (onboardingStepRef.current === "long-press-highlight") {
        completeOnboardingInteractionRef.current();
      }
    },
    [handleVerseLongPress, onboardingStepRef, completeOnboardingInteractionRef],
  );

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
  }, [clearVerseSelection, onboardingStepRef, completeOnboardingInteractionRef]);

  const openJournalFromSelection = useCallback(() => {
    if (selectedVerses.length === 0) return;
    hapticLightImpact();
    const first = selectedVerses[0]!;
    const last = selectedVerses[selectedVerses.length - 1]!;
    onOpenJournal({
      book: chapter.bookSlug,
      chapter: String(chapter.chapterNumber),
      verseStart: String(first),
      verseEnd: String(last),
      translation: resolvedTranslationId,
    });
    clearVerseSelection();
  }, [chapter, resolvedTranslationId, selectedVerses, clearVerseSelection, onOpenJournal]);

  const openStudyNotesFromSelection = useCallback(() => {
    if (selectedVerses.length === 0) return;
    hapticLightImpact();
    onOpenStudyNotes();
  }, [selectedVerses.length, onOpenStudyNotes]);

  useEffect(() => {
    if (featureOnboardingStep !== "clear-selection") {
      clearSelectionPrimedRef.current = false;
      return;
    }
    if (clearSelectionPrimedRef.current) return;
    if (selectedVerses.length > 0) {
      clearSelectionPrimedRef.current = true;
      return;
    }
    if (!chapter.verses.length) return;
    clearSelectionPrimedRef.current = true;
    toggleVerseSelection(1);
  }, [featureOnboardingStep, chapter.verses.length, selectedVerses.length, toggleVerseSelection]);

  const stableVisualData = useMemo(
    (): ReaderVerseStableVisualData => ({
      themeId,
      selectionBackground: rc.selectionBackground,
      selectionText: rc.selectionText,
      verseNumberColor: rc.verseNumberColor,
      noteBelowVerseBackground: rc.noteBelowVerseBackground,
      bodyTextColor: colors.brown800,
      readerVerseFontSize,
      readerVerseLineHeight,
      readerVerseBodyFontFamily,
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
      readerVerseBodyFontFamily,
      verseTextAlign,
    ],
  );

  const interactionData = useMemo(
    (): ReaderVerseInteractionData => ({
      selectedVerseNumbers,
      highlights,
      notes,
    }),
    [selectedVerseNumbers, highlights, notes],
  );

  const flashListExtraData = useMemo(
    () => ({ interactionData, stableVisualData }),
    [interactionData, stableVisualData],
  );

  const interactionDataRef = useRef(interactionData);
  interactionDataRef.current = interactionData;
  const stableVisualDataRef = useRef(stableVisualData);
  stableVisualDataRef.current = stableVisualData;

  const renderReaderVerseFlashItem = useCallback(
    ({ item, index }: ListRenderItemInfo<ReaderVerseFlashItem>) => {
      if (item.kind === "empty") {
        const twoColumnPaddingStyle =
          readerTabletLandscapeTwoColumn
            ? index % 2 === 0
              ? readerVerseListStyles.leftColumnPadding
              : readerVerseListStyles.rightColumnPadding
            : null;
        return <View style={[readerVerseListStyles.flashItemBase, twoColumnPaddingStyle]} />;
      }
      return (
        <MemoizedReaderVerseFlashRow
          item={item}
          index={index}
          interactionData={interactionDataRef.current}
          stableVisualData={stableVisualDataRef.current}
          readerTabletLandscapeTwoColumn={readerTabletLandscapeTwoColumn}
          readerVersesOpacityAnim={readerVersesOpacityAnim}
          onVersePress={handleVerseTapForOnboarding}
          onVerseLongPress={handleVerseLongPressForOnboarding}
        />
      );
    },
    [
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

  const hasVerseSelection = selectedVerses.length > 0;
  const readerOverlayOpen = readerOverlayOpenFromParent || noteModalVisible;

  const actionBarBottom = useMemo(() => {
    if (
      tabBarHideProgress != null &&
      actionBarBottomPxHidden != null &&
      Platform.OS === "android"
    ) {
      return tabBarHideProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [actionBarBottomPx, actionBarBottomPxHidden],
      });
    }
    return actionBarBottomPx;
  }, [actionBarBottomPx, actionBarBottomPxHidden, tabBarHideProgress]);

  const readerActionBarOnboarding = useReaderActionBarOnboarding({
    hasVerseSelection,
    actionBarMode,
    readerOverlayOpen,
    readerFeatureOnboardingActive,
    buttonRefs: actionBarButtonRefs,
    screenW,
    actionBarBottomPx,
  });

  const selectedVerseFeedbackLabel =
    selectedVerses.length === 0
      ? ""
      : selectedVerses.length === 1
        ? "1 verse selected"
        : `${selectedVerses.length} verses selected`;

  const copyToastTopPx = selectionBannerTopPx + (hasVerseSelection ? 22 : 36);

  return (
    <>
      <ReaderVerseList
        rc={rc}
        readerScrollRef={readerScrollRef}
        chapterSwipePanHandlers={chapterSwipePanHandlers}
        readerVerseEstimatedItemSize={readerVerseEstimatedItemSize}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        dismissReaderChromeFromBackgroundPress={dismissReaderChromeFromBackgroundPress}
        verseFlashListDataForList={verseFlashListDataForList}
        renderReaderVerseFlashItem={renderReaderVerseFlashItem}
        readerVerseFlashKeyExtractor={readerVerseFlashKeyExtractor}
        flashListExtraData={flashListExtraData}
        readerTabletLandscapeTwoColumn={readerTabletLandscapeTwoColumn}
        listHeader={listHeader}
        readerChapterFlashListFooter={readerChapterFlashListFooter}
        hasVerseSelection={hasVerseSelection}
        actionBarMode={actionBarMode}
        actionBarBottomPx={actionBarBottomPx}
        tabBarHideProgress={tabBarHideProgress}
        androidListPaddingBottomHidden={androidListPaddingBottomHidden}
        onListContentSizeChange={onListContentSizeChange}
        onListLayoutHeight={onListLayoutHeight}
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
        <ReaderSelectionActionBar
          actionBarMode={actionBarMode}
          actionBarBottom={actionBarBottom}
          colors={colors}
          rc={rc}
          highlights={highlights}
          selectedVerses={selectedVerses}
          pickedHighlightColor={pickedHighlightColor}
          setActionBarMode={setActionBarMode}
          setPickedHighlightColor={setPickedHighlightColor}
          removeHighlightsFromSelection={removeHighlightsFromSelection}
          applyPickedHighlightToSelection={applyPickedHighlightToSelection}
          openStudyNotesFromSelection={openStudyNotesFromSelection}
          copySelectedVerses={copySelectedVerses}
          openNoteForSelection={openNoteForSelection}
          openJournalFromSelection={openJournalFromSelection}
          actionBarButtonRefs={actionBarButtonRefs}
        />
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
            <View ref={selectionBannerRef} pointerEvents="auto" collapsable={false}>
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
    </>
  );
});
