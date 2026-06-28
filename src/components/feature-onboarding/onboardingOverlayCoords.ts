import { Platform, StatusBar, type LayoutRectangle } from "react-native";

/**
 * On Android, `measureInWindow` coords are often relative to the app content area
 * (below the status bar) while `Modal` + `statusBarTranslucent` overlays use the
 * full screen origin — shift anchors down so spotlights/coachmarks align with targets.
 */
export function onboardingModalYOffset(): number {
  if (Platform.OS !== "android") return 0;
  return StatusBar.currentHeight ?? 0;
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
