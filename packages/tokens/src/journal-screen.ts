import { colors } from "./primitives";

/**
 * Journal list shell + entry FAB — `apps/web/app/journal/journal-page-shell.tsx`.
 */
export const journalScreen = {
  page: {
    background: colors.background.DEFAULT,
    paddingXPx: 16,
    paddingTopPx: 24,
    paddingBottomPx: 112,
    maxWidthPx: 1152,
  },
  title: {
    text: colors.text.DEFAULT,
    fontSizePx: 32,
    fontWeight: "400" as const,
    /** Web uses Georgia; mobile can map to Lora */
    fontFamilyWeb: "Georgia, serif",
  },
  subtitle: {
    text: "#8a7b68",
    fontSizePx: 13,
    lineHeight: 1.625,
  },
  verseAttribution: {
    emphasisWeight: "700" as const,
  },
  fab: {
    sizePx: 60,
    zIndex: 110,
    iconColor: colors.cream.DEFAULT,
    iconSizePx: 20,
    shadow: "0 3px 4px rgba(36, 36, 35, 0.2)",
    transitionMs: 300,
  },
} as const;
