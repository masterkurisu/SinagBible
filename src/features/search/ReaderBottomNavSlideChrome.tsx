import { StyleSheet, View, Platform } from "react-native";
import { usePathname } from "expo-router";
import Reanimated, {
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { getReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import { mixHexColors } from "@/lib/mix-hex-color";
import { tabHapticKeyFromPathname } from "@/lib/tab-route-key";
import { TabBarSearchFab } from "@/src/features/search/TabBarSearchFab";
import { androidBottomNavChromeHideSlidePx } from "@/src/features/search/tabBarSearchFabChrome";
import {
  M3_MOTION_DURATION_SHORT3_MS,
  M3_STANDARD_DECELERATE_REANIMATED,
} from "@/src/components/m3/m3-motion";

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
 * Android reader: opacity cross-fade on a full-height bottom chrome panel + FAB.
 * Same execution as the header title's scroll-driven fade — `tabBarSlideProgressSV`
 * is a plain 0–1 value assigned directly every frame (no timing curve), so the panel
 * tracks the scroll gesture 1:1 instead of sliding on its own animation clock.
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

  const fadeAnimatedStyle = useAnimatedStyle(() => ({
    // Chase the raw scroll-driven target with a short tween instead of snapping to it
    // every scroll sample. Scroll events land at a fixed sampling rate regardless of
    // display refresh, so this lets Reanimated fill in the gaps with real interpolated
    // frames — the higher the panel's refresh rate (90/120Hz), the more of those extra
    // frames get rendered, making the cross-fade read as smoother rather than faster.
    opacity: withTiming(1 - tabBarSlideProgressSV.value, {
      duration: M3_MOTION_DURATION_SHORT3_MS,
      easing: M3_STANDARD_DECELERATE_REANIMATED,
    }),
  }));

  if (!onReaderChapter) return null;

  /** Full panel while native is hidden — one rigid block fades with the FAB. */
  const showSlidePanel = nativeTabBarHidden || slideOverlayActive;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Reanimated.View
        pointerEvents="box-none"
        // Android: without this, animating opacity on a view whose own/child elevation shadow
        // is composited separately renders the shadow as a faceted octagon mid-fade instead of
        // a smooth circle — https://github.com/facebook/react-native/issues/23090
        needsOffscreenAlphaCompositing={Platform.OS === "android"}
        style={[
          styles.slideHost,
          {
            height: slideChromeHeight,
          },
          fadeAnimatedStyle,
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
