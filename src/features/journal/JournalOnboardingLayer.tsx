import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Modal, Platform, StyleSheet, View, type LayoutRectangle } from "react-native";
import { FullWindowOverlay } from "react-native-screens";
import { FeatureOnboardingModal } from "@/src/components/feature-onboarding/FeatureOnboardingModal";
import { ActionBarOnboardingOverlay } from "@/src/features/reader/ActionBarOnboardingOverlay";

const FADE_IN_MS = 280;
const FADE_OUT_MS = 320;

type OnboardingTooltipStep = {
  id: string;
  title: string;
  description: string;
};

type JournalOnboardingLayerProps = {
  visible: boolean;
  step: OnboardingTooltipStep | null;
  stepAnchor: LayoutRectangle | null;
  tooltipPlacement?: "above" | "below";
  verticalOffsetPx?: number;
  /** Added on top of `verticalOffsetPx` for matching step ids (keyed by displayed step). */
  extraVerticalOffsetByStepId?: Partial<Record<string, number>>;
  /**
   * Reader new-entry sheet: render in a window-level overlay (matches book picker) instead of a
   * nested full-screen modal, which misaligns `measureInWindow` coachmark anchors.
   */
  useWindowOverlay?: boolean;
  colors: {
    tooltipBackground: string;
    tooltipText: string;
    arrow: string;
  };
};

function OnboardingOverlayHost({
  mounted,
  useWindowOverlay,
  children,
}: {
  mounted: boolean;
  useWindowOverlay: boolean;
  children: ReactNode;
}) {
  if (!mounted) return null;

  if (useWindowOverlay) {
    if (Platform.OS === "ios") {
      return (
        <FullWindowOverlay unstable_accessibilityContainerViewIsModal>{children}</FullWindowOverlay>
      );
    }
    return (
      <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => {}}>
        <View style={styles.layer} pointerEvents="box-none">
          {children}
        </View>
      </Modal>
    );
  }

  return (
    <FeatureOnboardingModal visible={mounted} pointerEvents="box-none" animationType="none">
      {children}
    </FeatureOnboardingModal>
  );
}

export function JournalOnboardingLayer({
  visible,
  step,
  stepAnchor,
  tooltipPlacement = "above",
  verticalOffsetPx = 0,
  extraVerticalOffsetByStepId,
  useWindowOverlay = false,
  colors,
}: JournalOnboardingLayerProps) {
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const [displayStep, setDisplayStep] = useState<OnboardingTooltipStep | null>(null);
  const [displayAnchor, setDisplayAnchor] = useState<LayoutRectangle | null>(null);
  const displayStepIdRef = useRef<string | null>(null);
  const fadeOutAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const fadeInAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const stopFadeAnims = () => {
    fadeOutAnimRef.current?.stop();
    fadeInAnimRef.current?.stop();
    fadeOutAnimRef.current = null;
    fadeInAnimRef.current = null;
  };

  const fadeIn = () => {
    fadeInAnimRef.current = Animated.timing(opacityAnim, {
      toValue: 1,
      duration: FADE_IN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    fadeInAnimRef.current.start(({ finished }) => {
      if (finished) fadeInAnimRef.current = null;
    });
  };

  const fadeOut = (onComplete?: () => void) => {
    fadeOutAnimRef.current = Animated.timing(opacityAnim, {
      toValue: 0,
      duration: FADE_OUT_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    fadeOutAnimRef.current.start(({ finished }) => {
      fadeOutAnimRef.current = null;
      if (finished) onComplete?.();
    });
  };

  useEffect(() => {
    if (visible && step && stepAnchor) {
      setMounted(true);
      return;
    }

    if (!mounted) return;

    stopFadeAnims();
    fadeOut(() => {
      setMounted(false);
      setDisplayStep(null);
      setDisplayAnchor(null);
      displayStepIdRef.current = null;
    });
  }, [visible, step, stepAnchor, mounted]);

  useEffect(() => {
    if (!visible || !step || !stepAnchor) return;

    const isFirstPaint = displayStepIdRef.current == null;
    if (isFirstPaint || displayStepIdRef.current === step.id) {
      displayStepIdRef.current = step.id;
      setDisplayStep(step);
      setDisplayAnchor(stepAnchor);
      stopFadeAnims();
      opacityAnim.setValue(0);
      fadeIn();
      return;
    }

    stopFadeAnims();
    fadeOut(() => {
      displayStepIdRef.current = step.id;
      setDisplayStep(step);
      setDisplayAnchor(stepAnchor);
      fadeIn();
    });
  }, [visible, step, stepAnchor, opacityAnim]);

  useEffect(() => () => stopFadeAnims(), []);

  const overlay =
    mounted && displayStep && displayAnchor ? (
      <Animated.View style={[styles.layer, { opacity: opacityAnim }]} pointerEvents="none">
        <ActionBarOnboardingOverlay
          step={displayStep}
          buttonAnchor={displayAnchor}
          tooltipPlacement={tooltipPlacement}
          verticalOffsetPx={
            verticalOffsetPx + (extraVerticalOffsetByStepId?.[displayStep.id] ?? 0)
          }
          colors={colors}
        />
      </Animated.View>
    ) : null;

  if (useWindowOverlay) {
    return (
      <OnboardingOverlayHost mounted={mounted} useWindowOverlay>
        {overlay}
      </OnboardingOverlayHost>
    );
  }

  return (
    <OnboardingOverlayHost mounted={mounted} useWindowOverlay={false}>
      {overlay}
    </OnboardingOverlayHost>
  );
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
  },
});
