import { useEffect, useRef } from "react";
import { Platform, View, Text, TouchableOpacity, ScrollView, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { useSbTabScreenPadding } from "@/lib/use-sb-bottom-padding";
import { registerTabScrollRef } from "@/lib/tab-scroll-to-top";
import { hapticLightImpact } from "@/lib/haptics";

const ctaRowClass =
  "flex-row h-14 w-full max-w-[300px] self-center items-center justify-between rounded-full px-6";

const ctaShadow: ViewStyle = {
  shadowColor: "#242423",
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 4,
};

function FeatureIconDoc() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M8 3H14L19 8V21H8C6.9 21 6 20.1 6 19V5C6 3.9 6.9 3 8 3Z"
        stroke="#5C4F3A"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M14 3V8H19" stroke="#5C4F3A" strokeWidth={1.5} />
      <Path d="M9 12H16" stroke="#5C4F3A" strokeWidth={1.5} />
      <Path d="M9 16H14" stroke="#5C4F3A" strokeWidth={1.5} />
    </Svg>
  );
}

function FeatureIconHome() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M3 10.5L12 3L21 10.5"
        stroke="#5C4F3A"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M6 9.5V20H18V9.5"
        stroke="#5C4F3A"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function FeatureIconPrivate() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Circle cx="12" cy="12" r="9" stroke="#5C4F3A" strokeWidth={1.5} fill="none" />
      <Path d="M12 10V16" stroke="#5C4F3A" strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx="12" cy="7.5" r="1" fill="#5C4F3A" />
    </Svg>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPad = useSbTabScreenPadding(48);
  // Android native tabs can still overlay content in some SDK/device combos.
  // Add extra Home-only space so the bottom verse card is never clipped.
  const androidHomeBottomCompensation = Platform.OS === "android" ? insets.bottom + 46 : 0;
  const scrollRef = useRef<ScrollView | null>(null);

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
      className="flex-1 bg-parchment-canvas"
      contentContainerClassName="pb-8"
      contentContainerStyle={{ paddingBottom: bottomPad + androidHomeBottomCompensation }}
    >
      <View className="w-full max-w-[680px] self-center px-5">
        <View style={{ paddingTop: Math.max(20, insets.top) }} className="pb-3">
          <Text
            className="text-[12px] font-medium uppercase text-brown-500"
            style={{ fontFamily: "Inter_500Medium", letterSpacing: 3 }}
          >
            SINAG BIBLE
          </Text>
        </View>

        <View className="pb-6 pt-1">
          <View className="mb-[22px] flex-row items-center gap-2.5">
            <View className="h-px w-8 bg-gold" />
            <Text
              className="text-[11px] uppercase text-gold"
              style={{ fontFamily: "Inter_400Regular", letterSpacing: 2.6 }}
            >
              BIBLE · JOURNAL · REFLECTION
            </Text>
          </View>

          <Text
            className="text-[42px] font-normal leading-[1.15]"
            style={{ fontFamily: "Lora_400Regular" }}
          >
            <Text className="text-brown-800">Your Bible.</Text>
            {"\n"}
            <Text className="text-gold" style={{ fontStyle: "italic" }}>
              Your thoughts.
            </Text>
            {"\n"}
            <Text className="text-brown-800">One place.</Text>
          </Text>

          <Text
            className="mt-[14px] text-[15px] italic text-brown-500"
            style={{ fontFamily: "Lora_400Regular" }}
          >
            Just you and the Word.
          </Text>

          <Text
            className="mt-[14px] text-tan-300 leading-[1.7]"
            style={{ fontFamily: "Inter_400Regular", fontSize: 15 }}
          >
            Your personal place to pause with Scripture, reflect on God&apos;s word, and write the
            story of your faith as it grows each day.
          </Text>

          <View className="mb-8 mt-7 gap-3">
            <TouchableOpacity
              style={[ctaShadow, { borderRadius: 9999, alignSelf: "center", maxWidth: 300, width: "100%" }]}
              activeOpacity={0.95}
              onPress={() => {
                hapticLightImpact();
                router.push("/reader");
              }}
            >
              <LinearGradient
                colors={["#4A3826", "#2C2416", "#1A160F"]}
                locations={[0, 0.6, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 9999,
                  height: 56,
                  paddingHorizontal: 24,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  className="text-[16px] tracking-[0.025em] text-cream"
                  style={{ fontFamily: "Lora_400Regular" }}
                >
                  Read Scripture
                </Text>
                <Text className="text-cream text-base">→</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              className={`${ctaRowClass} border border-white bg-parchment`}
              style={ctaShadow}
              activeOpacity={0.95}
              onPress={() => {
                hapticLightImpact();
                router.push("/journal");
              }}
            >
              <Text
                className="text-[16px] tracking-[0.025em] text-brown-800"
                style={{ fontFamily: "Lora_400Regular" }}
              >
                Write a journal
              </Text>
              <Text className="text-brown-800 text-base">→</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="mb-6 h-px bg-[#ddd8ce]" />

        <View className="pb-8">
          <View className="gap-5">
            <View className="flex-row items-start gap-3">
              <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone">
                <FeatureIconDoc />
              </View>
              <View className="flex-1">
                <Text
                  className="text-[15px] font-medium text-brown-800"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Inline verse notes
                </Text>
                <Text className="mt-[3px] text-[13px] leading-5 text-muted" style={{ fontFamily: "Inter_400Regular" }}>
                  Tap any verse to add a thought directly beneath it.
                </Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3">
              <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone">
                <FeatureIconHome />
              </View>
              <View className="flex-1">
                <Text
                  className="text-[15px] font-medium text-brown-800"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Anchored journal entries
                </Text>
                <Text className="mt-[3px] text-[13px] leading-5 text-muted" style={{ fontFamily: "Inter_400Regular" }}>
                  Journal reflections tied directly to the passage that moved you.
                </Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3">
              <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone">
                <FeatureIconPrivate />
              </View>
              <View className="flex-1">
                <Text
                  className="text-[15px] font-medium text-brown-800"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  Completely private
                </Text>
                <Text className="mt-[3px] text-[13px] leading-5 text-muted" style={{ fontFamily: "Inter_400Regular" }}>
                  Journal, highlights, and notes stay on this device. On the web, accounts sync the journal only.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View
          className="relative my-8 rounded-2xl border border-[#ddd8ce]/80 px-5 pb-5 pt-5 bg-quotetone"
          style={{
            shadowColor: "#2c2416",
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.06,
            shadowRadius: 40,
            elevation: 3,
          }}
        >
          <Text className="mb-3 text-[28px] text-gold" style={{ fontFamily: "Lora_400Regular" }}>
            &ldquo;
          </Text>
          <Text className="text-[16px] italic leading-[1.6] text-[#2C2416]" style={{ fontFamily: "Lora_400Regular" }}>
            Thy word is a lamp unto my feet, and a light unto my path.
          </Text>
          <Text
            className="mt-[14px] text-[11px] uppercase tracking-[0.2em] text-gold"
            style={{ fontFamily: "Inter_400Regular" }}
          >
            PSALM 119:105 · KJV
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
