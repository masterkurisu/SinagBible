import { useEffect, useRef, useCallback } from "react";
import { Platform, ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { useSbTabScreenPadding } from "@/lib/use-sb-bottom-padding";
import { registerTabScrollRef } from "@/lib/tab-scroll-to-top";
import { hapticLightImpact } from "@/lib/haptics";
import { HomeM3HeroSection } from "@/src/features/home/HomeM3HeroSection";
import { HomeM3DailyVerseCard } from "@/src/features/home/HomeM3DailyVerseCard";
import {
  HOME_M3_HORIZONTAL_PADDING_PX,
  HOME_M3_VERSE_CARD_TOP_GAP_PX,
} from "@/src/features/home/homeM3Chrome";

export default function HomeScreen() {
  const { bundle } = useMobileAppTheme();
  const h = bundle.home;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPad = useSbTabScreenPadding(48);
  const androidHomeBottomCompensation = Platform.OS === "android" ? insets.bottom + 46 : 0;
  const scrollRef = useRef<ScrollView | null>(null);

  const navigateWithHaptic = useCallback(
    (href: Href) => {
      hapticLightImpact();
      router.push(href);
    },
    [router],
  );

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
      <View
        className="w-full max-w-[680px] self-center"
        style={{ paddingHorizontal: HOME_M3_HORIZONTAL_PADDING_PX }}
      >
        <View style={{ paddingTop: Math.max(20, insets.top) }}>
          <HomeM3HeroSection
            bundle={bundle}
            onReadScripture={() => navigateWithHaptic("/reader")}
            onWriteJournal={() => navigateWithHaptic("/journal")}
          />
        </View>

        <View style={{ marginTop: HOME_M3_VERSE_CARD_TOP_GAP_PX }}>
          <HomeM3DailyVerseCard bundle={bundle} />
        </View>
      </View>
    </ScrollView>
  );
}
