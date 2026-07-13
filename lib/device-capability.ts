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

export type MotionTier = "reduced" | "standard";

/**
 * Device motion budget — drives sheet timings, deferred mounts, and scroll tuning.
 * `reduced` on low-RAM Android; `standard` everywhere else.
 */
export const motionTier: MotionTier = isLowEndDevice ? "reduced" : "standard";

export const READER_FLASH_LIST_DRAW_DISTANCE_PX = motionTier === "reduced" ? 200 : 500;

/** FlashList scrollEventThrottle — fewer JS bridge crossings on low-RAM Android. */
export const READER_SCROLL_EVENT_THROTTLE = motionTier === "reduced" ? 32 : 8;

/** Min scroll delta (px) before runOnJS nav-arrow side effects fire. */
export const READER_SCROLL_JS_BRIDGE_DELTA_PX = motionTier === "reduced" ? 24 : 8;

/** Primary bottom-sheet slide-in duration. */
export const SHEET_OPEN_DURATION_MS = motionTier === "reduced" ? 200 : 280;

/** Android scrim fade on sheet open. */
export const SHEET_SCRIM_DURATION_MS = motionTier === "reduced" ? 160 : 200;

/** Nested sheet (e.g. language filter) slide-in duration. */
export const NESTED_SHEET_OPEN_DURATION_MS = motionTier === "reduced" ? 200 : 240;

/** iOS primary sheet uses spring on standard tier; reduced tier uses timing for a predictable defer window. */
export const SHEET_OPEN_USE_SPRING = motionTier === "standard" && Platform.OS === "ios";

/** Mount heavy list bodies after the open animation (+ InteractionManager buffer). */
export const DEFER_SHEET_HEAVY_CONTENT = true;

/** Extra ms after animation ends before scheduling the heavy mount. */
export const SHEET_CONTENT_MOUNT_BUFFER_MS = motionTier === "reduced" ? 48 : 16;
