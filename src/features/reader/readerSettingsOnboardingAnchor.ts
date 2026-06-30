import type { LayoutRectangle } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import { READER_SETTINGS_NAV_RAIL_ITEM_HEIGHT_PX } from "@/src/features/reader/readerSettingsPanelChrome";

/** Resolves a full-width settings row measurement to the visible left-hand strip. */
export function visibleSettingsRowAnchor(
  measured: LayoutRectangle,
  insets: EdgeInsets,
  revealedStripWidthPx: number,
): LayoutRectangle {
  return {
    x: Math.max(insets.left, 0),
    y: measured.y,
    width: revealedStripWidthPx,
    height: measured.height,
  };
}

/** Navigation rail items are already within the left strip — use measured bounds directly. */
export function navigationRailRowAnchor(measured: LayoutRectangle): LayoutRectangle {
  return measured;
}

export function fallbackNavigationRailRowAnchor(
  stepIndex: number,
  screenH: number,
  scrollPaddingTop: number,
  railWidthPx: number,
  deleteMyDataBottomPx: number,
  isDeleteMyData: boolean,
): LayoutRectangle {
  const railW = railWidthPx;
  const rowH = READER_SETTINGS_NAV_RAIL_ITEM_HEIGHT_PX;
  const rowGap = 4;
  const x = 0;

  if (isDeleteMyData) {
    return {
      x,
      y: screenH - deleteMyDataBottomPx - rowH,
      width: railW,
      height: rowH,
    };
  }

  const y = scrollPaddingTop + Math.max(0, stepIndex) * (rowH + rowGap);
  return { x, y, width: railW, height: rowH };
}

export function fallbackSettingsRowAnchor(
  stepIndex: number,
  screenH: number,
  scrollPaddingTop: number,
  insets: EdgeInsets,
  revealedStripWidthPx: number,
  rowHeightPx: number,
  rowGapPx: number,
  deleteMyDataBottomPx: number,
  isDeleteMyData: boolean,
): LayoutRectangle {
  const x = Math.max(insets.left, 0);

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
