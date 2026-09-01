import { useCallback, useState, type Ref } from "react";
import { Animated, Platform, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import Reanimated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { MaterialIcons } from "@expo/vector-icons";
import { animateM3PressScale } from "@/src/components/m3/m3-motion";
import {
  JOURNAL_M3_FAB_ELEVATION_PX,
  JOURNAL_M3_FAB_SIZE_PX,
} from "@/src/features/journal/journalFabChrome";

export type JournalM3ExpressiveFabProps = {
  onPress: () => void;
  accessibilityLabel: string;
  containerColor: string;
  onContainerColor: string;
  rippleColor: string;
  /** 0 = plus, 1 = close (45°). */
  iconOpenProgress: Animated.Value;
  buttonRef?: Ref<View>;
  style?: ViewStyle;
};

/**
 * M3 expressive medium FAB — circular `primaryContainer`, 80dp, 6dp elevation, ripple.
 * Android only; journal index keeps the gradient FAB on iOS.
 */
export function JournalM3ExpressiveFab({
  onPress,
  accessibilityLabel,
  containerColor,
  onContainerColor,
  rippleColor,
  iconOpenProgress,
  buttonRef,
  style,
}: JournalM3ExpressiveFabProps) {
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  const handlePressIn = useCallback(() => {
    setPressed(true);
    animateM3PressScale(scale, 0.94);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    setPressed(false);
    animateM3PressScale(scale, 1);
  }, [scale]);

  const iconRotate = iconOpenProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  if (Platform.OS !== "android") return null;

  const size = JOURNAL_M3_FAB_SIZE_PX;
  const elevationPx = pressed ? JOURNAL_M3_FAB_ELEVATION_PX + 6 : JOURNAL_M3_FAB_ELEVATION_PX;

  return (
    <View
      ref={buttonRef}
      collapsable={false}
      style={[
        styles.shadowHost,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          elevation: elevationPx,
        },
        style,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        android_ripple={{ color: rippleColor, borderless: false, radius: size / 2 }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: containerColor,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <Reanimated.View style={scaleStyle}>
          <Animated.View style={{ transform: [{ rotate: iconRotate }] }}>
            <MaterialIcons name="add" size={24} color={onContainerColor} />
          </Animated.View>
        </Reanimated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowHost: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.24,
    shadowRadius: 4,
    zIndex: 3,
  },
});
