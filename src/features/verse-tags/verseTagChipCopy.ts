import { formatBookLabel } from "@sinag-bible/core/journal";
import type { VerseTagRef } from "@sinag-bible/types";

/** Spoken chip label for VoiceOver / TalkBack. */
export function formatVerseTagChipAccessibilityLabel(
  ref: VerseTagRef,
  bookDisplayLabel?: string,
): string {
  const book = bookDisplayLabel?.trim() || formatBookLabel(ref.book);
  const versePart =
    ref.verseEnd != null && ref.verseEnd > ref.verseStart
      ? `verses ${ref.verseStart} through ${ref.verseEnd}`
      : `verse ${ref.verseStart}`;
  return `Verse reference, ${book} chapter ${ref.chapter} ${versePart}, double tap to preview`;
}

/** Tooltip header: visible reference plus the active translation abbreviation. */
export function formatVerseTagTooltipTitle(label: string, versionAbbreviation: string): string {
  const abbr = versionAbbreviation.trim();
  if (!abbr) return label;
  return `${label} (${abbr})`;
}
