import { ScrollView } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import {
  READER_SCROLL_EVENT_THROTTLE,
  READER_SCROLL_JS_BRIDGE_DELTA_PX,
} from "@/lib/device-capability";
import { isM3ReducedMotion } from "@/lib/m3-motion-profile-state";
import {
  M3_EMPHASIZED_ACCELERATE_REANIMATED,
  M3_EMPHASIZED_DECELERATE_REANIMATED,
  M3_MOTION_DURATION_SHORT3_MS,
  M3_MOTION_DURATION_SHORT4_MS,
  M3_REDUCED_MOTION_CROSSFADE_MS,
} from "@/src/components/m3/m3-motion";

/**
 * Shared `scrollEventThrottle` for reader, picker, and other fling surfaces.
 * Alias of `READER_SCROLL_EVENT_THROTTLE` / `PICKER_SCROLL_EVENT_THROTTLE` (8 ms, or 32 ms on reduced tier).
 */
export const SCROLL_EVENT_THROTTLE = READER_SCROLL_EVENT_THROTTLE;

/**
 * Min scroll delta (px) before `runOnJS` side effects fire.
 * Alias of `READER_SCROLL_JS_BRIDGE_DELTA_PX` (8 px, or 24 px on reduced tier).
 */
export const SCROLL_JS_BRIDGE_DELTA_PX = READER_SCROLL_JS_BRIDGE_DELTA_PX;

/** Reanimated ScrollView for UI-thread `onScroll`. Do not spring `contentOffset`. */
export const AnimatedHighRefreshScrollView = Animated.createAnimatedComponent(ScrollView);

export type HighRefreshJsBridge = (y: number) => void;

export type UseHighRefreshScrollHandlerOptions = {
  scrollY: SharedValue<number>;
  onJsBridge?: HighRefreshJsBridge;
};

/** True when Y has moved enough (or is the first sample) to justify a JS-thread side effect. */
export function shouldFireHighRefreshJsBridge(y: number, lastBridgeY: number): boolean {
  "worklet";
  return lastBridgeY < 0 || Math.abs(y - lastBridgeY) >= SCROLL_JS_BRIDGE_DELTA_PX;
}

/** UI-thread write of scroll Y. Never wrap this in `withSpring` / `withTiming`. */
function assignHighRefreshScrollY(scrollY: SharedValue<number>, y: number): void {
  "worklet";
  scrollY.value = y;
}

/**
 * UI-thread scroll handler: assign `scrollY` every frame, and only `runOnJS` when the
 * delta gate fires. Never spring or interpolate the scroll offset itself.
 */
export function useHighRefreshScrollHandler({
  scrollY,
  onJsBridge,
}: UseHighRefreshScrollHandlerOptions) {
  const lastScrollBridgeY = useSharedValue(-1);

  return useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      assignHighRefreshScrollY(scrollY, y);
      if (onJsBridge == null) {
        return;
      }
      if (shouldFireHighRefreshJsBridge(y, lastScrollBridgeY.value)) {
        lastScrollBridgeY.value = y;
        runOnJS(onJsBridge)(y);
      }
    },
  });
}

/**
 * Opacity-only chrome after scroll rest (FAB, arrows). Effects timing: short4 enter,
 * short3 exit, emphasized easing. Reduced motion collapses to 150 ms. No spatial spring.
 */
export function animateM3ScrollChromeVisibility(
  opacity: SharedValue<number>,
  visible: boolean,
): void {
  const reduced = isM3ReducedMotion();
  opacity.value = withTiming(visible ? 1 : 0, {
    duration: reduced
      ? M3_REDUCED_MOTION_CROSSFADE_MS
      : visible
        ? M3_MOTION_DURATION_SHORT4_MS
        : M3_MOTION_DURATION_SHORT3_MS,
    easing: visible ? M3_EMPHASIZED_DECELERATE_REANIMATED : M3_EMPHASIZED_ACCELERATE_REANIMATED,
  });
}
