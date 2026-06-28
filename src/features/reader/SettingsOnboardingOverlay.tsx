import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type LayoutRectangle,
} from "react-native";
import { CoachmarkArrowIcon } from "@/src/components/feature-onboarding/CoachmarkArrowIcon";
import { onboardingTooltipStyles } from "@/src/components/feature-onboarding/onboarding-tooltip-styles";
import type { ReaderSettingsOnboardingStep } from "@/src/features/reader/readerSettingsOnboardingSteps";

const ARROW_SIZE_PX = 30;
const ARROW_GAP_PX = 12;
const ARROW_NUDGE_PX = 10;
const TOOLTIP_EST_HEIGHT_PX = 120;

type SettingsOnboardingOverlayProps = {
  step: ReaderSettingsOnboardingStep;
  rowAnchor: LayoutRectangle;
  colors: {
    tooltipBackground: string;
    tooltipText: string;
    arrow: string;
  };
};

export function SettingsOnboardingOverlay({
  step,
  rowAnchor,
  colors,
}: SettingsOnboardingOverlayProps) {
  const arrowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    arrowAnim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(arrowAnim, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [arrowAnim, step.id]);

  const arrowTranslateX = arrowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, ARROW_NUDGE_PX],
  });

  const rowCenterY = rowAnchor.y + rowAnchor.height / 2;
  const arrowLeft = Math.max(16, rowAnchor.x - ARROW_SIZE_PX - ARROW_GAP_PX);
  const arrowTop = rowCenterY - ARROW_SIZE_PX / 2;

  const tooltipMaxWidth = Math.min(320, Math.max(180, rowAnchor.x - ARROW_SIZE_PX - ARROW_GAP_PX - 32));
  const tooltipLeft = Math.max(16, arrowLeft - tooltipMaxWidth - 10);
  const tooltipTop = Math.max(20, rowCenterY - TOOLTIP_EST_HEIGHT_PX / 2);

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View
        style={[
          styles.arrowWrap,
          {
            left: arrowLeft,
            top: arrowTop,
            transform: [{ translateX: arrowTranslateX }],
          },
        ]}
      >
        <CoachmarkArrowIcon name="arrow-forward" size={ARROW_SIZE_PX} color={colors.arrow} />
      </Animated.View>

      <View
        style={[
          styles.tooltipWrap,
          {
            top: tooltipTop,
            left: tooltipLeft,
            width: tooltipMaxWidth,
          },
        ]}
      >
        <View style={[onboardingTooltipStyles.card, { backgroundColor: colors.tooltipBackground }]}>
          <Text style={[onboardingTooltipStyles.message, { color: colors.tooltipText }]}>
            {step.title}
          </Text>
          <Text style={[onboardingTooltipStyles.hint, { color: colors.tooltipText, marginTop: 6 }]}>
            {step.description}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
  },
  arrowWrap: {
    position: "absolute",
    width: ARROW_SIZE_PX,
    height: ARROW_SIZE_PX,
    alignItems: "center",
    justifyContent: "center",
  },
  tooltipWrap: {
    position: "absolute",
  },
});
