import type { ComponentType, ReactNode, RefObject } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type View as RNView,
} from "react-native";
import { BookIcon } from "@/components/icons/BookIcon";
import { DeleteMyDataIcon } from "@/components/icons/DeleteMyDataIcon";
import { ReaderFontSettingsIcon } from "@/components/icons/ReaderFontSettingsIcon";
import { ReaderThemesPaletteIcon } from "@/components/icons/ReaderThemesPaletteIcon";
import { SettingsMoreIcon } from "@/components/icons/SettingsMoreIcon";
import { StudyNotesResearchIcon } from "@/components/icons/StudyNotesResearchIcon";
import { hapticLightImpact } from "@/lib/haptics";
import { readerSettingsDeleteMyDataPanelBottomPx } from "@/lib/native-tab-chrome";
import type { ReaderSettingsOnboardingStepId } from "@/src/features/reader/readerSettingsOnboardingSteps";
import {
  READER_M3_ERROR,
  READER_M3_ERROR_CONTAINER,
  READER_M3_ON_ERROR_CONTAINER,
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
  READER_M3_SURFACE_CONTAINER,
  READER_MOBILE_SETTINGS_PANEL_BG,
  READER_SETTINGS_NAV_RAIL_ITEM_HEIGHT_PX,
} from "@/src/features/reader/readerSettingsPanelChrome";

const RAIL_ICON_SIZE = 24;
const RAIL_LABEL_SIZE = 14;
const RAIL_LABEL_LINE_HEIGHT = 20;
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
  onSelectFontSettings?: () => void;
  onSelectThemes: () => void;
  onSelectMore: () => void;
  onSelectTranslation: () => void;
  onSelectCommentary: () => void;
  onSelectDeleteMyData: () => void;
  settingsOnboardingRowRefs?: Partial<
    Record<ReaderSettingsOnboardingStepId | "more", RefObject<RNView | null>>
  >;
  onSettingsPanelLayout?: () => void;
};

function RailDestinationButton({
  destination,
  rowRef,
  contentPaddingLeft,
}: {
  destination: RailDestination;
  rowRef?: RefObject<RNView | null>;
  contentPaddingLeft: number;
}) {
  const { label, onPress, Icon, iconSize, destructive } = destination;
  const iconColor = destructive ? READER_M3_ERROR : READER_M3_ON_SURFACE_VARIANT;
  const labelColor = destructive ? READER_M3_ON_ERROR_CONTAINER : READER_M3_ON_SURFACE;

  return (
    <Pressable
      onPress={() => {
        hapticLightImpact();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.railItem,
        destructive && styles.railItemDestructive,
        pressed && (destructive ? styles.railItemDestructivePressed : styles.railItemPressed),
      ]}
    >
      <View
        ref={rowRef}
        collapsable={false}
        style={[styles.railItemInner, { paddingLeft: 16 + contentPaddingLeft }]}
      >
        <Icon size={iconSize ?? RAIL_ICON_SIZE} color={iconColor} />
        <Text style={[styles.railLabel, { color: labelColor }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/** M3 expanded navigation rail — phone layout; left edge; revealed when the reader slides aside. */
export function ReaderSettingsNavigationRail({
  insets,
  scrollPaddingTop,
  railWidthPx,
  toolsMenuOpen,
  headerTools = null,
  hideFontSettings = false,
  onSelectFontSettings,
  onSelectThemes,
  onSelectMore,
  onSelectTranslation,
  onSelectCommentary,
  onSelectDeleteMyData,
  settingsOnboardingRowRefs,
  onSettingsPanelLayout,
}: ReaderSettingsNavigationRailProps) {
  const deleteMyDataBottomPx = readerSettingsDeleteMyDataPanelBottomPx();
  const contentPaddingLeft = insets.left;

  const destinations: RailDestination[] = [
    {
      id: "translation",
      label: "Translation",
      onPress: onSelectTranslation,
      Icon: BookIcon,
    },
    {
      id: "study-notes",
      label: "Study Notes",
      onPress: onSelectCommentary,
      Icon: StudyNotesResearchIcon,
    },
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
            backgroundColor: toolsMenuOpen ? READER_MOBILE_SETTINGS_PANEL_BG : "transparent",
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
                <RailDestinationButton
                  key={destination.id}
                  destination={destination}
                  rowRef={settingsOnboardingRowRefs?.[destination.id]}
                  contentPaddingLeft={contentPaddingLeft}
                />
              ))}
            </ScrollView>
            <View style={[styles.deleteWrap, { bottom: deleteMyDataBottomPx }]}>
              <RailDestinationButton
                destination={{
                  id: "delete-my-data",
                  label: "Delete My Data",
                  onPress: onSelectDeleteMyData,
                  Icon: DeleteMyDataIcon,
                  destructive: true,
                }}
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
  railItem: {
    minHeight: READER_SETTINGS_NAV_RAIL_ITEM_HEIGHT_PX,
    borderRadius: 999,
    marginHorizontal: 12,
    overflow: "hidden",
  },
  railItemPressed: {
    backgroundColor: READER_M3_SURFACE_CONTAINER,
  },
  railItemDestructive: {
    backgroundColor: READER_M3_ERROR_CONTAINER,
  },
  railItemDestructivePressed: {
    backgroundColor: "#F3DAD7",
  },
  railItemInner: {
    minHeight: READER_SETTINGS_NAV_RAIL_ITEM_HEIGHT_PX,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 16,
    paddingVertical: 4,
    gap: 12,
  },
  railLabel: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: RAIL_LABEL_SIZE,
    lineHeight: RAIL_LABEL_LINE_HEIGHT,
  },
  deleteWrap: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
