import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { motionTier } from "@/lib/device-capability";
import { setPrefersReducedMotion } from "@/lib/m3-motion-profile-state";

export type M3MotionTier = "full" | "reduced";

export type M3MotionProfile = {
  tier: M3MotionTier;
  prefersReducedMotion: boolean;
};

/**
 * Combines device `motionTier` with the OS reduce-motion accessibility setting.
 * Subscribes to `reduceMotionChanged` — Reanimated 4.5 has no `useReducedMotion`.
 */
export function useM3MotionProfile(): M3MotionProfile {
  const [prefersReducedMotion, setPrefersReducedMotionState] = useState(false);

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!mounted) return;
      setPrefersReducedMotionState(enabled);
      setPrefersReducedMotion(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        setPrefersReducedMotionState(enabled);
        setPrefersReducedMotion(enabled);
      },
    );

    return () => {
      mounted = false;
      subscription.remove();
      setPrefersReducedMotion(false);
    };
  }, []);

  const tier = useMemo<M3MotionTier>(
    () => (motionTier === "reduced" || prefersReducedMotion ? "reduced" : "full"),
    [prefersReducedMotion],
  );

  return { tier, prefersReducedMotion };
}

/** Mount once at app root so non-hook motion helpers see OS reduce-motion. */
export function M3MotionProfileBridge(): null {
  useM3MotionProfile();
  return null;
}
