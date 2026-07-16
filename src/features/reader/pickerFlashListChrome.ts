import {
  PICKER_FLASH_LIST_DRAW_DISTANCE_PX,
  PICKER_SCROLL_EVENT_THROTTLE,
} from "@/lib/device-capability";

/** Shared FlashList perf props for book/translation picker sheets. */
export const pickerFlashListPerfProps = {
  drawDistance: Math.max(PICKER_FLASH_LIST_DRAW_DISTANCE_PX * 2, 800),
  scrollEventThrottle: PICKER_SCROLL_EVENT_THROTTLE,
  // Clipping causes visible blank bands while fast-scrolling picker sheets.
  removeClippedSubviews: false,
};
