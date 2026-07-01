import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { getHapticsEnabledSync } from "@/lib/haptics-preference";

const isNative = Platform.OS === "ios" || Platform.OS === "android";

function run(fn: () => Promise<void>) {
  if (!isNative || !getHapticsEnabledSync()) return;
  void fn().catch(() => {
    /* no engine / reduced motion / unsupported */
  });
}

export function hapticLightImpact() {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function hapticMediumImpact() {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export function hapticSelection() {
  run(() => Haptics.selectionAsync());
}

/** Subtle pop when a contextual tooltip or popover appears (long-press reveal). */
export function hapticSoftPop() {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
}

export function hapticWarning() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
