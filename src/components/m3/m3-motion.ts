import { Easing } from "react-native";

/** M3 emphasized decelerate — elements entering the screen. */
export const M3_EMPHASIZED_DECELERATE_EASING = Easing.bezier(0.05, 0.7, 0.1, 1);

/** M3 emphasized accelerate — elements leaving the screen. */
export const M3_EMPHASIZED_ACCELERATE_EASING = Easing.bezier(0.3, 0, 0.8, 0.15);

/** M3 standard decelerate — on-screen motion that ends at rest. */
export const M3_STANDARD_DECELERATE_EASING = Easing.bezier(0, 0, 0, 1);

/** M3 short duration token — quick exits (snackbar dismiss, chrome hide). */
export const M3_MOTION_DURATION_SHORT3_MS = 150;

/** M3 short duration token — compact enters. */
export const M3_MOTION_DURATION_SHORT4_MS = 200;

/** M3 medium duration token — on-screen reposition (keyboard sheet lift). */
export const M3_MOTION_DURATION_MEDIUM2_MS = 300;
