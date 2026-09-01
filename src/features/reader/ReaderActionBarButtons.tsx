import { useCallback, useRef, type ReactNode, type RefObject } from "react";
import {
  Platform,
  Pressable,
  TouchableOpacity,
  View,
  type LayoutRectangle,
  type ViewStyle,
} from "react-native";
import Reanimated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { hapticLightImpact, hapticSoftPop } from "@/lib/haptics";
import { animateM3PressScale } from "@/src/components/m3/m3-motion";
import { measureOnboardingTarget } from "@/src/components/feature-onboarding/measureOnboardingTarget";
import { ReaderM3IconButton } from "@/src/features/reader/ReaderM3IconButton";
import {
  READER_M3_ICON_BUTTON_RIPPLE,
  READER_M3_ON_SURFACE_VARIANT,
} from "@/src/features/reader/readerSettingsPanelChrome";
import { READER_ACTION_BAR_BUTTON_PX } from "@/src/features/reader/readerActionBarOnboardingSteps";

type ActionBarTooltipPayload = {
  anchor: LayoutRectangle;
  title: string;
  description: string;
};

type ReaderActionBarButtonTooltipProps = {
  tooltipTitle?: string;
  tooltipDescription?: string;
  onShowTooltip?: (payload: ActionBarTooltipPayload) => void;
};

type ReaderActionBarIconButtonProps = ReaderActionBarButtonTooltipProps & {
  onPress: () => void;
  accessibilityLabel: string;
  buttonRef?: RefObject<View | null>;
  style?: ViewStyle;
  children: ReactNode;
};

function useActionBarLongPressTooltip({
  buttonRef,
  tooltipTitle,
  tooltipDescription,
  onShowTooltip,
}: ReaderActionBarButtonTooltipProps & { buttonRef?: RefObject<View | null> }) {
  const fallbackRef = useRef<View | null>(null);
  const measureRef = buttonRef ?? fallbackRef;
  const hasTooltip = tooltipTitle != null && onShowTooltip != null;

  const handleLongPress = useCallback(() => {
    if (!hasTooltip || !tooltipTitle || !onShowTooltip) return;
    hapticSoftPop();
    void (async () => {
      const measured = await measureOnboardingTarget(measureRef, {
        minWidth: READER_ACTION_BAR_BUTTON_PX,
        minHeight: READER_ACTION_BAR_BUTTON_PX,
      });
      if (!measured) return;
      onShowTooltip({
        anchor: measured,
        title: tooltipTitle,
        description: tooltipDescription ?? "",
      });
    })();
  }, [hasTooltip, measureRef, onShowTooltip, tooltipDescription, tooltipTitle]);

  return { handleLongPress, hasTooltip, measureRef };
}

/** M3 standard icon button on Android; compact circular press on iOS. */
export function ReaderActionBarIconButton({
  onPress,
  accessibilityLabel,
  buttonRef,
  style,
  children,
  tooltipTitle,
  tooltipDescription,
  onShowTooltip,
}: ReaderActionBarIconButtonProps) {
  const { handleLongPress, hasTooltip, measureRef } = useActionBarLongPressTooltip({
    buttonRef,
    tooltipTitle,
    tooltipDescription,
    onShowTooltip,
  });

  if (Platform.OS === "android") {
    return (
      <ReaderM3IconButton
        onPress={onPress}
        onLongPress={hasTooltip ? handleLongPress : undefined}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={hasTooltip ? "Press and hold for more information" : undefined}
        buttonRef={measureRef}
        style={style}
        suppressHaptic
        jiggleOnPress={false}
      >
        {children}
      </ReaderM3IconButton>
    );
  }

  return (
    <View
      ref={measureRef}
      collapsable={false}
      style={[{ width: READER_ACTION_BAR_BUTTON_PX, height: READER_ACTION_BAR_BUTTON_PX }, style]}
    >
      <TouchableOpacity
        onPress={() => {
          hapticLightImpact();
          onPress();
        }}
        onLongPress={hasTooltip ? handleLongPress : undefined}
        delayLongPress={420}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={hasTooltip ? "Press and hold for more information" : undefined}
        className="rounded-full items-center justify-center"
        style={{ width: READER_ACTION_BAR_BUTTON_PX, height: READER_ACTION_BAR_BUTTON_PX }}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    </View>
  );
}

type ReaderActionBarJournalButtonProps = ReaderActionBarButtonTooltipProps & {
  onPress: () => void;
  accessibilityLabel: string;
  containerColor: string;
  rippleColor: string;
  buttonRef?: RefObject<View | null>;
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
  tooltipTitle,
  tooltipDescription,
  onShowTooltip,
}: ReaderActionBarJournalButtonProps) {
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const size = READER_ACTION_BAR_BUTTON_PX;
  const { handleLongPress, hasTooltip, measureRef } = useActionBarLongPressTooltip({
    buttonRef,
    tooltipTitle,
    tooltipDescription,
    onShowTooltip,
  });

  const handlePress = useCallback(() => {
    hapticLightImpact();
    onPress();
  }, [onPress]);

  const handlePressIn = useCallback(() => {
    animateM3PressScale(scale, 0.92);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    animateM3PressScale(scale, 1);
  }, [scale]);

  if (Platform.OS === "android") {
    return (
      <View
        ref={measureRef}
        collapsable={false}
        style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}
      >
        <Pressable
          onPress={handlePress}
          onLongPress={hasTooltip ? handleLongPress : undefined}
          delayLongPress={420}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={hasTooltip ? "Press and hold for more information" : undefined}
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
          <Reanimated.View style={scaleStyle}>{children}</Reanimated.View>
        </Pressable>
      </View>
    );
  }

  return (
    <View ref={measureRef} collapsable={false} style={[{ width: size, height: size }, style]}>
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={hasTooltip ? handleLongPress : undefined}
        delayLongPress={420}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={hasTooltip ? "Press and hold for more information" : undefined}
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
