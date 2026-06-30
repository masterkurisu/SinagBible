import type { ReactNode } from "react";
import { Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";
import { Stack } from "expo-router";

/** ~20% smaller than a typical ~17pt stack title; acronym another 20% smaller. */
export const READER_HEADER_TITLE_MAIN_PX = 17 * 0.8;
export const READER_HEADER_TITLE_TRANS_PX = READER_HEADER_TITLE_MAIN_PX * 0.8;

type ReaderHeaderProps = {
  /**
   * Hides native header chrome while the book picker is fully open (not during exit animation).
   * Keeps the header mounted — avoids iOS stack header remount flash when the picker closes.
   */
  readerHeaderChromeHidden: boolean;
  rc: { sceneSurface: string };
  colors: { brown800: string; gold: string };
  screenW: number;
  readerHeaderTitleAnimatedStyle: AnimatedStyle<ViewStyle>;
  readerHeaderBookName: string;
  chapterNumber: number;
  readerHeaderTranslationId: string;
  readerHeaderToolsGroup: ReactNode | null;
  /** When set, renders tools in the native stack header on iOS (`left` or `right`). */
  readerHeaderToolsSide?: "left" | "right";
};

export function ReaderHeader({
  readerHeaderChromeHidden,
  rc,
  colors,
  screenW,
  readerHeaderTitleAnimatedStyle,
  readerHeaderBookName,
  chapterNumber,
  readerHeaderTranslationId,
  readerHeaderToolsGroup,
  readerHeaderToolsSide = "right",
}: ReaderHeaderProps) {
  const iosHeaderTools =
    Platform.OS === "ios" && readerHeaderToolsGroup != null ? () => readerHeaderToolsGroup : undefined;

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
          headerTitle: () => (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  backgroundColor: rc.sceneSurface,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                },
                readerHeaderTitleAnimatedStyle,
              ]}
            >
              <View
                className="flex-row items-baseline justify-center"
                style={{
                  maxWidth: screenW * 0.42,
                  flexShrink: 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: READER_HEADER_TITLE_MAIN_PX,
                    lineHeight: Math.ceil(READER_HEADER_TITLE_MAIN_PX * 1.25),
                    color: colors.brown800,
                  }}
                  numberOfLines={1}
                >
                  {readerHeaderBookName} {chapterNumber}
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: READER_HEADER_TITLE_TRANS_PX,
                    lineHeight: Math.ceil(READER_HEADER_TITLE_TRANS_PX * 1.25),
                    color: colors.gold,
                  }}
                  numberOfLines={1}
                >{` (${readerHeaderTranslationId})`}</Text>
              </View>
            </Animated.View>
          ),
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
