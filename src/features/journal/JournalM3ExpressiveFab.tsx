import { useCallback, useRef, type Ref } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
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
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const elevationAnim = useRef(new Animated.Value(JOURNAL_M3_FAB_ELEVATION_PX)).current;

  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.94,
        friction: 8,
        tension: 320,
        useNativeDriver: true,
      }),
      Animated.timing(elevationAnim, {
        toValue: JOURNAL_M3_FAB_ELEVATION_PX + 6,
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
        toValue: JOURNAL_M3_FAB_ELEVATION_PX,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [elevationAnim, scaleAnim]);

  const iconRotate = iconOpenProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  if (Platform.OS !== "android") return null;

  const size = JOURNAL_M3_FAB_SIZE_PX;

  return (
    <Animated.View
      ref={buttonRef}
      collapsable={false}
      style={[
        styles.shadowHost,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          elevation: elevationAnim,
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
        <Animated.View style={{ transform: [{ scale: scaleAnim }, { rotate: iconRotate }] }}>
          <MaterialIcons name="add" size={24} color={onContainerColor} />
        </Animated.View>
      </Pressable>
    </Animated.View>
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
