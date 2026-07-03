/**
 * Sinag Bible design tokens — shared between web (Tailwind classes) and
 * mobile (NativeWind / StyleSheet) surfaces.
 */
export const colors = {
  parchment: "#fdfbf7",
  parchmentDark: "#EDE8DC",
  parchmentMid: "#f5f2ec",
  parchmentDeep: "#f0ece3",

  brown900: "#1a160f",
  brown800: "#2c2416",
  brown700: "#2c2416",
  brown600: "#4a3826",
  brown500: "#5c4f3a",

  tan400: "#6B5540",
  tan300: "#8a7e6d",
  tan200: "#9c8e78",
  tan100: "#B5A993",

  gold: "#c9a96e",
  goldLight: "#C4A882",
  goldMuted: "#b09070",

  border: "#C4A88260",
  borderSolid: "#ddd8ce",
} as const;

export const fontFamily = {
  serif: "Lora",
  sans: "Inter",
} as const;

export const highlightColors = {
  yellow: "#f2e5b6",
  blue: "#d6e7ff",
  pink: "#ffd7e6",
  green: "#d9f5e2",
  purple: "#eadcff",
} as const;

export const highlightColorOptions = [
  { id: "yellow" as const, swatch: highlightColors.yellow, ring: "#d6c48a" },
  { id: "blue" as const, swatch: highlightColors.blue, ring: "#9bbce7" },
  { id: "pink" as const, swatch: highlightColors.pink, ring: "#e7a7c0" },
  { id: "green" as const, swatch: highlightColors.green, ring: "#92caa4" },
  { id: "purple" as const, swatch: highlightColors.purple, ring: "#b4a0e8" },
] as const;

/** Dark ink swatches for underline marks. */
export const underlineDarkColors = {
  brown800: colors.brown800,
  brown600: colors.brown600,
  navy: "#1e3a5f",
  red: "#C41E1E",
  black: colors.brown900,
} as const;

export const underlineDarkColorOptions = [
  { id: "brown800" as const, swatch: underlineDarkColors.brown800, ring: "#6b5540" },
  { id: "brown600" as const, swatch: underlineDarkColors.brown600, ring: "#8a7355" },
  { id: "navy" as const, swatch: underlineDarkColors.navy, ring: "#4a6a8f" },
  { id: "red" as const, swatch: underlineDarkColors.red, ring: "#e07070" },
  { id: "black" as const, swatch: underlineDarkColors.black, ring: "#5c4f3a" },
] as const;

export type HighlightColorOption = (typeof highlightColorOptions)[number];
export type UnderlineDarkColorOption = (typeof underlineDarkColorOptions)[number];

/** Resolve any annotation color id to a display hex. */
export function resolveAnnotationColorHex(colorId: string): string | undefined {
  const pastel = highlightColors[colorId as keyof typeof highlightColors];
  if (pastel) return pastel;
  const dark = underlineDarkColors[colorId as keyof typeof underlineDarkColors];
  if (dark) return dark;
  return undefined;
}
