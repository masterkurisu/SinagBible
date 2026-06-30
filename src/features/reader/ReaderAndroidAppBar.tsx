import type { ReactNode, RefObject } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import type { AnimatedStyle } from "react-native-reanimated";
import { READER_HEADER_TITLE_MIN_WIDTH_PX, ReaderScrollChapterTitlePill } from "@/src/features/reader/ReaderHeader";
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
  const leadingWidth = READER_M3_APP_BAR_ICON_BUTTON_PX;
  const trailingWidth = READER_M3_APP_BAR_ICON_BUTTON_PX * 2;
  const titleSideReserve = Math.max(leadingWidth, trailingWidth) + sideInset;
  const titleMaxWidth = Math.max(
    READER_HEADER_TITLE_MIN_WIDTH_PX,
    screenW - titleSideReserve * 2,
  );

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

          <View style={styles.trailing}>
            {bookButton}
            {fontButton}
          </View>
        </View>
      </View>

      {!toolsMenuOpen ? (
        <View
          pointerEvents="none"
          style={[
            styles.titleWrap,
            {
              top: topInsetPx,
              height: READER_M3_APP_BAR_CONTENT_HEIGHT_PX,
            },
          ]}
        >
          <ReaderScrollChapterTitlePill
            rc={{ sceneSurface: backgroundColor }}
            colors={colors}
            bookName={bookName}
            chapterNumber={chapterNumber}
            titleMaxWidth={titleMaxWidth}
            animatedStyle={titleAnimatedStyle}
          />
        </View>
      ) : null}
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
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
});
