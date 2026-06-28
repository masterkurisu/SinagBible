import * as ScreenOrientation from "expo-screen-orientation";
import { Dimensions, Platform } from "react-native";
import { isTabletLayout } from "@/lib/tablet-layout";

/**
 * Android phones stay portrait; tablets may rotate (matches iPad Info.plist behavior).
 * iOS orientations are declared in native Info.plist — no runtime lock needed.
 */
export async function applyPlatformOrientationLock(): Promise<void> {
  if (Platform.OS !== "android") return;

  const { width, height } = Dimensions.get("window");

  try {
    if (isTabletLayout(width, height)) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT);
      return;
    }

    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  } catch {
    // Emulators or devices without orientation support can reject the lock.
  }
}
