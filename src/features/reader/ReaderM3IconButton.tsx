import { useCallback, useEffect, useRef, type ReactNode, type Ref } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { hapticLightImpact } from "@/lib/haptics";
import {
  READER_M3_APP_BAR_ICON_BUTTON_PX,
  READER_M3_ICON_BUTTON_RIPPLE,
  READER_M3_SURFACE_CONTAINER,
} from "@/src/features/reader/readerSettingsPanelChrome";

export type ReaderM3IconButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityState?: { expanded?: boolean; selected?: boolean };
  selected?: boolean;
  rippleColor?: string;
  /** Increment to play a brief spin (e.g. after async work). */
  spinNonce?: number;
  /** Brief spin on each press — M3 busy feedback when opening panels. */
  spinOnPress?: boolean;
  /** Skip haptic when the parent `onPress` already fires one. */
  suppressHaptic?: boolean;
  hitSlop?: { top: number; right: number; bottom: number; left: number };
  buttonRef?: Ref<View>;
  style?: ViewStyle;
  children: ReactNode;
};

/**
 * M3 standard icon button — ripple, press scale, selected container, optional spin.
 * Android only; iOS callers should use their own Pressable chrome.
 */
export function ReaderM3IconButton({
  onPress,
  accessibilityLabel,
  accessibilityState,
  selected = false,
  rippleColor = READER_M3_ICON_BUTTON_RIPPLE,
  spinNonce = 0,
  spinOnPress = true,
  suppressHaptic = false,
  hitSlop = { top: 4, right: 4, bottom: 4, left: 4 },
  buttonRef,
  style,
  children,
}: ReaderM3IconButtonProps) {
  const selectedAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    Animated.spring(selectedAnim, {
      toValue: selected ? 1 : 0,
      friction: 8,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [selected, selectedAnim]);

  const playSpin = useCallback(() => {
    spinLoopRef.current?.stop();
    spinAnim.setValue(0);
    spinLoopRef.current = Animated.timing(spinAnim, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    spinLoopRef.current.start(({ finished }) => {
      if (finished) spinAnim.setValue(0);
    });
  }, [spinAnim]);

  useEffect(() => {
    if (spinNonce === 0) return;
    playSpin();
  }, [playSpin, spinNonce]);

  useEffect(() => () => spinLoopRef.current?.stop(), []);

  const handlePress = useCallback(() => {
    if (!suppressHaptic) hapticLightImpact();
    if (spinOnPress) playSpin();
    onPress();
  }, [onPress, playSpin, spinOnPress, suppressHaptic]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      friction: 8,
      tension: 320,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const selectedBgOpacity = selectedAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const busyRotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  if (Platform.OS !== "android") return null;

  const size = READER_M3_APP_BAR_ICON_BUTTON_PX;

  return (
    <View
      ref={buttonRef}
      collapsable={false}
      style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        android_ripple={{ color: rippleColor, borderless: true, radius: size / 2 }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: size / 2,
              backgroundColor: READER_M3_SURFACE_CONTAINER,
              opacity: selectedBgOpacity,
            },
          ]}
        />
        <Animated.View style={{ transform: [{ scale: scaleAnim }, { rotate: busyRotation }] }}>
          {children}
        </Animated.View>
      </Pressable>
    </View>
  );
}
