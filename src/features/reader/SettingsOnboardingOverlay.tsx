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
import { settingsOnboardingCoachmarkCenterY } from "@/src/features/reader/readerSettingsOnboardingAnchor";
import type { ReaderSettingsOnboardingStep } from "@/src/features/reader/readerSettingsOnboardingSteps";

const ARROW_SIZE_PX = 30;
const ARROW_GAP_PX = 12;
const ARROW_NUDGE_PX = 10;
const TOOLTIP_WIDTH_PX = 228;
const TOOLTIP_MIN_WIDTH_PX = 200;
const TOOLTIP_EST_HEIGHT_PX = 96;
const SCREEN_EDGE_INSET_PX = 16;

type SettingsOnboardingOverlayProps = {
  step: ReaderSettingsOnboardingStep;
  rowAnchor: LayoutRectangle;
  /** Which edge the settings rail sits on (tooltip appears on the opposite side). */
  railSide?: "left" | "right";
  /** Width of the revealed settings side sheet (positions coachmarks beside the panel). */
  sideSheetWidthPx: number;
  colors: {
    tooltipBackground: string;
    tooltipText: string;
    arrow: string;
  };
};

function coachmarkLayoutForLeftRail(
  rowAnchor: LayoutRectangle,
  sideSheetWidthPx: number,
  screenW: number,
): {
  arrowLeft: number;
  arrowTop: number;
  tooltipLeft: number;
  tooltipWidth: number;
  coachmarkCenterY: number;
} {
  const coachmarkCenterY = settingsOnboardingCoachmarkCenterY(rowAnchor);
  const sheetRight = sideSheetWidthPx;
  const arrowLeft = sheetRight + ARROW_GAP_PX;
  const tooltipLeft = arrowLeft + ARROW_SIZE_PX + 12;
  const tooltipWidth = Math.min(
    TOOLTIP_WIDTH_PX,
    Math.max(TOOLTIP_MIN_WIDTH_PX, screenW - tooltipLeft - SCREEN_EDGE_INSET_PX),
  );

  return {
    arrowLeft,
    arrowTop: coachmarkCenterY - ARROW_SIZE_PX / 2,
    tooltipLeft,
    tooltipWidth,
    coachmarkCenterY,
  };
}

export function SettingsOnboardingOverlay({
  step,
  rowAnchor,
  railSide = "right",
  sideSheetWidthPx,
  colors,
}: SettingsOnboardingOverlayProps) {
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

  const coachmarkCenterY = settingsOnboardingCoachmarkCenterY(rowAnchor);
  const isLeftRail = railSide === "left";

  const layout =
    isLeftRail && sideSheetWidthPx > 0
      ? coachmarkLayoutForLeftRail(rowAnchor, sideSheetWidthPx, screenW)
      : {
          arrowLeft: rowAnchor.x - ARROW_SIZE_PX - ARROW_GAP_PX,
          arrowTop: coachmarkCenterY - ARROW_SIZE_PX / 2,
          tooltipLeft: Math.max(
            SCREEN_EDGE_INSET_PX,
            rowAnchor.x - ARROW_SIZE_PX - ARROW_GAP_PX - TOOLTIP_WIDTH_PX - 12,
          ),
          tooltipWidth: TOOLTIP_WIDTH_PX,
          coachmarkCenterY,
        };

  const tooltipTop = Math.max(20, layout.coachmarkCenterY - TOOLTIP_EST_HEIGHT_PX / 2);

  const arrowTranslateX = arrowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isLeftRail ? ARROW_NUDGE_PX : -ARROW_NUDGE_PX],
  });

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View
        style={[
          styles.arrowWrap,
          {
            left: layout.arrowLeft,
            top: layout.arrowTop,
            transform: [{ translateX: arrowTranslateX }],
          },
        ]}
      >
        <CoachmarkArrowIcon
          name={isLeftRail ? "arrow-back" : "arrow-forward"}
          size={ARROW_SIZE_PX}
          color={colors.arrow}
        />
      </Animated.View>

      <View
        style={[
          styles.tooltipWrap,
          {
            top: tooltipTop,
            left: layout.tooltipLeft,
            width: layout.tooltipWidth,
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
