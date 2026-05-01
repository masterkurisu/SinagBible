/**
 * Mobile design tokens — fonts (Expo `useFonts` names) and colors in one place.
 *
 * - **`colors`** / **`highlightColors`**: re-exported from `@sinag-bible/ui` (same hex the reader and forms use).
 * - **`sharedPalette`**: `webPalette` from `@sinag-bible/tokens` for cross-platform semantic names when adding themes.
 * - **`mobileOnly`**: hex used in native screens but not on the shared `colors` object.
 * - **`lightTheme`**: role → hex map; duplicate/adjust for a dark (or other) theme later.
 *
 * NativeWind class colors live in `tailwind.config.js` — keep them in sync when you change primitives here.
 */
import { webPalette } from "@sinag-bible/tokens";
import { colors, highlightColors, highlightColorOptions } from "@sinag-bible/ui";

export { colors, highlightColors, highlightColorOptions };

/** Cross-platform names (web + mobile); use for new themes to stay aligned with `packages/tokens`. */
export const sharedPalette = webPalette;

/**
 * Font family strings exactly as loaded in `app/_layout.tsx` (`useFonts`).
 * Use `style={{ fontFamily: fonts.loaded.… }}` or `fonts.role.…` for semantic picks.
 */
export const fonts = {
  loaded: {
    inter400: "Inter_400Regular",
    inter500: "Inter_500Medium",
    lora400: "Lora_400Regular",
    lora400Italic: "Lora_400Regular_Italic",
    lora700: "Lora_700Bold",
    lora700Italic: "Lora_700Bold_Italic",
  },
  role: {
    /** Stack headers, editorial titles */
    title: "Lora_400Regular",
    /** Default UI / body sans */
    body: "Inter_400Regular",
    /** Labels, buttons, uppercase meta */
    label: "Inter_500Medium",
    /** Longform journal / reader verse */
    passage: "Lora_400Regular",
    passageBold: "Lora_700Bold",
    passageItalic: "Lora_400Regular_Italic",
    passageBoldItalic: "Lora_700Bold_Italic",
  },
} as const;

/**
 * Extra colors referenced from mobile screens/components that are not on `colors` from `@sinag-bible/ui`.
 * Prefer `colors.*` when both exist (e.g. brown800, tan300).
 */
export const mobileOnly = {
  white: "#ffffff",
  black: "#000000",

  stone: "#E8E2D8",
  quotetone: "#ebe6df",
  cream: "#f5e9d6",
  mutedLabel: "#8A7E6D",
  badgeGold: "#efe3c2",
  badgeGoldInk: "#8c6a2f",

  captionWarm: "#8a7b68",
  inkSecondary: "#6f6455",
  borderSoft: "#ece7dd",
  titleMutedBrown: "#6b5e4b",

  swipeHeartStroke: "#fbe0e0",
  swipeHeartInk: "#a57575",
  swipeTrashStroke: "#d6e6ff",
  swipeTrashInk: "#5f7fa3",

  iconStroke: "#8B7E6A",
  iconDarkBrown: "#2C2118",
  toolbarDark: "#2c2118",
  toolbarMenuOpen: "#f5f0e6",
  pencilIconOnDark: "#F6EFE4",

  rowPressed: "#F7F5F0",
  swipeRowBg: "#f2efe8",

  searchScreenBg: "#EFEDE6",
  searchCardBg: "#FFFFFF",
  searchCardBorder: "#E4E0D6",
  searchDivider: "#EDEAE2",
  searchSnippet: "#4a4336",
  searchCloseIcon: "#B5AA9A",

  readerPopoverSurface: "#ffffff",
  readerPopoverRow: "#f3f3f3",
  readerPopoverRowActive: "#e6e3df",
  readerBookSheetBg: "#f6efdf",
  readerActionIconGray: "#7a6e5f",
  readerFilterIcon: "#6b5a43",
  readerTextMutedBrown: "#8a7355",
  readerChapterTabInactiveText: "#6f6251",

  shadowDark: "#2c2416",
  shadowNeutral: "#242423",
  shadowToolbar: "#1a140d",

  badgeRed: "#e53935",
} as const;

/** Linear gradients `[from, to]` or multi-stop for `LinearGradient`. */
export const gradients = {
  homeHero: ["#4A3826", "#2C2416", "#1A160F"] as const,
  journalEmptyState: ["#4b3520", "#2b2014", "#15110b"] as const,
  saveCta: ["#3a2f1f", "#1f170d"] as const,
  saveCtaDisabled: ["#6a5a42", "#5a4b35"] as const,
  translationPickerSelected: ["#3d3428", "#1f1a14"] as const,
  journalShare: ["#3A2F1F", "#1F170D"] as const,
} as const;

/**
 * Semantic light theme: swap values (or export `darkTheme` with the same keys) for alternate themes.
 */
export const lightTheme = {
  screen: colors.parchment,
  screenCanvas: colors.parchmentMid,
  surfaceElevated: mobileOnly.white,
  border: colors.borderSolid,
  borderSoft: mobileOnly.borderSoft,

  text: colors.brown800,
  textMuted: colors.tan300,
  textSubtle: colors.tan200,
  textPlaceholder: colors.tan100,
  textOnDark: mobileOnly.cream,
  accent: colors.gold,

  tabActive: colors.brown500,
  tabInactive: mobileOnly.iconStroke,

  overlayHairline: colors.border,
} as const;

export type LightTheme = typeof lightTheme;
export type MobileOnlyColors = typeof mobileOnly;
export type FontLoaded = (typeof fonts.loaded)[keyof typeof fonts.loaded];
