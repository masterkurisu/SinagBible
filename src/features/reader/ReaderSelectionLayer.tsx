import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type Animated as AnimatedType,
  type LayoutRectangle,
} from "react-native";
import type { ListRenderItemInfo } from "@shopify/flash-list";
import type { VerseAnnotation } from "@sinag-bible/types";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import {
  ReaderCopyIcon,
  ReaderFavoriteIcon,
  ReaderHighlightIcon,
  ReaderJournalIcon,
  ReaderNoteIcon,
} from "@/components/reader-action-icons";
import { StudyNotesBookmarkIcon } from "@/components/icons/StudyNotesBookmarkIcon";
import type { JournalNewEntryInitialParams } from "@/components/journal-new-entry-form";
import { hapticLightImpact, hapticSelection } from "@/lib/haptics";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { useReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ReaderTranslationLoadingOverlay,
  type ReaderTranslationLoadingPhase,
} from "@/src/features/reader/ReaderTranslationLoadingOverlay";
import {
  buildCarouselVerseFromSelection,
  selectionMatchesCarouselRecord,
} from "@/lib/journal-carousel-verses";
import { useCarouselFavorites } from "@/lib/use-journal-carousel-verses";
import type { TranslationPickerItem } from "@/lib/use-translation-picker";
import { ReaderVerseRow } from "@/components/reader-verse-row";
import {
  ReaderVerseList,
  READER_TABLET_TWO_COLUMN_GAP,
} from "@/src/features/reader/ReaderVerseList";
import type { ReaderVerseFlashItem } from "@/src/features/reader/useReaderGestures";
import { useReaderSelection } from "@/src/features/reader/useReaderSelection";
import { ReaderAnnotationSheet } from "@/src/features/reader/ReaderAnnotationSheet";
import { ReaderVerseNoteDialog } from "@/src/features/reader/ReaderVerseNoteDialog";
import { ReaderActionBarOnboardingLayer } from "@/src/features/reader/ReaderActionBarOnboardingLayer";
import type { ReaderActionBarOnboardingStepId } from "@/src/features/reader/readerActionBarOnboardingSteps";
import {
  READER_ACTION_BAR_ICON_BOX_PX,
  READER_ACTION_BAR_ICON_SIZE_PX,
  getReaderActionBarTooltip,
} from "@/src/features/reader/readerActionBarOnboardingSteps";
import { useReaderActionBarOnboarding } from "@/src/features/reader/useReaderActionBarOnboarding";
import {
  ReaderActionBarIconButton,
  ReaderActionBarJournalButton,
} from "@/src/features/reader/ReaderActionBarButtons";
import {
  readerM3FloatingToolbarPillStyle,
} from "@/src/features/reader/readerActionBarChrome";
import { ReaderActionBarTooltipOverlay } from "@/src/features/reader/ReaderActionBarTooltipOverlay";
import {
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
} from "@/src/features/reader/readerSettingsPanelChrome";
import type { ReaderOnboardingStep } from "@/src/features/reader/useReaderFeatureOnboarding";
import type { ReaderVerseTextAlign } from "@/src/features/reader/useReaderPreferences";

const readerVerseListStyles = StyleSheet.create({
  flashItemBase: {
    alignSelf: "stretch",
    width: "100%",
  },
  leftColumnPadding: {
    paddingRight: READER_TABLET_TWO_COLUMN_GAP / 2,
  },
  rightColumnPadding: {
    paddingLeft: READER_TABLET_TWO_COLUMN_GAP / 2,
  },
});

const ACTION_BAR_ICON_SCALE = {
  studyNotes: 1.01,
  highlight: 1.19,
  copy: 1.31,
  note: 1.08,
  favorite: 1.05,
  journal: 1.08,
} as const;

function readerActionBarIconColor(
  rc: ReaderThemeBundle,
  platformMuted: string,
): string {
  return Platform.OS === "android" ? platformMuted : rc.actionIconMuted;
}

export type ReaderSelectionActivity = {
  selectedVerses: number[];
  noteModalVisible: boolean;
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
  actionBarBottom: number | AnimatedType.AnimatedInterpolation<number>;
  colors: ReaderThemeColors;
  rc: ReaderThemeBundle;
  openAnnotationSheet: () => void;
  openStudyNotesFromSelection: () => void;
  copySelectedVerses: () => void;
  openNoteForSelection: () => void;
  toggleFavoriteFromSelection: () => void;
  selectionIsFavorited: boolean;
  openJournalFromSelection: () => void;
  actionBarButtonRefs: Record<ReaderActionBarOnboardingStepId, RefObject<View | null>>;
};

