import type { ComponentType, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BookIcon } from "@/components/icons/BookIcon";
import { DeleteMyDataIcon } from "@/components/icons/DeleteMyDataIcon";
import { ReaderFontSettingsIcon } from "@/components/icons/ReaderFontSettingsIcon";
import { ReaderThemesPaletteIcon } from "@/components/icons/ReaderThemesPaletteIcon";
import { SettingsMoreIcon } from "@/components/icons/SettingsMoreIcon";
import { StudyNotesResearchIcon } from "@/components/icons/StudyNotesResearchIcon";
import {
  READER_SETTINGS_MENU_SPRING_CLOSE,
  READER_SETTINGS_MENU_SPRING_OPEN,
} from "@/lib/reader-settings-menu-motion";
import { readerSettingsDeleteMyDataPanelBottomPx } from "@/lib/native-tab-chrome";
import { ReaderM3RailDestination } from "@/src/features/reader/ReaderM3RailDestination";
import { M3RichTooltipOverlay } from "@/src/components/m3/M3RichTooltipOverlay";
import { getReaderSettingsTooltip } from "@/src/features/reader/readerSettingsOnboardingSteps";
import { useSettingsRowTooltip } from "@/src/features/reader/useSettingsRowTooltip";
import {
  READER_SETTINGS_NAV_RAIL_ITEM_HEIGHT_PX,
  readerSettingsSideSheetWidthPx,
} from "@/src/features/reader/readerSettingsPanelChrome";

const HEADER_TOOLS_ROW_HEIGHT = 44;

type ReaderSettingsMenuIconProps = { size?: number; color?: string };

type SideSheetDestination = {
  id: string;
  label: string;
  onPress: () => void;
  Icon: ComponentType<ReaderSettingsMenuIconProps>;
  iconSize?: number;
  destructive?: boolean;
};

export type ReaderSettingsSideSheetProps = {
  open: boolean;
  onClose: () => void;
  screenWidth: number;
  insets: { top: number; bottom: number; left: number; right: number };
  scrollPaddingTop: number;
  headerTools?: ReactNode | null;
  hideFontSettings?: boolean;
  hideTranslationAndStudyNotes?: boolean;
  onSelectFontSettings?: () => void;
  onSelectThemes: () => void;
  onSelectMore: () => void;
  onSelectTranslation: () => void;
  onSelectCommentary: () => void;
  onSelectDeleteMyData: () => void;
  onSelectVerseCarousel?: () => void;
  panelBackgroundColor: string;
  rippleColor?: string;
  onSettingsPanelLayout?: () => void;
};

function VerseCarouselSideSheetIcon({ size = 24, color = "#2c2416" }: ReaderSettingsMenuIconProps) {
  return <MaterialIcons name="view-carousel" size={size} color={color} />;
}

