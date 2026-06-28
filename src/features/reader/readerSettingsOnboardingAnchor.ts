import type { LayoutRectangle } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";

/** Resolves a full-width settings row measurement to the visible right-hand strip. */
export function visibleSettingsRowAnchor(
  measured: LayoutRectangle,
  screenW: number,
  insets: EdgeInsets,
  revealedStripWidthPx: number,
): LayoutRectangle {
  const visibleStripW = revealedStripWidthPx;
  const x = screenW - visibleStripW - Math.max(insets.right, 10);
  return {
    x,
    y: measured.y,
    width: visibleStripW,
    height: measured.height,
  };
}

export function fallbackSettingsRowAnchor(
  stepIndex: number,
  screenW: number,
  screenH: number,
  scrollPaddingTop: number,
  insets: EdgeInsets,
  revealedStripWidthPx: number,
  rowHeightPx: number,
  rowGapPx: number,
  deleteMyDataBottomPx: number,
  isDeleteMyData: boolean,
): LayoutRectangle {
  const x = screenW - revealedStripWidthPx - Math.max(insets.right, 10);

  if (isDeleteMyData) {
    return {
      x,
      y: screenH - deleteMyDataBottomPx - rowHeightPx,
      width: revealedStripWidthPx,
      height: rowHeightPx,
    };
  }

  const y = scrollPaddingTop + Math.max(0, stepIndex) * (rowHeightPx + rowGapPx);
  return { x, y, width: revealedStripWidthPx, height: rowHeightPx };
}
