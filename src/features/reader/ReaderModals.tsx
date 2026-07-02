import React, { useCallback, useEffect, useRef, type ComponentType, type ReactNode, type RefObject } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  type LayoutRectangle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  FlatList as GHFlatList,
  NativeViewGestureHandler,
  ScrollView as GHScrollView,
  TouchableOpacity as GestureHandlerTouchableOpacity,
} from "react-native-gesture-handler";
import { FullWindowOverlay } from "react-native-screens";
import type { BibleBookNavItem, BibleChapter } from "@sinag-bible/types";
import { BookIcon } from "@/components/icons/BookIcon";
import { StudyNotesResearchIcon } from "@/components/icons/StudyNotesResearchIcon";
import { ReaderFontSettingsIcon } from "@/components/icons/ReaderFontSettingsIcon";
import { ReaderThemesPaletteIcon } from "@/components/icons/ReaderThemesPaletteIcon";
import { DeleteMyDataIcon } from "@/components/icons/DeleteMyDataIcon";
import { SettingsMoreIcon } from "@/components/icons/SettingsMoreIcon";
import { ReaderSettingsSideSheet } from "@/src/features/reader/ReaderSettingsSideSheet";
import { ReaderThemePickerSheet } from "@/src/features/reader/ReaderThemePickerSheet";
import { ReaderStudyNotesSheet } from "@/src/features/reader/ReaderStudyNotesSheet";
import { ReaderVerseNoteDialog } from "@/src/features/reader/ReaderVerseNoteDialog";
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
import { readerSettingsDeleteMyDataPanelBottomPx } from "@/lib/native-tab-chrome";
import { hapticLightImpact, hapticSoftPop } from "@/lib/haptics";
import { BookPickerSheet } from "@/src/features/reader/BookPickerSheet";
export type { BookSelectorViewMode, SelectorTestamentTab } from "@/src/features/reader/BookPickerSheet";
export { ReaderBookSheetWindowOverlay } from "@/src/features/reader/BookPickerSheet";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";

export type ReaderToolsDropdown = "book" | "translation" | "theme";

export { READER_MOBILE_SETTINGS_PANEL_BG } from "@/src/features/reader/readerSettingsPanelChrome";

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

<ReaderStudyNotesSheet
  isOpen={commentaryPanelOpen}
  onClose={closeCommentaryPanel}
  bundle={bundle}
  insets={insets}
  isTabletReaderLayout={isTabletReaderLayout}
  chapter={chapter}
  selectedVerses={selectedVerses}
  settingsMutedTextColor={settingsMutedTextColor}
/>

<ReaderVerseNoteDialog
  isOpen={noteModalVisible}
  onClose={() => {
    setNoteModalVisible(false);
    setNoteTargetVerse(null);
    setNoteDraft("");
  }}
  onSave={saveNoteFromModal}
  noteDraft={noteDraft}
  onChangeNoteDraft={setNoteDraft}
  verseReference={
    noteTargetVerse != null ? `${chapter.bookName} ${chapter.chapterNumber}:${noteTargetVerse}` : undefined
  }
  bundle={bundle}
  insets={insets}
  isTabletReaderLayout={isTabletReaderLayout}
/>

    </>
  );
}
