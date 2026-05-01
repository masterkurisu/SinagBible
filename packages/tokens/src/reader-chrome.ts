import { colors } from "./primitives";

/**
 * Reader / Bible chapter UI — key chrome from `apps/web/.../reader-view.tsx`.
 */
export const readerChrome = {
  headerDropdown: {
    /** Popovers for font + translation (web: `READER_HEADER_DROPDOWN_PANEL_CLASS`) */
    background: colors.background.DEFAULT,
    border: "#ffffff",
    radiusPx: 24,
    shadow: "0 4px 4px rgba(36, 36, 35, 0.3)",
    paddingXPx: 16,
    paddingYPx: 12,
    marginTopPx: 8,
  },
  bookSheet: {
    dragDismissPx: 96,
  },
  note: {
    longPressMs: 200,
  },
} as const;
