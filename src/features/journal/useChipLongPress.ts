import { useCallback, useEffect, useRef } from "react";

export const JOURNAL_TAG_CHIP_LONG_PRESS_MS = 400;

/**
 * ScrollView on Android often cancels Pressable `onLongPress`.
 * Start a timer on press-in so a still hold still fires.
 */
export function useChipLongPress(onLongPress: (() => void) | undefined, delayMs = JOURNAL_TAG_CHIP_LONG_PRESS_MS) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current == null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const onPressIn = useCallback(() => {
    didLongPressRef.current = false;
    clearTimer();
    if (!onLongPress) return;
    timerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      timerRef.current = null;
      onLongPress();
    }, delayMs);
  }, [clearTimer, delayMs, onLongPress]);

  const onPressOut = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const shouldSkipPress = useCallback(() => {
    if (!didLongPressRef.current) return false;
    didLongPressRef.current = false;
    return true;
  }, []);

  return { onPressIn, onPressOut, shouldSkipPress };
}