const ACTION_BAR_TOOLTIP_BACKGROUND = "#FFFFFF";

type ActionBarTooltipState = {
  anchor: LayoutRectangle;
  title: string;
  description: string;
};

const ReaderSelectionActionBar = memo(function ReaderSelectionActionBar({
  actionBarBottom,
  colors,
  rc,
  openAnnotationSheet,
  openStudyNotesFromSelection,
  copySelectedVerses,
  openNoteForSelection,
  toggleFavoriteFromSelection,
  selectionIsFavorited,
  openJournalFromSelection,
  actionBarButtonRefs,
}: ReaderSelectionActionBarProps) {
  const { bundle } = useMobileAppTheme();
  const sheetChrome = useReaderSheetChrome();
  const journalChrome = bundle.journal;
  const iconMuted = readerActionBarIconColor(rc, sheetChrome.onSurfaceVariant);
  const actionBarPillRef = useRef<View | null>(null);
  const [tooltip, setTooltip] = useState<ActionBarTooltipState | null>(null);
  const showTooltip = useCallback((next: ActionBarTooltipState) => {
    setTooltip(next);
  }, []);
  const dismissTooltip = useCallback(() => {
    setTooltip(null);
  }, []);
  const tooltipVisible = tooltip != null;
  const studyNotesTooltip = getReaderActionBarTooltip("study-notes");
  const highlightTooltip = getReaderActionBarTooltip("highlight");
  const copyTooltip = getReaderActionBarTooltip("copy");
  const noteTooltip = getReaderActionBarTooltip("note");
  const favoriteTooltip = getReaderActionBarTooltip("favorite");
  const journalTooltip = getReaderActionBarTooltip("journal");
  const toolbarPillStyle = useMemo(
    () =>
      readerM3FloatingToolbarPillStyle(
        sheetChrome.surfaceContainerHigh,
        colors.parchmentMid,
      ),
    [colors.parchmentMid, sheetChrome.surfaceContainerHigh],
  );

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
          paddingHorizontal: 16,
        }}
      >
        <View ref={actionBarPillRef} collapsable={false} style={toolbarPillStyle}>
          <ReaderActionBarIconButton
            onPress={openStudyNotesFromSelection}
            accessibilityLabel="Open study notes for selection"
            buttonRef={actionBarButtonRefs["study-notes"]}
            tooltipTitle={studyNotesTooltip?.title}
            tooltipDescription={studyNotesTooltip?.description}
            onShowTooltip={studyNotesTooltip ? showTooltip : undefined}
          >
            <View
              style={{
                width: READER_ACTION_BAR_ICON_BOX_PX,
                height: READER_ACTION_BAR_ICON_BOX_PX,
                alignItems: "center",
                justifyContent: "center",
                transform: [{ scale: ACTION_BAR_ICON_SCALE.studyNotes }],
              }}
            >
              <StudyNotesBookmarkIcon color={iconMuted} size={READER_ACTION_BAR_ICON_SIZE_PX} />
            </View>
          </ReaderActionBarIconButton>
          <ReaderActionBarIconButton
            onPress={openAnnotationSheet}
            accessibilityLabel="Highlight or underline"
            buttonRef={actionBarButtonRefs.highlight}
            tooltipTitle={highlightTooltip?.title}
            tooltipDescription={highlightTooltip?.description}
            onShowTooltip={highlightTooltip ? showTooltip : undefined}
          >
            <View
              style={{
                width: READER_ACTION_BAR_ICON_BOX_PX,
                height: READER_ACTION_BAR_ICON_BOX_PX,
                alignItems: "center",
                justifyContent: "center",
                transform: [{ scale: ACTION_BAR_ICON_SCALE.highlight }],
              }}
            >
              <ReaderHighlightIcon color={iconMuted} size={READER_ACTION_BAR_ICON_SIZE_PX} />
            </View>
          </ReaderActionBarIconButton>
          <ReaderActionBarIconButton
            onPress={() => {
              void copySelectedVerses();
            }}
            accessibilityLabel="Copy"
            buttonRef={actionBarButtonRefs.copy}
            tooltipTitle={copyTooltip?.title}
            tooltipDescription={copyTooltip?.description}
            onShowTooltip={copyTooltip ? showTooltip : undefined}
          >
            <View
              style={{
                width: READER_ACTION_BAR_ICON_BOX_PX,
                height: READER_ACTION_BAR_ICON_BOX_PX,
                alignItems: "center",
                justifyContent: "center",
                transform: [{ scale: ACTION_BAR_ICON_SCALE.copy }],
              }}
            >
              <ReaderCopyIcon color={iconMuted} size={READER_ACTION_BAR_ICON_SIZE_PX} />
            </View>
          </ReaderActionBarIconButton>
          <ReaderActionBarIconButton
            onPress={openNoteForSelection}
            accessibilityLabel="Note"
            buttonRef={actionBarButtonRefs.note}
            tooltipTitle={noteTooltip?.title}
            tooltipDescription={noteTooltip?.description}
            onShowTooltip={noteTooltip ? showTooltip : undefined}
          >
            <View
              style={{
                width: READER_ACTION_BAR_ICON_BOX_PX,
                height: READER_ACTION_BAR_ICON_BOX_PX,
                alignItems: "center",
                justifyContent: "center",
                transform: [{ scale: ACTION_BAR_ICON_SCALE.note }],
              }}
            >
              <ReaderNoteIcon color={iconMuted} size={READER_ACTION_BAR_ICON_SIZE_PX} />
            </View>
          </ReaderActionBarIconButton>
          <ReaderActionBarIconButton
            onPress={toggleFavoriteFromSelection}
            accessibilityLabel={
              selectionIsFavorited
                ? "Remove from journal carousel"
                : "Add to journal carousel"
            }
            buttonRef={actionBarButtonRefs.favorite}
            tooltipTitle={favoriteTooltip?.title}
            tooltipDescription={favoriteTooltip?.description}
            onShowTooltip={favoriteTooltip ? showTooltip : undefined}
          >
            <View
              style={{
                width: READER_ACTION_BAR_ICON_BOX_PX,
                height: READER_ACTION_BAR_ICON_BOX_PX,
                alignItems: "center",
                justifyContent: "center",
                transform: [{ scale: ACTION_BAR_ICON_SCALE.favorite }],
              }}
            >
              <ReaderFavoriteIcon
                color={selectionIsFavorited ? "#c45c5c" : iconMuted}
                filled={selectionIsFavorited}
                size={READER_ACTION_BAR_ICON_SIZE_PX}
              />
            </View>
          </ReaderActionBarIconButton>
          <ReaderActionBarJournalButton
            onPress={openJournalFromSelection}
            accessibilityLabel="New journal entry from selection"
            containerColor={
              Platform.OS === "android" ? journalChrome.fabContainer : colors.brown800
            }
            rippleColor={journalChrome.fabRipple}
            buttonRef={actionBarButtonRefs.journal}
            tooltipTitle={journalTooltip?.title}
            tooltipDescription={journalTooltip?.description}
            onShowTooltip={journalTooltip ? showTooltip : undefined}
          >
            <View
              style={{
                width: READER_ACTION_BAR_ICON_BOX_PX,
                height: READER_ACTION_BAR_ICON_BOX_PX,
                alignItems: "center",
                justifyContent: "center",
                transform: [{ scale: ACTION_BAR_ICON_SCALE.journal }],
              }}
            >
              <ReaderJournalIcon
                color={
                  Platform.OS === "android" ? journalChrome.fabOnContainer : rc.selectionText
                }
                size={READER_ACTION_BAR_ICON_SIZE_PX}
              />
            </View>
          </ReaderActionBarJournalButton>
        </View>
      </Animated.View>
      {tooltip ? (
        <ReaderActionBarTooltipOverlay
          visible={tooltipVisible}
          buttonAnchor={tooltip.anchor}
          actionBarPillRef={actionBarPillRef}
          title={tooltip.title}
          description={tooltip.description}
          onDismiss={dismissTooltip}
          backgroundColor={ACTION_BAR_TOOLTIP_BACKGROUND}
          titleColor={READER_M3_ON_SURFACE}
          descriptionColor={READER_M3_ON_SURFACE_VARIANT}
        />
      ) : null}
    </View>
  );
});

