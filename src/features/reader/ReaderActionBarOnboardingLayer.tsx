import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, type LayoutRectangle } from "react-native";
import { FeatureOnboardingModal } from "@/src/components/feature-onboarding/FeatureOnboardingModal";
import { OnboardingTargetDebugOverlay } from "@/src/components/feature-onboarding/OnboardingTargetDebugOverlay";
import { ActionBarOnboardingOverlay } from "@/src/features/reader/ActionBarOnboardingOverlay";
import { READER_ONBOARDING_DEBUG_TARGETS } from "@/src/features/reader/readerOnboardingDebug";
import type { ReaderActionBarOnboardingStep } from "@/src/features/reader/readerActionBarOnboardingSteps";

const FADE_IN_MS = 280;
const FADE_OUT_MS = 320;

type ReaderActionBarOnboardingLayerProps = {
  visible: boolean;
  step: ReaderActionBarOnboardingStep | null;
  buttonAnchor: LayoutRectangle | null;
  colors: {
    tooltipBackground: string;
    tooltipText: string;
    arrow: string;
  };
};

export function ReaderActionBarOnboardingLayer({
  visible,
  step,
  buttonAnchor,
  colors,
}: ReaderActionBarOnboardingLayerProps) {
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const [displayStep, setDisplayStep] = useState<ReaderActionBarOnboardingStep | null>(null);
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
    if (visible && step && buttonAnchor) {
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
  }, [visible, step, buttonAnchor, mounted]);

  useEffect(() => {
    if (!visible || !step || !buttonAnchor) return;

    const isFirstPaint = displayStepIdRef.current == null;
    if (isFirstPaint || displayStepIdRef.current === step.id) {
      displayStepIdRef.current = step.id;
      setDisplayStep(step);
      setDisplayAnchor(buttonAnchor);
      stopFadeAnims();
      opacityAnim.setValue(0);
      fadeIn();
      return;
    }

    stopFadeAnims();
    fadeOut(() => {
      displayStepIdRef.current = step.id;
      setDisplayStep(step);
      setDisplayAnchor(buttonAnchor);
      fadeIn();
    });
  }, [visible, step, buttonAnchor, opacityAnim]);

  useEffect(() => () => stopFadeAnims(), []);

  return (
    <FeatureOnboardingModal visible={mounted} pointerEvents="box-none" animationType="none">
      {mounted && displayStep && displayAnchor ? (
        <Animated.View style={[styles.layer, { opacity: opacityAnim }]} pointerEvents="none">
          <ActionBarOnboardingOverlay step={displayStep} buttonAnchor={displayAnchor} colors={colors} />
          <OnboardingTargetDebugOverlay
            targets={[displayAnchor]}
            enabled={READER_ONBOARDING_DEBUG_TARGETS}
          />
        </Animated.View>
      ) : null}
    </FeatureOnboardingModal>
  );
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
  },
});
