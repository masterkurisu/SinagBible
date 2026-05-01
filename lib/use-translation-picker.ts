import { useMemo, useEffect, useState } from "react";
import {
  getTranslationIds,
  TRANSLATION_FULL_NAME,
  TRANSLATION_LANGUAGE_LABEL,
  getExternalApiId,
} from "@sinag-bible/core/bible-translations";
import { getTranslationPickerItemsFromApi } from "./bible-api-service";

export type TranslationPickerItem = {
  id: string;
  label: string;
  /** Section heading in the translation sheet (e.g. "English", "Tagalog"). */
  languageSection: string;
};

function buildInternalFallback(): TranslationPickerItem[] {
  return getTranslationIds()
    .map((id) => ({
      id: getExternalApiId(id),
      label: `${id} - ${TRANSLATION_FULL_NAME[id]}`,
      languageSection: TRANSLATION_LANGUAGE_LABEL[id],
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** English first, then alphabetical by section label. */
function compareLanguageSections(a: string, b: string): number {
  const na = a.toLowerCase();
  const nb = b.toLowerCase();
  if (na === "english" && nb !== "english") return -1;
  if (nb === "english" && na !== "english") return 1;
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function sortPickerItems(items: TranslationPickerItem[]): TranslationPickerItem[] {
  return items.slice().sort((x, y) => {
    const c = compareLanguageSections(x.languageSection, y.languageSection);
    if (c !== 0) return c;
    return x.label.localeCompare(y.label, undefined, { sensitivity: "base" });
  });
}

/**
 * Fetches translations from the Free Use Bible API (all languages) and merges
 * bundled translations the API does not list (e.g. OEB, ADB1905).
 *
 * - `items` is pre-populated with the internal fallback immediately, so the
 *   picker is never empty while the network request is in-flight.
 * - Once the API responds, `items` is replaced with the merged result.
 * - On network failure the fallback list is kept permanently.
 */
export function useTranslationPicker(): {
  items: TranslationPickerItem[];
  loading: boolean;
} {
  const fallback = useMemo(buildInternalFallback, []);
  const [apiItems, setApiItems] = useState<TranslationPickerItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await getTranslationPickerItemsFromApi();
        if (!cancelled) setApiItems(result);
      } catch {
        /* network unavailable — keep fallback */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => {
    if (!apiItems) return sortPickerItems(fallback);
    const apiIdSet = new Set(apiItems.map((t) => t.id));
    const missing = fallback.filter((t) => !apiIdSet.has(t.id));
    return sortPickerItems([...apiItems, ...missing]);
  }, [apiItems, fallback]);

  return { items, loading };
}
