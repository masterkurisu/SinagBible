import type { LazyLoadableFontKey } from "@/lib/app-font-map";

export const READER_VERSE_BODY_FONT_IDS = [
  "lora",
  "merriweather",
  "ebGaramond",
  "crimsonPro",
  "gentiumPlus",
  "charisSil",
  "notoSans",
  "sourceSans3",
  "lato",
  "atkinsonHyperlegible",
  "openDyslexic",
  "inter",
] as const;

export type ReaderVerseBodyFontId = (typeof READER_VERSE_BODY_FONT_IDS)[number];

export const READER_VERSE_BODY_FONT_STORAGE_KEY = "sb:reader:verseBodyFontId";

export const DEFAULT_READER_VERSE_BODY_FONT_ID: ReaderVerseBodyFontId = "lora";

const LABELS: Record<ReaderVerseBodyFontId, string> = {
  lora: "Lora",
  merriweather: "Merriweather",
  ebGaramond: "EB Garamond",
  crimsonPro: "Crimson Pro",
  gentiumPlus: "Gentium Plus",
  charisSil: "Charis SIL",
  notoSans: "Noto Sans",
  sourceSans3: "Source Sans 3",
  lato: "Lato",
  atkinsonHyperlegible: "Atkinson Hyperlegible",
  openDyslexic: "OpenDyslexic",
  inter: "Inter",
};

/** `fontFamily` strings must match keys in `STARTUP_FONT_MAP` / lazy font loaders. */
const FAMILY: Record<ReaderVerseBodyFontId, string> = {
  lora: "Lora_400Regular",
  merriweather: "Merriweather_400Regular",
  ebGaramond: "EBGaramond_400Regular",
  crimsonPro: "CrimsonPro_400Regular",
  gentiumPlus: "GentiumPlus_400Regular",
  charisSil: "CharisSIL_400Regular",
  notoSans: "NotoSans_400Regular",
  sourceSans3: "SourceSans3_400Regular",
  lato: "Lato_400Regular",
  atkinsonHyperlegible: "AtkinsonHyperlegible_400Regular",
  openDyslexic: "ReaderOpenDyslexic",
  inter: "Inter_400Regular",
};

const LAZY_FONT_ID_TO_KEY: Partial<Record<ReaderVerseBodyFontId, LazyLoadableFontKey>> = {
  merriweather: "Merriweather_400Regular",
  ebGaramond: "EBGaramond_400Regular",
  crimsonPro: "CrimsonPro_400Regular",
  gentiumPlus: "GentiumPlus_400Regular",
  charisSil: "CharisSIL_400Regular",
  notoSans: "NotoSans_400Regular",
  sourceSans3: "SourceSans3_400Regular",
  lato: "Lato_400Regular",
  atkinsonHyperlegible: "AtkinsonHyperlegible_400Regular",
  openDyslexic: "ReaderOpenDyslexic",
};

export const READER_VERSE_BODY_FONT_OPTIONS: readonly {
  id: ReaderVerseBodyFontId;
  label: string;
}[] = READER_VERSE_BODY_FONT_IDS.map((id) => ({ id, label: LABELS[id] }));

export function isReaderVerseBodyFontId(raw: string): raw is ReaderVerseBodyFontId {
  return (READER_VERSE_BODY_FONT_IDS as readonly string[]).includes(raw);
}

export function readerVerseBodyFontFamily(id: ReaderVerseBodyFontId): string {
  return FAMILY[id];
}

export function readerVerseBodyFontLazyKey(id: ReaderVerseBodyFontId): LazyLoadableFontKey | null {
  return LAZY_FONT_ID_TO_KEY[id] ?? null;
}
