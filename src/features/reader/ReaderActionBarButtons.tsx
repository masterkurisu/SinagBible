import { useCallback, useRef, type ReactNode, type Ref } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { hapticLightImpact } from "@/lib/haptics";
import { ReaderM3IconButton } from "@/src/features/reader/ReaderM3IconButton";
import {
  READER_M3_ICON_BUTTON_RIPPLE,
  READER_M3_ON_SURFACE_VARIANT,
} from "@/src/features/reader/readerSettingsPanelChrome";
import { READER_ACTION_BAR_BUTTON_PX } from "@/src/features/reader/readerActionBarOnboardingSteps";

type ReaderActionBarIconButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  buttonRef?: Ref<View>;
  style?: ViewStyle;
  children: ReactNode;
};

/** M3 standard icon button on Android; compact circular press on iOS. */
export function ReaderActionBarIconButton({
  onPress,
  accessibilityLabel,
  buttonRef,
  style,
  children,
}: ReaderActionBarIconButtonProps) {
  if (Platform.OS === "android") {
    return (
      <ReaderM3IconButton
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        buttonRef={buttonRef}
        style={style}
        suppressHaptic
        spinOnPress={false}
      >
        {children}
      </ReaderM3IconButton>
    );
  }

  return (
    <View ref={buttonRef} collapsable={false} style={[{ width: READER_ACTION_BAR_BUTTON_PX, height: READER_ACTION_BAR_BUTTON_PX }, style]}>
      <TouchableOpacity
        onPress={() => {
          hapticLightImpact();
          onPress();
        }}
        accessibilityLabel={accessibilityLabel}
        className="rounded-full items-center justify-center"
        style={{ width: READER_ACTION_BAR_BUTTON_PX, height: READER_ACTION_BAR_BUTTON_PX }}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    </View>
  );
}

type ReaderActionBarJournalButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  containerColor: string;
  rippleColor: string;
  buttonRef?: Ref<View>;
  style?: ViewStyle;
  children: ReactNode;
};

/** Trailing journal action — M3 primary-filled circular button at the right end of the toolbar. */
export function ReaderActionBarJournalButton({
  onPress,
  accessibilityLabel,
  containerColor,
  rippleColor,
  buttonRef,
  style,
  children,
}: ReaderActionBarJournalButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const size = READER_ACTION_BAR_BUTTON_PX;

  const handlePress = useCallback(() => {
    hapticLightImpact();
    onPress();
  }, [onPress]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
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

  if (Platform.OS === "android") {
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
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>{children}</Animated.View>
        </Pressable>
      </View>
    );
  }

  return (
    <View ref={buttonRef} collapsable={false} style={[{ width: size, height: size }, style]}>
      <TouchableOpacity
        onPress={handlePress}
        accessibilityLabel={accessibilityLabel}
        className="rounded-full items-center justify-center"
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: containerColor,
        }}
        activeOpacity={0.85}
      >
        {children}
      </TouchableOpacity>
    </View>
  );
}

export { READER_M3_ON_SURFACE_VARIANT, READER_M3_ICON_BUTTON_RIPPLE };
