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
import { Ionicons } from "@expo/vector-icons";
import { onboardingTooltipStyles } from "@/src/components/feature-onboarding/onboarding-tooltip-styles";
import type { ReaderActionBarOnboardingStep } from "@/src/features/reader/readerActionBarOnboardingSteps";

const ARROW_SIZE_PX = 24;
const ARROW_GAP_PX = 10;
const ARROW_NUDGE_PX = 8;
const TOOLTIP_EST_HEIGHT_PX = 88;

type ActionBarOnboardingOverlayProps = {
  step: ReaderActionBarOnboardingStep;
  buttonAnchor: LayoutRectangle;
  colors: {
    tooltipBackground: string;
    tooltipText: string;
    arrow: string;
  };
};

export function ActionBarOnboardingOverlay({
  step,
  buttonAnchor,
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
    outputRange: [0, ARROW_NUDGE_PX],
  });

  const buttonCenterX = buttonAnchor.x + buttonAnchor.width / 2;
  const tooltipMaxWidth = Math.min(240, screenW - 32);
  const tooltipLeft = Math.max(16, Math.min(buttonCenterX - tooltipMaxWidth / 2, screenW - tooltipMaxWidth - 16));
  const tooltipBottom = buttonAnchor.y - ARROW_GAP_PX - ARROW_SIZE_PX;
  const tooltipTop = Math.max(20, tooltipBottom - TOOLTIP_EST_HEIGHT_PX);
  const arrowLeft = buttonCenterX - ARROW_SIZE_PX / 2;
  const arrowTop = buttonAnchor.y - ARROW_GAP_PX - ARROW_SIZE_PX;

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
          <Text style={[onboardingTooltipStyles.hint, { color: colors.tooltipText, marginTop: 6 }]}>
            {step.description}
          </Text>
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
        <Ionicons name="arrow-down" size={ARROW_SIZE_PX} color={colors.arrow} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
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
