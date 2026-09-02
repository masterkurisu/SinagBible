export const VERSE_TAG_PREVIEW_MAX_VERSES = 3;
export const VERSE_TAG_TOOLTIP_MIN_WIDTH_PX = 280;
export const VERSE_TAG_TOOLTIP_MAX_WIDTH_PX = 360;
export const VERSE_TAG_TOOLTIP_MAX_BODY_HEIGHT_PX = 140;
export const VERSE_TAG_TOOLTIP_ACTION_SIZE_PX = 40;
export const VERSE_TAG_TOOLTIP_ACTION_INSET_PX = 10;

export type VerseTagPreviewRange = {
  verseStart: number;
  verseEnd: number | null;
  truncated: boolean;
};

/** Caps a tagged range so the preview tooltip never loads more than three verses. */
export function clampVerseTagPreviewRange(
  verseStart: number,
  verseEnd: number | null,
): VerseTagPreviewRange {
  const end = verseEnd != null && verseEnd >= verseStart ? verseEnd : verseStart;
  const maxEnd = verseStart + VERSE_TAG_PREVIEW_MAX_VERSES - 1;
  if (end <= maxEnd) {
    return {
      verseStart,
      verseEnd: verseEnd != null && verseEnd > verseStart ? verseEnd : null,
      truncated: false,
    };
  }
  return {
    verseStart,
    verseEnd: maxEnd,
    truncated: true,
  };
}

/** Grows the tooltip toward the screen cap as verse text gets longer. */
export function computeVerseTagTooltipWidth(
  descriptionLength: number,
  screenW: number,
  edgeInsetPx = 16,
): number {
  const available = Math.max(0, screenW - edgeInsetPx * 2);
  const max = Math.min(VERSE_TAG_TOOLTIP_MAX_WIDTH_PX, available);
  const min = Math.min(VERSE_TAG_TOOLTIP_MIN_WIDTH_PX, max);
  const t = Math.min(1, Math.max(0, (descriptionLength - 48) / 160));
  return Math.round(min + (max - min) * t);
}
