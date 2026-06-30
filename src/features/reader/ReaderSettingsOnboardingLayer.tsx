import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, type LayoutRectangle } from "react-native";
import { FeatureOnboardingModal } from "@/src/components/feature-onboarding/FeatureOnboardingModal";
import { OnboardingTargetDebugOverlay } from "@/src/components/feature-onboarding/OnboardingTargetDebugOverlay";
import { SettingsOnboardingOverlay } from "@/src/features/reader/SettingsOnboardingOverlay";
import { READER_ONBOARDING_DEBUG_TARGETS } from "@/src/features/reader/readerOnboardingDebug";
import type { ReaderSettingsOnboardingStep } from "@/src/features/reader/readerSettingsOnboardingSteps";

const FADE_IN_MS = 280;
const FADE_OUT_MS = 320;

type ReaderSettingsOnboardingLayerProps = {
  visible: boolean;
  step: ReaderSettingsOnboardingStep | null;
  rowAnchor: LayoutRectangle | null;
  railSide?: "left" | "right";
  colors: {
    tooltipBackground: string;
    tooltipText: string;
    arrow: string;
  };
};

export function ReaderSettingsOnboardingLayer({
  visible,
  step,
  rowAnchor,
  railSide = "right",
  colors,
}: ReaderSettingsOnboardingLayerProps) {
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const [displayStep, setDisplayStep] = useState<ReaderSettingsOnboardingStep | null>(null);
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
    if (visible && step && rowAnchor) {
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
  }, [visible, step, rowAnchor, mounted]);

  useEffect(() => {
    if (!visible || !step || !rowAnchor) return;

    const isFirstPaint = displayStepIdRef.current == null;
    if (isFirstPaint) {
      displayStepIdRef.current = step.id;
      setDisplayStep(step);
      setDisplayAnchor(rowAnchor);
      stopFadeAnims();
      opacityAnim.setValue(0);
      fadeIn();
      return;
    }

    if (displayStepIdRef.current === step.id) {
      setDisplayAnchor(rowAnchor);
      return;
    }

    stopFadeAnims();
    fadeOut(() => {
      displayStepIdRef.current = step.id;
      setDisplayStep(step);
      setDisplayAnchor(rowAnchor);
      fadeIn();
    });
  }, [visible, step, rowAnchor, opacityAnim]);

  useEffect(() => () => stopFadeAnims(), []);

  return (
    <FeatureOnboardingModal visible={mounted} pointerEvents="box-none" animationType="none">
      {mounted && displayStep && displayAnchor ? (
        <Animated.View style={[styles.layer, { opacity: opacityAnim }]} pointerEvents="none">
          <SettingsOnboardingOverlay step={displayStep} rowAnchor={displayAnchor} railSide={railSide} colors={colors} />
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
