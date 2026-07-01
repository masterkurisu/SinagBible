import { useCallback } from "react";
import { Image } from "expo-image";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Your public Ko-fi page, e.g. `https://ko-fi.com/yourname`.
 * Leave empty until you set it — `Linking.openURL` rejects on many devices for fake/invalid URLs.
 * Button graphic: `assets/support-me-on-kofi.png` (Ko-fi "Support me on Ko-fi" badge).
 */
export const KOFI_SUPPORT_URL = "https://ko-fi.com/sinagbible";

const KOFI_BUTTON_IMAGE = require("../assets/support-me-on-kofi.png");
/** Native pixel size of `support-me-on-kofi.png` (980×198). */
const KOFI_BUTTON_ASPECT = 980 / 198;

export type KofiSupportBlockProps = {
  bodyColor: string;
  bodyFontSize?: number;
  bodyLineHeight?: number;
  buttonWidth?: number;
};

export function KofiSupportBlock({
  bodyColor,
  bodyFontSize = 15,
  bodyLineHeight = 22,
  buttonWidth = 180,
}: KofiSupportBlockProps) {
  const openKofi = useCallback(() => {
    const url = KOFI_SUPPORT_URL.trim();
    if (!url) return;
    void Linking.openURL(url).catch(() => {
      /* User or OS blocked open; avoid uncaught promise in dev overlay */
    });
  }, []);

  if (KOFI_SUPPORT_URL.trim().length === 0) return null;

  return (
    <View style={styles.root}>
      <Text
        style={[
          styles.body,
          {
            color: bodyColor,
            fontSize: bodyFontSize,
            lineHeight: bodyLineHeight,
          },
        ]}
      >
        This app is free, no strings attached. But if you would like to support its development, a
        small Ko-fi goes a long way.
      </Text>
      <Pressable
        onPress={openKofi}
        style={styles.kofiButton}
        accessibilityRole="link"
        accessibilityLabel="Support me on Ko-fi"
      >
        <Image
          source={KOFI_BUTTON_IMAGE}
          style={[styles.kofiButtonImage, { width: buttonWidth }]}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </Pressable>
      <Text
        style={[
          styles.thankYou,
          {
            color: bodyColor,
            fontSize: bodyFontSize,
            lineHeight: bodyLineHeight,
          },
        ]}
      >
        Thank you for using Sinag Bible.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
    marginTop: 4,
  },
  body: {
    fontFamily: "Inter_400Regular",
  },
  kofiButton: {
    alignSelf: "center",
    maxWidth: "100%",
  },
  kofiButtonImage: {
    maxWidth: "100%",
    aspectRatio: KOFI_BUTTON_ASPECT,
  },
  thankYou: {
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 4,
  },
});
