import { useCallback, useEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";
import {
  DEFER_SHEET_HEAVY_CONTENT,
  SHEET_CONTENT_MOUNT_BUFFER_MS,
  SHEET_OPEN_DURATION_MS,
} from "@/lib/device-capability";

/**
 * Defers mounting expensive sheet list content until the open animation finishes.
 * Call `notifySheetAnimatedIn` from the animation completion callback; a timeout
 * fallback ensures content still mounts if the callback is missed.
 */
type DeferSheetContentMountOptions = {
  /** Skip InteractionManager — mount on the next frame after the open animation. */
  mountOnAnimationEnd?: boolean;
};

export function useDeferSheetContentMount(
  isOpen: boolean,
  openDurationMs: number = SHEET_OPEN_DURATION_MS,
  options: DeferSheetContentMountOptions = {},
) {
  const { mountOnAnimationEnd = false } = options;
  const [contentReady, setContentReady] = useState(!DEFER_SHEET_HEAVY_CONTENT);
  const openGenRef = useRef(0);
  const interactionTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(
    null,
  );

  const scheduleMount = useCallback(
    (gen: number) => {
      interactionTaskRef.current?.cancel();
      const markReady = () => {
        if (openGenRef.current !== gen) return;
        setContentReady(true);
      };
      if (mountOnAnimationEnd) {
        requestAnimationFrame(markReady);
        return;
      }
      interactionTaskRef.current = InteractionManager.runAfterInteractions(() => {
        if (openGenRef.current !== gen) return;
        requestAnimationFrame(markReady);
      });
    },
    [mountOnAnimationEnd],
  );

  const notifySheetAnimatedIn = useCallback(() => {
    if (!DEFER_SHEET_HEAVY_CONTENT) return;
    scheduleMount(openGenRef.current);
  }, [scheduleMount]);

  useEffect(() => {
    if (!DEFER_SHEET_HEAVY_CONTENT) {
      setContentReady(true);
      return;
    }

    if (!isOpen) {
      openGenRef.current += 1;
      interactionTaskRef.current?.cancel();
      setContentReady(false);
      return;
    }

    openGenRef.current += 1;
    const gen = openGenRef.current;
    setContentReady(false);

    const fallbackMs = openDurationMs + SHEET_CONTENT_MOUNT_BUFFER_MS + 60;
    const timer = setTimeout(() => {
      if (openGenRef.current !== gen) return;
      scheduleMount(gen);
    }, fallbackMs);

    return () => {
      clearTimeout(timer);
      interactionTaskRef.current?.cancel();
    };
  }, [isOpen, openDurationMs, scheduleMount]);

  return { contentReady, notifySheetAnimatedIn };
}
