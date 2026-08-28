import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { captureScreen, releaseCapture } from "react-native-view-shot";

/** Wait until the sheet's close animation finishes before deleting the snapshot. */
const ANDROID_BACKDROP_RELEASE_MS = 260;

/**
 * Android: a Modal sheet opens in its own native Window, so a live `BlurView` cannot sample the
 * screen behind it (same limitation as the tab-bar search overlay — see `TabBarSearchLayer`).
 * This freezes a screenshot the instant `isOpen` flips true, before the Modal's own Window has
 * drawn anything over it, so it can be blurred and shown as a stand-in backdrop.
 *
 * iOS doesn't need this — its Modal supports a live `BlurView` — so this always returns null there.
 */
export function useAndroidSheetBackdropSnapshot(isOpen: boolean): string | null {
  const [uri, setUri] = useState<string | null>(null);
  const uriRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      if (releaseTimerRef.current != null) {
        clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = null;
      }
      let cancelled = false;
      void captureScreen({
        format: "jpg",
        quality: 0.55,
        result: "tmpfile",
        handleGLSurfaceViewOnAndroid: true,
      })
        .then((captured) => {
          if (cancelled || !captured) return;
          const normalized = captured.startsWith("file:") ? captured : `file://${captured}`;
          uriRef.current = normalized;
          setUri(normalized);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }

    if (!isOpen && wasOpenRef.current) {
      wasOpenRef.current = false;
      const previous = uriRef.current;
      releaseTimerRef.current = setTimeout(() => {
        releaseTimerRef.current = null;
        uriRef.current = null;
        setUri(null);
        if (previous == null) return;
        try {
          releaseCapture(previous);
        } catch {
          /* tmpfile may already be gone */
        }
      }, ANDROID_BACKDROP_RELEASE_MS);
    }

    return undefined;
  }, [isOpen]);

  return uri;
}
