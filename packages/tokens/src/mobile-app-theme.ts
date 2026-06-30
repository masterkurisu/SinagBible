/**
 * Mobile Sinag Bible color themes — reader, journal list, search, and tab chrome.
 * Add a new entry to `MOBILE_APP_THEME_IDS` and `mobileAppThemeCatalog` to ship another palette.
 *
 * `ui` mirrors `packages/ui/src/design-tokens.ts` (`colors`) so screens can swap `import { colors }`
 * for `useMobileAppTheme().bundle.ui` without renaming keys.
 */

export const MOBILE_APP_THEME_IDS = ["default", "dark", "night", "mono", "sage", "spectrum"] as const;
export type MobileAppThemeId = (typeof MOBILE_APP_THEME_IDS)[number];

export function isMobileAppThemeId(value: string): value is MobileAppThemeId {
  return (MOBILE_APP_THEME_IDS as readonly string[]).includes(value);
}

/** Accent swatches shown next to theme names in the mobile theme picker */
export const mobileAppThemePickerSwatches: Record<MobileAppThemeId, string> = {
  default: "#5c4f3a",
  dark: "#2a2520",
  night: "#000000",
  mono: "#888888",
  sage: "#43a047",
  /** Primary accent; iOS tab bar uses a multi-color set via `chrome.tabTints`. */
  spectrum: "#4285f4",
};

/** Same keys as `@sinag-bible/ui` `design-tokens` `colors`. */
export type MobileUiColorPalette = {
  parchment: string;
  parchmentDark: string;
  parchmentMid: string;
  parchmentDeep: string;
  brown900: string;
  brown800: string;
  brown700: string;
  brown600: string;
  brown500: string;
  tan400: string;
  tan300: string;
  tan200: string;
  tan100: string;
  gold: string;
  goldLight: string;
  goldMuted: string;
  border: string;
  borderSolid: string;
};

export type MobileAppThemeBundle = {
  id: MobileAppThemeId;
  label: string;
  ui: MobileUiColorPalette;
  reader: {
    sceneSurface: string;
    popoverSurface: string;
    popoverRow: string;
    translationSelectedGradient: readonly [string, string];
    /** Light scrim over reader when menus / sheets dim the content */
    menuScrim: string;
    /** Stronger scrim (e.g. verse note modal) */
    denseModalScrim: string;
    selectionBackground: string;
    selectionText: string;
    noteBelowVerseBackground: string;
    actionIconMuted: string;
    popoverShadow: string;
    /** Verse number column (must stay readable on `sceneSurface`) */
    verseNumberColor: string;
  };
  search: {
    pageBackground: string;
    cardBackground: string;
    cardBorder: string;
    primaryText: string;
    bodyText: string;
    muted: string;
    placeholder: string;
    subtitle: string;
    recentText: string;
    divider: string;
    tint: string;
    searchBarBorder: string;
  };
  chrome: {
    /** M3 `primary` / active icon + label on Android Navigation bar. */
    tabTint: string;
    /** M3 `onSurfaceVariant` — inactive icon (and label when visible). */
    tabMuted: string;
    /** M3 `surfaceContainer` — navigation bar background. */
    tabBarBackground: string;
    /** M3 press ripple (`primary` at low alpha). */
    androidRipple: string;
    /** M3 `secondaryContainer` — active indicator pill behind the icon. */
    androidIndicator: string;
    /** Per-tab selected accent on iOS only. Index: 0=Home, 1=Bible, 2=Journal, 3=Search. */
    tabTints?: readonly [string, string, string, string];
  };
  journal: {
    dateHeading: string;
    listPageBackground: string;
    subtitleQuote: string;
    cardBackground: string;
    filterOpenerBackground: string;
    filterOpenerText: string;
    panelBackground: string;
    panelBorder: string;
    chipInactiveBackground: string;
    chipInactiveBorder: string;
    chipInactiveText: string;
    chipActiveBackground: string;
    chipActiveBorder: string;
    chipActiveText: string;
    emptyStateBackground: string;
    emptyStateBorder: string;
    emptyStateText: string;
    newEntrySheetBackground: string;
    newEntrySheetBorder: string;
    newEntryDragAreaBackground: string;
    fabGradient: readonly [string, string, string];
    /** M3 expressive FAB — `primaryContainer`. */
    fabContainer: string;
    /** M3 expressive FAB — `onPrimaryContainer` icon tint. */
    fabOnContainer: string;
    /** M3 FAB press ripple (`onPrimaryContainer` at low alpha). */
    fabRipple: string;
    /** Passage preview card under the reference field */
    versePreviewBackground: string;
    /** Reflection toolbar circular buttons */
    reflectionToolbarBackground: string;
    /** Format popover toggle when expanded */
    reflectionFormatMenuOpenBackground: string;
    saveReflectionGradient: readonly [string, string];
    saveReflectionGradientSaving: readonly [string, string];
    /** Full-screen new entry route (`journal/new`) scrim */
    newEntryRouteScrim: string;
  };
};

