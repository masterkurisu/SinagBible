import { useCallback, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { hapticLightImpact } from "@/lib/haptics";
import { useTabBarSearch } from "@/lib/tab-bar-search-context";
import { M3_SPRING_FAST_SPATIAL } from "@/src/components/m3/m3-motion";
import {
  TAB_BAR_SEARCH_FAB_ELEVATION_PX,
  TAB_BAR_SEARCH_FAB_ICON_PX,
  TAB_BAR_SEARCH_FAB_SIZE_PX,
  tabBarSearchFabBottomPx,
  tabBarSearchFabLeftPx,
} from "@/src/features/search/tabBarSearchFabChrome";

export type TabBarSearchFabProps = {
  /** Disable taps while the tab bar is scroll-hidden or mid-slide. */
  tabBarInteractionHidden?: boolean;
  style?: ViewStyle;
};

/** Large circular search control — sits in the fourth bottom-nav slot (M3 expressive). */
export function TabBarSearchFab({
  tabBarInteractionHidden = false,
  style,
}: TabBarSearchFabProps) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { bundle } = useMobileAppTheme();
  const { isOpen, openSearch, closeSearch } = useTabBarSearch();
  const chrome = bundle.chrome;
  const searchTheme = bundle.search;
  const isAndroid = Platform.OS === "android";

  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    hapticLightImpact();
    if (isOpen) {
      closeSearch();
    } else {
      openSearch();
    }
  }, [closeSearch, isOpen, openSearch]);

  const handlePressIn = useCallback(() => {
    setPressed(true);
    scale.value = withSpring(0.94, M3_SPRING_FAST_SPATIAL);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    setPressed(false);
    scale.value = withSpring(1, M3_SPRING_FAST_SPATIAL);
  }, [scale]);

  if (isOpen) {
    return null;
  }

  const size = TAB_BAR_SEARCH_FAB_SIZE_PX;
  const containerColor = isAndroid ? chrome.androidIndicator : searchTheme.cardBackground;
  const iconColor = searchTheme.bodyText;
  const rippleColor = isAndroid ? chrome.androidRipple : "rgba(0,0,0,0.08)";
  const elevationPx = pressed
    ? TAB_BAR_SEARCH_FAB_ELEVATION_PX + 4
    : TAB_BAR_SEARCH_FAB_ELEVATION_PX;

  return (
    <Reanimated.View
      pointerEvents={tabBarInteractionHidden ? "none" : "box-none"}
      style={[
        styles.host,
        {
          left: tabBarSearchFabLeftPx(screenW),
          bottom: tabBarSearchFabBottomPx(insets.bottom),
          width: size,
          height: size,
          borderRadius: size / 2,
          elevation: isAndroid ? elevationPx : undefined,
        },
        style,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel="Search"
        android_ripple={{ color: rippleColor, borderless: false, radius: size / 2 }}
        style={[
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: containerColor,
          },
          !isAndroid
            ? {
                borderWidth: 1,
                borderColor: searchTheme.searchBarBorder,
                shadowColor: "#242423",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.22,
                shadowRadius: 8,
              }
            : null,
        ]}
      >
        <Reanimated.View style={scaleStyle}>
          <MaterialCommunityIcons name="magnify" size={TAB_BAR_SEARCH_FAB_ICON_PX} color={iconColor} />
        </Reanimated.View>
      </Pressable>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    zIndex: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
