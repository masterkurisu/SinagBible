import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import {
  READER_M3_ERROR,
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
  READER_M3_OUTLINE_VARIANT,
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
  scale?: number;
  accessibilityLabel?: string;
  style?: ViewStyle;
  fullWidth?: boolean;
};

const BUTTON_HEIGHT_PX = 40;
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
  scale = 1,
  accessibilityLabel,
  style,
  fullWidth = false,
}: M3ButtonProps) {
  const rippleColor = bundle.chrome.androidRipple;
  const primary = destructive ? READER_M3_ERROR : bundle.chrome.tabTint;
  const height = BUTTON_HEIGHT_PX * scale;
  const radius = BUTTON_RADIUS_PX * scale;
  const isDisabled = disabled || loading;

  const colors = resolveM3ButtonColors(variant, primary, destructive);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      android_ripple={
        Platform.OS === "android" && !isDisabled
          ? { color: rippleColor, borderless: variant === "text" }
          : undefined
      }
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: height,
          borderRadius: radius,
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderWidth: colors.borderWidth,
          opacity: isDisabled ? 0.38 : pressed ? 0.88 : 1,
          alignSelf: fullWidth ? "stretch" : "auto",
        },
        style,
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
        label: "#FFFFFF",
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
        border: READER_M3_OUTLINE_VARIANT,
        borderWidth: 1,
        label: destructive ? READER_M3_ERROR : READER_M3_ON_SURFACE,
      };
    case "text":
      return {
        background: "transparent",
        border: "transparent",
        borderWidth: 0,
        label: destructive ? READER_M3_ERROR : READER_M3_ON_SURFACE_VARIANT,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
