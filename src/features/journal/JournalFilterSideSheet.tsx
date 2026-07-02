import { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import {
  READER_SETTINGS_MENU_SPRING_CLOSE,
  READER_SETTINGS_MENU_SPRING_OPEN,
} from "@/lib/reader-settings-menu-motion";
import { M3SettingsSheetTitle } from "@/src/components/m3/M3SettingsSheetTitle";
import {
  JournalFilterSortPanel,
  type JournalFilterKind,
  type JournalSortKind,
} from "@/src/features/journal/JournalFilterSortPanel";
import type { RefObject } from "react";
import type { View as RNView } from "react-native";

export type JournalFilterSideSheetProps = {
  open: boolean;
  onClose: () => void;
  bundle: MobileAppThemeBundle;
  screenWidth: number;
  insets: { top: number; bottom: number; left: number; right: number };
  filter: JournalFilterKind;
  sort: JournalSortKind;
  onSelectFilter: (kind: JournalFilterKind) => void;
  onSelectSort: (kind: JournalSortKind) => void;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  onDateFromChange?: (date: Date | null) => void;
  onDateToChange?: (date: Date | null) => void;
  filtersRef?: RefObject<RNView | null>;
  sortRef?: RefObject<RNView | null>;
  pointerEvents?: "none" | "auto";
  onOpenCarouselSettings?: () => void;
};

/** M3 side sheet — filter and sort controls slide in from the right edge. */
export function JournalFilterSideSheet({
  open,
  onClose,
  bundle,
  screenWidth,
  insets,
  filter,
  sort,
  onSelectFilter,
  onSelectSort,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  filtersRef,
  sortRef,
  pointerEvents = "auto",
  onOpenCarouselSettings,
}: JournalFilterSideSheetProps) {
  if (Platform.OS !== "android") return null;

  const j = bundle.journal;
  const sheetWidth = Math.max(240, Math.min(320, Math.max(280, Math.round(screenWidth * 0.84)) - 40));
  const slideProgress = useRef(new Animated.Value(0)).current;
  const [sheetMounted, setSheetMounted] = useState(open);
  const scrimOpacity = slideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.32],
  });
  const sheetTranslateX = slideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [sheetWidth, 0],
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

  if (!sheetMounted) return null;

  return (
    <Modal visible={sheetMounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root} pointerEvents="box-none">
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss filter options"
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
              paddingLeft: 16,
              paddingRight: Math.max(insets.right, 16),
              backgroundColor: j.panelBackground,
              borderColor: j.panelBorder,
              transform: [{ translateX: sheetTranslateX }],
            },
          ]}
        >
          <M3SettingsSheetTitle
            title="Filter & sort"
            titleColor={bundle.ui.brown800}
            style={{ marginBottom: 16 }}
          />
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <JournalFilterSortPanel
              bundle={bundle}
              filter={filter}
              sort={sort}
              onSelectFilter={onSelectFilter}
              onSelectSort={onSelectSort}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={onDateFromChange}
              onDateToChange={onDateToChange}
              filtersRef={filtersRef}
              sortRef={sortRef}
              onOpenCarouselSettings={onOpenCarouselSettings}
              pointerEvents={pointerEvents}
            />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  scrim: {
    backgroundColor: "#000000",
  },
  sheet: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    borderLeftWidth: 1,
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
    elevation: 16,
    shadowColor: "#000000",
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    overflow: "hidden",
  },
  scrollContent: {
    width: "100%",
    paddingBottom: 8,
  },
});
