import type { ReactNode } from "react";
import { Platform, StyleSheet, Text, View, Animated } from "react-native";
import { Stack } from "expo-router";

/** ~20% smaller than a typical ~17pt stack title; acronym another 20% smaller. */
const READER_HEADER_TITLE_MAIN_PX = 17 * 0.8;
const READER_HEADER_TITLE_TRANS_PX = READER_HEADER_TITLE_MAIN_PX * 0.8;

type ReaderHeaderProps = {
  /**
   * Hides native header chrome while the book picker is fully open (not during exit animation).
   * Keeps the header mounted — avoids iOS stack header remount flash when the picker closes.
   */
  readerHeaderChromeHidden: boolean;
  rc: { sceneSurface: string };
  colors: { brown800: string; gold: string };
  screenW: number;
  readerHeaderTitleOpacityAnim: Animated.AnimatedInterpolation<string | number>;
  readerHeaderBookName: string;
  chapterNumber: number;
  readerHeaderTranslationId: string;
  readerHeaderToolsGroup: ReactNode;
};

export function ReaderHeader({
  readerHeaderChromeHidden,
  rc,
  colors,
  screenW,
  readerHeaderTitleOpacityAnim,
  readerHeaderBookName,
  chapterNumber,
  readerHeaderTranslationId,
  readerHeaderToolsGroup,
}: ReaderHeaderProps) {
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
              style={{
                opacity: readerHeaderTitleOpacityAnim,
                backgroundColor: rc.sceneSurface,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
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
          headerLeft: () => null,
          /** Android: in-screen overlay (see reader chapter screen). iOS: native headerRight. */
          headerRight: Platform.OS === "ios" ? () => readerHeaderToolsGroup : undefined,
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
