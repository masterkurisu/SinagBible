import { Platform, type LayoutRectangle } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import type { SpotlightTarget } from "@/src/components/feature-onboarding/SpotlightOverlay";
import {
  READER_M3_APP_BAR_CONTENT_HEIGHT_PX,
  READER_M3_APP_BAR_ICON_BUTTON_PX,
} from "@/src/features/reader/readerSettingsPanelChrome";

export const READER_HEADER_TOOLS_PILL_WIDTH = 92;
export const READER_HEADER_TOOL_BUTTON_SIZE = 44;
/** iOS native stack navigation bar content height below the status bar. */
const IOS_NAV_BAR_HEIGHT = 44;
const HEADER_TOOLS_EDGE_INSET = 16;

/** iOS phone navigation rail — book/settings pill sits below the status bar, not in the stack header. */
export function estimateReaderNavigationRailToolsPillRect(
  insets: EdgeInsets,
  headerToolsTopPx: number,
): LayoutRectangle {
  const height = READER_HEADER_TOOL_BUTTON_SIZE;
  const width = READER_HEADER_TOOLS_PILL_WIDTH;
  return {
    x: Math.max(insets.left, HEADER_TOOLS_EDGE_INSET),
    y: headerToolsTopPx,
    width,
    height,
  };
}

export function isPlausibleHeaderToolsPillRect(
  rect: LayoutRectangle | null | undefined,
  insets: EdgeInsets,
  screenW: number,
  toolsOnLeft: boolean,
): rect is LayoutRectangle {
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;

  const expectedMinY = insets.top - 6;
  const expectedMaxY = insets.top + IOS_NAV_BAR_HEIGHT + 12;

  if (toolsOnLeft) {
    const expectedMinX = Math.max(insets.left, 8);
    const expectedMaxX = screenW * 0.55;
    return (
      rect.y >= expectedMinY &&
      rect.y <= expectedMaxY &&
      rect.x >= expectedMinX - 4 &&
      rect.x + rect.width <= expectedMaxX &&
      rect.width >= READER_HEADER_TOOLS_PILL_WIDTH - 12 &&
      rect.width <= READER_HEADER_TOOLS_PILL_WIDTH + 12 &&
      rect.height >= READER_HEADER_TOOL_BUTTON_SIZE - 8 &&
      rect.height <= READER_HEADER_TOOL_BUTTON_SIZE + 8
    );
  }

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
  toolsOnLeft: boolean,
): LayoutRectangle {
  const height = READER_HEADER_TOOL_BUTTON_SIZE;
  const width = READER_HEADER_TOOLS_PILL_WIDTH;
  const y =
    Platform.OS === "android"
      ? androidTopToolsTopPx
      : insets.top + (IOS_NAV_BAR_HEIGHT - height) / 2;
  const x = toolsOnLeft
    ? Math.max(insets.left, HEADER_TOOLS_EDGE_INSET)
    : screenW - Math.max(insets.right, HEADER_TOOLS_EDGE_INSET) - width;
  return { x, y, width, height };
}

export function estimateReaderAndroidAppBarToolRect(
  which: "book" | "settings" | "font",
  insets: EdgeInsets,
  screenW: number,
  androidTopToolsTopPx: number,
): LayoutRectangle {
  const size = READER_M3_APP_BAR_ICON_BUTTON_PX;
  const y = androidTopToolsTopPx + (READER_M3_APP_BAR_CONTENT_HEIGHT_PX - size) / 2;
  const sideInset = Math.max(insets.left, insets.right, 4);

  switch (which) {
    case "book":
      return {
        x: screenW - sideInset - size * 2,
        y,
        width: size,
        height: size,
      };
    case "settings":
      return { x: sideInset, y, width: size, height: size };
    case "font":
      return {
        x: screenW - sideInset - size,
        y,
        width: size,
        height: size,
      };
  }
}

export function isPlausibleAndroidAppBarRect(
  rect: LayoutRectangle | null | undefined,
  screenW: number,
): rect is LayoutRectangle {
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;
  return rect.width >= screenW * 0.85 && rect.height >= READER_M3_APP_BAR_CONTENT_HEIGHT_PX - 8;
}

export function readerAndroidAppBarToolTargetsFromBar(
  bar: LayoutRectangle,
  insets: EdgeInsets,
  screenW: number,
): { book: SpotlightTarget; settings: SpotlightTarget; font: SpotlightTarget } {
  const size = READER_M3_APP_BAR_ICON_BUTTON_PX;
  const sideInset = Math.max(insets.left, insets.right, 4);
  const y = bar.y + (bar.height - size) / 2;
  const circle = (x: number): SpotlightTarget => ({
    x,
    y,
    width: size,
    height: size,
    borderRadius: size / 2,
    shape: "circle",
  });

  return {
    book: circle(screenW - sideInset - size * 2),
    settings: circle(sideInset),
    font: circle(screenW - sideInset - size),
  };
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
  toolsOnLeft: boolean,
): SpotlightTarget {
  if (Platform.OS === "android") {
    const appBarRect = isPlausibleAndroidAppBarRect(headerToolsPillRect, screenW)
      ? headerToolsPillRect
      : null;
    if (appBarRect) {
      return readerAndroidAppBarToolTargetsFromBar(appBarRect, insets, screenW)[which];
    }
    const rect = estimateReaderAndroidAppBarToolRect(which, insets, screenW, androidTopToolsTopPx);
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      borderRadius: rect.width / 2,
      shape: "circle",
    };
  }

  const pill = isPlausibleHeaderToolsPillRect(headerToolsPillRect, insets, screenW, toolsOnLeft)
    ? headerToolsPillRect
    : estimateReaderHeaderToolsPillRect(insets, screenW, androidTopToolsTopPx, toolsOnLeft);

  return readerHeaderToolTargetsFromPill(pill)[which];
}
