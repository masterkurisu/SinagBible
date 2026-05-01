import { useCallback, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { OnboardingSlide1 } from "@/features/onboarding/OnboardingSlide1";
import { OnboardingSlide2 } from "./OnboardingSlide2";
import { OnboardingSlide3 } from "./OnboardingSlide3";
import { OnboardingSlide4 } from "./OnboardingSlide4";

/** Index of the last onboarding slide (0-based). Increase when adding slides. */
const LAST_SLIDE_INDEX = 3;

/** Outgoing slide fades out over this duration. */
const FADE_OUT_DURATION = 180;
/** Incoming slide fades in over this duration, starting after the outgoing fade finishes. */
const FADE_IN_DURATION = 300;

type OnboardingContainerProps = {
  onFinish: () => void;
};

function renderSlide(
  slide: number,
  onNext: () => void,
  onBack: () => void,
  onFinish: () => void,
) {
  const onPrivacyPressPlaceholder = () => {};
  switch (slide) {
    case 0:
      return <OnboardingSlide1 onNext={onNext} />;
    case 1:
      return <OnboardingSlide2 onNext={onNext} onBack={onBack} />;
    case 2:
      return <OnboardingSlide3 onNext={onNext} onBack={onBack} />;
    case 3:
      return (
        <OnboardingSlide4
          onFinish={onFinish}
          onBack={onBack}
          onPrivacyPress={onPrivacyPressPlaceholder}
        />
      );
    default:
      return null;
  }
}

export function OnboardingContainer({ onFinish }: OnboardingContainerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const currentOpacity = useRef(new Animated.Value(1)).current;

  const runTransition = useCallback(
    (to: number) => {
      if (to < 0 || to > LAST_SLIDE_INDEX) return;
      setTransitioning(true);

      // Fade the current slide out, then swap and let the new slide's own
      // stagger-in entrance animate naturally from the start.
      Animated.timing(currentOpacity, {
        toValue: 0,
        duration: FADE_OUT_DURATION,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        // Keep opacity pinned at 0 while React re-renders the new slide.
        // One rAF gives the new slide a full frame to mount and paint at
        // opacity:0 before we start the fade-in, preventing any flash.
        currentOpacity.setValue(0);
        setCurrentSlide(to);
        requestAnimationFrame(() => {
          Animated.timing(currentOpacity, {
            toValue: 1,
            duration: FADE_IN_DURATION,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            setTransitioning(false);
          });
        });
      });
    },
    [currentOpacity],
  );

  const goNext = useCallback(() => {
    if (transitioning) return;
    if (currentSlide >= LAST_SLIDE_INDEX) {
      onFinish();
      return;
    }
    runTransition(currentSlide + 1);
  }, [currentSlide, onFinish, runTransition, transitioning]);

  const goBack = useCallback(() => {
    if (transitioning) return;
    runTransition(currentSlide - 1);
  }, [currentSlide, runTransition, transitioning]);

  return (
    <View style={styles.root}>
      <Animated.View
        style={[styles.slide, { opacity: currentOpacity }]}
        pointerEvents={transitioning ? "none" : "auto"}
      >
        {renderSlide(currentSlide, goNext, goBack, onFinish)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  slide: {
    flex: 1,
  },
});