/** M3 side sheet — settings destinations slide in from the left edge. */
export function ReaderSettingsSideSheet({
  open,
  onClose,
  screenWidth,
  insets,
  scrollPaddingTop,
  headerTools = null,
  hideFontSettings = false,
  hideTranslationAndStudyNotes = false,
  onSelectFontSettings,
  onSelectThemes,
  onSelectMore,
  onSelectTranslation,
  onSelectCommentary,
  onSelectDeleteMyData,
  onSelectVerseCarousel,
  panelBackgroundColor,
  rippleColor,
  onSettingsPanelLayout,
}: ReaderSettingsSideSheetProps) {
  const sheetWidth = readerSettingsSideSheetWidthPx(screenWidth);
  const deleteMyDataBottomPx = readerSettingsDeleteMyDataPanelBottomPx();
  const contentPaddingLeft = insets.left;
  const slideProgress = useRef(new Animated.Value(0)).current;
  const [sheetMounted, setSheetMounted] = useState(open);
  const { tooltip, showTooltip, dismissTooltip, tooltipVisible } = useSettingsRowTooltip();

  const scrimOpacity = slideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.32],
  });
  const sheetTranslateX = slideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-sheetWidth, 0],
  });

  useEffect(() => {
    if (open) setSheetMounted(true);
    slideProgress.stopAnimation();
    Animated.spring(slideProgress, {
      ...(open ? READER_SETTINGS_MENU_SPRING_OPEN : READER_SETTINGS_MENU_SPRING_CLOSE),
      toValue: open ? 1 : 0,
    }).start(({ finished }) => {
      if (finished && !open) setSheetMounted(false);
    });
  }, [open, slideProgress]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose, open]);

  const destinations: SideSheetDestination[] = [
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
    ...(onSelectVerseCarousel
      ? [
          {
            id: "verse-carousel" as const,
            label: "Verse Carousel",
            onPress: onSelectVerseCarousel,
            Icon: VerseCarouselSideSheetIcon,
          },
        ]
      : []),
    {
      id: "more",
      label: "More",
      onPress: onSelectMore,
      Icon: SettingsMoreIcon,
    },
  ];

  if (!sheetMounted) return null;

  const deleteTooltip = getReaderSettingsTooltip("delete-my-data");

  return (
    <Modal visible={sheetMounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root} pointerEvents="box-none" onLayout={onSettingsPanelLayout}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss settings"
          onPress={onClose}
        >
          <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: scrimOpacity }]} />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            {
              width: sheetWidth,
              paddingTop: Math.max(insets.top, 8) + 12,
              paddingBottom: Math.max(insets.bottom, 16),
              paddingLeft: Math.max(insets.left, 16),
              paddingRight: 16,
              backgroundColor: panelBackgroundColor,
              transform: [{ translateX: sheetTranslateX }],
            },
          ]}
        >
          {headerTools != null ? (
            <View
              style={[
                styles.headerToolsRow,
                {
                  paddingTop: scrollPaddingTop,
                  minHeight: HEADER_TOOLS_ROW_HEIGHT,
                  paddingLeft: contentPaddingLeft,
                },
              ]}
            >
              {headerTools}
            </View>
          ) : (
            <Text style={styles.title}>Settings</Text>
          )}

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces
            style={styles.destinationsScroll}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingBottom: deleteMyDataBottomPx + READER_SETTINGS_NAV_RAIL_ITEM_HEIGHT_PX + 8,
              },
            ]}
          >
            {destinations.map((destination) => {
              const tooltipContent = getReaderSettingsTooltip(destination.id);
              return (
              <ReaderM3RailDestination
                key={destination.id}
                label={destination.label}
                onPress={destination.onPress}
                Icon={destination.Icon}
                iconSize={destination.iconSize}
                destructive={destination.destructive}
                rippleColor={rippleColor}
                tooltipTitle={tooltipContent?.title}
                tooltipDescription={tooltipContent?.description}
                onShowTooltip={tooltipContent ? showTooltip : undefined}
                contentPaddingLeft={contentPaddingLeft}
              />
            );
            })}
          </ScrollView>

          <View style={[styles.deleteWrap, { bottom: deleteMyDataBottomPx }]}>
            <ReaderM3RailDestination
              label="Delete My Data"
              onPress={onSelectDeleteMyData}
              Icon={DeleteMyDataIcon}
              destructive
              rippleColor={rippleColor}
              tooltipTitle={deleteTooltip?.title}
              tooltipDescription={deleteTooltip?.description}
              onShowTooltip={deleteTooltip ? showTooltip : undefined}
              contentPaddingLeft={contentPaddingLeft}
            />
          </View>
        </Animated.View>
      </View>
      {tooltip ? (
        <M3RichTooltipOverlay
          visible={tooltipVisible}
          anchor={tooltip.anchor}
          title={tooltip.title}
          description={tooltip.description}
          onDismiss={dismissTooltip}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  scrim: {
    backgroundColor: "#000000",
  },
  sheet: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    overflow: "hidden",
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    color: "#2c2416",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  headerToolsRow: {
    justifyContent: "center",
  },
  destinationsScroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 4,
  },
  deleteWrap: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
