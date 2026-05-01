/**
 * Default form control metrics from web shadcn-style components
 * (`apps/web/components/ui/button.tsx`, `input.tsx`, `card.tsx`).
 * Use on mobile for comparable hit targets and density.
 */
export const shadcnButton = {
  height: {
    xs: 24,
    sm: 28,
    default: 32,
    lg: 36,
  },
  radiusPx: 12,
  fontSize: {
    xs: 12,
    sm: 12.8,
    default: 14,
  },
} as const;

export const shadcnInput = {
  heightPx: 32,
  radiusPx: 8,
  paddingXPx: 10,
  fontSizePx: 16,
  fontSizeMdPx: 14,
} as const;

export const shadcnCard = {
  radiusPx: 12,
  gapPx: 16,
  paddingYPx: 16,
  paddingXPx: 16,
  smGapPx: 12,
  smPaddingPx: 12,
} as const;
