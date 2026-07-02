/** WCAG-style relative luminance for sRGB hex (used for on-tile label contrast). */
export function readerThemeSwatchLuminance(hex: string): number {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return 0;
  const n = Number.parseInt(normalized, 16);
  if (!Number.isFinite(n)) return 0;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function readerThemeTileOnSwatchLabel(swatchHex: string): string {
  if (swatchHex.toLowerCase() === "#888888") return "rgba(18,18,18,0.92)";
  const L = readerThemeSwatchLuminance(swatchHex);
  return L > 0.5 ? "rgba(24,20,16,0.92)" : "rgba(255,255,255,0.96)";
}
