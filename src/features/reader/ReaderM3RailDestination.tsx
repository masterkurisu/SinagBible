import { useCallback, useRef, type ComponentType } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutRectangle,
} from "react-native";
import { hapticLightImpact, hapticSoftPop } from "@/lib/haptics";
import { measureOnboardingTarget } from "@/src/components/feature-onboarding/measureOnboardingTarget";
import {
  READER_M3_ERROR,
  READER_M3_ERROR_CONTAINER,
  READER_M3_ICON_BUTTON_RIPPLE,
  READER_M3_ON_ERROR_CONTAINER,
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
  READER_M3_SURFACE_CONTAINER,
  READER_SETTINGS_NAV_RAIL_ITEM_HEIGHT_PX,
} from "@/src/features/reader/readerSettingsPanelChrome";

type ReaderSettingsMenuIconProps = { size?: number; color?: string };

export type ReaderM3RailDestinationProps = {
  label: string;
  onPress: () => void;
  Icon: ComponentType<ReaderSettingsMenuIconProps>;
  iconSize?: number;
  destructive?: boolean;
  rippleColor?: string;
  contentPaddingLeft: number;
  tooltipTitle?: string;
  tooltipDescription?: string;
  onShowTooltip?: (payload: {
    anchor: LayoutRectangle;
    title: string;
    description: string;
  }) => void;
};

const RAIL_ICON_SIZE = 24;
const RAIL_LABEL_SIZE = 14;
const RAIL_LABEL_LINE_HEIGHT = 20;

/** M3 navigation-rail destination — ripple, press scale, state-layer fill. */
export function ReaderM3RailDestination({
  label,
  onPress,
  Icon,
  iconSize = RAIL_ICON_SIZE,
  destructive = false,
  rippleColor = READER_M3_ICON_BUTTON_RIPPLE,
  contentPaddingLeft,
  tooltipTitle,
  tooltipDescription,
  onShowTooltip,
}: ReaderM3RailDestinationProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rowMeasureRef = useRef<View | null>(null);
  const iconColor = destructive ? READER_M3_ERROR : READER_M3_ON_SURFACE_VARIANT;
  const labelColor = destructive ? READER_M3_ON_ERROR_CONTAINER : READER_M3_ON_SURFACE;
  const destructiveRipple = "rgba(179,38,30,0.12)";

  const handlePress = useCallback(() => {
    hapticLightImpact();
    onPress();
  }, [onPress]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
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

  const handleLongPress = useCallback(() => {
    if (!tooltipTitle || !onShowTooltip) return;
    hapticSoftPop();
    void (async () => {
      const measured = await measureOnboardingTarget(rowMeasureRef, {
        minWidth: 40,
        minHeight: 20,
      });
      if (!measured) return;
      onShowTooltip({
        anchor: measured,
        title: tooltipTitle,
        description: tooltipDescription ?? "",
      });
    })();
  }, [onShowTooltip, tooltipDescription, tooltipTitle]);

  const useM3Press = Platform.OS === "android";
  const hasTooltip = tooltipTitle != null && onShowTooltip != null;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={hasTooltip ? handleLongPress : undefined}
      delayLongPress={420}
      onPressIn={useM3Press ? handlePressIn : undefined}
      onPressOut={useM3Press ? handlePressOut : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hasTooltip ? "Press and hold for more information" : undefined}
      android_ripple={
        useM3Press
          ? { color: destructive ? destructiveRipple : rippleColor }
          : undefined
      }
      style={({ pressed }) => [
        styles.railItem,
        destructive && styles.railItemDestructive,
        !useM3Press &&
          pressed &&
          (destructive ? styles.railItemDestructivePressed : styles.railItemPressed),
      ]}
    >
      <Animated.View
        ref={rowMeasureRef}
        collapsable={false}
        style={[
          styles.railItemInner,
          { paddingLeft: 16 + contentPaddingLeft },
          useM3Press ? { transform: [{ scale: scaleAnim }] } : null,
        ]}
      >
        <Icon size={iconSize} color={iconColor} />
        <Text style={[styles.railLabel, { color: labelColor }]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  railItem: {
    minHeight: READER_SETTINGS_NAV_RAIL_ITEM_HEIGHT_PX,
    borderRadius: 999,
    marginHorizontal: 12,
    overflow: "hidden",
  },
  railItemPressed: {
    backgroundColor: READER_M3_SURFACE_CONTAINER,
  },
  railItemDestructive: {
    backgroundColor: READER_M3_ERROR_CONTAINER,
  },
  railItemDestructivePressed: {
    backgroundColor: "#F3DAD7",
  },
  railItemInner: {
    minHeight: READER_SETTINGS_NAV_RAIL_ITEM_HEIGHT_PX,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 16,
    paddingVertical: 4,
    gap: 12,
  },
  railLabel: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: RAIL_LABEL_SIZE,
    lineHeight: RAIL_LABEL_LINE_HEIGHT,
  },
});
