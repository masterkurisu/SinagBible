import type { LayoutRectangle } from "react-native";
import {
  VERSE_TAG_TOOLTIP_MAX_BODY_HEIGHT_PX,
  VERSE_TAG_TOOLTIP_MIN_WIDTH_PX,
} from "@/src/features/verse-tags/verseTagPreviewLimits";

export const VERSE_TAG_TOOLTIP_WIDTH_PX = VERSE_TAG_TOOLTIP_MIN_WIDTH_PX;
export const VERSE_TAG_TOOLTIP_EST_HEIGHT_PX = 168;
export const VERSE_TAG_TOOLTIP_GAP_PX = 8;
const SCREEN_EDGE_INSET_PX = 16;

export type VerseTagTooltipPlacement = "above" | "below";

export type VerseTagTooltipSafeInsets = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
};

export type VerseTagTooltipPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: VerseTagTooltipPlacement;
};

function edgeInset(value: number | undefined): number {
  return Math.max(SCREEN_EDGE_INSET_PX, value ?? SCREEN_EDGE_INSET_PX);
}

/** Rough card height so we can flip before the first onLayout measurement. */
export function estimateVerseTagTooltipHeight(description: string): number {
  const titleBlock = 12 + 24 + 4;
  const bottomPad = 16;
  const lineHeight = 20;
  const charsPerLine = 42;
  const lines = Math.max(2, Math.ceil(Math.max(description.length, 1) / charsPerLine));
  const body = Math.min(VERSE_TAG_TOOLTIP_MAX_BODY_HEIGHT_PX, lines * lineHeight);
  return titleBlock + body + bottomPad;
}

/**
 * Positions the verse-tag preview above the chip when it fully fits under the
 * status bar. Flips below when the top edge is tight, then clamps on-screen.
 */
export function computeVerseTagTooltipPosition(
  anchor: LayoutRectangle,
  screenW: number,
  screenH: number,
  tooltipWidth = VERSE_TAG_TOOLTIP_WIDTH_PX,
  estimatedHeight = VERSE_TAG_TOOLTIP_EST_HEIGHT_PX,
  safeInsets: VerseTagTooltipSafeInsets = {},
): VerseTagTooltipPosition {
  const insetLeft = edgeInset(safeInsets.left);
  const insetRight = edgeInset(safeInsets.right);
  const insetTop = edgeInset(safeInsets.top);
  const insetBottom = edgeInset(safeInsets.bottom);

  const width = Math.min(tooltipWidth, Math.max(0, screenW - insetLeft - insetRight));
  const centeredLeft = anchor.x + anchor.width / 2 - width / 2;
  const maxLeft = screenW - width - insetRight;
  const left = Math.max(insetLeft, Math.min(centeredLeft, maxLeft));

  const needed = estimatedHeight + VERSE_TAG_TOOLTIP_GAP_PX;
  const spaceAbove = anchor.y - insetTop;
  const spaceBelow = screenH - insetBottom - (anchor.y + anchor.height);
  const fitsAbove = spaceAbove >= needed;
  const fitsBelow = spaceBelow >= needed;

  let placement: VerseTagTooltipPlacement = "above";
  if (!fitsAbove && fitsBelow) {
    placement = "below";
  } else if (!fitsAbove && !fitsBelow) {
    placement = spaceBelow > spaceAbove ? "below" : "above";
  }

  const aboveTop = anchor.y - estimatedHeight - VERSE_TAG_TOOLTIP_GAP_PX;
  const belowTop = anchor.y + anchor.height + VERSE_TAG_TOOLTIP_GAP_PX;
  const maxTop = screenH - estimatedHeight - insetBottom;
  let top = placement === "above" ? aboveTop : belowTop;
  top = Math.max(insetTop, Math.min(top, Math.max(insetTop, maxTop)));

  const maxHeight = Math.max(
    96,
    placement === "above"
      ? anchor.y - VERSE_TAG_TOOLTIP_GAP_PX - insetTop
      : screenH - insetBottom - top,
  );

  return { left, top, width, maxHeight, placement };
}
