import { Text, View } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import {
  HOME_M3_BODY_FONT_PX,
  HOME_M3_BODY_LINE_HEIGHT_PX,
  HOME_M3_CARD_ELEVATION_PX,
  HOME_M3_CARD_PADDING_PX,
  HOME_M3_CARD_RADIUS_PX,
  HOME_M3_REFERENCE_FONT_PX,
  HOME_M3_REFERENCE_LETTER_SPACING,
  HOME_M3_REFERENCE_LINE_HEIGHT_PX,
} from "@/src/features/home/homeM3Chrome";

export type HomeM3VerseCardProps = {
  quote: string;
  reference: string;
  bundle: MobileAppThemeBundle;
};

/** M3 elevated card — featured verse on the home screen. */
export function HomeM3VerseCard({ quote, reference, bundle }: HomeM3VerseCardProps) {
  const h = bundle.home;
  const primary = bundle.chrome.tabTint;

  return (
    <View
      style={{
        borderRadius: HOME_M3_CARD_RADIUS_PX,
        padding: HOME_M3_CARD_PADDING_PX,
        backgroundColor: h.quoteCardBackground,
        borderWidth: 1,
        borderColor: h.quoteCardBorder,
        elevation: HOME_M3_CARD_ELEVATION_PX,
        shadowColor: h.quoteCardShadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
      }}
    >
      <Text
        style={{
          fontFamily: "Lora_400Regular",
          fontSize: 32,
          lineHeight: 36,
          color: primary,
          marginBottom: 8,
        }}
        accessibilityElementsHidden
      >
        &ldquo;
      </Text>
      <Text
        style={{
          fontFamily: "Lora_400Regular",
          fontSize: HOME_M3_BODY_FONT_PX,
          lineHeight: HOME_M3_BODY_LINE_HEIGHT_PX,
          fontStyle: "italic",
          color: h.quoteText,
        }}
      >
        {quote}
      </Text>
      <Text
        style={{
          marginTop: 12,
          fontFamily: "Inter_500Medium",
          fontSize: HOME_M3_REFERENCE_FONT_PX,
          lineHeight: HOME_M3_REFERENCE_LINE_HEIGHT_PX,
          letterSpacing: HOME_M3_REFERENCE_LETTER_SPACING,
          color: primary,
        }}
      >
        {reference}
      </Text>
    </View>
  );
}
