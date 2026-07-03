import { Platform, type LayoutRectangle } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import type { JournalDetailOnboardingStepId } from "@/src/features/journal/journalDetailOnboardingSteps";
import {
  READER_M3_APP_BAR_CONTENT_HEIGHT_PX,
  READER_M3_APP_BAR_ICON_BUTTON_PX,
} from "@/src/features/reader/readerSettingsPanelChrome";

/** iOS native stack navigation bar content height below the status bar. */
const IOS_NAV_BAR_HEIGHT = 44;
const IOS_EXPORT_ACTION_PX = 40;
const IOS_EXPORT_ACTION_GAP_PX = 2;
const IOS_EXPORT_ACTION_MARGIN_RIGHT_PX = 2;

const EXPORT_ACTION_COUNT = 3;

/** Trailing export actions render left-to-right: share, save, PDF. */
const EXPORT_ACTION_INDEX: Record<JournalDetailOnboardingStepId, number> = {
  "share-as-image": 0,
  "save-to-library": 1,
  "export-as-pdf": 2,
};

function exportActionIndexFromRight(stepId: JournalDetailOnboardingStepId): number {
  return EXPORT_ACTION_COUNT - 1 - EXPORT_ACTION_INDEX[stepId];
}

export function journalDetailExportActionTargetFromTrailingRow(
  row: LayoutRectangle,
  stepId: JournalDetailOnboardingStepId,
  buttonSizePx: number,
): LayoutRectangle {
  const index = EXPORT_ACTION_INDEX[stepId];
  return {
    x: row.x + index * buttonSizePx,
    y: row.y + (row.height - buttonSizePx) / 2,
    width: buttonSizePx,
    height: buttonSizePx,
  };
}

export function estimateJournalDetailAndroidExportActionRect(
  stepId: JournalDetailOnboardingStepId,
  insets: EdgeInsets,
  screenW: number,
  androidTopToolsTopPx: number,
): LayoutRectangle {
  const size = READER_M3_APP_BAR_ICON_BUTTON_PX;
  const sideInset = Math.max(insets.right, 4);
  const indexFromRight = exportActionIndexFromRight(stepId);
  const y = androidTopToolsTopPx + (READER_M3_APP_BAR_CONTENT_HEIGHT_PX - size) / 2;
  const x = screenW - sideInset - size * (indexFromRight + 1);
  return { x, y, width: size, height: size };
}

export function estimateJournalDetailIosExportActionRect(
  stepId: JournalDetailOnboardingStepId,
  insets: EdgeInsets,
  screenW: number,
): LayoutRectangle {
  const size = IOS_EXPORT_ACTION_PX;
  const indexFromRight = exportActionIndexFromRight(stepId);
  const y = insets.top + (IOS_NAV_BAR_HEIGHT - size) / 2;
  const rightEdge = screenW - IOS_EXPORT_ACTION_MARGIN_RIGHT_PX;
  const x =
    rightEdge - size * (indexFromRight + 1) - IOS_EXPORT_ACTION_GAP_PX * indexFromRight;
  return { x, y, width: size, height: size };
}

export function isPlausibleJournalDetailExportActionRect(
  rect: LayoutRectangle | null | undefined,
  insets: EdgeInsets,
  screenW: number,
  androidTopToolsTopPx: number,
): rect is LayoutRectangle {
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;

  const expectedMinY =
    Platform.OS === "android" ? androidTopToolsTopPx - 4 : insets.top - 4;
  const expectedMaxY =
    Platform.OS === "android"
      ? androidTopToolsTopPx + READER_M3_APP_BAR_CONTENT_HEIGHT_PX + 8
      : insets.top + IOS_NAV_BAR_HEIGHT + 8;
  const minSize = Platform.OS === "android" ? READER_M3_APP_BAR_ICON_BUTTON_PX - 8 : IOS_EXPORT_ACTION_PX - 8;
  const maxSize = Platform.OS === "android" ? READER_M3_APP_BAR_ICON_BUTTON_PX + 8 : IOS_EXPORT_ACTION_PX + 8;

  return (
    rect.y >= expectedMinY &&
    rect.y <= expectedMaxY &&
    rect.x >= screenW * 0.45 &&
    rect.x + rect.width <= screenW + 4 &&
    rect.width >= minSize &&
    rect.width <= maxSize &&
    rect.height >= minSize &&
    rect.height <= maxSize
  );
}

export function isPlausibleJournalDetailTrailingActionsRow(
  rect: LayoutRectangle | null | undefined,
  androidTopToolsTopPx: number,
): rect is LayoutRectangle {
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;

  const expectedMinWidth = READER_M3_APP_BAR_ICON_BUTTON_PX * EXPORT_ACTION_COUNT - 12;
  const expectedMaxWidth = READER_M3_APP_BAR_ICON_BUTTON_PX * EXPORT_ACTION_COUNT + 12;

  return (
    rect.y >= androidTopToolsTopPx - 4 &&
    rect.y <= androidTopToolsTopPx + READER_M3_APP_BAR_CONTENT_HEIGHT_PX + 8 &&
    rect.width >= expectedMinWidth &&
    rect.width <= expectedMaxWidth &&
    rect.height >= READER_M3_APP_BAR_ICON_BUTTON_PX - 8 &&
    rect.height <= READER_M3_APP_BAR_ICON_BUTTON_PX + 8
  );
}

export function resolveJournalDetailExportActionAnchor(
  stepId: JournalDetailOnboardingStepId,
  measuredButton: LayoutRectangle | null,
  measuredTrailingRow: LayoutRectangle | null,
  insets: EdgeInsets,
  screenW: number,
  androidTopToolsTopPx: number,
): LayoutRectangle {
  if (Platform.OS === "ios") {
    return estimateJournalDetailIosExportActionRect(stepId, insets, screenW);
  }

  if (
    isPlausibleJournalDetailTrailingActionsRow(measuredTrailingRow, androidTopToolsTopPx)
  ) {
    return journalDetailExportActionTargetFromTrailingRow(
      measuredTrailingRow,
      stepId,
      READER_M3_APP_BAR_ICON_BUTTON_PX,
    );
  }

  if (
    isPlausibleJournalDetailExportActionRect(
      measuredButton,
      insets,
      screenW,
      androidTopToolsTopPx,
    )
  ) {
    return measuredButton;
  }

  return estimateJournalDetailAndroidExportActionRect(
    stepId,
    insets,
    screenW,
    androidTopToolsTopPx,
  );
}
