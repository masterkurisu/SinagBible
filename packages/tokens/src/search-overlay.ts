import { colors } from "./primitives";

/**
 * Full-screen search results card — `apps/web/components/search-overlay-panel.tsx`.
 */
export const searchOverlay = {
  scrim: {
    background: "rgba(27, 23, 15, 0.35)",
    backdropBlurPx: 2,
  },
  panel: {
    background: colors.background.DEFAULT,
    radiusPx: 24,
    /** Web: shadow-[0_10px_22px_rgba(22,18,12,0.28)] */
    shadow: "0 10px 22px rgba(22, 18, 12, 0.28)",
    horizontalInsetPx: 12,
    topMinRem: 0.85,
  },
  handle: {
    widthPx: 44,
    heightPx: 6,
    background: "rgba(0, 0, 0, 0.18)",
    radiusPx: 999,
    paddingTopPx: 8,
  },
  closeButton: {
    sizePx: 36,
    iconColor: colors.secondary.DEFAULT,
    hoverBackground: colors.background.subtle,
    insetTopPx: 8,
    insetRightPx: 12,
  },
  body: {
    paddingXPx: 12,
    paddingBottomPx: 16,
    paddingTopPx: 4,
  },
  loading: {
    pulseBackground: "#e8e2d8",
    rowRadiusPx: 16,
  },
  error: {
    background: "rgba(254, 242, 242, 0.8)",
    border: "rgba(254, 202, 202, 0.7)",
    text: "#991b1b",
    fontSizePx: 13,
    radiusPx: 12,
  },
  transitionMs: 300,
} as const;
