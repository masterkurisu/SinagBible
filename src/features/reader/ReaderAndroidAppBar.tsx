import type { ReactNode, RefObject } from "react";
import { Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";
import {
  READER_HEADER_TITLE_MAIN_PX,
  READER_HEADER_TITLE_TRANS_PX,
} from "@/src/features/reader/ReaderHeader";
import {
  READER_M3_APP_BAR_CONTENT_HEIGHT_PX,
  READER_M3_APP_BAR_ICON_BUTTON_PX,
} from "@/src/features/reader/readerSettingsPanelChrome";

export type ReaderAndroidAppBarProps = {
  hidden: boolean;
  topInsetPx: number;
  backgroundColor: string;
  insets: { left: number; right: number };
  screenW: number;
  titleAnimatedStyle: AnimatedStyle<ViewStyle>;
  bookName: string;
  chapterNumber: number;
  translationId: string;
  colors: { brown800: string; gold: string };
  bookButton: ReactNode;
  settingsButton: ReactNode;
  fontButton: ReactNode;
  toolsMenuOpen: boolean;
  barRef?: RefObject<View | null>;
  onLayout?: () => void;
};

/** M3 center-aligned top app bar — settings, title, book selector, and font controls. */
export function ReaderAndroidAppBar({
  hidden,
  topInsetPx,
  backgroundColor,
  insets,
  screenW,
  titleAnimatedStyle,
  bookName,
  chapterNumber,
  translationId,
  colors,
  bookButton,
  settingsButton,
  fontButton,
  toolsMenuOpen,
  barRef,
  onLayout,
}: ReaderAndroidAppBarProps) {
  if (Platform.OS !== "android") return null;

  const sideInset = Math.max(insets.left, insets.right, 4);
  const titleSidePad =
    READER_M3_APP_BAR_ICON_BUTTON_PX + sideInset + READER_M3_APP_BAR_ICON_BUTTON_PX * 2 + sideInset;

  return (
    <View
      ref={barRef}
      pointerEvents={hidden ? "none" : "box-none"}
      collapsable={false}
      onLayout={onLayout}
      style={[
        styles.root,
        {
          opacity: hidden ? 0 : 1,
        },
      ]}
    >
      <View style={{ paddingTop: topInsetPx, backgroundColor }}>
        <View
          style={[
            styles.barRow,
            {
              height: READER_M3_APP_BAR_CONTENT_HEIGHT_PX,
              paddingLeft: Math.max(insets.left, 4),
              paddingRight: Math.max(insets.right, 4),
            },
          ]}
        >
          <View style={styles.leading}>{settingsButton}</View>

          {!toolsMenuOpen ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.titleWrap,
                {
                  left: titleSidePad,
                  right: titleSidePad,
                },
                titleAnimatedStyle,
              ]}
            >
              <View style={[styles.titlePill, { maxWidth: screenW - titleSidePad * 2 }]}>
                <View className="flex-row items-baseline justify-center" style={{ flexShrink: 1 }}>
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: READER_HEADER_TITLE_MAIN_PX,
                      lineHeight: Math.ceil(READER_HEADER_TITLE_MAIN_PX * 1.25),
                      color: colors.brown800,
                    }}
                    numberOfLines={1}
                  >
                    {bookName} {chapterNumber}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: READER_HEADER_TITLE_TRANS_PX,
                      lineHeight: Math.ceil(READER_HEADER_TITLE_TRANS_PX * 1.25),
                      color: colors.gold,
                    }}
                    numberOfLines={1}
                  >{` (${translationId})`}</Text>
                </View>
              </View>
            </Animated.View>
          ) : null}

          <View style={styles.trailing}>
            {bookButton}
            {fontButton}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 100,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leading: {
    width: READER_M3_APP_BAR_ICON_BUTTON_PX,
    height: READER_M3_APP_BAR_ICON_BUTTON_PX,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },
  titleWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  titlePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
