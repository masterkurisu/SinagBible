import {
  getExternalApiId,
  isTranslationId,
  TRANSLATION_LANGUAGE_LABEL,
  type TranslationId,
} from "@sinag-bible/core/bible-translations";
import type { TranslationPickerItem } from "@/lib/use-translation-picker";

/** Human-readable language label for the active reader translation (e.g. "Filipino", "English"). */
export function getReaderTranslationLanguageLabel(
  translationId: string,
  pickerItems: readonly TranslationPickerItem[],
): string {
  const apiId = isTranslationId(translationId)
    ? getExternalApiId(translationId as TranslationId)
    : translationId;
  const pickerItem = pickerItems.find(
    (t) => t.id === apiId || t.id.toLowerCase() === apiId.toLowerCase(),
  );
  if (pickerItem) return pickerItem.languageSection;
  if (isTranslationId(translationId)) {
    return TRANSLATION_LANGUAGE_LABEL[translationId];
  }
  return "English";
}
