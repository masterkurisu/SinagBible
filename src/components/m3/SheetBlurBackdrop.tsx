import { Image, Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import {
  DismissibleScrimLayer,
  type ScrimOpacitySource,
} from "@/src/components/m3/dismissible-scrim-opacity";

const SHEET_BLUR_ANDROID_SNAPSHOT_RADIUS = 22;
const SHEET_BLUR_IOS_INTENSITY = 60;

export type SheetBlurBackdropProps = {
  isDark: boolean;
  /** Android only: frozen screenshot to blur (Modal is a separate native window there). */
  androidBackdropUri?: string | null;
  /** Existing scrim color — kept as a tint wash over the blur so contrast/dimming stays the same. */
  tintColor: string;
  /** Omit for a static (non-animated) tint, e.g. sheets that don't fade their scrim in. */
  opacity?: ScrimOpacitySource;
};

/**
 * Blurred backdrop for M3 sheets presented in a Modal.
 * iOS: live native blur (`BlurView` samples whatever is behind it).
 * Android: blurs a frozen screenshot taken the instant the sheet opened, since Modal draws in its
 * own native Window and can't be sampled live — see `useAndroidSheetBackdropSnapshot`.
 */
export function SheetBlurBackdrop({
  isDark,
  androidBackdropUri,
  tintColor,
  opacity,
}: SheetBlurBackdropProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={SHEET_BLUR_IOS_INTENSITY}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      ) : androidBackdropUri ? (
        <Image
          source={{ uri: androidBackdropUri }}
          blurRadius={SHEET_BLUR_ANDROID_SNAPSHOT_RADIUS}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {opacity != null ? (
        <DismissibleScrimLayer scrimColor={tintColor} scrimOpacity={opacity} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]} />
      )}
    </View>
  );
}
