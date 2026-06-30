import type { ReactNode } from "react";
import { Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";
import { Stack } from "expo-router";
import {
  READER_HEADER_TOOLS_PILL_WIDTH,
} from "@/src/features/reader/readerHeaderToolTargets";

/** ~20% smaller than a typical ~17pt stack title. */
export const READER_HEADER_TITLE_MAIN_PX = 17 * 0.8;

/** ~7 characters at header title size before ellipsis is acceptable. */
export const READER_HEADER_TITLE_MIN_WIDTH_PX = Math.ceil(READER_HEADER_TITLE_MAIN_PX * 0.65 * 7);

const HEADER_TITLE_EDGE_INSET_PX = 16;

export function readerHeaderTitleSideInsets(hasHeaderTools: boolean, _toolsOnLeft: boolean) {
  if (!hasHeaderTools) {
    return { left: 0, right: 0 };
  }
  const toolsInset = READER_HEADER_TOOLS_PILL_WIDTH + HEADER_TITLE_EDGE_INSET_PX;
  // Symmetric reserve — keeps max-width sane while the pill stays screen-centered.
  return { left: toolsInset, right: toolsInset };
}

function readerHeaderTitleMaxWidth(
  screenW: number,
  hasHeaderTools: boolean,
  toolsOnLeft: boolean,
): number {
  const { left, right } = readerHeaderTitleSideInsets(hasHeaderTools, toolsOnLeft);
  return Math.max(READER_HEADER_TITLE_MIN_WIDTH_PX, screenW - left - right - HEADER_TITLE_EDGE_INSET_PX * 2);
}

const IOS_NAV_BAR_HEIGHT_PX = 44;

type ReaderScrollChapterTitlePillProps = {
  rc: { sceneSurface: string };
  colors: { brown800: string; gold: string };
  bookName: string;
  chapterNumber: number;
  titleMaxWidth: number;
  animatedStyle: AnimatedStyle<ViewStyle>;
};

const readerScrollChapterTitleTextStyle = {
  fontSize: READER_HEADER_TITLE_MAIN_PX,
  lineHeight: Math.ceil(READER_HEADER_TITLE_MAIN_PX * 1.25),
} as const;

export function ReaderScrollChapterTitlePill({
  rc,
  colors,
  bookName,
  chapterNumber,
  titleMaxWidth,
  animatedStyle,
}: ReaderScrollChapterTitlePillProps) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          backgroundColor: rc.sceneSurface,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 4,
          minWidth: READER_HEADER_TITLE_MIN_WIDTH_PX,
          maxWidth: titleMaxWidth,
          alignSelf: "center",
        },
        animatedStyle,
      ]}
    >
      <Text
        style={[readerScrollChapterTitleTextStyle, { textAlign: "center" }]}
        numberOfLines={1}
      >
        <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.brown800 }}>
          {bookName}
        </Text>
        <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.gold }}>
          {` ${chapterNumber}`}
        </Text>
      </Text>
    </Animated.View>
  );
}

export type ReaderIosScrollChapterTitleProps = {
  hidden: boolean;
  topInsetPx: number;
  screenW: number;
  titleAnimatedStyle: AnimatedStyle<ViewStyle>;
  bookName: string;
  chapterNumber: number;
  colors: { brown800: string; gold: string };
  rc: { sceneSurface: string };
  hasHeaderTools: boolean;
  toolsOnLeft: boolean;
};

/** iOS scroll-reveal chapter title — native stack `headerTitle` is too narrow for full book names. */
export function ReaderIosScrollChapterTitle({
  hidden,
  topInsetPx,
  screenW,
  titleAnimatedStyle,
  bookName,
  chapterNumber,
  colors,
  rc,
  hasHeaderTools,
  toolsOnLeft,
}: ReaderIosScrollChapterTitleProps) {
  if (Platform.OS !== "ios") return null;

  const titleSideInsets = readerHeaderTitleSideInsets(hasHeaderTools, toolsOnLeft);
  const titleMaxWidth = readerHeaderTitleMaxWidth(screenW, hasHeaderTools, toolsOnLeft);

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99,
        opacity: hidden ? 0 : 1,
      }}
    >
      <View
        style={{
          paddingTop: topInsetPx,
          height: topInsetPx + IOS_NAV_BAR_HEIGHT_PX,
          width: screenW,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: Math.max(titleSideInsets.left, titleSideInsets.right),
        }}
      >
        <ReaderScrollChapterTitlePill
          rc={rc}
          colors={colors}
          bookName={bookName}
          chapterNumber={chapterNumber}
          titleMaxWidth={titleMaxWidth}
          animatedStyle={titleAnimatedStyle}
        />
      </View>
    </View>
  );
}

type ReaderHeaderProps = {
  /**
   * Hides native header chrome while the book picker is fully open (not during exit animation).
   * Keeps the header mounted — avoids iOS stack header remount flash when the picker closes.
   */
  readerHeaderChromeHidden: boolean;
  rc: { sceneSurface: string };
  colors: { brown800: string; gold: string };
  readerHeaderToolsGroup: ReactNode | null;
  /** When set, renders tools in the native stack header on iOS (`left` or `right`). */
  readerHeaderToolsSide?: "left" | "right";
};

export function ReaderHeader({
  readerHeaderChromeHidden,
  rc,
  colors,
  readerHeaderToolsGroup,
  readerHeaderToolsSide = "right",
}: ReaderHeaderProps) {
  const hasHeaderTools = readerHeaderToolsGroup != null;
  const iosHeaderTools =
    Platform.OS === "ios" && hasHeaderTools ? () => readerHeaderToolsGroup : undefined;

  return (
    <>
      <Stack.Screen
        options={{
          /**
           * iOS: native stack header + headerRight tools.
           * Android: header hidden — tools are an in-screen overlay; native header intercepts taps there.
           */
          headerShown: Platform.OS === "ios",
          /**
           * iOS: no custom header background — keeps `headerTransparent` so scrolling text shows through.
           * Android: opaque fill from `57f2fe3` avoids white flashes under the native stack header when params update.
           */
          ...(Platform.OS !== "ios"
            ? {
                headerBackground: () => (
                  <View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, { backgroundColor: rc.sceneSurface }]}
                  />
                ),
              }
            : {}),
          headerTitle: () => <View />,
          headerTitleAlign: "center",
          headerLeft: readerHeaderToolsSide === "left" ? iosHeaderTools : () => null,
          /** Android: in-screen overlay (see reader chapter screen). iOS: native header tools. */
          headerRight: readerHeaderToolsSide === "right" ? iosHeaderTools : undefined,
          headerBackVisible: false,
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: "transparent",
            borderBottomWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
            opacity: readerHeaderChromeHidden ? 0 : 1,
          } as { backgroundColor: string; opacity: number },
          headerTintColor: colors.brown800,
          headerTransparent: Platform.OS === "ios",
        }}
      />

    </>
  );
}
