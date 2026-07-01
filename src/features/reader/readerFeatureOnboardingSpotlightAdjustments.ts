import type { SpotlightTarget } from "@/src/components/feature-onboarding/SpotlightOverlay";
import type { ReaderOnboardingStep } from "@/src/features/reader/useReaderFeatureOnboarding";

/** Shifts spotlight center and optionally scales size (scale < 1 shrinks). */
export function nudgeSpotlightTarget(
  target: SpotlightTarget,
  dx: number,
  dy: number,
  scale = 1,
): SpotlightTarget {
  const cx = target.x + target.width / 2 + dx;
  const cy = target.y + target.height / 2 + dy;
  const width = target.width * scale;
  const height = target.height * scale;
  const borderRadius =
    target.shape === "circle"
      ? Math.max(width, height) / 2
      : target.borderRadius != null
        ? target.borderRadius * scale
        : undefined;
  return {
    ...target,
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    borderRadius,
  };
}

function spotlightNudgeForStep(step: ReaderOnboardingStep): { dx: number; dy: number; scale: number } {
  switch (step) {
    case "book-selector":
      return { dx: 0, dy: -10, scale: 0.8 };
    case "settings":
      return { dx: -10, dy: 0, scale: 0.8 };
    case "page-turns":
      return { dx: 0, dy: -20, scale: 0.8 };
    default:
      return { dx: 0, dy: 0, scale: 1 };
  }
}

/** Visual-only offsets applied when rendering spotlights (not during measurement). */
export function applyReaderFeatureOnboardingSpotlightAdjustments(
  step: ReaderOnboardingStep,
  targets: SpotlightTarget[],
): SpotlightTarget[] {
  const { dx, dy, scale } = spotlightNudgeForStep(step);
  if (dx === 0 && dy === 0 && scale === 1) return targets;
  return targets.map((target) => nudgeSpotlightTarget(target, dx, dy, scale));
}
