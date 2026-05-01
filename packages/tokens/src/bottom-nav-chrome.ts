import { colors } from "./primitives";

/**
 * Bottom pill nav + inline search chrome — matches `apps/web/components/app-nav.tsx`.
 * Mobile uses native system tabs; token colors remain aligned where referenced.
 */
export const bottomNavChrome = {
  /** Outer pill / search container */
  surface: {
    background: "#ffffff",
    border: "#ffffff",
    borderWidthPx: 1,
    radiusPx: 999,
  },
  shadow: {
    /** Web: shadow-[0_3px_6px_0_rgba(36,36,35,0.35)] */
    color: "#242423",
    offsetYPx: 3,
    blurPx: 6,
    opacity: 0.35,
  },
  fallbackBorder: "#e9e5dc",
  tabIndicator: {
    background: "#f1f0ed",
  },
  tabLabel: {
    inactive: colors.secondary.DEFAULT,
    selected: colors.gold.DEFAULT,
    fontSizePx: 8,
    letterSpacing: 0.01,
    fontWeight: "500" as const,
  },
  icon: {
    inactive: colors.secondary.DEFAULT,
    gradientStart: colors.primary.light,
    gradientEnd: "#1f1a12",
  },
  search: {
    icon: colors.secondary.DEFAULT,
    inputText: colors.text.DEFAULT,
    placeholder: "#8a7b68",
    inputFontSizePx: 13,
  },
  focusRing: {
    /** Tab / search chrome keyboard focus (web `ring-[#8fb2ea]/45`) */
    nav: "rgba(143, 178, 234, 0.45)",
    /** Gold accent ring on search button */
    search: "rgba(201, 169, 110, 0.4)",
  },
  scale: {
    hover: 1.02,
    pressDesktop: 1.03,
    pressMobile: 0.985,
    tabPressed: 0.94,
  },
  transitionMs: {
    width: 300,
    tab: 280,
    searchOpacity: 200,
  },
  timing: {
    out: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
} as const;
