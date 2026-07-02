import { useEffect, useRef } from "react";
import { Platform, View, Text, Pressable, ScrollView, type ViewStyle } from "react-native";
import { Link, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { useSbTabScreenPadding } from "@/lib/use-sb-bottom-padding";
import { registerTabScrollRef } from "@/lib/tab-scroll-to-top";
import { hapticLightImpact } from "@/lib/haptics";

/** Home hero CTA pill buttons (Read Scripture / Write a journal). */
const HOME_CTA = {
  width: 200,
  height: 56,
  paddingHorizontal: 18,
  /** Half of height — fully rounded capsule ends. */
  borderRadius: 28,
} as const;

const homeCtaShellStyle: ViewStyle = {
  alignSelf: "center",
  width: HOME_CTA.width,
  borderRadius: HOME_CTA.borderRadius,
  overflow: "hidden",
};

const homeCtaRowStyle: ViewStyle = {
  height: HOME_CTA.height,
  paddingHorizontal: HOME_CTA.paddingHorizontal,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  borderRadius: HOME_CTA.borderRadius,
};

export default function HomeScreen() {
  const { bundle } = useMobileAppTheme();
  const h = bundle.home;
  const insets = useSafeAreaInsets();
  const bottomPad = useSbTabScreenPadding(48);
  // Android native tabs can still overlay content in some SDK/device combos.
  // Add extra Home-only space so the bottom verse card is never clipped.
  const androidHomeBottomCompensation = Platform.OS === "android" ? insets.bottom + 46 : 0;
  const scrollRef = useRef<ScrollView | null>(null);

  const ctaShadow: ViewStyle = {
    shadowColor: h.ctaShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  };

  const homeCtaJournalFillStyle: ViewStyle = {
    backgroundColor: h.ctaSecondaryBackground,
    borderWidth: 1,
    borderColor: h.ctaSecondaryBorder,
  };

  useEffect(() => {
    return registerTabScrollRef("index", {
      scrollToOffset: ({ offset, animated = true }) => {
        scrollRef.current?.scrollTo({ y: offset, animated });
      },
    });
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      className="flex-1"
      style={{ backgroundColor: h.pageBackground }}
      contentContainerClassName="pb-8"
      contentContainerStyle={{ paddingBottom: bottomPad + androidHomeBottomCompensation }}
    >
      <View className="w-full max-w-[680px] self-center px-5">
        <View style={{ paddingTop: Math.max(20, insets.top) }} className="pb-3">
          <Text
            className="text-[12px] font-medium uppercase"
            style={{ fontFamily: "Inter_500Medium", letterSpacing: 3, color: h.eyebrowText }}
          >
            SINAG BIBLE
          </Text>
        </View>

        <View className="pt-1">
          <View className="mb-[22px] flex-row items-center gap-2.5">
            <View className="h-px w-8" style={{ backgroundColor: h.accent }} />
            <Text
              className="text-[11px] uppercase"
              style={{ fontFamily: "Inter_400Regular", letterSpacing: 2.6, color: h.accent }}
            >
              BIBLE · JOURNAL · REFLECTION
            </Text>
          </View>

          <Text
            className="text-[42px] font-normal leading-[1.15]"
            style={{ fontFamily: "Lora_400Regular" }}
          >
            <Text style={{ color: h.headline }}>Your Bible.</Text>
            {"\n"}
            <Text style={{ color: h.accent, fontStyle: "italic" }}>Your thoughts.</Text>
            {"\n"}
            <Text style={{ color: h.headline }}>One place.</Text>
          </Text>

          <Text
            className="mt-[14px] text-[15px] italic"
            style={{ fontFamily: "Lora_400Regular", color: h.tagline }}
          >
            Just you and the Word.
          </Text>

          <Text
            className="mt-[14px] leading-[1.7]"
            style={{ fontFamily: "Inter_400Regular", fontSize: 15, color: h.bodyText }}
          >
            Your personal place to pause with Scripture, reflect on God&apos;s word, and write the
            story of your faith as it grows each day.
          </Text>

          <View className="mt-7 gap-3">
            <Link href={"/reader" as Href} asChild onPress={() => hapticLightImpact()}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Read Scripture"
                style={({ pressed }) => [ctaShadow, homeCtaShellStyle, pressed && { opacity: 0.95 }]}
              >
                <LinearGradient
                  colors={[...h.ctaPrimaryGradient]}
                  locations={[0, 0.6, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={homeCtaRowStyle}
                >
                  <Text
                    className="text-[16px] tracking-[0.025em]"
                    style={{ fontFamily: "Lora_400Regular", color: h.ctaPrimaryText }}
                  >
                    Read Scripture
                  </Text>
                  <Text className="text-base" style={{ color: h.ctaPrimaryText }}>
                    →
                  </Text>
                </LinearGradient>
              </Pressable>
            </Link>

            <Link href={"/journal" as Href} asChild onPress={() => hapticLightImpact()}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Write a journal"
                style={({ pressed }) => [ctaShadow, homeCtaShellStyle, pressed && { opacity: 0.95 }]}
              >
                <View style={[homeCtaRowStyle, homeCtaJournalFillStyle]}>
                  <Text
                    className="text-[16px] tracking-[0.025em]"
                    style={{ fontFamily: "Lora_400Regular", color: h.ctaSecondaryText }}
                  >
                    Write a journal
                  </Text>
                  <Text className="text-base" style={{ color: h.ctaSecondaryText }}>
                    →
                  </Text>
                </View>
              </Pressable>
            </Link>
          </View>
        </View>

        <View
          className="relative mt-[30px] rounded-2xl border px-5 pb-5 pt-5"
          style={{
            backgroundColor: h.quoteCardBackground,
            borderColor: h.quoteCardBorder,
            shadowColor: h.quoteCardShadow,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.06,
            shadowRadius: 40,
            elevation: 3,
          }}
        >
          <Text className="mb-3 text-[28px]" style={{ fontFamily: "Lora_400Regular", color: h.accent }}>
            &ldquo;
          </Text>
          <Text
            className="text-[16px] italic leading-[1.6]"
            style={{ fontFamily: "Lora_400Regular", color: h.quoteText }}
          >
            Thy word is a lamp unto my feet, and a light unto my path.
          </Text>
          <Text
            className="mt-[14px] text-[11px] uppercase tracking-[0.2em]"
            style={{ fontFamily: "Inter_400Regular", color: h.accent }}
          >
            PSALM 119:105 · KJV
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
