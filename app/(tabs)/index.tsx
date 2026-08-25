import { useCallback } from "react";
import { Platform, ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { useSbTabScreenPadding } from "@/lib/use-sb-bottom-padding";
import { hapticLightImpact } from "@/lib/haptics";
import { loadReaderLastPosition, peekReaderLastPosition } from "@/lib/reader-last-position";
import { READER_INTERNAL_NO_STACK_ANIMATION } from "@/lib/reader-hub-navigation";
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

  const navigateWithHaptic = useCallback(
    (href: Href) => {
      hapticLightImpact();
      router.navigate(href);
    },
    [router],
  );

  const openReader = useCallback(() => {
    hapticLightImpact();
    const cached = peekReaderLastPosition();
    if (cached) {
      router.navigate(
        `/reader/${cached.bookSlug}/${cached.chapter}?translation=${encodeURIComponent(cached.translationId)}&${READER_INTERNAL_NO_STACK_ANIMATION}=1` as Href,
      );
      return;
    }
    void loadReaderLastPosition().then((saved) => {
      if (saved) {
        router.navigate(
          `/reader/${saved.bookSlug}/${saved.chapter}?translation=${encodeURIComponent(saved.translationId)}&${READER_INTERNAL_NO_STACK_ANIMATION}=1` as Href,
        );
      } else {
        router.navigate("/reader" as Href);
      }
    });
  }, [router]);

  return (
    <View className="flex-1" style={{ backgroundColor: h.pageBackground }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: bottomPad + androidHomeBottomCompensation,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          className="w-full max-w-[680px] self-center"
          style={{ paddingHorizontal: HOME_M3_HORIZONTAL_PADDING_PX }}
        >
          <View style={{ paddingTop: Math.max(10, insets.top) }}>
            <HomeM3HeroSection
              bundle={bundle}
              onReadScripture={openReader}
              onWriteJournal={() => navigateWithHaptic("/journal")}
            />
          </View>

          <View style={{ marginTop: HOME_M3_VERSE_CARD_TOP_GAP_PX }}>
            <HomeM3DailyVerseCard bundle={bundle} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
