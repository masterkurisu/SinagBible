import { MaterialIcons } from "@expo/vector-icons";
import { Platform, Pressable, Text, View, type ViewStyle } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { READER_M3_ON_SURFACE } from "@/src/features/reader/readerSettingsPanelChrome";
import {
  HOME_M3_CTA_HEIGHT_PX,
  HOME_M3_CTA_LABEL_FONT_PX,
  HOME_M3_CTA_LABEL_LINE_HEIGHT_PX,
  HOME_M3_CTA_PADDING_H_PX,
  HOME_M3_CTA_RADIUS_PX,
} from "@/src/features/home/homeM3Chrome";

export type HomeM3CtaVariant = "filled" | "tonal";

export type HomeM3CtaButtonProps = {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  variant?: HomeM3CtaVariant;
  bundle: MobileAppThemeBundle;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

function onPrimaryLabelColor(background: string): string {
  const hex = background.replace("#", "");
  if (hex.length !== 6) return "#FFFFFF";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? READER_M3_ON_SURFACE : "#FFFFFF";
}

/** M3 expressive hero CTA — 48dp filled or tonal button with leading icon. */
export function HomeM3CtaButton({
  label,
  icon,
  onPress,
  variant = "filled",
  bundle,
  accessibilityLabel,
  style,
}: HomeM3CtaButtonProps) {
  const h = bundle.home;
  const primary = bundle.chrome.tabTint;
  const rippleColor = bundle.chrome.androidRipple;
  const isFilled = variant === "filled";

  const backgroundColor = isFilled ? primary : bundle.chrome.androidIndicator;
  const contentColor = isFilled ? onPrimaryLabelColor(primary) : primary;
  const labelColor = isFilled ? contentColor : h.ctaSecondaryText;
  const iconColor = isFilled ? contentColor : primary;
  const borderColor = isFilled ? "transparent" : h.divider;
  const borderWidth = isFilled ? 0 : 1;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      android_ripple={
        Platform.OS === "android"
          ? { color: rippleColor, foreground: true, borderless: false }
          : undefined
      }
      style={({ pressed }) => [
        {
          alignSelf: "stretch",
          borderRadius: HOME_M3_CTA_RADIUS_PX,
          overflow: "hidden",
          opacity: pressed ? 0.92 : 1,
        },
        style,
      ]}
    >
      <View
        style={{
          minHeight: HOME_M3_CTA_HEIGHT_PX,
          borderRadius: HOME_M3_CTA_RADIUS_PX,
          paddingHorizontal: HOME_M3_CTA_PADDING_H_PX,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor,
          borderColor,
          borderWidth,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
          <MaterialIcons name={icon} size={22} color={iconColor} />
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: HOME_M3_CTA_LABEL_FONT_PX,
              lineHeight: HOME_M3_CTA_LABEL_LINE_HEIGHT_PX,
              letterSpacing: 0.15,
              color: labelColor,
            }}
          >
            {label}
          </Text>
        </View>
        <MaterialIcons name="arrow-forward" size={20} color={iconColor} />
      </View>
    </Pressable>
  );
}
