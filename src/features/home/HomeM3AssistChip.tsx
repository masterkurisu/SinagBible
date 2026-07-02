import { Text, View } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import {
  HOME_M3_CHIP_FONT_PX,
  HOME_M3_CHIP_HEIGHT_PX,
  HOME_M3_CHIP_LETTER_SPACING,
  HOME_M3_CHIP_LINE_HEIGHT_PX,
  HOME_M3_CHIP_PADDING_H_PX,
  HOME_M3_CHIP_RADIUS_PX,
} from "@/src/features/home/homeM3Chrome";

export type HomeM3AssistChipProps = {
  label: string;
  bundle: MobileAppThemeBundle;
};

/** M3 assist chip — tonal pill for hero metadata tags. */
export function HomeM3AssistChip({ label, bundle }: HomeM3AssistChipProps) {
  const h = bundle.home;
  const primary = bundle.chrome.tabTint;

  return (
    <View
      style={{
        height: HOME_M3_CHIP_HEIGHT_PX,
        borderRadius: HOME_M3_CHIP_RADIUS_PX,
        paddingHorizontal: HOME_M3_CHIP_PADDING_H_PX,
        justifyContent: "center",
        backgroundColor: bundle.chrome.androidIndicator,
        borderWidth: 1,
        borderColor: h.divider,
      }}
    >
      <Text
        style={{
          fontFamily: "Inter_500Medium",
          fontSize: HOME_M3_CHIP_FONT_PX,
          lineHeight: HOME_M3_CHIP_LINE_HEIGHT_PX,
          letterSpacing: HOME_M3_CHIP_LETTER_SPACING,
          color: primary,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
