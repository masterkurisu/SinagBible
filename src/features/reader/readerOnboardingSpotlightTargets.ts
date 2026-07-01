import type { LayoutRectangle } from "react-native";
import type { SpotlightTarget } from "@/src/components/feature-onboarding/SpotlightOverlay";

/** Visual center offset of the glyph inside measured button bounds (icon wrapper transforms). */
export type IconVisualCenterOffset = { dx: number; dy: number };

export type ReaderHeaderIconSpotlightId = "book" | "settings" | "font";

export const READER_HEADER_ICON_VISUAL_OFFSET: Record<ReaderHeaderIconSpotlightId, IconVisualCenterOffset> = {
  book: { dx: 0, dy: -4 },
  settings: { dx: 2, dy: -4 },
  font: { dx: 0, dy: 0 },
};

export const READER_HEADER_ICON_SPOTLIGHT_DIAMETER_PX: Record<ReaderHeaderIconSpotlightId, number> = {
  book: 36,
  settings: 40,
  font: 36,
};

export const READER_PAGE_TURN_ICON_VISUAL_OFFSET: Record<"prev" | "next", IconVisualCenterOffset> = {
  prev: { dx: 0, dy: -8 },
  next: { dx: 8, dy: -8 },
};

export const READER_PAGE_TURN_SPOTLIGHT_DIAMETER_PX = 52;

/** Builds a circle spotlight centered on the icon glyph, not the touch-target bounds. */
export function centeredIconSpotlightTarget(
  rect: LayoutRectangle,
  centerOffset: IconVisualCenterOffset,
  diameterPx: number,
): SpotlightTarget {
  const cx = rect.x + rect.width / 2 + centerOffset.dx;
  const cy = rect.y + rect.height / 2 + centerOffset.dy;
  return {
    x: cx - diameterPx / 2,
    y: cy - diameterPx / 2,
    width: diameterPx,
    height: diameterPx,
    borderRadius: diameterPx / 2,
    shape: "circle",
  };
}

export function readerHeaderIconSpotlight(
  which: ReaderHeaderIconSpotlightId,
  rect: LayoutRectangle,
): SpotlightTarget {
  return centeredIconSpotlightTarget(
    rect,
    READER_HEADER_ICON_VISUAL_OFFSET[which],
    READER_HEADER_ICON_SPOTLIGHT_DIAMETER_PX[which],
  );
}

export function readerPageTurnIconSpotlight(
  which: "prev" | "next",
  rect: LayoutRectangle,
): SpotlightTarget {
  return centeredIconSpotlightTarget(
    rect,
    READER_PAGE_TURN_ICON_VISUAL_OFFSET[which],
    READER_PAGE_TURN_SPOTLIGHT_DIAMETER_PX,
  );
}
