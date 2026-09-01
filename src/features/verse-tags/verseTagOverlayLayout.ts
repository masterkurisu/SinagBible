export const VERSE_TAG_OVERLAY_MAX_HEIGHT_PX = 280;
export const VERSE_TAG_OVERLAY_MIN_HEIGHT_PX = 96;
export const VERSE_TAG_OVERLAY_GAP_PX = 8;

export type VerseTagOverlayMetrics = {
  bottom: number;
  maxHeight: number;
};

/** Keeps the suggestion list above the keyboard and below the status bar. */
export function computeVerseTagOverlayMetrics(options: {
  screenHeight: number;
  keyboardHeight: number;
  statusBarInset: number;
  gap?: number;
}): VerseTagOverlayMetrics {
  const gap = options.gap ?? VERSE_TAG_OVERLAY_GAP_PX;
  const bottom = Math.max(options.keyboardHeight, 0) + gap;
  const available = Math.max(
    0,
    options.screenHeight - bottom - Math.max(options.statusBarInset, 0) - gap,
  );
  const maxHeight = Math.min(VERSE_TAG_OVERLAY_MAX_HEIGHT_PX, available);
  return { bottom, maxHeight };
}
