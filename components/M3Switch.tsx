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

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [trackColorOff, trackColorOn]),
    borderColor: interpolateColor(progress.value, [0, 1], [trackBorderOff, trackColorOn]),
    borderWidth: interpolate(progress.value, [0, 1], [2, 0]),
  }));

  const handleStyle = useAnimatedStyle(() => {
    const size = interpolate(progress.value, [0, 1], [handleOff, handleOn]);
    const translateX = interpolate(
      progress.value,
      [0, 1],
      [inset, trackW - inset - handleOn],
    );
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      transform: [{ translateX }],
    };
  });

  const handleFillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [handleColorOff, handleColorOn]),
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
        <Animated.View style={[styles.handle, handleStyle, handleFillStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    justifyContent: "center",
    overflow: "hidden",
  },
  handle: {
    position: "absolute",
    left: 0,
  },
});