const defaultUi: MobileUiColorPalette = {
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
};

const defaultThemeBody: Omit<MobileAppThemeBundle, "id"> = {
  label: "Default",
  ui: defaultUi,
  reader: {
    sceneSurface: defaultUi.parchmentMid,
    popoverSurface: "#ffffff",
    popoverRow: "#f3f3f3",
    translationSelectedGradient: ["#3d3428", "#1f1a14"],
    menuScrim: "rgba(44,36,22,0.14)",
    denseModalScrim: "rgba(44,36,22,0.35)",
    selectionBackground: defaultUi.brown800,
    selectionText: "#f5e9d6",
    noteBelowVerseBackground: defaultUi.parchmentDark,
    actionIconMuted: "#7a6e5f",
    popoverShadow: "#2c2416",
    verseNumberColor: defaultUi.tan100,
  },
  search: {
    pageBackground: "#EDEAE0",
    cardBackground: "#FFFFFF",
    cardBorder: "#D9D3C8",
    primaryText: "#1C1610",
    bodyText: "#3B2F1E",
    muted: "#9A8E7E",
    placeholder: "#B0A492",
    subtitle: "#8A7E6E",
    recentText: "#5A4E3E",
    divider: "#D0C9BC",
    tint: "#3B2F1E",
    searchBarBorder: "#FFFFFF",
  },
  chrome: {
    tabTint: "#5C4F3A",
    tabMuted: "#8B7E6A",
    tabBarBackground: defaultUi.parchmentMid,
    androidRipple: "rgba(92, 79, 58, 0.14)",
    androidIndicator: "#E3DDD2",
  },
  journal: {
    dateHeading: "#8a7b68",
    listPageBackground: defaultUi.parchmentMid,
    subtitleQuote: "#8a7b68",
    cardBackground: "#ffffff",
    filterOpenerBackground: "#ffffff",
    filterOpenerText: "#6f6455",
    panelBackground: "#fdfbf7",
    panelBorder: "#ece7dd",
    chipInactiveBackground: "#ffffff",
    chipInactiveBorder: "#ddd8ce",
    chipInactiveText: "#6f6455",
    chipActiveBackground: "#efe3c2",
    chipActiveBorder: "#c9a96e",
    chipActiveText: "#8c6a2f",
    emptyStateBackground: "#fdfbf7",
    emptyStateBorder: "#ddd8ce",
    emptyStateText: "#6b5e4b",
    newEntrySheetBackground: "#fdfbf7",
    newEntrySheetBorder: "#ece7dd",
    newEntryDragAreaBackground: "#fdfbf7",
    fabGradient: ["#4b3520", "#2b2014", "#15110b"],
    fabContainer: "#EDE5D8",
    fabOnContainer: "#2C2416",
    fabRipple: "rgba(44, 36, 22, 0.12)",
    versePreviewBackground: "#ffffff",
    reflectionToolbarBackground: "#2c2118",
    reflectionFormatMenuOpenBackground: "#f5f0e6",
    saveReflectionGradient: ["#3a2f1f", "#1f170d"],
    saveReflectionGradientSaving: ["#6a5a42", "#5a4b35"],
    newEntryRouteScrim: "rgba(36, 36, 35, 0.42)",
  },
};
const darkThemeBody: Omit<MobileAppThemeBundle, "id"> = {
  label: "Dark",
  ui: {
    parchment: "#2a2420",
    parchmentDark: "#484038",
    parchmentMid: "#332e28",
    parchmentDeep: "#3d3830",
    brown900: "#e8ddd0",
    brown800: "#c9bfb0",
    brown700: "#c9bfb0",
    brown600: "#a89a88",
    brown500: "#8a7e6d",
    tan400: "#7a6e5f",
    tan300: "#6b5f50",
    tan200: "#5a4f42",
    tan100: "#3d3428",
    gold: "#c9a96e",
    goldLight: "#d4b882",
    goldMuted: "#b09070",
    border: "#c4a88228",
    borderSolid: "#3d3428",
  },
  reader: {
    sceneSurface: "#332e28",
    popoverSurface: "#3d3830",
    popoverRow: "#484038",
    translationSelectedGradient: ["#c9a96e", "#b09070"],
    menuScrim: "rgba(0,0,0,0.35)",
    denseModalScrim: "rgba(0,0,0,0.60)",
    selectionBackground: "#c9a96e",
    selectionText: "#2a2420",
    noteBelowVerseBackground: "#484038",
    actionIconMuted: "#6b5f50",
    popoverShadow: "#000000",
    verseNumberColor: "#a89a88",
  },
  search: {
    pageBackground: "#2a2420",
    cardBackground: "#3d3830",
    cardBorder: "#3d3428",
    primaryText: "#e8ddd0",
    bodyText: "#c9bfb0",
    muted: "#6b5f50",
    placeholder: "#5a4f42",
    subtitle: "#8a7e6d",
    recentText: "#a89a88",
    divider: "#484038",
    tint: "#c9a96e",
    searchBarBorder: "#3d3428",
  },
  chrome: {
    tabTint: "#c9a96e",
    tabMuted: "#6b5a45",
    tabBarBackground: "#332e28",
    androidRipple: "rgba(201,169,110,0.14)",
    androidIndicator: "#3D3830",
  },
  journal: {
    dateHeading: "#8a7e6d",
    listPageBackground: "#332e28",
    subtitleQuote: "#8a7e6d",
    cardBackground: "#3d3830",
    filterOpenerBackground: "#3d3830",
    filterOpenerText: "#a89a88",
    panelBackground: "#484038",
    panelBorder: "#3d3428",
    chipInactiveBackground: "#332e28",
    chipInactiveBorder: "#3d3428",
    chipInactiveText: "#a89a88",
    chipActiveBackground: "#3d3428",
    chipActiveBorder: "#c9a96e",
    chipActiveText: "#c9a96e",
    emptyStateBackground: "#332e28",
    emptyStateBorder: "#3d3428",
    emptyStateText: "#a89a88",
    newEntrySheetBackground: "#2a2420",
    newEntrySheetBorder: "#3d3428",
    newEntryDragAreaBackground: "#2a2420",
    fabGradient: ["#7a5c3a", "#4a3826", "#1f1a14"],
    fabContainer: "#6B5540",
    fabOnContainer: "#F5E9D6",
    fabRipple: "rgba(245, 233, 214, 0.12)",
    versePreviewBackground: "#3d3830",
    reflectionToolbarBackground: "#1a1410",
    reflectionFormatMenuOpenBackground: "#3d3428",
    saveReflectionGradient: ["#8a6b45", "#4a3826"],
    saveReflectionGradientSaving: ["#5c4a38", "#3d3228"],
    newEntryRouteScrim: "rgba(0, 0, 0, 0.55)",
  },
};

