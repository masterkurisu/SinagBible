import { getTranslationDisplayAbbreviation } from "@/lib/translation-display-label";

/** Single-line passage label for the note-surface header (ellipsized in the UI). */
export function formatReflectionPassageStrip(
  passage: string,
  translationId: string,
): string {
  const ref = passage.trim();
  if (!ref) return "Reflection";
  const abbr = getTranslationDisplayAbbreviation(translationId);
  return abbr ? `${ref} · ${abbr}` : ref;
}
