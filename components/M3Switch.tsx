import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useEffect } from "react";

/** M3 switch track (52 × 32 dp). */
const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const HANDLE_SIZE_OFF = 16;
const HANDLE_SIZE_ON = 24;
const TRACK_INSET = 4;

const SPRING = { damping: 22, stiffness: 320, mass: 0.55 };

type M3SwitchProps = {
  value: boolean;
  onValueChange: () => void;
  accessibilityLabel?: string;
  scale?: number;
  trackColorOn?: string;
  trackColorOff?: string;
  trackBorderOff?: string;
  handleColorOn?: string;
  handleColorOff?: string;
  iconColorOn?: string;
};

export function M3Switch({
  value,
  onValueChange,
  accessibilityLabel = "Toggle",
  scale = 1,
  trackColorOn = "#6750A4",
  trackColorOff = "#ECE6F0",
  trackBorderOff = "#79747E",
  handleColorOn = "#FFFFFF",
  handleColorOff = "#49454F",
  iconColorOn = "#6750A4",
}: M3SwitchProps) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, SPRING);
  }, [progress, value]);

  const trackW = TRACK_WIDTH * scale;
  const trackH = TRACK_HEIGHT * scale;
  const inset = TRACK_INSET * scale;
  const handleOff = HANDLE_SIZE_OFF * scale;
  const handleOn = HANDLE_SIZE_ON * scale;
  const travel = trackW - inset * 2 - handleOff;

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [trackColorOff, trackColorOn]),
    borderColor: interpolateColor(progress.value, [0, 1], [trackBorderOff, trackColorOn]),
    borderWidth: interpolate(progress.value, [0, 1], [2, 0]),
  }));

  const handleStyle = useAnimatedStyle(() => {
    const size = interpolate(progress.value, [0, 1], [handleOff, handleOn]);
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      transform: [{ translateX: inset + progress.value * travel }],
    };
  });

  const handleFillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [handleColorOff, handleColorOn]),
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 0.4, 1], [0.4, 0.85, 1]) }],
  }));

  return (
    <Pressable
      onPress={onValueChange}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
    >
      <Animated.View style={[styles.track, { width: trackW, height: trackH, borderRadius: trackH / 2 }, trackStyle]}>
        <Animated.View style={[styles.handle, handleStyle, handleFillStyle]}>
          <Animated.View style={[styles.iconWrap, iconStyle]}>
            <Ionicons name="checkmark" size={14 * scale} color={iconColorOn} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    justifyContent: "center",
  },
  handle: {
    position: "absolute",
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
