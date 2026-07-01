import { CoachMarkOverlay } from "@/src/components/feature-onboarding/CoachMarkOverlay";
import { FeatureOnboardingModal } from "@/src/components/feature-onboarding/FeatureOnboardingModal";
import { OnboardingTargetDebugOverlay } from "@/src/components/feature-onboarding/OnboardingTargetDebugOverlay";
import { SpotlightOverlay } from "@/src/components/feature-onboarding/SpotlightOverlay";
import { READER_ONBOARDING_DEBUG_TARGETS } from "@/src/features/reader/readerOnboardingDebug";
import type { ReaderOnboardingStep } from "@/src/features/reader/useReaderFeatureOnboarding";
import { StyleSheet, View } from "react-native";

type ReaderFeatureOnboardingLayerProps = {
  visible: boolean;
  step: ReaderOnboardingStep | null;
  isSpotlightStep: boolean;
  isInteractionCoachMark: boolean;
  message: string;
  subtitle?: string;
  spotlightTargets: Array<{ x: number; y: number; width: number; height: number; borderRadius?: number; shape?: "circle" | "rect" | "pill" }>;
  spotlightTargetsStep: ReaderOnboardingStep | null;
  coachMarkAnchor: { x: number; y: number; width: number; height: number } | null;
  onDismiss: () => void;
  colors: {
    tooltipBackground: string;
    tooltipText: string;
    scrim: string;
  };
};

function spotlightLabelConfig(step: ReaderOnboardingStep) {
  switch (step) {
    case "book-selector":
      return { labelPosition: "below" as const, labelGap: 86, labelAnchorTargetIndex: 0 };
    case "settings":
      return { labelPosition: "below" as const, labelGap: 86, labelAnchorTargetIndex: 0 };
    case "font-settings":
      return { labelPosition: "below" as const, labelGap: 86, labelAnchorTargetIndex: 0 };
    case "page-turns":
      return { labelPosition: "above" as const, labelGap: 28, labelAnchorTargetIndex: 0 };
    case "clear-selection":
      return { labelPosition: "below" as const, labelGap: 14, labelAnchorTargetIndex: 0 };
    default:
      return { labelPosition: "auto" as const, labelGap: 16, labelAnchorTargetIndex: 0 };
  }
}

export function ReaderFeatureOnboardingLayer({
  visible,
  step,
  isSpotlightStep,
  isInteractionCoachMark,
  message,
  subtitle,
  spotlightTargets,
  coachMarkAnchor,
  onDismiss,
  colors,
}: ReaderFeatureOnboardingLayerProps) {
  const spotlightVisible = visible && isSpotlightStep && step != null;
  const interactionVisible = visible && isInteractionCoachMark && step != null;
  const labelConfig = step ? spotlightLabelConfig(step) : null;
  const iconSpotlightStep =
    step === "book-selector" ||
    step === "settings" ||
    step === "font-settings" ||
    step === "page-turns";

  return (
    <>
      <FeatureOnboardingModal visible={spotlightVisible} animationType="none">
        {spotlightVisible && step && labelConfig ? (
          <>
            <SpotlightOverlay
              targets={spotlightTargets}
              message={message}
              subtitle={subtitle}
              onDismiss={onDismiss}
              colors={{
                tooltipBackground: colors.tooltipBackground,
                tooltipText: colors.tooltipText,
              }}
              labelPosition={labelConfig.labelPosition}
              labelGap={labelConfig.labelGap}
              labelAnchorTargetIndex={labelConfig.labelAnchorTargetIndex}
              targetPadding={iconSpotlightStep ? 6 : 8}
            />
            <OnboardingTargetDebugOverlay
              targets={spotlightTargets}
              enabled={READER_ONBOARDING_DEBUG_TARGETS}
            />
          </>
        ) : null}
      </FeatureOnboardingModal>

      {interactionVisible && step ? (
        <View style={styles.interactionLayer} pointerEvents="box-none">
          <CoachMarkOverlay
            message={message}
            onDismiss={onDismiss}
            anchor={coachMarkAnchor}
            placement="center"
            dimmed={false}
            dismissOnTap={false}
            hint={null}
            colors={colors}
          />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  interactionLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 10000,
    elevation: 100,
  },
});
