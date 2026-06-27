import { Platform, type LayoutRectangle } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import type { SpotlightTarget } from "@/src/components/feature-onboarding/SpotlightOverlay";

const TOOL_PILL_WIDTH = 92;
const TOOL_BUTTON_SIZE = 44;

export function estimateReaderHeaderToolsPillRect(
  insets: EdgeInsets,
  screenW: number,
  androidTopToolsTopPx: number,
): LayoutRectangle {
  const height = TOOL_BUTTON_SIZE;
  const width = TOOL_PILL_WIDTH;
  const y = Platform.OS === "android" ? androidTopToolsTopPx : insets.top + 2;
  const x = screenW - Math.max(insets.right, 16) - width;
  return { x, y, width, height };
}

export function readerHeaderToolTargetsFromPill(
  pill: LayoutRectangle,
): { book: SpotlightTarget; settings: SpotlightTarget } {
  return {
    book: {
      x: pill.x,
      y: pill.y,
      width: TOOL_BUTTON_SIZE,
      height: TOOL_BUTTON_SIZE,
      borderRadius: TOOL_BUTTON_SIZE / 2,
      shape: "circle",
    },
    settings: {
      x: pill.x + pill.width - TOOL_BUTTON_SIZE,
      y: pill.y,
      width: TOOL_BUTTON_SIZE,
      height: TOOL_BUTTON_SIZE,
      borderRadius: TOOL_BUTTON_SIZE / 2,
      shape: "circle",
    },
  };
}