const nightThemeBody: Omit<MobileAppThemeBundle, "id"> = {
  label: "Night",
  ui: {
    parchment: "#000000",
    parchmentDark: "#1c1914",
    parchmentMid: "#0d0b09",
    parchmentDeep: "#141210",
    brown900: "#e0d4c4",
    brown800: "#bfb3a0",
    brown700: "#bfb3a0",
    brown600: "#96886f",
    brown500: "#7a6b54",
    tan400: "#6b5a45",
    tan300: "#574839",
    tan200: "#42362a",
    tan100: "#1c1914",
    gold: "#b8945a",
    goldLight: "#c9a96e",
    goldMuted: "#9a7d52",
    border: "#b8945a1f",
    borderSolid: "#1c1914",
  },
  reader: {
    sceneSurface: "#0d0b09",
    popoverSurface: "#141210",
    popoverRow: "#1c1914",
    translationSelectedGradient: ["#b8945a", "#9a7d52"],
    menuScrim: "rgba(0,0,0,0.50)",
    denseModalScrim: "rgba(0,0,0,0.75)",
    selectionBackground: "#b8945a",
    selectionText: "#000000",
    noteBelowVerseBackground: "#1c1914",
    actionIconMuted: "#574839",
    popoverShadow: "#000000",
    verseNumberColor: "#96886f",
  },
  search: {
    pageBackground: "#000000",
    cardBackground: "#141210",
    cardBorder: "#1c1914",
    primaryText: "#e0d4c4",
    bodyText: "#bfb3a0",
    muted: "#574839",
    placeholder: "#42362a",
    subtitle: "#7a6b54",
    recentText: "#96886f",
    divider: "#1c1914",
    tint: "#b8945a",
    searchBarBorder: "#1c1914",
  },
  chrome: {
    tabTint: "#b8945a",
    tabMuted: "#4a3c2a",
    tabBarBackground: "#0d0b09",
    androidRipple: "rgba(184,148,90,0.14)",
    androidIndicator: "#1C1914",
  },
  journal: {
    dateHeading: "#7a6b54",
    listPageBackground: "#0d0b09",
    subtitleQuote: "#7a6b54",
    cardBackground: "#141210",
    filterOpenerBackground: "#141210",
    filterOpenerText: "#96886f",
    panelBackground: "#1c1914",
    panelBorder: "#2a2520",
    chipInactiveBackground: "#0d0b09",
    chipInactiveBorder: "#2a2520",
    chipInactiveText: "#96886f",
    chipActiveBackground: "#2a2520",
    chipActiveBorder: "#b8945a",
    chipActiveText: "#b8945a",
    emptyStateBackground: "#0d0b09",
    emptyStateBorder: "#2a2520",
    emptyStateText: "#96886f",
    newEntrySheetBackground: "#000000",
    newEntrySheetBorder: "#2a2520",
    newEntryDragAreaBackground: "#000000",
    fabGradient: ["#6b4f30", "#3d2e1a", "#0d0b09"],
    fabContainer: "#5C4630",
    fabOnContainer: "#E0D4C4",
    fabRipple: "rgba(224, 212, 196, 0.12)",
    versePreviewBackground: "#141210",
    reflectionToolbarBackground: "#0d0b09",
    reflectionFormatMenuOpenBackground: "#2a2520",
    saveReflectionGradient: ["#7a5c38", "#3d2e1a"],
    saveReflectionGradientSaving: ["#4a3a28", "#2a2018"],
    newEntryRouteScrim: "rgba(0, 0, 0, 0.65)",
  },
};
const monoThemeBody: Omit<MobileAppThemeBundle, "id"> = {
  label: "Mono",
  ui: {
    parchment: "#ffffff",
    parchmentDark: "#e8e8e6",
    parchmentMid: "#f8f8f6",
    parchmentDeep: "#f0f0ee",
    brown900: "#111111",
    brown800: "#222222",
    brown700: "#222222",
    brown600: "#333333",
    brown500: "#555555",
    tan400: "#666666",
    tan300: "#888888",
    tan200: "#aaaaaa",
    tan100: "#cccccc",
    gold: "#111111",
    goldLight: "#333333",
    goldMuted: "#555555",
    border: "#11111118",
    borderSolid: "#e0e0e0",
  },
  reader: {
    sceneSurface: "#f8f8f6",
    popoverSurface: "#ffffff",
    popoverRow: "#f0f0ee",
    translationSelectedGradient: ["#333333", "#111111"],
    menuScrim: "rgba(0,0,0,0.12)",
    denseModalScrim: "rgba(0,0,0,0.30)",
    selectionBackground: "#111111",
    selectionText: "#ffffff",
    noteBelowVerseBackground: "#e8e8e6",
    actionIconMuted: "#888888",
    popoverShadow: "#111111",
    verseNumberColor: "#cccccc",
  },
  search: {
    pageBackground: "#f0f0ee",
    cardBackground: "#ffffff",
    cardBorder: "#e0e0e0",
    primaryText: "#111111",
    bodyText: "#333333",
    muted: "#888888",
    placeholder: "#aaaaaa",
    subtitle: "#666666",
    recentText: "#555555",
    divider: "#e8e8e6",
    tint: "#111111",
    searchBarBorder: "#e0e0e0",
  },
  chrome: {
    tabTint: "#111111",
    tabMuted: "#aaaaaa",
    tabBarBackground: "#f0f0ee",
    androidRipple: "rgba(17,17,17,0.10)",
    androidIndicator: "#E4E4E2",
  },
  journal: {
    dateHeading: "#888888",
    listPageBackground: "#f8f8f6",
    subtitleQuote: "#888888",
    cardBackground: "#ffffff",
    filterOpenerBackground: "#ffffff",
    filterOpenerText: "#666666",
    panelBackground: "#ffffff",
    panelBorder: "#e0e0e0",
    chipInactiveBackground: "#ffffff",
    chipInactiveBorder: "#e0e0e0",
    chipInactiveText: "#666666",
    chipActiveBackground: "#e8e8e6",
    chipActiveBorder: "#111111",
    chipActiveText: "#111111",
    emptyStateBackground: "#f8f8f6",
    emptyStateBorder: "#e0e0e0",
    emptyStateText: "#666666",
    newEntrySheetBackground: "#f7f9f5",
    newEntrySheetBorder: "#e0e0e0",
    newEntryDragAreaBackground: "#f7f9f5",
    fabGradient: ["#333333", "#222222", "#111111"],
    fabContainer: "#E4E4E2",
    fabOnContainer: "#111111",
    fabRipple: "rgba(17, 17, 17, 0.10)",
    versePreviewBackground: "#ffffff",
    reflectionToolbarBackground: "#111111",
    reflectionFormatMenuOpenBackground: "#e8e8e6",
    saveReflectionGradient: ["#222222", "#111111"],
    saveReflectionGradientSaving: ["#555555", "#444444"],
    newEntryRouteScrim: "rgba(0, 0, 0, 0.42)",
  },
};