type ReaderVerseInteractionData = {
  selectedVerseNumbers: Set<number>;
  annotations: Record<number, VerseAnnotation | undefined>;
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
  translationId: string;
  bundle: MobileAppThemeBundle;
  verseTagChipBackground: string;
  verseTagChipBorder: string;
  yvpFootnotes?: Record<number, { label: string; body: string }>;
  onYvpFootnotePress?: (noteId: number) => void;
};

type ReaderVerseFlashRowProps = {
  item: Extract<ReaderVerseFlashItem, { kind: "verse" }>;
  index: number;
  interactionData: ReaderVerseInteractionData;
  stableVisualData: ReaderVerseStableVisualData;
  readerTabletLandscapeTwoColumn: boolean;
  onVersePress: (verseNum: number) => void;
  onVerseLongPress: (verseNum: number) => void;
  onNoteLongPress: (verseNum: number) => void;
};

const MemoizedReaderVerseFlashRow = memo(
  ({
    item,
    index,
    interactionData,
    stableVisualData: vd,
    readerTabletLandscapeTwoColumn,
    onVersePress,
    onVerseLongPress,
    onNoteLongPress,
  }: ReaderVerseFlashRowProps) => {
    const verseNum = item.verseIndex + 1;
    const twoColumnPaddingStyle =
      readerTabletLandscapeTwoColumn
        ? index % 2 === 0
          ? readerVerseListStyles.leftColumnPadding
          : readerVerseListStyles.rightColumnPadding
        : null;
    return (
      <View style={[readerVerseListStyles.flashItemBase, twoColumnPaddingStyle]}>
        <ReaderVerseRow
          verseNum={verseNum}
          verseText={item.verseText}
          verseInlineContent={item.verseInlineContent}
          isSelected={interactionData.selectedVerseNumbers.has(verseNum)}
          annotation={interactionData.annotations[verseNum]}
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
          onNoteLongPress={onNoteLongPress}
          translationId={vd.translationId}
          bundle={vd.bundle}
          verseTagChipBackground={vd.verseTagChipBackground}
          verseTagChipBorder={vd.verseTagChipBorder}
          yvpFootnotes={vd.yvpFootnotes}
          onYvpFootnotePress={vd.onYvpFootnotePress}
        />
      </View>
    );
  },
  (prevProps, nextProps) => {
    if (prevProps.item.verseIndex !== nextProps.item.verseIndex) return false;
    if (prevProps.item.verseText !== nextProps.item.verseText) return false;
    if (prevProps.item.verseInlineContent !== nextProps.item.verseInlineContent) return false;
    if (prevProps.index !== nextProps.index) return false;
    if (prevProps.readerTabletLandscapeTwoColumn !== nextProps.readerTabletLandscapeTwoColumn) return false;
    if (prevProps.onVersePress !== nextProps.onVersePress) return false;
    if (prevProps.onVerseLongPress !== nextProps.onVerseLongPress) return false;
    if (prevProps.onNoteLongPress !== nextProps.onNoteLongPress) return false;
    if (prevProps.stableVisualData !== nextProps.stableVisualData) return false;

    const verseNum = prevProps.item.verseIndex + 1;
    const prevSelected = prevProps.interactionData.selectedVerseNumbers.has(verseNum);
    const nextSelected = nextProps.interactionData.selectedVerseNumbers.has(verseNum);
    if (prevSelected !== nextSelected) return false;
    if (prevProps.interactionData.annotations[verseNum] !== nextProps.interactionData.annotations[verseNum]) {
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
  annotations: Record<number, VerseAnnotation | undefined>;
  notes: Record<number, string | undefined>;
  removeAnnotationsFromVerses: (verses: number[]) => void;
  applyAnnotationToVerses: (verses: number[], annotation: VerseAnnotation) => void;
  persistNoteForVerse: (verse: number, text: string) => void;
  bookSlug: string | undefined;
  chapterNumber: number;
  requestedTranslationId: string;
  translationPickerItems?: readonly TranslationPickerItem[];
  toolsMenuOpen: boolean;
  closeToolsMenu: () => void;
  isTabletReaderLayout?: boolean;
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
  /** Book:chapter:translation — scopes FlashList keys so row heights are not recycled across chapters. */
  readerListContentKey: string;
  onScroll: import("react").ComponentProps<typeof ReaderVerseList>["onScroll"];
  onScrollBeginDrag: () => void;
  onScrollEndDrag?: (event: import("react-native").NativeSyntheticEvent<import("react-native").NativeScrollEvent>) => void;
  onMomentumScrollEnd?: () => void;
  dismissReaderChromeFromBackgroundPress: () => void;
  verseFlashListDataForList: ReaderVerseFlashItem[];
  readerTabletLandscapeTwoColumn: boolean;
  readerVersesOpacityAnim: AnimatedType.Value;
  listHeader: ReactNode;
  readerChapterFlashListFooter: () => React.ReactElement | null;
  actionBarBottomPx: number;
  actionBarBottomPxHidden?: number;
  tabBarScrollHidden?: boolean;
  onListContentSizeChange?: (width: number, height: number) => void;
  onListLayoutHeight?: (height: number) => void;
  selectionBannerTopPx: number;
  screenW: number;
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
  translationLoadingPhase?: ReaderTranslationLoadingPhase;
  translationLoadingLabel?: string;
  translationLoadingDoneLabel?: string;
  /** When false, loading phase shows spinner only (used for backup import reload). */
  translationLoadingShowLabel?: boolean;
  translationLoadingAccentColor?: string;
  yvpFootnotes?: Record<number, { label: string; body: string }>;
  onYvpFootnotePress?: (noteId: number) => void;
};

export const ReaderSelectionLayer = memo(function ReaderSelectionLayer({
  chapter,
  resolvedTranslationId,
  annotations,
  notes,
  removeAnnotationsFromVerses,
  applyAnnotationToVerses,
  persistNoteForVerse,
  bookSlug,
  chapterNumber,
  requestedTranslationId,
  translationPickerItems,
  toolsMenuOpen,
  closeToolsMenu,
  isTabletReaderLayout = false,
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
  readerListContentKey,
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
  tabBarScrollHidden,
  onListContentSizeChange,
  onListLayoutHeight,
  selectionBannerTopPx,
  screenW,
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
  translationLoadingPhase = "idle",
  translationLoadingLabel,
  translationLoadingDoneLabel,
  translationLoadingShowLabel = true,
  translationLoadingAccentColor,
  yvpFootnotes,
  onYvpFootnotePress,
}: ReaderSelectionLayerProps) {
  const actionBarOnboardingStudyNotesRef = useRef<View | null>(null);
  const actionBarOnboardingHighlightRef = useRef<View | null>(null);
  const actionBarOnboardingCopyRef = useRef<View | null>(null);
  const actionBarOnboardingNoteRef = useRef<View | null>(null);
  const actionBarOnboardingFavoriteRef = useRef<View | null>(null);
  const actionBarOnboardingJournalRef = useRef<View | null>(null);

  const actionBarButtonRefs = useMemo(
    (): Record<ReaderActionBarOnboardingStepId, RefObject<View | null>> => ({
      "study-notes": actionBarOnboardingStudyNotesRef,
      highlight: actionBarOnboardingHighlightRef,
      copy: actionBarOnboardingCopyRef,
      note: actionBarOnboardingNoteRef,
      favorite: actionBarOnboardingFavoriteRef,
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
    annotationSheetOpen,
    openAnnotationSheet,
    closeAnnotationSheet,
    annotationSheetInitial,
    selectionHasExistingAnnotation,
    copyToastVisible,
    clearVerseSelection,
    dismissVerseSelectionMode,
    toggleVerseSelection,
    handleVerseTap,
    handleVerseLongPress,
    selectedVerses,
    copySelectedVerses,
    removeAnnotationsFromSelection,
    applyAnnotationToSelection,
    openNoteForSelection,
    openNoteForVerse,
    saveNoteFromModal,
  } = useReaderSelection({
    chapter,
    resolvedTranslationId,
    annotations,
    notes,
    removeAnnotationsFromVerses,
    applyAnnotationToVerses,
    persistNoteForVerse,
    bookSlug,
    chapterNumber,
    requestedTranslationId,
    translationPickerItems,
    toolsMenuOpen,
    closeToolsMenu,
  });

  const { bundle } = useMobileAppTheme();
  const insets = useSafeAreaInsets();

  const { favorites, toggleFavorite } = useCarouselFavorites();
  const [favoriteToastVisible, setFavoriteToastVisible] = useState(false);
  const [favoriteToastAdded, setFavoriteToastAdded] = useState(true);

  useEffect(() => {
    if (!favoriteToastVisible) return;
    const t = setTimeout(() => setFavoriteToastVisible(false), 2200);
    return () => clearTimeout(t);
  }, [favoriteToastVisible]);

  const selectionIsFavorited = useMemo(
    () =>
      bookSlug
        ? selectionMatchesCarouselRecord(favorites, bookSlug, chapterNumber, selectedVerses) != null
        : false,
    [bookSlug, chapterNumber, favorites, selectedVerses],
  );

  const toggleFavoriteFromSelection = useCallback(() => {
    if (selectedVerses.length === 0 || !chapter || !resolvedTranslationId || !bookSlug) return;
    const record = buildCarouselVerseFromSelection({
      bookSlug,
      bookName: chapter.bookName,
      chapter: chapter.chapterNumber,
      verses: chapter.verses,
      selectedVerses,
      translationId: resolvedTranslationId,
    });
    if (!record) return;
    hapticLightImpact();
    void toggleFavorite(record).then((added) => {
      setFavoriteToastAdded(added);
      setFavoriteToastVisible(true);
      clearVerseSelection();
    });
  }, [
    bookSlug,
    chapter,
    clearVerseSelection,
    resolvedTranslationId,
    selectedVerses,
    toggleFavorite,
  ]);

  const clearSelectionPrimedRef = useRef(false);
  const selectionToastHapticGuardRef = useRef(0);

  useEffect(() => {
    if (clearVerseSelectionRef) {
      clearVerseSelectionRef.current = dismissVerseSelectionMode;
    }
  }, [dismissVerseSelectionMode, clearVerseSelectionRef]);

  useEffect(() => {
    onSelectionActivityChange?.({
      selectedVerses,
      noteModalVisible,
    });
  }, [selectedVerses, noteModalVisible, onSelectionActivityChange]);

  const closeNoteModal = useCallback(() => {
    setNoteModalVisible(false);
    setNoteTargetVerse(null);
    setNoteDraft("");
  }, [setNoteModalVisible, setNoteTargetVerse, setNoteDraft]);

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

  const handleNoteLongPress = useCallback(
    (verseNum: number) => {
      hapticLightImpact();
      openNoteForVerse(verseNum);
    },
    [openNoteForVerse],
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
      translationId: resolvedTranslationId,
      bundle,
      verseTagChipBackground: colors.parchmentMid,
      verseTagChipBorder: colors.tan300,
      yvpFootnotes,
      onYvpFootnotePress,
    }),
    [
      themeId,
      rc.selectionBackground,
      rc.selectionText,
      rc.verseNumberColor,
      rc.noteBelowVerseBackground,
      colors.brown800,
      colors.parchmentMid,
      colors.tan300,
      readerVerseFontSize,
      readerVerseLineHeight,
      readerVerseBodyFontFamily,
      verseTextAlign,
      resolvedTranslationId,
      bundle,
      yvpFootnotes,
      onYvpFootnotePress,
    ],
  );

  const interactionData = useMemo(
    (): ReaderVerseInteractionData => ({
      selectedVerseNumbers,
      annotations,
      notes,
    }),
    [selectedVerseNumbers, annotations, notes],
  );

  const flashListExtraData = useMemo(
    () => ({ interactionData, stableVisualData }),
    [interactionData, stableVisualData],
  );

  const renderReaderVerseFlashItem = useCallback(
    ({ item, index, extraData: flashExtraData }: ListRenderItemInfo<ReaderVerseFlashItem>) => {
      const flashExtra = flashExtraData as {
        interactionData: ReaderVerseInteractionData;
        stableVisualData: ReaderVerseStableVisualData;
      };
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
          interactionData={flashExtra.interactionData}
          stableVisualData={flashExtra.stableVisualData}
          readerTabletLandscapeTwoColumn={readerTabletLandscapeTwoColumn}
          onVersePress={handleVerseTapForOnboarding}
          onVerseLongPress={handleVerseLongPressForOnboarding}
          onNoteLongPress={handleNoteLongPress}
        />
      );
    },
    [
      handleVerseTapForOnboarding,
      handleVerseLongPressForOnboarding,
      handleNoteLongPress,
      readerTabletLandscapeTwoColumn,
    ],
  );

  const readerVerseFlashKeyExtractor = useCallback(
    (item: ReaderVerseFlashItem) => {
      if (item.kind === "verse") return `${readerListContentKey}:v-${item.verseIndex}`;
      return `${readerListContentKey}:e-${item.side}-${item.row}`;
    },
    [readerListContentKey],
  );

  const hasVerseSelection = selectedVerses.length > 0;
  const readerOverlayOpen =
    readerOverlayOpenFromParent || noteModalVisible || annotationSheetOpen;

  const actionBarBottom = useMemo(() => {
    if (
      tabBarScrollHidden != null &&
      actionBarBottomPxHidden != null &&
      Platform.OS === "android"
    ) {
      return tabBarScrollHidden ? actionBarBottomPxHidden : actionBarBottomPx;
    }
    return actionBarBottomPx;
  }, [actionBarBottomPx, actionBarBottomPxHidden, tabBarScrollHidden]);

  const readerActionBarOnboarding = useReaderActionBarOnboarding({
    hasVerseSelection,
    annotationSheetOpen,
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
      <View style={{ flex: 1 }}>
        <ReaderVerseList
          rc={rc}
          readerScrollRef={readerScrollRef}
          chapterSwipePanHandlers={chapterSwipePanHandlers}
          readerVerseEstimatedItemSize={readerVerseEstimatedItemSize}
          readerListContentKey={readerListContentKey}
          readerVerseFontSize={readerVerseFontSize}
          readerVerseLineHeight={readerVerseLineHeight}
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
          actionBarBottomPx={actionBarBottomPx}
          readerVersesOpacityAnim={readerVersesOpacityAnim}
          onListContentSizeChange={onListContentSizeChange}
          onListLayoutHeight={onListLayoutHeight}
        />
        <ReaderTranslationLoadingOverlay
          phase={translationLoadingPhase}
          accentColor={translationLoadingAccentColor ?? "#6750A4"}
          surfaceColor={rc.sceneSurface}
          loadingLabel={translationLoadingLabel}
          doneLabel={translationLoadingDoneLabel}
          showLoadingLabel={translationLoadingShowLabel}
        />
      </View>

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

      {favoriteToastVisible ? (
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
                {favoriteToastAdded ? "Added to Favorites" : "Removed from Favorites"}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {hasVerseSelection ? (
        <ReaderSelectionActionBar
          actionBarBottom={actionBarBottom}
          colors={colors}
          rc={rc}
          openAnnotationSheet={openAnnotationSheet}
          openStudyNotesFromSelection={openStudyNotesFromSelection}
          copySelectedVerses={copySelectedVerses}
          openNoteForSelection={openNoteForSelection}
          toggleFavoriteFromSelection={toggleFavoriteFromSelection}
          selectionIsFavorited={selectionIsFavorited}
          openJournalFromSelection={openJournalFromSelection}
          actionBarButtonRefs={actionBarButtonRefs}
        />
      ) : null}

      <ReaderAnnotationSheet
        isOpen={annotationSheetOpen}
        onClose={closeAnnotationSheet}
        bundle={bundle}
        insets={insets}
        isTabletReaderLayout={isTabletReaderLayout}
        selectedVerses={selectedVerses}
        selectionSubtitle={
          selectedVerses.length === 1
            ? `${chapter.bookName} ${chapter.chapterNumber}:${selectedVerses[0]}`
            : `${selectedVerses.length} verses selected`
        }
        initialAnnotation={annotationSheetInitial}
        existingAnnotation={selectionHasExistingAnnotation ? annotationSheetInitial : undefined}
        onApply={applyAnnotationToSelection}
        onRemove={removeAnnotationsFromSelection}
      />

      <ReaderVerseNoteDialog
        isOpen={noteModalVisible}
        onClose={closeNoteModal}
        onSave={saveNoteFromModal}
        noteDraft={noteDraft}
        onChangeNoteDraft={setNoteDraft}
        verseReference={
          noteTargetVerse != null
            ? `${chapter.bookName} ${chapter.chapterNumber}:${noteTargetVerse}`
            : undefined
        }
        contextTranslationId={resolvedTranslationId}
        bundle={bundle}
        insets={insets}
        isTabletReaderLayout={isTabletReaderLayout}
      />

      {hasVerseSelection ? (
        <View
          pointerEvents="box-none"
          style={[
            StyleSheet.absoluteFill,
            {
              zIndex: 4000,
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
        </View>
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
