import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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
  badgeLabel?: string;
  imageUrl?: string | null;
  gradient?: readonly [string, string, string];
};

/** M3 elevated card — featured verse on the home screen. */
export function HomeM3VerseCard({
  quote,
  reference,
  bundle,
  badgeLabel,
  imageUrl,
  gradient,
}: HomeM3VerseCardProps) {
  const h = bundle.home;
  const primary = bundle.chrome.tabTint;
  const hasImage = Boolean(imageUrl);
  const showPhotoChrome = hasImage || Boolean(gradient);

  return (
    <View
      style={{
        borderRadius: HOME_M3_CARD_RADIUS_PX,
        overflow: "hidden",
        backgroundColor: showPhotoChrome ? undefined : h.quoteCardBackground,
        borderWidth: showPhotoChrome ? 0 : 1,
        borderColor: h.quoteCardBorder,
        elevation: HOME_M3_CARD_ELEVATION_PX,
        shadowColor: h.quoteCardShadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
      }}
    >
      {gradient ? (
        <LinearGradient
          colors={[...gradient]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {hasImage ? (
        <Image
          source={{ uri: imageUrl! }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="disk"
          recyclingKey={imageUrl!}
          transition={0}
          accessibilityIgnoresInvertColors
        />
      ) : null}

      {showPhotoChrome ? (
        <LinearGradient
          colors={["rgba(26,22,15,0.08)", "rgba(26,22,15,0.52)", "rgba(26,22,15,0.82)"]}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <View style={{ padding: HOME_M3_CARD_PADDING_PX }}>
        {badgeLabel ? (
          <Text
            style={{
              marginBottom: 8,
              fontFamily: "Inter_600SemiBold",
              fontSize: 11,
              lineHeight: 14,
              color: "#e8dcc8",
              letterSpacing: 1.4,
              textTransform: "uppercase",
            }}
          >
            {badgeLabel}
          </Text>
        ) : null}
        <Text
          style={{
            fontFamily: "Lora_400Regular",
            fontSize: 32,
            lineHeight: 36,
            color: showPhotoChrome ? "#e8dcc8" : primary,
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
            color: showPhotoChrome ? "#f5f2ec" : h.quoteText,
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
            color: showPhotoChrome ? "#e8dcc8" : primary,
          }}
        >
          {reference}
        </Text>
      </View>
    </View>
  );
}