const sageThemeBody: Omit<MobileAppThemeBundle, "id"> = {
  label: "Sage",
  ui: {
    parchment: "#f7f9f5",
    parchmentDark: "#dfe4da",
    parchmentMid: "#f2f4f0",
    parchmentDeep: "#eaede6",
    brown900: "#1e2a1e",
    brown800: "#2e3d2a",
    brown700: "#2e3d2a",
    brown600: "#3d5236",
    brown500: "#4a5e42",
    tan400: "#5a6e52",
    tan300: "#6b7a5e",
    tan200: "#8fa080",
    tan100: "#b0bf9e",
    gold: "#2e7d32",
    goldLight: "#43a047",
    goldMuted: "#388e3c",
    border: "#2e7d3228",
    borderSolid: "#c8d4be",
  },
  reader: {
    sceneSurface: "#f2f4f0",
    popoverSurface: "#ffffff",
    popoverRow: "#f0f2ee",
    translationSelectedGradient: ["#2e3d2a", "#1e2a1e"],
    menuScrim: "rgba(30,42,30,0.12)",
    denseModalScrim: "rgba(30,42,30,0.30)",
    selectionBackground: "#2e3d2a",
    selectionText: "#f0f4ee",
    noteBelowVerseBackground: "#dfe4da",
    actionIconMuted: "#8fa080",
    popoverShadow: "#1e2a1e",
    verseNumberColor: "#81c784",
  },
  search: {
    pageBackground: "#eaede6",
    cardBackground: "#ffffff",
    cardBorder: "#c8d4be",
    primaryText: "#1e2a1e",
    bodyText: "#2e3d2a",
    muted: "#8fa080",
    placeholder: "#b0bf9e",
    subtitle: "#6b7a5e",
    recentText: "#4a5e42",
    divider: "#d4dccb",
    tint: "#2e7d32",
    searchBarBorder: "#ffffff",
  },
  chrome: {
    tabTint: "#2e7d32",
    tabMuted: "#8fa080",
    tabBarBackground: "#eaede6",
    androidRipple: "rgba(46,125,50,0.12)",
    androidIndicator: "#DDE8D6",
  },
  journal: {
    dateHeading: "#7a8e6e",
    listPageBackground: "#f2f4f0",
    subtitleQuote: "#6b7a5e",
    cardBackground: "#ffffff",
    filterOpenerBackground: "#ffffff",
    filterOpenerText: "#5a6e52",
    panelBackground: "#f7f9f5",
    panelBorder: "#c8d4be",
    chipInactiveBackground: "#ffffff",
    chipInactiveBorder: "#c8d4be",
    chipInactiveText: "#5a6e52",
    chipActiveBackground: "#c8e6c9",
    chipActiveBorder: "#2e7d32",
    chipActiveText: "#1b5e20",
    emptyStateBackground: "#f7f9f5",
    emptyStateBorder: "#c8d4be",
    emptyStateText: "#4a5e42",
    newEntrySheetBackground: "#ffffff",
    newEntrySheetBorder: "#c8d4be",
    newEntryDragAreaBackground: "#ffffff",
    fabGradient: ["#4a5e42", "#2e3d2a", "#1e2a1e"],
    fabContainer: "#C8E6C9",
    fabOnContainer: "#1B5E20",
    fabRipple: "rgba(27, 94, 32, 0.12)",
    versePreviewBackground: "#ffffff",
    reflectionToolbarBackground: "#2e3d2a",
    reflectionFormatMenuOpenBackground: "#eaede6",
    saveReflectionGradient: ["#3d5236", "#1e2a1e"],
    saveReflectionGradientSaving: ["#6b8a55", "#5a6e52"],
    newEntryRouteScrim: "rgba(30, 42, 30, 0.42)",
  },
};

