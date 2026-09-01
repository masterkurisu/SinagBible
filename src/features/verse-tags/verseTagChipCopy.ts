import { formatBookLabel } from "@sinag-bible/core/journal";
import type { VerseTagRef } from "@sinag-bible/types";
import type { VerseTagComposerError } from "@/src/features/verse-tags/verseTagComposer";

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

export function formatVerseTagComposerError(error: VerseTagComposerError): string {
  switch (error) {
    case "invalid-chapter":
      return "That chapter is not in this translation.";
    case "invalid-verse":
      return "That verse is not in this chapter.";
    case "invalid-range":
      return "Only same-chapter ranges can be tagged.";
  }
}
