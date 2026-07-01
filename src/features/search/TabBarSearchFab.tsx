import { useCallback, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { hapticLightImpact } from "@/lib/haptics";
import { useTabBarSearch } from "@/lib/tab-bar-search-context";
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

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const elevationAnim = useRef(new Animated.Value(TAB_BAR_SEARCH_FAB_ELEVATION_PX)).current;

  const handlePress = useCallback(() => {
    hapticLightImpact();
    if (isOpen) {
      closeSearch();
    } else {
      openSearch();
    }
  }, [closeSearch, isOpen, openSearch]);

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.94,
        friction: 8,
        tension: 320,
        useNativeDriver: true,
      }),
      Animated.timing(elevationAnim, {
        toValue: TAB_BAR_SEARCH_FAB_ELEVATION_PX + 4,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [elevationAnim, scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 220,
        useNativeDriver: true,
      }),
      Animated.timing(elevationAnim, {
        toValue: TAB_BAR_SEARCH_FAB_ELEVATION_PX,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [elevationAnim, scaleAnim]);

  if (isOpen) {
    return null;
  }

  const size = TAB_BAR_SEARCH_FAB_SIZE_PX;
  const containerColor = isAndroid ? chrome.androidIndicator : searchTheme.cardBackground;
  const iconColor = searchTheme.bodyText;
  const rippleColor = isAndroid ? chrome.androidRipple : "rgba(0,0,0,0.08)";

  return (
    <Animated.View
      pointerEvents={tabBarInteractionHidden ? "none" : "box-none"}
      style={[
        styles.host,
        {
          left: tabBarSearchFabLeftPx(screenW),
          bottom: tabBarSearchFabBottomPx(insets.bottom),
          width: size,
          height: size,
          borderRadius: size / 2,
          elevation: isAndroid ? elevationAnim : undefined,
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
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <MaterialCommunityIcons name="magnify" size={TAB_BAR_SEARCH_FAB_ICON_PX} color={iconColor} />
        </Animated.View>
      </Pressable>
    </Animated.View>
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