const spectrumThemeBody: Omit<MobileAppThemeBundle, "id"> = {
  label: "Spectrum",
  ui: {
    parchment: "#ffffff",
    parchmentDark: "#e8eaed",
    parchmentMid: "#fafafa",
    parchmentDeep: "#f1f3f4",
    brown900: "#202124",
    brown800: "#3c4043",
    brown700: "#3c4043",
    brown600: "#5f6368",
    brown500: "#80868b",
    tan400: "#9aa0a6",
    tan300: "#bdc1c6",
    tan200: "#dadce0",
    tan100: "#e8eaed",
    gold: "#4285f4",
    goldLight: "#669df6",
    goldMuted: "#1a73e8",
    border: "#4285f418",
    borderSolid: "#e8eaed",
  },
  reader: {
    sceneSurface: "#fafafa",
    popoverSurface: "#ffffff",
    popoverRow: "#f1f3f4",
    translationSelectedGradient: ["#3c4043", "#202124"],
    menuScrim: "rgba(32,33,36,0.12)",
    denseModalScrim: "rgba(32,33,36,0.30)",
    selectionBackground: "#4285f4",
    selectionText: "#ffffff",
    noteBelowVerseBackground: "#e8eaed",
    actionIconMuted: "#9aa0a6",
    popoverShadow: "#202124",
    verseNumberColor: "#9aa0a6",
  },
  search: {
    pageBackground: "#f1f3f4",
    cardBackground: "#ffffff",
    cardBorder: "#e8eaed",
    primaryText: "#202124",
    bodyText: "#3c4043",
    muted: "#9aa0a6",
    placeholder: "#bdc1c6",
    subtitle: "#80868b",
    recentText: "#5f6368",
    divider: "#e8eaed",
    tint: "#4285f4",
    searchBarBorder: "#ffffff",
  },
  chrome: {
    tabTint: "#4285f4",
    tabMuted: "#9aa0a6",
    tabBarBackground: "#f1f3f4",
    androidRipple: "rgba(66,133,244,0.12)",
    androidIndicator: "#DCE8FC",
    tabTints: ["#4285f4", "#34a853", "#fbbc04", "#ea4335"],
  },
  journal: {
    dateHeading: "#9aa0a6",
    listPageBackground: "#fafafa",
    subtitleQuote: "#80868b",
    cardBackground: "#ffffff",
    filterOpenerBackground: "#ffffff",
    filterOpenerText: "#5f6368",
    panelBackground: "#fafafa",
    panelBorder: "#e8eaed",
    chipInactiveBackground: "#ffffff",
    chipInactiveBorder: "#e8eaed",
    chipInactiveText: "#5f6368",
    chipActiveBackground: "#e8eaed",
    chipActiveBorder: "#4285f4",
    chipActiveText: "#202124",
    emptyStateBackground: "#fafafa",
    emptyStateBorder: "#e8eaed",
    emptyStateText: "#5f6368",
    newEntrySheetBackground: "#ffffff",
    newEntrySheetBorder: "#e8eaed",
    newEntryDragAreaBackground: "#ffffff",
    fabGradient: ["#1a73e8", "#4285f4", "#1967d2"],
    fabContainer: "#D3E3FD",
    fabOnContainer: "#041E49",
    fabRipple: "rgba(4, 30, 73, 0.12)",
    versePreviewBackground: "#ffffff",
    reflectionToolbarBackground: "#3c4043",
    reflectionFormatMenuOpenBackground: "#f1f3f4",
    saveReflectionGradient: ["#3c4043", "#202124"],
    saveReflectionGradientSaving: ["#669df6", "#4285f4"],
    newEntryRouteScrim: "rgba(32, 33, 36, 0.42)",
  },
};

