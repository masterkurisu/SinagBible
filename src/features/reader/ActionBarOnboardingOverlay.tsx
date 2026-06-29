import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutRectangle,
} from "react-native";
import { CoachmarkArrowIcon } from "@/src/components/feature-onboarding/CoachmarkArrowIcon";
import { onboardingTooltipStyles } from "@/src/components/feature-onboarding/onboarding-tooltip-styles";

const ARROW_SIZE_PX = 24;
const ARROW_GAP_PX = 10;
const ARROW_NUDGE_PX = 8;
const TOOLTIP_EST_HEIGHT_PX = 88;

type OnboardingTooltipStep = {
  id: string;
  title: string;
  description: string;
};

type TooltipPlacement = "above" | "below";

type ActionBarOnboardingOverlayProps = {
  step: OnboardingTooltipStep;
  buttonAnchor: LayoutRectangle;
  /** Default `above`: tooltip sits above the target with a down arrow. */
  tooltipPlacement?: TooltipPlacement;
  /** Shifts the tooltip and arrow down (positive) or up (negative). */
  verticalOffsetPx?: number;
  colors: {
    tooltipBackground: string;
    tooltipText: string;
    arrow: string;
  };
};

export function ActionBarOnboardingOverlay({
  step,
  buttonAnchor,
  tooltipPlacement = "above",
  verticalOffsetPx = 0,
  colors,
}: ActionBarOnboardingOverlayProps) {
  const { width: screenW } = useWindowDimensions();
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

  const arrowTranslateY = arrowAnim.interpolate({
    inputRange: [0, 1],
    outputRange:
      tooltipPlacement === "below" ? [0, -ARROW_NUDGE_PX] : [0, ARROW_NUDGE_PX],
  });

  const buttonCenterX = buttonAnchor.x + buttonAnchor.width / 2;
  const tooltipMaxWidth = Math.min(240, screenW - 32);
  const tooltipLeft = Math.max(16, Math.min(buttonCenterX - tooltipMaxWidth / 2, screenW - tooltipMaxWidth - 16));
  const arrowLeft = buttonCenterX - ARROW_SIZE_PX / 2;

  const arrowTop =
    tooltipPlacement === "below"
      ? buttonAnchor.y + buttonAnchor.height + ARROW_GAP_PX + verticalOffsetPx
      : buttonAnchor.y - ARROW_GAP_PX - ARROW_SIZE_PX + verticalOffsetPx;

  const tooltipTop =
    tooltipPlacement === "below"
      ? arrowTop + ARROW_SIZE_PX + ARROW_GAP_PX
      : Math.max(20, arrowTop - TOOLTIP_EST_HEIGHT_PX);

  return (
    <View style={styles.root} pointerEvents="none">
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
          {step.description ? (
            <Text style={[onboardingTooltipStyles.hint, { color: colors.tooltipText, marginTop: 6 }]}>
              {step.description}
            </Text>
          ) : null}
        </View>
      </View>

      <Animated.View
        style={[
          styles.arrowWrap,
          {
            left: arrowLeft,
            top: arrowTop,
            transform: [{ translateY: arrowTranslateY }],
          },
        ]}
      >
        <CoachmarkArrowIcon
          name={tooltipPlacement === "below" ? "arrow-up" : "arrow-down"}
          size={ARROW_SIZE_PX}
          color={colors.arrow}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
  },
  tooltipWrap: {
    position: "absolute",
  },
  arrowWrap: {
    position: "absolute",
    width: ARROW_SIZE_PX,
    height: ARROW_SIZE_PX,
    alignItems: "center",
    justifyContent: "center",
  },
});
