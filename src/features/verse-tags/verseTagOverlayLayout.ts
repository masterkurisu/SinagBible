import type { LayoutRectangle } from "react-native";

export const VERSE_TAG_OVERLAY_MAX_HEIGHT_PX = 280;
export const VERSE_TAG_OVERLAY_MIN_HEIGHT_PX = 96;
export const VERSE_TAG_OVERLAY_GAP_PX = 8;
const KEYBOARD_EXCLUDED_SLACK_PX = 24;

export type VerseTagOverlayMetrics = {
  bottom: number;
  maxHeight: number;
};

/** Keeps the suggestion list above the keyboard, the caret line, and the status bar. */
export function computeVerseTagOverlayMetrics(options: {
  screenHeight: number;
  keyboardHeight: number;
  statusBarInset: number;
  gap?: number;
  containerHeight?: number;
  caretYInContainer?: number;
}): VerseTagOverlayMetrics {
  const gap = options.gap ?? VERSE_TAG_OVERLAY_GAP_PX;
  const keyboardHeight = Math.max(options.keyboardHeight, 0);
  const containerHeight = options.containerHeight ?? options.screenHeight;
  const statusBarInset = Math.max(options.statusBarInset, 0);
  const keyboardAlreadyExcluded =
    options.containerHeight != null &&
    options.containerHeight + keyboardHeight <= options.screenHeight + KEYBOARD_EXCLUDED_SLACK_PX;
  const keyboardInset = keyboardAlreadyExcluded ? 0 : keyboardHeight;

  let bottom = keyboardInset + gap;

  if (options.caretYInContainer != null && Number.isFinite(options.caretYInContainer)) {
    const aboveCaret = containerHeight - options.caretYInContainer + gap;
    bottom = Math.max(keyboardInset + gap, aboveCaret);
  }

  const maxBottom = Math.max(
    keyboardInset + gap,
    containerHeight - VERSE_TAG_OVERLAY_MIN_HEIGHT_PX - statusBarInset - gap,
  );
  bottom = Math.min(bottom, maxBottom);

  const available = Math.max(0, containerHeight - bottom - statusBarInset - gap);
  const maxHeight = Math.min(VERSE_TAG_OVERLAY_MAX_HEIGHT_PX, available);
  return { bottom, maxHeight };
}

/** Window-space rect for the line the caret is on, clamped to the visible input. */
export function estimateVerseTagCaretAnchor(options: {
  input: LayoutRectangle;
  text: string;
  cursorIndex: number;
  lineHeight: number;
  paddingTop?: number;
}): LayoutRectangle {
  const paddingTop = options.paddingTop ?? 0;
  const cursor = Math.max(0, Math.min(options.cursorIndex, options.text.length));
  const lineIndex = options.text.slice(0, cursor).split("\n").length - 1;
  const yUnclamped = options.input.y + paddingTop + lineIndex * options.lineHeight;
  const minY = options.input.y + paddingTop;
  const maxY = options.input.y + Math.max(paddingTop, options.input.height - options.lineHeight);
  return {
    x: options.input.x,
    y: Math.max(minY, Math.min(yUnclamped, maxY)),
    width: options.input.width,
    height: options.lineHeight,
  };
}
