/**
 * Default pinned translations in picker id form (helloao / bundled ids or `yvp:{bibleId}`).
 * Order is preserved in the Pinned section.
 */
export const DEFAULT_PINNED_TRANSLATION_IDS = [
  "KJV",
  "yvp:111", // NIV
  "ADB1905",
  "yvp:1264", // ASD — Ang Salita ng Diyos
] as const;

/** Max pinned translations — each pin prefetches chapters for offline reading. */
export const MAX_PINNED_TRANSLATIONS = 10;

const DEFAULTS_MIGRATION_KEY = "sb:reader:favorite-translations-defaults-v1";

export function getDefaultPinnedTranslationIds(): string[] {
  return [...DEFAULT_PINNED_TRANSLATION_IDS];
}

export { DEFAULTS_MIGRATION_KEY };
