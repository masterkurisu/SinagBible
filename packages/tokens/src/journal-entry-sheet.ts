import { colors } from "./primitives";

/**
 * New journal entry bottom sheet — `apps/web/components/journal-new-entry-sheet.tsx`.
 */
export const journalEntrySheet = {
  transitionMs: 350,
  dragDismissPx: 96,
  saveFeedback: {
    holdMs: 1200,
    fadeOutMs: 220,
  },
  field: {
    radiusPx: 999,
    border: "rgba(0, 0, 0, 0.1)",
    borderWidthPx: 0.5,
    background: colors.parchment.input,
    paddingXPx: 16,
    paddingYPx: 12,
    fontSizePx: 15,
    text: colors.text.DEFAULT,
    placeholder: "#ADA090",
    fontFamily: "Lora, serif",
  },
  label: {
    fontFamily: "var(--font-sans), system-ui, sans-serif",
    fontSizePx: 10,
    fontWeight: "400" as const,
    letterSpacing: 0.1,
    textTransform: "uppercase" as const,
    color: colors.gold.focus,
  },
} as const;
