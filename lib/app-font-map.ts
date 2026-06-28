import { AtkinsonHyperlegible_400Regular } from "@expo-google-fonts/atkinson-hyperlegible";
import { CharisSIL_400Regular } from "@expo-google-fonts/charis-sil";
import { CrimsonPro_400Regular } from "@expo-google-fonts/crimson-pro";
import { EBGaramond_400Regular } from "@expo-google-fonts/eb-garamond";
import { GentiumPlus_400Regular } from "@expo-google-fonts/gentium-plus";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { Lato_400Regular } from "@expo-google-fonts/lato";
import {
  Lora_400Regular,
  Lora_400Regular_Italic,
  Lora_700Bold,
  Lora_700Bold_Italic,
} from "@expo-google-fonts/lora";
import { Merriweather_400Regular } from "@expo-google-fonts/merriweather";
import { NotoSans_400Regular } from "@expo-google-fonts/noto-sans";
import { SourceSans3_400Regular } from "@expo-google-fonts/source-sans-3";

/** Fonts loaded before splash clears — UI (Inter) + default reader body (Lora). */
export const STARTUP_FONT_MAP = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Lora_400Regular,
  Lora_400Regular_Italic,
  Lora_700Bold,
  Lora_700Bold_Italic,
} as const;

/** Reader verse body fonts — loaded on demand from the font picker. */
export const LAZY_FONT_MAP = {
  Merriweather_400Regular,
  EBGaramond_400Regular,
  CrimsonPro_400Regular,
  GentiumPlus_400Regular,
  CharisSIL_400Regular,
  NotoSans_400Regular,
  SourceSans3_400Regular,
  Lato_400Regular,
  AtkinsonHyperlegible_400Regular,
} as const;

export type LazyFontKey = keyof typeof LAZY_FONT_MAP;

/** Local asset — not from @expo-google-fonts; lazy-loaded separately. */
export const OPEN_DYSLEXIC_FONT = {
  ReaderOpenDyslexic: require("../assets/fonts/OpenDyslexic-Regular.otf"),
} as const;

export type OpenDyslexicFontKey = keyof typeof OPEN_DYSLEXIC_FONT;

export type LazyLoadableFontKey = LazyFontKey | OpenDyslexicFontKey;
