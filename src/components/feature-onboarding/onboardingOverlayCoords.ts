import { type LayoutRectangle } from "react-native";

/**
 * Y-offset when mapping measured anchors onto full-screen `Modal` overlays with
 * `statusBarTranslucent`.
 *
 * RN 0.86 + edge-to-edge (`edgeToEdgeEnabled` in gradle.properties): `measureInWindow`
 * returns full-window coordinates that already match the modal coordinate space.
 *
 * Pre-0.86 Android subtracted status-bar insets from `measureInWindow`, so callers
 * added `StatusBar.currentHeight` here to align spotlights/coachmarks with targets.
 */
export function onboardingModalYOffset(): number {
  return 0;
}

export function adjustAnchorForOnboardingModal(rect: LayoutRectangle): LayoutRectangle {
  const offsetY = onboardingModalYOffset();
  if (offsetY === 0) return rect;
  return { ...rect, y: rect.y + offsetY };
}

export function adjustAnchorsForOnboardingModal(rects: LayoutRectangle[]): LayoutRectangle[] {
  const offsetY = onboardingModalYOffset();
  if (offsetY === 0) return rects;
  return rects.map((rect) => ({ ...rect, y: rect.y + offsetY }));
}
