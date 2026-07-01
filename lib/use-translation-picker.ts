import { useMemo, useEffect, useState } from "react";
import {
  FEATURED_TRANSLATION_IDS,
  type FeaturedTranslationId,
  getFeaturedTranslationSortIndex,
  getTranslationIds,
  isFeaturedTranslationId,
  TRANSLATION_FULL_NAME,
  TRANSLATION_LANGUAGE_LABEL,
  getExternalApiId,
} from "@sinag-bible/core/bible-translations";
import { fetchAvailableTranslations, type ApiTranslation } from "./bible-api-service";
import {
  fetchYvpBibles,
  formatYvpTranslationId,
  type YvpBible,
} from "./youversion-api";
import { normalizeTranslationLanguageSection } from "./translation-language-sections";

export type TranslationPickerItem = {
  id: string;
  label: string;
  /** Section heading in the translation sheet (e.g. "English", "Tagalog"). */
  languageSection: string;
};

/** Short code shown in the picker (e.g. `KJV`, `NIV`). */
export function getTranslationPickerAbbreviation(item: TranslationPickerItem): string {
  return item.label.split(" - ")[0]?.trim() || item.id;
}

export function compareTranslationPickerAbbreviations(
  a: TranslationPickerItem,
  b: TranslationPickerItem,
): number {
  return getTranslationPickerAbbreviation(a).localeCompare(
    getTranslationPickerAbbreviation(b),
    undefined,
    { sensitivity: "base", numeric: true },
  );
}

function shouldIncludeApiTranslation(t: ApiTranslation): boolean {
  return isFeaturedTranslationId(t.id, t.shortName);
}

function mapApiTranslationsToPickerItems(allTranslations: ApiTranslation[]): TranslationPickerItem[] {
  const featured = allTranslations.filter(shouldIncludeApiTranslation);
  return featured
    .slice()
    .sort((a, b) => {
      const la = (a.languageEnglishName ?? a.language).toLowerCase();
      const lb = (b.languageEnglishName ?? b.language).toLowerCase();
      if (la !== lb) return la.localeCompare(lb);
      return a.shortName.localeCompare(b.shortName);
    })
    .map((t) => ({
      id: t.id,
      label: `${t.shortName} - ${t.englishName || t.name}`,
      languageSection: normalizeTranslationLanguageSection(
        (t.languageEnglishName ?? t.language).trim() || "Other",
      ),
    }));
}

function mapYvpBiblesToPickerItems(bibles: YvpBible[]): TranslationPickerItem[] {
  return bibles.map((bible) => {
    const abbr = bible.localizedAbbreviation?.trim() || bible.abbreviation.trim();
    const title = bible.localizedTitle?.trim() || bible.title.trim();
    return {
      id: formatYvpTranslationId(bible.id),
      label: `${abbr} - ${title}`,
      languageSection: normalizeTranslationLanguageSection(bible.languageTag),
    };
  });
}

function buildInternalFallback(): TranslationPickerItem[] {
  return getTranslationIds()
    .map((id) => ({
      id: getExternalApiId(id),
      label: `${id} - ${TRANSLATION_FULL_NAME[id]}`,
      languageSection: normalizeTranslationLanguageSection(TRANSLATION_LANGUAGE_LABEL[id]),
    }))
    .filter((item) =>
      FEATURED_TRANSLATION_IDS.includes(item.id as FeaturedTranslationId),
    )
    .sort((a, b) => {
      const orderA = getFeaturedTranslationSortIndex(a.id);
      const orderB = getFeaturedTranslationSortIndex(b.id);
      if (orderA !== orderB) return orderA - orderB;
      return a.label.localeCompare(b.label);
    });
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
    const orderA = getFeaturedTranslationSortIndex(x.id);
    const orderB = getFeaturedTranslationSortIndex(y.id);
    if (orderA !== orderB) return orderA - orderB;
    return x.label.localeCompare(y.label, undefined, { sensitivity: "base" });
  });
}

function mergePickerItems(
  helloaoItems: TranslationPickerItem[],
  yvpItems: TranslationPickerItem[],
  fallback: TranslationPickerItem[],
): TranslationPickerItem[] {
  const merged = new Map<string, TranslationPickerItem>();
  for (const item of [...helloaoItems, ...yvpItems, ...fallback]) {
    merged.set(item.id, item);
  }
  return sortPickerItems([...merged.values()]);
}

/**
 * Fetches translations from helloao.org (featured) and the YouVersion Platform API,
 * then merges bundled translations the helloao API does not list (e.g. OEB, ADB1905).
 *
 * - `items` is pre-populated with the internal fallback immediately, so the
 *   picker is never empty while network requests are in-flight.
 * - YouVersion entries use ids like `yvp:111` (NIV).
 */
export function useTranslationPicker(): {
  items: TranslationPickerItem[];
  loading: boolean;
} {
  const fallback = useMemo(buildInternalFallback, []);
  const [helloaoItems, setHelloaoItems] = useState<TranslationPickerItem[] | null>(null);
  const [yvpItems, setYvpItems] = useState<TranslationPickerItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [helloaoResult, yvpResult] = await Promise.allSettled([
        fetchAvailableTranslations().then((allTranslations) =>
          mapApiTranslationsToPickerItems(allTranslations),
        ),
        fetchYvpBibles().then((bibles) => mapYvpBiblesToPickerItems(bibles)),
      ]);

      if (cancelled) return;

      if (helloaoResult.status === "fulfilled") {
        setHelloaoItems(helloaoResult.value);
      }
      if (yvpResult.status === "fulfilled") {
        setYvpItems(yvpResult.value);
      } else if (__DEV__) {
        console.warn(
          "[useTranslationPicker] YouVersion catalog failed:",
          yvpResult.reason,
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => {
    if (!helloaoItems && !yvpItems) return sortPickerItems(fallback);
    return mergePickerItems(helloaoItems ?? [], yvpItems ?? [], fallback);
  }, [helloaoItems, yvpItems, fallback]);

  return { items, loading };
}
