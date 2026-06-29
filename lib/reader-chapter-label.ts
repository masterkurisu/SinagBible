function normalizeLanguageKey(languageLabel: string): string {
  return languageLabel.trim().toLowerCase();
}

/** Localized singular "chapter" word for reader UI (e.g. Kabanata, Kapitulo). */
const CHAPTER_WORD_BY_LANGUAGE: Record<string, string> = {
  english: "Chapter",
  filipino: "Kabanata",
  tagalog: "Kabanata",
  cebuano: "Kapitulo",
  iloko: "Kapitulo",
  ilocano: "Kapitulo",
  spanish: "Capítulo",
  español: "Capítulo",
};

export function getChapterWordForLanguage(languageLabel: string): string {
  return CHAPTER_WORD_BY_LANGUAGE[normalizeLanguageKey(languageLabel)] ?? "Chapter";
}

export function formatReaderChapterHeading(languageLabel: string, chapterNumber: number): string {
  return `${getChapterWordForLanguage(languageLabel)} ${chapterNumber}`;
}

const SELECT_CHAPTER_HEADING_BY_LANGUAGE: Record<string, string> = {
  english: "SELECT A CHAPTER",
  filipino: "PUMILI NG KABANATA",
  tagalog: "PUMILI NG KABANATA",
  cebuano: "PILI ANG KAPITULO",
  iloko: "AGPILI ITI KAPITULO",
  ilocano: "AGPILI ITI KAPITULO",
  spanish: "SELECCIONE UN CAPÍTULO",
  español: "SELECCIONE UN CAPÍTULO",
};

export function getSelectChapterHeadingForLanguage(languageLabel: string): string {
  return SELECT_CHAPTER_HEADING_BY_LANGUAGE[normalizeLanguageKey(languageLabel)] ?? "SELECT A CHAPTER";
}
