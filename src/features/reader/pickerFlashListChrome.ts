import {
  PICKER_FLASH_LIST_DRAW_DISTANCE_PX,
  PICKER_SCROLL_EVENT_THROTTLE,
} from "@/lib/device-capability";

/** Shared FlashList perf props for book/translation picker sheets. */
export const pickerFlashListPerfProps = {
  drawDistance: PICKER_FLASH_LIST_DRAW_DISTANCE_PX,
  scrollEventThrottle: PICKER_SCROLL_EVENT_THROTTLE,
  removeClippedSubviews: true,
};
