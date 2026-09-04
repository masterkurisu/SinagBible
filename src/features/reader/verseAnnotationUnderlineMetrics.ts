import {
  isHighlightColor,
  type AnnotationColorId,
  type UnderlineStyle,
} from "@sinag-bible/types";

/** Straight / squiggly underline stroke width. */
export const VERSE_ANNOTATION_UNDERLINE_THICKNESS_PX = 3;

/** Gap between the line box bottom and the underline. */
export const VERSE_ANNOTATION_UNDERLINE_GAP_PX = 1;

/** Extra downward offset for squiggle underlines (straight underlines unchanged). */
export const VERSE_ANNOTATION_SQUIGGLE_VERTICAL_OFFSET_PX = 2;

/** Underline ink opacity for dark colors — keeps strokes from obscuring verse text. */
export const VERSE_ANNOTATION_UNDERLINE_DARK_OPACITY = 0.7;

function parseHexRgb(color: string): { r: number; g: number; b: number } | null {
  const normalized = color.trim();
  if (normalized.startsWith("rgba(") || normalized.startsWith("rgb(")) {
    return null;
  }
  const hex = normalized.replace("#", "");
  if (hex.length !== 6 && hex.length !== 8) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
  return { r, g, b };
}

/** Pastel swatches stay fully opaque; dark inks use reduced opacity. */
export function verseAnnotationUnderlineOpacity(
  color: string,
  colorId?: AnnotationColorId,
): number {
  if (colorId && isHighlightColor(colorId)) return 1;
  return VERSE_ANNOTATION_UNDERLINE_DARK_OPACITY;
}

/** Resolve underline ink — `#RRGGBB` at full opacity or `rgba` when dimmed. */
export function verseAnnotationUnderlineColor(
  color: string,
  colorId?: AnnotationColorId,
): string {
  const opacity = verseAnnotationUnderlineOpacity(color, colorId);
  if (opacity >= 1) return color.trim();

  const rgb = parseHexRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

/** Reference font size for squiggle wavelength/amplitude scaling. */
const SQUIGGLE_METRICS_BASE_FONT_PX = 18;

/** M3-style squiggle wavelength at the reference font size. */
const SQUIGGLE_WAVELENGTH_BASE_PX = 14;

/** M3-style squiggle amplitude at the reference font size. */
const SQUIGGLE_AMPLITUDE_BASE_PX = 2.5;

export type VerseSquiggleMetrics = {
  wavelength: number;
  amplitude: number;
  strokeWidth: number;
  svgHeight: number;
};

export function verseSquiggleMetricsForFontSize(fontSize: number): VerseSquiggleMetrics {
  const scale = fontSize / SQUIGGLE_METRICS_BASE_FONT_PX;
  const wavelength = SQUIGGLE_WAVELENGTH_BASE_PX * scale;
  const amplitude = SQUIGGLE_AMPLITUDE_BASE_PX * scale;
  const strokeWidth = VERSE_ANNOTATION_UNDERLINE_THICKNESS_PX;
  const svgHeight = Math.ceil(amplitude * 2 + strokeWidth + 2);
  return { wavelength, amplitude, strokeWidth, svgHeight };
}

export function resolveUnderlineStyle(style: UnderlineStyle | undefined): UnderlineStyle {
  return style === "squiggly" ? "squiggly" : "straight";
}

/**
 * Nested paragraph `<Text>` on Android reports a broken descender (~0 or negative).
 * Line-by-line onTextLayout uses ~0.42 × fontSize (9.6px at 22.72). Without that
 * clearance the overlay sits in the glyph box instead of below the baseline.
 */
const LINE_BY_LINE_DESCENDER_RATIO = 9.6 / 22.72;

export function paragraphUnderlineExtraOffsetY(
  fontSize: number,
  reportedDescender: number,
): number {
  if (reportedDescender >= fontSize * 0.2) return 0;
  return Math.round(fontSize * LINE_BY_LINE_DESCENDER_RATIO);
}
