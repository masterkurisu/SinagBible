import { useEffect, useRef } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet } from "react-native";

const TOGGLE_ON_ICON = require("../assets/icons/toggle-on.png");
const TOGGLE_OFF_ICON = require("../assets/icons/toggle-off-outlined.png");

const DEFAULT_TOGGLE_SIZE = 54;

type HapticFeedbackToggleProps = {
  enabled: boolean;
  onToggle: () => void;
  accessibilityLabel?: string;
  size?: number;
  color?: string;
};

export function HapticFeedbackToggle({
  enabled,
  onToggle,
  accessibilityLabel = "Haptic Feedback",
  size = DEFAULT_TOGGLE_SIZE,
  color = "#ffffff",
}: HapticFeedbackToggleProps) {
  const progress = useRef(new Animated.Value(enabled ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: enabled ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enabled, progress]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.9,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        speed: 22,
        bounciness: 7,
        useNativeDriver: true,
      }),
    ]).start();
    onToggle();
  };

  const offOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const onOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const iconStyle = { width: size, height: size, tintColor: color as string };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={styles.pressable}
    >
      <Animated.View style={{ width: size, height: size, transform: [{ scale }] }}>
        <Animated.View style={[styles.layer, { opacity: offOpacity }]}>
          <Image
            source={TOGGLE_OFF_ICON}
            style={iconStyle}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
        <Animated.View style={[styles.layer, { opacity: onOpacity }]}>
          <Image
            source={TOGGLE_ON_ICON}
            style={iconStyle}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: "flex-end",
  },
  layer: {
    position: "absolute",
    top: 0,
    right: 0,
    width: "100%",
    height: "100%",
  },
});
