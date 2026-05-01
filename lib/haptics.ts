import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const isNative = Platform.OS === "ios" || Platform.OS === "android";

function run(fn: () => Promise<void>) {
  if (!isNative) return;
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

export function hapticWarning() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
