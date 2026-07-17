import type { LayoutRectangle } from "react-native";

export const READER_ACTION_BAR_TOOLTIP_WIDTH_PX = 260;
export const READER_ACTION_BAR_TOOLTIP_GAP_ABOVE_PX = 20;
export const READER_ACTION_BAR_TOOLTIP_AUTO_DISMISS_MS = 2500;
export const READER_ACTION_BAR_TOOLTIP_PAD_TOP_PX = 10;
export const READER_ACTION_BAR_TOOLTIP_PAD_BOTTOM_PX = 10;
const SCREEN_EDGE_INSET_PX = 16;

/** Fixed-width tooltip above the action bar, edge-aligned to the tapped button. */
export function computeActionBarTooltipPosition(
  buttonAnchor: LayoutRectangle,
  actionBarTop: number,
  screenW: number,
  tooltipWidth = READER_ACTION_BAR_TOOLTIP_WIDTH_PX,
): { left: number; top: number; width: number } {
  // `top` is the gap line; tooltip uses translateY(-100%) so its bottom sits on this line.
  const top = actionBarTop - READER_ACTION_BAR_TOOLTIP_GAP_ABOVE_PX;

  let left = buttonAnchor.x;
  if (left + tooltipWidth > screenW - SCREEN_EDGE_INSET_PX) {
    left = buttonAnchor.x + buttonAnchor.width - tooltipWidth;
  }

  left = Math.max(SCREEN_EDGE_INSET_PX, Math.min(left, screenW - tooltipWidth - SCREEN_EDGE_INSET_PX));

  return { left, top, width: tooltipWidth };
}
