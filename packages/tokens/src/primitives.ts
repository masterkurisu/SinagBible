/**
 * Canonical palette aligned with `apps/web` (layout, app-nav, journal, reader).
 * Use `webPalette` for self-documenting names; `colors` keeps stable keys for
 * shared exports (`bottomNavChrome`, `journalEntrySheet`, etc.).
 */
export const webPalette = {
  /** `layout.tsx` body — global page canvas & primary ink */
  appShell: {
    background: "#f5f2ec",
    text: "#2c2416",
  },
  /** Light copy on dark surfaces (`sb-gradient-dark`, primary `rounded-full` buttons) */
  onDark: {
    text: "#f5e9d6",
    textSubtle: "rgba(245, 233, 214, 0.85)",
  },
  /** `sb-gradient-dark`, book selector header, nav icon SVG fills */
  gradientDark: {
    start: "#4a3826",
    mid: "#2c2416",
    end: "#1a160f",
    iconEnd: "#1f1a12",
  },
  gold: {
    tabAndLink: "#c9a96e",
    uppercaseLabel: "#c8a84b",
    sectionLabel: "#9e7a4f",
  },
  /** Idle nav labels, icons, de-emphasized UI */
  muted: {
    DEFAULT: "#7a6e5f",
    journalListPreview: "#6b5e4b",
    journalMeta: "#6b5540",
    sheetCaption: "#7a7060",
    subtleBrown: "#6f6455",
    /** Filter chips, reader controls, date picker (`#5c4f3a`) */
    controlLabel: "#5c4f3a",
    /** Status banner copy in new-entry sheet (`#5c4a32`) */
    sheetStatusText: "#5c4a32",
  },
  parchment: {
    inputFill: "#ede8dc",
    bookRow: "#fffdf9",
    card: "#fdfbf7",
    sheetBanner: "#fdf6e8",
    warmBackgroundSubtle: "#f0ebe3",
  },
  /** Inline scripture tags in journal editor / preview */
  tagChip: {
    from: "#8f7a60",
    via: "#7e684d",
    to: "#6f5a40",
    text: "#f2e6d4",
  },
  border: {
    hairline: "#ddd8ce",
    emphasis: "#c9b99a",
    parchment: "#c4a882",
    navSearchFallback: "#e9e5dc",
  },
  placeholder: {
    searchField: "#8a7b68",
    richEditor: "#b09070",
    sheetField: "#ada090",
  },
  focus: {
    keyboardNav: "#8fb2ea",
  },
  destructive: "#9e3b3b",
  chrome: {
    white: "#ffffff",
    bottomNavTabTrack: "#f1f0ed",
  },
  /** Inline toast / sheet gradient (`journal-new-entry-sheet`) */
  toastGradient: {
    from: "#332916",
    via: "#241c12",
    to: "#17120b",
  },
} as const;

export const colors = {
  ink: { DEFAULT: webPalette.appShell.text },
  cream: { DEFAULT: webPalette.onDark.text },
  gold: {
    DEFAULT: webPalette.gold.tabAndLink,
    focus: webPalette.gold.uppercaseLabel,
    warm: webPalette.gold.sectionLabel,
  },
  parchment: { input: webPalette.parchment.inputFill },
  primary: {
    DEFAULT: webPalette.appShell.text,
    light: webPalette.gradientDark.start,
    dark: webPalette.gradientDark.end,
  },
  secondary: {
    DEFAULT: webPalette.muted.DEFAULT,
    light: "#9c8e78",
    dark: webPalette.muted.controlLabel,
  },
  background: {
    DEFAULT: webPalette.appShell.background,
    subtle: webPalette.parchment.warmBackgroundSubtle,
    elevated: webPalette.parchment.card,
  },
  text: {
    DEFAULT: webPalette.appShell.text,
    muted: webPalette.muted.DEFAULT,
    inverse: webPalette.onDark.text,
  },
  border: {
    DEFAULT: webPalette.border.hairline,
    strong: webPalette.border.emphasis,
  },
  accent: webPalette.gold.tabAndLink,
  destructive: webPalette.destructive,
} as const;

export const typography = {
  fontFamily: {
    /** Web default UI — `layout` Inter on `html`, Tailwind `font-sans` */
    uiSans: "var(--font-sans), system-ui, sans-serif",
    /** Journal titles, longform — Lora; Tailwind `font-lora` / `font-serif` */
    editorialSerif: "var(--font-lora), Georgia, serif",
    /** Loaded in web root; Tailwind `font-dm` when you need this face */
    altSans: "var(--font-dm-sans), system-ui, sans-serif",
    /** Reader verses & search snippets where web inlines Georgia */
    readerVerseFallback: "Georgia, serif",
    sans: "var(--font-sans), system-ui, sans-serif",
    serif: "var(--font-lora), Georgia, serif",
    mono: "",
  },
  /** Expo asset names — wired in native layout / providers */
  fontAssets: {
    Inter_400Regular: "Inter_400Regular",
    Inter_500Medium: "Inter_500Medium",
    Lora_400Regular: "Lora_400Regular",
    Lora_700Bold: "Lora_700Bold",
  },
  fontSize: {
    xs: "11px",
    sm: "12px",
    base: "15px",
    lg: "17px",
    xl: "22px",
    "2xl": "26px",
    "3xl": "32px",
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
} as const;

export const spacing = {
  0: "0",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
} as const;

export const radius = {
  sm: { css: "6px", rn: 6 },
  md: { css: "12px", rn: 12 },
  lg: { css: "16px", rn: 16 },
  xl: { css: "24px", rn: 24 },
  full: { css: "9999px", rn: 999 },
} as const;

export type Primitives = {
  colors: typeof colors;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
};
