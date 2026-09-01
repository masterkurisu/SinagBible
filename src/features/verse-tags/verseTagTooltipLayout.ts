import type { LayoutRectangle } from "react-native";

export const VERSE_TAG_TOOLTIP_WIDTH_PX = 280;
export const VERSE_TAG_TOOLTIP_EST_HEIGHT_PX = 188;
export const VERSE_TAG_TOOLTIP_GAP_PX = 8;
const SCREEN_EDGE_INSET_PX = 16;

export type VerseTagTooltipPlacement = "above" | "below";

export type VerseTagTooltipPosition = {
  left: number;
  top: number;
  width: number;
  placement: VerseTagTooltipPlacement;
};

/**
 * Positions the verse-tag preview above the chip when possible.
 * Flips below near the top of the screen and centers horizontally on the chip.
 */
export function computeVerseTagTooltipPosition(
  anchor: LayoutRectangle,
  screenW: number,
  screenH: number,
  tooltipWidth = VERSE_TAG_TOOLTIP_WIDTH_PX,
  estimatedHeight = VERSE_TAG_TOOLTIP_EST_HEIGHT_PX,
): VerseTagTooltipPosition {
  const width = Math.min(tooltipWidth, Math.max(0, screenW - SCREEN_EDGE_INSET_PX * 2));
  const centeredLeft = anchor.x + anchor.width / 2 - width / 2;
  const maxLeft = screenW - width - SCREEN_EDGE_INSET_PX;
  const left = Math.max(SCREEN_EDGE_INSET_PX, Math.min(centeredLeft, maxLeft));

  const aboveTop = anchor.y - estimatedHeight - VERSE_TAG_TOOLTIP_GAP_PX;
  const belowTop = anchor.y + anchor.height + VERSE_TAG_TOOLTIP_GAP_PX;
  const maxTop = screenH - estimatedHeight - SCREEN_EDGE_INSET_PX;

  let placement: VerseTagTooltipPlacement = "above";
  let top = aboveTop;
  if (aboveTop < SCREEN_EDGE_INSET_PX) {
    placement = "below";
    top = belowTop;
  }

  top = Math.max(SCREEN_EDGE_INSET_PX, Math.min(top, Math.max(SCREEN_EDGE_INSET_PX, maxTop)));

  return { left, top, width, placement };
}
