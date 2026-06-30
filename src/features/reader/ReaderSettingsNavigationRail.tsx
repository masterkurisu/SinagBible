import type { ComponentType, ReactNode, RefObject } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type View as RNView,
} from "react-native";
import { BookIcon } from "@/components/icons/BookIcon";
import { DeleteMyDataIcon } from "@/components/icons/DeleteMyDataIcon";
import { ReaderFontSettingsIcon } from "@/components/icons/ReaderFontSettingsIcon";
import { ReaderThemesPaletteIcon } from "@/components/icons/ReaderThemesPaletteIcon";
import { SettingsMoreIcon } from "@/components/icons/SettingsMoreIcon";
import { StudyNotesResearchIcon } from "@/components/icons/StudyNotesResearchIcon";
import { readerSettingsDeleteMyDataPanelBottomPx } from "@/lib/native-tab-chrome";
import { ReaderM3RailDestination } from "@/src/features/reader/ReaderM3RailDestination";
import type { ReaderSettingsOnboardingStepId } from "@/src/features/reader/readerSettingsOnboardingSteps";
import { READER_SETTINGS_NAV_RAIL_ITEM_HEIGHT_PX } from "@/src/features/reader/readerSettingsPanelChrome";

const HEADER_TOOLS_ROW_HEIGHT = 44;

type ReaderSettingsMenuIconProps = { size?: number; color?: string };

type RailDestination = {
  id: ReaderSettingsOnboardingStepId | "more";
  label: string;
  onPress: () => void;
  Icon: ComponentType<ReaderSettingsMenuIconProps>;
  iconSize?: number;
  destructive?: boolean;
};

export type ReaderSettingsNavigationRailProps = {
  insets: { top: number; bottom: number; left: number; right: number };
  scrollPaddingTop: number;
  /** Expanded rail width — matches reader slide distance; flush to the screen edge. */
  railWidthPx: number;
  toolsMenuOpen: boolean;
  headerTools?: ReactNode | null;
  hideFontSettings?: boolean;
  hideTranslationAndStudyNotes?: boolean;
  onSelectFontSettings?: () => void;
  onSelectThemes: () => void;
  onSelectMore: () => void;
  onSelectTranslation: () => void;
  onSelectCommentary: () => void;
  onSelectDeleteMyData: () => void;
  /** Theme page background revealed behind the sliding content. */
  panelBackgroundColor: string;
  /** Theme-aware M3 ripple for rail destinations. */
  rippleColor?: string;
  settingsOnboardingRowRefs?: Partial<
    Record<ReaderSettingsOnboardingStepId | "more", RefObject<RNView | null>>
  >;
  onSettingsPanelLayout?: () => void;
};

/** M3 expanded navigation rail — phone layout; left edge; revealed when the reader slides aside. */
export function ReaderSettingsNavigationRail({
  insets,
  scrollPaddingTop,
  railWidthPx,
  toolsMenuOpen,
  headerTools = null,
  hideFontSettings = false,
  hideTranslationAndStudyNotes = false,
  onSelectFontSettings,
  onSelectThemes,
  onSelectMore,
  onSelectTranslation,
  onSelectCommentary,
  onSelectDeleteMyData,
  panelBackgroundColor,
  rippleColor,
  settingsOnboardingRowRefs,
  onSettingsPanelLayout,
}: ReaderSettingsNavigationRailProps) {
  const deleteMyDataBottomPx = readerSettingsDeleteMyDataPanelBottomPx();
  const contentPaddingLeft = insets.left;

  const destinations: RailDestination[] = [
    ...(hideTranslationAndStudyNotes
      ? []
      : [
          {
            id: "translation" as const,
            label: "Translation",
            onPress: onSelectTranslation,
            Icon: BookIcon,
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
          },
        ]),
    {
      id: "themes",
      label: "Themes",
      onPress: onSelectThemes,
      Icon: ReaderThemesPaletteIcon,
    },
    {
      id: "more",
      label: "More",
      onPress: onSelectMore,
      Icon: SettingsMoreIcon,
    },
  ];

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.panelRoot]}
      pointerEvents="box-none"
      onLayout={onSettingsPanelLayout}
    >
      <View
        style={[
          styles.railColumn,
          {
            width: railWidthPx,
            backgroundColor: toolsMenuOpen ? panelBackgroundColor : "transparent",
            borderTopRightRadius: toolsMenuOpen ? 28 : 0,
          },
        ]}
      >
        <View
          style={[
            styles.headerToolsRow,
            {
              paddingTop: headerTools != null ? scrollPaddingTop : 0,
              minHeight: headerTools != null ? HEADER_TOOLS_ROW_HEIGHT : 0,
              paddingLeft: contentPaddingLeft,
            },
          ]}
        >
          {headerTools}
        </View>
        {toolsMenuOpen ? (
          <>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces
              style={styles.destinationsScroll}
              contentContainerStyle={[
                styles.railScrollContent,
                {
                  paddingTop: headerTools == null ? scrollPaddingTop : 0,
                  paddingBottom:
                    deleteMyDataBottomPx + READER_SETTINGS_NAV_RAIL_ITEM_HEIGHT_PX + 8,
                },
              ]}
            >
              {destinations.map((destination) => (
                <ReaderM3RailDestination
                  key={destination.id}
                  label={destination.label}
                  onPress={destination.onPress}
                  Icon={destination.Icon}
                  iconSize={destination.iconSize}
                  destructive={destination.destructive}
                  rippleColor={rippleColor}
                  rowRef={settingsOnboardingRowRefs?.[destination.id]}
                  contentPaddingLeft={contentPaddingLeft}
                />
              ))}
            </ScrollView>
            <View style={[styles.deleteWrap, { bottom: deleteMyDataBottomPx }]}>
              <ReaderM3RailDestination
                label="Delete My Data"
                onPress={onSelectDeleteMyData}
                Icon={DeleteMyDataIcon}
                destructive
                rippleColor={rippleColor}
                rowRef={settingsOnboardingRowRefs?.["delete-my-data"]}
                contentPaddingLeft={contentPaddingLeft}
              />
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panelRoot: {
    zIndex: 100,
  },
  railColumn: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 100,
  },
  headerToolsRow: {
    justifyContent: "center",
  },
  destinationsScroll: {
    flex: 1,
  },
  railScrollContent: {
    gap: 4,
  },
  deleteWrap: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
