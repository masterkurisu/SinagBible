import type { RefObject } from "react";
import { Alert, Platform } from "react-native";
import type { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { EncodingType, deleteAsync, readAsStringAsync } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import { captureRef } from "react-native-view-shot";

export async function captureCarouselCardPng(ref: RefObject<View | null>): Promise<string | null> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const node = ref.current;
  if (!node) return null;
  try {
    return await captureRef(node, {
      format: "png",
      quality: 1,
      result: "tmpfile",
    });
  } catch {
    return null;
  }
}

async function withCapturedPng(
  ref: RefObject<View | null>,
  fn: (uri: string) => Promise<void>,
): Promise<boolean> {
  const capturedUri = await captureCarouselCardPng(ref);
  if (!capturedUri) {
    Alert.alert("Could not create image", "Unable to capture this carousel card.");
    return false;
  }
  try {
    await fn(capturedUri);
    return true;
  } finally {
    void deleteAsync(capturedUri, { idempotent: true }).catch(() => {});
  }
}

export async function shareCarouselCardImage(
  ref: RefObject<View | null>,
  dialogTitle: string,
): Promise<void> {
  await withCapturedPng(ref, async (uri) => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert("Sharing unavailable", "Sharing is not available on this device.");
      return;
    }
    await Sharing.shareAsync(uri, {
      mimeType: "image/png",
      dialogTitle,
    });
  });
}

export async function saveCarouselCardImage(ref: RefObject<View | null>): Promise<void> {
  await withCapturedPng(ref, async (uri) => {
    const perm =
      Platform.OS === "android"
        ? await requestPermissionsAsync(false, ["photo"])
        : await requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photos access needed",
        "Allow photo library access in Settings to save carousel images.",
      );
      return;
    }
    try {
      await Asset.create(uri);
      Alert.alert("Saved", "The image was saved to your photo library.");
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e ?? "");
      const isExpoGoAndroidMediaLibraryPermissionError =
        Platform.OS === "android" &&
        /expo go can no longer provide full access to the media library/i.test(errorMessage);
      if (isExpoGoAndroidMediaLibraryPermissionError && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Save carousel image",
        });
        Alert.alert(
          "Save via share sheet",
          "Expo Go on Android cannot save directly. Use your share sheet to save the image.",
        );
        return;
      }
      Alert.alert("Could not save", "Something went wrong. Try again.");
    }
  });
}

export async function copyCarouselCardImage(ref: RefObject<View | null>): Promise<void> {
  await withCapturedPng(ref, async (uri) => {
    const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
    await Clipboard.setImageAsync(base64);
  });
}
