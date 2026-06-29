/**
 * Canonical language labels for the translation picker.
 * YouVersion returns ~1,400+ Bibles across many ISO codes; we bucket them here
 * so the language filter stays readable (English, Tagalog, …) instead of listing
 * every translation as its own “language”.
 */

/** Languages shown in the translation picker’s language filter sheet. */
export const TRANSLATION_LANGUAGE_FILTER_SECTIONS = [
  "English",
  "Tagalog",
  "Filipino",
  "Cebuano",
  "Ilocano",
  "Spanish",
] as const;

export type TranslationLanguageFilterSection = (typeof TRANSLATION_LANGUAGE_FILTER_SECTIONS)[number];

const FILTER_SECTION_SET = new Set<string>(TRANSLATION_LANGUAGE_FILTER_SECTIONS);

/** Maps BCP-47 base tags (and a few helloao codes) to picker language sections. */
const LANGUAGE_TAG_TO_SECTION: Record<string, TranslationLanguageFilterSection> = {
  en: "English",
  eng: "English",
  fil: "Filipino",
  tl: "Tagalog",
  tgl: "Tagalog",
  ceb: "Cebuano",
  ilo: "Ilocano",
  es: "Spanish",
  spa: "Spanish",
};

const LANGUAGE_NAME_TO_SECTION: Record<string, TranslationLanguageFilterSection> = {
  english: "English",
  tagalog: "Tagalog",
  filipino: "Filipino",
  cebuano: "Cebuano",
  ilocano: "Ilocano",
  spanish: "Spanish",
};

/**
 * Buckets a helloao language name or YouVersion `language_tag` into a picker section.
 * Curated languages map to fixed labels; everything else keeps a readable name for
 * search results but is excluded from the language filter sheet.
 */
export function normalizeTranslationLanguageSection(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Other";

  const lower = trimmed.toLowerCase();
  const baseTag = lower.split("-")[0] ?? lower;

  const fromTag = LANGUAGE_TAG_TO_SECTION[baseTag];
  if (fromTag) return fromTag;

  const fromName = LANGUAGE_NAME_TO_SECTION[lower];
  if (fromName) return fromName;

  for (const section of TRANSLATION_LANGUAGE_FILTER_SECTIONS) {
    if (section.toLowerCase() === lower) return section;
  }

  if (baseTag.length >= 2 && baseTag.length <= 3) {
    try {
      const dn = new Intl.DisplayNames(["en"], { type: "language" });
      const label = dn.of(baseTag);
      if (label) {
        const mapped = LANGUAGE_NAME_TO_SECTION[label.toLowerCase()];
        if (mapped) return mapped;
        return label;
      }
    } catch {
      /* ignore */
    }
  }

  return trimmed;
}

export function isTranslationLanguageFilterSection(section: string): section is TranslationLanguageFilterSection {
  return FILTER_SECTION_SET.has(section);
}

/** Curated language filter options that have at least one translation in the picker. */
export function getTranslationLanguageFilterOptions(
  items: readonly { languageSection: string }[],
): TranslationLanguageFilterSection[] {
  const present = new Set(items.map((item) => item.languageSection));
  return TRANSLATION_LANGUAGE_FILTER_SECTIONS.filter((section) => present.has(section));
}
