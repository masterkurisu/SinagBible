import { Platform, type LayoutRectangle } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import type { SpotlightTarget } from "@/src/components/feature-onboarding/SpotlightOverlay";

export const READER_HEADER_TOOLS_PILL_WIDTH = 92;
export const READER_HEADER_TOOL_BUTTON_SIZE = 44;
/** iOS native stack navigation bar content height below the status bar. */
const IOS_NAV_BAR_HEIGHT = 44;
const HEADER_TOOLS_RIGHT_INSET = 16;

export function isPlausibleHeaderToolsPillRect(
  rect: LayoutRectangle | null | undefined,
  insets: EdgeInsets,
  screenW: number,
): rect is LayoutRectangle {
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;

  const expectedMinY = insets.top - 6;
  const expectedMaxY = insets.top + IOS_NAV_BAR_HEIGHT + 12;
  const expectedMaxX = screenW - Math.max(insets.right, 8);
  const expectedMinX = screenW * 0.45;

  return (
    rect.y >= expectedMinY &&
    rect.y <= expectedMaxY &&
    rect.x >= expectedMinX &&
    rect.x + rect.width <= expectedMaxX + 4 &&
    rect.width >= READER_HEADER_TOOLS_PILL_WIDTH - 12 &&
    rect.width <= READER_HEADER_TOOLS_PILL_WIDTH + 12 &&
    rect.height >= READER_HEADER_TOOL_BUTTON_SIZE - 8 &&
    rect.height <= READER_HEADER_TOOL_BUTTON_SIZE + 8
  );
}

/**
 * Computes header tool pill position from safe-area + nav bar geometry.
 * Used on iOS/iPadOS where `measureInWindow` on native header views is unreliable.
 */
export function estimateReaderHeaderToolsPillRect(
  insets: EdgeInsets,
  screenW: number,
  androidTopToolsTopPx: number,
): LayoutRectangle {
  const height = READER_HEADER_TOOL_BUTTON_SIZE;
  const width = READER_HEADER_TOOLS_PILL_WIDTH;
  const y =
    Platform.OS === "android"
      ? androidTopToolsTopPx
      : insets.top + (IOS_NAV_BAR_HEIGHT - height) / 2;
  const x = screenW - Math.max(insets.right, HEADER_TOOLS_RIGHT_INSET) - width;
  return { x, y, width, height };
}

export function readerHeaderToolTargetsFromPill(
  pill: LayoutRectangle,
): { book: SpotlightTarget; settings: SpotlightTarget } {
  return {
    book: {
      x: pill.x,
      y: pill.y,
      width: READER_HEADER_TOOL_BUTTON_SIZE,
      height: READER_HEADER_TOOL_BUTTON_SIZE,
      borderRadius: READER_HEADER_TOOL_BUTTON_SIZE / 2,
      shape: "circle",
    },
    settings: {
      x: pill.x + pill.width - READER_HEADER_TOOL_BUTTON_SIZE,
      y: pill.y,
      width: READER_HEADER_TOOL_BUTTON_SIZE,
      height: READER_HEADER_TOOL_BUTTON_SIZE,
      borderRadius: READER_HEADER_TOOL_BUTTON_SIZE / 2,
      shape: "circle",
    },
  };
}

/**
 * Resolves book/settings spotlight targets from the tools pill.
 * Native iOS header children report bogus `measureInWindow` coords — always prefer
 * a measured in-screen pill (Android) or safe-area estimate (iOS/iPadOS).
 */
export function resolveReaderHeaderToolTarget(
  which: "book" | "settings",
  headerToolsPillRect: LayoutRectangle | null,
  insets: EdgeInsets,
  screenW: number,
  androidTopToolsTopPx: number,
): SpotlightTarget {
  const pill = isPlausibleHeaderToolsPillRect(headerToolsPillRect, insets, screenW)
    ? headerToolsPillRect
    : estimateReaderHeaderToolsPillRect(insets, screenW, androidTopToolsTopPx);

  return readerHeaderToolTargetsFromPill(pill)[which];
}
