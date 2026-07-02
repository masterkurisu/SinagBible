import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import {
  READER_M3_ERROR,
  READER_M3_ON_SURFACE,
  READER_M3_SECONDARY_CONTAINER,
  READER_M3_ON_SECONDARY_CONTAINER,
} from "@/src/features/reader/readerSettingsPanelChrome";

export type M3ButtonVariant = "filled" | "tonal" | "outlined" | "text";

export type M3ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: M3ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
  bundle: MobileAppThemeBundle;
  /** Overrides theme primary for filled/outlined accents (e.g. dialog actions). */
  accentColor?: string;
  scale?: number;
  accessibilityLabel?: string;
  style?: ViewStyle;
  fullWidth?: boolean;
};

/** M3 small button — 40dp tall, fully rounded, 16dp horizontal padding. */
const BUTTON_HEIGHT_PX = 40;
const BUTTON_PADDING_H_PX = 16;
const BUTTON_RADIUS_PX = 20;
const LABEL_FONT_PX = 14;
const LABEL_LINE_HEIGHT_PX = 20;

/** M3 button — filled, tonal, outlined, or text. */
export function M3Button({
  label,
  onPress,
  variant = "filled",
  disabled = false,
  loading = false,
  destructive = false,
  bundle,
  accentColor,
  scale = 1,
  accessibilityLabel,
  style,
  fullWidth = false,
}: M3ButtonProps) {
  const rippleColor = bundle.chrome.androidRipple;
  const primary = destructive ? READER_M3_ERROR : (accentColor ?? bundle.chrome.tabTint);
  const height = BUTTON_HEIGHT_PX * scale;
  const radius = BUTTON_RADIUS_PX * scale;
  const padH = BUTTON_PADDING_H_PX * scale;
  const isDisabled = disabled || loading;

  const colors = resolveM3ButtonColors(variant, primary, destructive);
  const useRipple = Platform.OS === "android" && !isDisabled && variant !== "text";

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      android_ripple={
        useRipple
          ? { color: rippleColor, foreground: true, borderless: false }
          : undefined
      }
      style={({ pressed }) => [
        styles.pressable,
        fullWidth ? styles.pressableFullWidth : null,
        {
          borderRadius: radius,
          opacity: isDisabled ? 0.38 : 1,
        },
        style,
      ]}
    >
      {({ pressed }) => (
      <View
        style={[
          styles.surface,
          {
            minHeight: height,
            borderRadius: radius,
            paddingHorizontal: padH,
            backgroundColor: colors.background,
            borderColor: colors.border,
            borderWidth: colors.borderWidth,
            opacity: !isDisabled && pressed ? 0.88 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.label} />
        ) : (
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: LABEL_FONT_PX * scale,
              lineHeight: LABEL_LINE_HEIGHT_PX * scale,
              letterSpacing: 0.1,
              color: colors.label,
            }}
          >
            {label}
          </Text>
        )}
      </View>
      )}
    </Pressable>
  );
}

function resolveM3ButtonColors(
  variant: M3ButtonVariant,
  primary: string,
  destructive: boolean,
): { background: string; border: string; borderWidth: number; label: string } {
  switch (variant) {
    case "filled":
      return {
        background: primary,
        border: primary,
        borderWidth: 0,
        label: onPrimaryLabelColor(primary),
      };
    case "tonal":
      return {
        background: destructive ? "#F9DEDC" : READER_M3_SECONDARY_CONTAINER,
        border: "transparent",
        borderWidth: 0,
        label: destructive ? READER_M3_ERROR : READER_M3_ON_SECONDARY_CONTAINER,
      };
    case "outlined":
      return {
        background: "transparent",
        border: primary,
        borderWidth: 1,
        label: destructive ? READER_M3_ERROR : primary,
      };
    case "text":
      return {
        background: "transparent",
        border: "transparent",
        borderWidth: 0,
        label: destructive ? READER_M3_ERROR : primary,
      };
  }
}

/** Pick readable label color on filled button containers. */
function onPrimaryLabelColor(background: string): string {
  const hex = background.replace("#", "");
  if (hex.length !== 6) return "#FFFFFF";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? READER_M3_ON_SURFACE : "#FFFFFF";
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: "flex-start",
    overflow: "hidden",
  },
  pressableFullWidth: {
    alignSelf: "stretch",
    width: "100%",
  },
  surface: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
