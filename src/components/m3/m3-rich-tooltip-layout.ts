import type { LayoutRectangle } from "react-native";

export const M3_RICH_TOOLTIP_WIDTH_PX = 280;
export const M3_RICH_TOOLTIP_EST_HEIGHT_PX = 132;
const SCREEN_EDGE_INSET_PX = 16;
const ANCHOR_GAP_PX = 12;

/** Positions an M3 rich tooltip beside or above the anchor, keeping it on screen. */
export function computeM3RichTooltipPosition(
  anchor: LayoutRectangle,
  screenW: number,
  screenH: number,
  tooltipWidth = M3_RICH_TOOLTIP_WIDTH_PX,
  estimatedHeight = M3_RICH_TOOLTIP_EST_HEIGHT_PX,
): { left: number; top: number; width: number } {
  const maxLeft = screenW - tooltipWidth - SCREEN_EDGE_INSET_PX;
  const rightOfAnchor = anchor.x + anchor.width + ANCHOR_GAP_PX;
  let left =
    rightOfAnchor <= maxLeft
      ? rightOfAnchor
      : Math.max(SCREEN_EDGE_INSET_PX, Math.min(anchor.x, maxLeft));

  const centeredTop = anchor.y + anchor.height / 2 - estimatedHeight / 2;
  const top = Math.max(
    SCREEN_EDGE_INSET_PX,
    Math.min(centeredTop, screenH - estimatedHeight - SCREEN_EDGE_INSET_PX),
  );

  const width = Math.min(tooltipWidth, screenW - SCREEN_EDGE_INSET_PX * 2);

  return { left, top, width };
}
