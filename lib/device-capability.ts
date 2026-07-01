import * as Device from "expo-device";
import { Platform } from "react-native";

const LOW_END_RAM_BYTES = 5 * 1024 * 1024 * 1024;

/**
 * True when RAM is known to be under 5GB, OR when we can't determine RAM
 * on Android (conservative fallback — better to under-render than crash).
 */
export const isLowEndDevice =
  Platform.OS === "android" &&
  (Device.totalMemory == null || Device.totalMemory < LOW_END_RAM_BYTES);

export const READER_FLASH_LIST_DRAW_DISTANCE_PX = isLowEndDevice ? 200 : 500;

/** FlashList scrollEventThrottle — fewer JS bridge crossings on low-RAM Android. */
export const READER_SCROLL_EVENT_THROTTLE = isLowEndDevice ? 32 : 8;

/** Min scroll delta (px) before runOnJS nav-arrow side effects fire. */
export const READER_SCROLL_JS_BRIDGE_DELTA_PX = isLowEndDevice ? 24 : 8;

/** Tab bar auto-hide — tighter bridge so chrome reacts sooner than nav arrows. */
export const READER_TAB_BAR_SCROLL_JS_BRIDGE_DELTA_PX = isLowEndDevice ? 12 : 4;
