import { StyleSheet, View } from "react-native";
import { usePathname } from "expo-router";
import Reanimated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { getReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import { mixHexColors } from "@/lib/mix-hex-color";
import { tabHapticKeyFromPathname } from "@/lib/tab-route-key";
import { TabBarSearchFab } from "@/src/features/search/TabBarSearchFab";
import { androidBottomNavChromeHideSlidePx } from "@/src/features/search/tabBarSearchFabChrome";

/** True when the active reader tab is showing a chapter (not the redirect index). */
function isReaderChapterRoute(pathname: string | null): boolean {
  if (pathname == null || pathname === "") return false;
  const parts = pathname.split("/").filter(Boolean);
  let i = 0;
  if (parts[0] === "(tabs)") i = 1;
  if (parts[i] !== "reader") return false;
  const afterReader = parts.slice(i + 1);
  return afterReader.length >= 2 && afterReader[0] !== "index";
}

type ReaderBottomNavSlideChromeProps = {
  tabBarSlideProgressSV: SharedValue<number>;
  slideOverlayActive: boolean;
  /** Native tab is hidden — slide chrome replaces it for the transition. */
  nativeTabBarHidden: boolean;
  settingsTabBarTint: number;
  tabBarInteractionHidden: boolean;
};

/**
 * Android reader: one translateY on a full-height bottom chrome panel + FAB.
 * The panel spans the FAB and nav strip so nothing visually leads during the slide.
 */
export function ReaderBottomNavSlideChrome({
  tabBarSlideProgressSV,
  slideOverlayActive,
  nativeTabBarHidden,
  settingsTabBarTint,
  tabBarInteractionHidden,
}: ReaderBottomNavSlideChromeProps) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { bundle } = useMobileAppTheme();
  const sheetChrome = getReaderSheetChrome(bundle);

  const onReaderChapter =
    Platform.OS === "android" &&
    tabHapticKeyFromPathname(pathname) === "reader" &&
    isReaderChapterRoute(pathname);

  const slideChromeHeight = androidBottomNavChromeHideSlidePx(insets.bottom);
  const tabBarSurface = mixHexColors(
    bundle.reader.sceneSurface,
    sheetChrome.settingsPanelBackground,
    settingsTabBarTint,
  );

  const slideAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabBarSlideProgressSV.value * slideChromeHeight }],
  }));

  if (!onReaderChapter) return null;

  /** Full panel while native is hidden — one rigid block slides with the FAB. */
  const showSlidePanel = nativeTabBarHidden || slideOverlayActive;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Reanimated.View
        pointerEvents="box-none"
        style={[
          styles.slideHost,
          {
            height: slideChromeHeight,
          },
          slideAnimatedStyle,
        ]}
      >
        {showSlidePanel ? (
          <View
            pointerEvents="none"
            style={[
              styles.slidePanel,
              {
                height: slideChromeHeight,
                backgroundColor: tabBarSurface,
              },
            ]}
          />
        ) : null}
        <TabBarSearchFab tabBarInteractionHidden={tabBarInteractionHidden} />
      </Reanimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slideHost: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 170,
    elevation: 17,
  },
  slidePanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});