/**
 * All shipped themes. Clone `default` as a starting point for a new palette.
 */
export const mobileAppThemeCatalog: Record<MobileAppThemeId, Omit<MobileAppThemeBundle, "id">> = {
  default: defaultThemeBody,
  dark: darkThemeBody,
  night: nightThemeBody,
  mono: monoThemeBody,
  sage: sageThemeBody,
  spectrum: spectrumThemeBody,
};


export function getMobileAppThemeBundle(id: MobileAppThemeId): MobileAppThemeBundle {
  return { id, ...mobileAppThemeCatalog[id] };
}

/** Selected tab icon/label tint; falls back to `tabTint` when `tabTints` is omitted. */
export function getTabTint(chrome: MobileAppThemeBundle["chrome"], tabIndex: number): string {
  const { tabTints, tabTint } = chrome;
  if (tabTints && tabIndex >= 0 && tabIndex < tabTints.length) {
    return tabTints[tabIndex]!;
  }
  return tabTint;
}

/** Labels for theme picker UIs */
export const mobileAppThemePickerOptions: {
  id: MobileAppThemeId;
  label: string;
  swatchColor: string;
}[] = MOBILE_APP_THEME_IDS.map((id) => ({
  id,
  label: mobileAppThemeCatalog[id].label,
  swatchColor: mobileAppThemePickerSwatches[id],
}));
