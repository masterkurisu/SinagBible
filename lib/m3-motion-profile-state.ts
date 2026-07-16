import { motionTier } from "@/lib/device-capability";

let prefersReducedMotionEnabled = false;

/** Updated by `useM3MotionProfile` when OS reduce-motion changes. */
export function setPrefersReducedMotion(enabled: boolean): void {
  prefersReducedMotionEnabled = enabled;
}

/** True on low-RAM Android (`motionTier`) or when the user enables reduce motion. */
export function isM3ReducedMotion(): boolean {
  return motionTier === "reduced" || prefersReducedMotionEnabled;
}
