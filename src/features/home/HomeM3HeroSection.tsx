import { Text, View } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { HomeM3AssistChip } from "@/src/features/home/HomeM3AssistChip";
import { HomeM3CtaButton } from "@/src/features/home/HomeM3CtaButton";
import {
  HOME_M3_BODY_FONT_PX,
  HOME_M3_BODY_LINE_HEIGHT_PX,
  HOME_M3_CTA_GAP_PX,
  HOME_M3_DISPLAY_FONT_PX,
  HOME_M3_DISPLAY_LINE_HEIGHT_PX,
  HOME_M3_EYEBROW_FONT_PX,
  HOME_M3_EYEBROW_LETTER_SPACING,
  HOME_M3_EYEBROW_LINE_HEIGHT_PX,
  HOME_M3_TITLE_FONT_PX,
  HOME_M3_TITLE_LINE_HEIGHT_PX,
} from "@/src/features/home/homeM3Chrome";

const HERO_CHIPS = ["Bible", "Journal", "Reflection"] as const;

export type HomeM3HeroSectionProps = {
  bundle: MobileAppThemeBundle;
  onReadScripture: () => void;
  onWriteJournal: () => void;
};

/** M3 hero — eyebrow, assist chips, display headline, body copy, and primary CTAs. */
export function HomeM3HeroSection({
  bundle,
  onReadScripture,
  onWriteJournal,
}: HomeM3HeroSectionProps) {
  const h = bundle.home;
  const primary = bundle.chrome.tabTint;

  return (
    <View>
      <Text
        style={{
          fontFamily: "Inter_500Medium",
          fontSize: HOME_M3_EYEBROW_FONT_PX,
          lineHeight: HOME_M3_EYEBROW_LINE_HEIGHT_PX,
          letterSpacing: HOME_M3_EYEBROW_LETTER_SPACING,
          color: h.eyebrowText,
          textTransform: "uppercase",
        }}
      >
        Sinag Bible
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
        {HERO_CHIPS.map((chip) => (
          <HomeM3AssistChip key={chip} label={chip} bundle={bundle} />
        ))}
      </View>

      <Text
        accessibilityRole="header"
        style={{
          marginTop: 20,
          fontFamily: "Lora_400Regular",
          fontSize: HOME_M3_DISPLAY_FONT_PX,
          lineHeight: HOME_M3_DISPLAY_LINE_HEIGHT_PX,
        }}
      >
        <Text style={{ color: h.headline }}>Your Bible.</Text>
        {"\n"}
        <Text style={{ color: primary, fontStyle: "italic" }}>Your thoughts.</Text>
        {"\n"}
        <Text style={{ color: h.headline }}>One place.</Text>
      </Text>

      <Text
        style={{
          marginTop: 12,
          fontFamily: "Lora_400Regular",
          fontSize: HOME_M3_TITLE_FONT_PX,
          lineHeight: HOME_M3_TITLE_LINE_HEIGHT_PX,
          fontStyle: "italic",
          color: h.tagline,
        }}
      >
        Just you and the Word.
      </Text>

      <Text
        style={{
          marginTop: 12,
          fontFamily: "Inter_400Regular",
          fontSize: HOME_M3_BODY_FONT_PX,
          lineHeight: HOME_M3_BODY_LINE_HEIGHT_PX,
          color: h.bodyText,
        }}
      >
        Your personal place to pause with Scripture, reflect on God&apos;s word, and write the
        story of your faith as it grows each day.
      </Text>

      <View style={{ marginTop: 24, gap: HOME_M3_CTA_GAP_PX }}>
        <HomeM3CtaButton
          label="Read Scripture"
          icon="menu-book"
          variant="filled"
          bundle={bundle}
          onPress={onReadScripture}
        />
        <HomeM3CtaButton
          label="Write a journal"
          icon="edit-note"
          variant="tonal"
          bundle={bundle}
          onPress={onWriteJournal}
        />
      </View>
    </View>
  );
}
