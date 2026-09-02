export const READER_M3_SHEET_KEYBOARD_GAP_PX = 8;
export const READER_M3_SHEET_MIN_HEIGHT_ABOVE_KEYBOARD_PX = 160;

export type ReaderM3SheetKeyboardMetrics = {
  /** Padding under the sheet so it sits just above the IME. */
  bottomInset: number;
  /** Sheet max height that still fits between the status bar and the keyboard. */
  maxHeight: number;
  floating: boolean;
};

/**
 * Docks a bottom sheet just above the keyboard for any IME height, and shrinks
 * the card so the focused field stays on-screen.
 */
export function computeReaderM3SheetKeyboardMetrics(options: {
  screenHeight: number;
  keyboardHeight: number;
  statusBarInset: number;
  maxHeight: number;
  gap?: number;
  minHeight?: number;
}): ReaderM3SheetKeyboardMetrics {
  const keyboardHeight = Math.max(options.keyboardHeight, 0);
  const statusBarInset = Math.max(options.statusBarInset, 0);
  const gap = options.gap ?? READER_M3_SHEET_KEYBOARD_GAP_PX;
  const minHeight = options.minHeight ?? READER_M3_SHEET_MIN_HEIGHT_ABOVE_KEYBOARD_PX;

  if (keyboardHeight <= 0) {
    return { bottomInset: 0, maxHeight: options.maxHeight, floating: false };
  }

  const bottomInset = keyboardHeight + gap;
  const available = Math.max(minHeight, options.screenHeight - bottomInset - statusBarInset);
  return {
    bottomInset,
    maxHeight: Math.min(options.maxHeight, available),
    floating: true,
  };
}
