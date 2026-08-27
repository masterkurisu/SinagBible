import {
  getExternalApiId,
  getInternalIdFromApiId,
  isTranslationId,
  type TranslationId,
} from "@sinag-bible/core/bible-translations";
import type { TranslationPickerItem } from "@/lib/use-translation-picker";

/** Keep this a type-only import so search/tab startup does not pull the picker catalog. */
function pickerItemAbbreviation(item: TranslationPickerItem): string {
  return item.label.split(" - ")[0]?.trim() || item.id;
}

/** Display abbreviations for pinned YouVersion translations when the picker catalog has not loaded. */
const YVP_DISPLAY_ABBREVIATION_FALLBACK: Record<string, string> = {
  "yvp:111": "NIV",
  "yvp:1264": "ASD",
};

function findPickerItem(
  translationId: string,
  pickerItems: readonly TranslationPickerItem[],
): TranslationPickerItem | undefined {
  const trimmed = translationId.trim();
  const candidates = new Set<string>([trimmed, trimmed.toLowerCase()]);

  const upper = trimmed.toUpperCase();
  if (isTranslationId(upper)) {
    candidates.add(getExternalApiId(upper as TranslationId));
    candidates.add(upper);
  }

  const internal = getInternalIdFromApiId(trimmed);
  if (internal) {
    candidates.add(internal);
    candidates.add(getExternalApiId(internal));
  }

  return pickerItems.find((item) => {
    const id = item.id;
    return candidates.has(id) || candidates.has(id.toLowerCase());
  });
}

/**
 * Short label for UI (e.g. `NIV`, `KJV`). Resolves YouVersion ids like `yvp:111` to their abbreviation.
 * Internal storage ids are unchanged — use this only for display.
 */
export function getTranslationDisplayAbbreviation(
  translationId: string | null | undefined,
  pickerItems?: readonly TranslationPickerItem[],
): string {
  const trimmed = translationId?.trim() ?? "";
  if (!trimmed) return "KJV";

  if (pickerItems?.length) {
    const item = findPickerItem(trimmed, pickerItems);
    if (item) return pickerItemAbbreviation(item);
  }

  const yvpFallback = YVP_DISPLAY_ABBREVIATION_FALLBACK[trimmed.toLowerCase()];
  if (yvpFallback) return yvpFallback;

  const upper = trimmed.toUpperCase();
  if (isTranslationId(upper)) return upper;

  const internal = getInternalIdFromApiId(trimmed);
  if (internal) return internal;

  return trimmed;
}

/** Lowercase tokens to index in journal search (e.g. `niv` for stored `yvp:111`). */
export function getTranslationDisplaySearchTokens(translationId: string | null | undefined): string[] {
  const raw = translationId?.trim().toLowerCase() ?? "";
  const display = getTranslationDisplayAbbreviation(translationId).toLowerCase();
  const tokens = new Set<string>();
  if (raw) tokens.add(raw);
  if (display) tokens.add(display);
  return [...tokens];
}
