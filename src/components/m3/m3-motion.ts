import { Easing } from "react-native";
import {
  Easing as ReanimatedEasing,
  runOnJS,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { motionTier } from "@/lib/device-capability";

/** M3 emphasized decelerate — elements entering the screen. */
export const M3_EMPHASIZED_DECELERATE_EASING = Easing.bezier(0.05, 0.7, 0.1, 1);

/** M3 emphasized accelerate — elements leaving the screen. */
export const M3_EMPHASIZED_ACCELERATE_EASING = Easing.bezier(0.3, 0, 0.8, 0.15);

/** M3 standard decelerate — on-screen motion that ends at rest. */
export const M3_STANDARD_DECELERATE_EASING = Easing.bezier(0, 0, 0, 1);

/** Reanimated — M3 emphasized decelerate (enter). */
export const M3_EMPHASIZED_DECELERATE_REANIMATED = ReanimatedEasing.bezier(0.05, 0.7, 0.1, 1);

/** Reanimated — M3 emphasized accelerate (exit). */
export const M3_EMPHASIZED_ACCELERATE_REANIMATED = ReanimatedEasing.bezier(0.3, 0, 0.8, 0.15);

/** Reanimated — M3 standard decelerate (on-screen settle). */
export const M3_STANDARD_DECELERATE_REANIMATED = ReanimatedEasing.bezier(0, 0, 0, 1);

/** M3 short duration token — quick exits (snackbar dismiss, chrome hide). */
export const M3_MOTION_DURATION_SHORT3_MS = 150;

/** M3 short duration token — compact enters. */
export const M3_MOTION_DURATION_SHORT4_MS = 200;

/** M3 medium duration token — utility transitions. */
export const M3_MOTION_DURATION_MEDIUM1_MS = 250;

/** M3 medium duration token — on-screen reposition (keyboard sheet lift). */
export const M3_MOTION_DURATION_MEDIUM2_MS = 300;

/** M3 long duration token — larger traversal (dialogs, expanded panels). */
export const M3_MOTION_DURATION_LONG1_MS = 450;

/** M3 long duration token — full-screen / container-transform enter (MDC theme default). */
export const M3_MOTION_DURATION_LONG2_MS = 500;

/**
 * MDC MaterialContainerTransform incoming duration — 300 ms.
 * Named separately from LONG2 because the library maps enter/return to distinct theme slots.
 */
export const M3_CONTAINER_TRANSFORM_ENTER_MS = 300;

/**
 * MDC MaterialContainerTransform outgoing duration — 250 ms.
 * Named separately from MEDIUM1 because the library maps enter/return to distinct theme slots.
 */
export const M3_CONTAINER_TRANSFORM_RETURN_MS = 250;

/** Shape of M3 spring presets for Reanimated `withSpring`. */
export type M3SpringConfig = {
  damping: number;
  stiffness: number;
  mass: number;
};

/**
 * Fast spatial spring — switches, buttons, chips.
 * Rule: spatial = spring; opacity/color = effects spring or timing with emphasized easing.
 */
export const M3_SPRING_FAST_SPATIAL: M3SpringConfig = {
  damping: 67.3,
  stiffness: 1400,
  mass: 1,
};

/**
 * Default spatial spring — bottom sheets, drawers, search pill.
 * Rule: spatial = spring; opacity/color = effects spring or timing with emphasized easing.
 */
export const M3_SPRING_DEFAULT_SPATIAL: M3SpringConfig = {
  damping: 47.6,
  stiffness: 700,
  mass: 1,
};

/**
 * Slow spatial spring — full-screen transitions.
 * Rule: spatial = spring; opacity/color = effects spring or timing with emphasized easing.
 */
export const M3_SPRING_SLOW_SPATIAL: M3SpringConfig = {
  damping: 31.2,
  stiffness: 300,
  mass: 1,
};

/**
 * Fast effects spring — opacity/color on small components (critically damped; no overshoot).
 * Rule: spatial = spring; opacity/color = effects spring or timing with emphasized easing.
 */
export const M3_SPRING_FAST_EFFECTS: M3SpringConfig = {
  damping: 123.3,
  stiffness: 3800,
  mass: 1,
};

/**
 * Default effects spring — opacity/color on partial-screen UI (critically damped; no overshoot).
 * Rule: spatial = spring; opacity/color = effects spring or timing with emphasized easing.
 */
export const M3_SPRING_DEFAULT_EFFECTS: M3SpringConfig = {
  damping: 80.0,
  stiffness: 1600,
  mass: 1,
};

/**
 * Slow effects spring — opacity/color on full-screen transitions (critically damped; no overshoot).
 * Rule: spatial = spring; opacity/color = effects spring or timing with emphasized easing.
 */
export const M3_SPRING_SLOW_EFFECTS: M3SpringConfig = {
  damping: 56.6,
  stiffness: 800,
  mass: 1,
};

/** M3 standard scrim — 32% black (MaterialContainerTransform default). */
export const M3_SCRIM_OPACITY = 0.32;

const REDUCED_MOTION = motionTier === "reduced";

/** Opacity/color channel — timing with emphasized easing (no spring overshoot). */
export function animateM3EffectsOpacity(
  value: SharedValue<number>,
  target: number,
  entering: boolean,
  onComplete?: () => void,
): void {
  value.value = withTiming(
    target,
    {
      duration: entering ? M3_CONTAINER_TRANSFORM_ENTER_MS : M3_CONTAINER_TRANSFORM_RETURN_MS,
      easing: entering ? M3_EMPHASIZED_DECELERATE_REANIMATED : M3_EMPHASIZED_ACCELERATE_REANIMATED,
    },
    (finished) => {
      if (finished && onComplete) {
        runOnJS(onComplete)();
      }
    },
  );
}

/** Spatial channel — spring on standard tier, timing on reduced-motion Android. */
export function animateM3SpatialProgress(
  value: SharedValue<number>,
  target: number,
  entering: boolean,
): void {
  if (REDUCED_MOTION) {
    value.value = withTiming(target, {
      duration: entering ? M3_CONTAINER_TRANSFORM_ENTER_MS : M3_CONTAINER_TRANSFORM_RETURN_MS,
      easing: entering ? M3_EMPHASIZED_DECELERATE_REANIMATED : M3_EMPHASIZED_ACCELERATE_REANIMATED,
    });
    return;
  }

  value.value = withSpring(target, M3_SPRING_DEFAULT_SPATIAL);
}
