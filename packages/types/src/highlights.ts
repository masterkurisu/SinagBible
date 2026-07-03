/** Pastel highlight swatches — also available for underline. */
export type HighlightColor = "yellow" | "blue" | "pink" | "green" | "purple";

/** Dark ink colors for underline only. */
export type UnderlineDarkColor =
  | "brown800"
  | "brown600"
  | "navy"
  | "red"
  | "black";

/** All selectable annotation colors. */
export type AnnotationColorId = HighlightColor | UnderlineDarkColor;

export type AnnotationStyle = "highlight" | "underline";

/** Underline shape — straight bar or M3-style squiggle. */
export type UnderlineStyle = "straight" | "squiggly";

/** A verse-level reader mark (highlight fill or underline). */
export type VerseAnnotation = {
  style: AnnotationStyle;
  colorId: AnnotationColorId;
  /** Present when `style === "underline"`. Defaults to straight when omitted. */
  underlineStyle?: UnderlineStyle;
};

/** A single verse highlight record (legacy / remote sync shape). */
export type Highlight = {
  id?: string;
  user_id: string;
  book: string;
  chapter: number;
  verse: number;
  color: HighlightColor;
  created_at?: string;
};

/** Local annotation map: verseNumber -> VerseAnnotation */
export type LocalAnnotationMap = Record<number, VerseAnnotation>;

/** @deprecated Use LocalAnnotationMap — kept for migration helpers. */
export type LocalHighlightMap = Record<number, HighlightColor>;

export const HIGHLIGHT_COLOR_IDS: readonly HighlightColor[] = [
  "yellow",
  "blue",
  "pink",
  "green",
  "purple",
] as const;

export const UNDERLINE_DARK_COLOR_IDS: readonly UnderlineDarkColor[] = [
  "brown800",
  "brown600",
  "navy",
  "red",
  "black",
] as const;

export function isHighlightColor(value: unknown): value is HighlightColor {
  return typeof value === "string" && (HIGHLIGHT_COLOR_IDS as readonly string[]).includes(value);
}

export function isUnderlineDarkColor(value: unknown): value is UnderlineDarkColor {
  return typeof value === "string" && (UNDERLINE_DARK_COLOR_IDS as readonly string[]).includes(value);
}

export function isAnnotationColorId(value: unknown): value is AnnotationColorId {
  return isHighlightColor(value) || isUnderlineDarkColor(value);
}

export function isAnnotationStyle(value: unknown): value is AnnotationStyle {
  return value === "highlight" || value === "underline";
}

export function isVerseAnnotation(value: unknown): value is VerseAnnotation {
  if (!value || typeof value !== "object") return false;
  const annotation = value as Partial<VerseAnnotation>;
  if (!isAnnotationStyle(annotation.style)) return false;
  if (!isAnnotationColorId(annotation.colorId)) return false;
  if (annotation.style === "highlight") {
    return isHighlightColor(annotation.colorId);
  }
  if (annotation.underlineStyle != null && annotation.underlineStyle !== "straight" && annotation.underlineStyle !== "squiggly") {
    return false;
  }
  return true;
}

/** Parse persisted storage values (legacy color string or full annotation object). */
export function parseStoredVerseAnnotation(value: unknown): VerseAnnotation | null {
  if (isHighlightColor(value)) {
    return { style: "highlight", colorId: value };
  }
  if (!isVerseAnnotation(value)) return null;
  if (value.style === "highlight" && !isHighlightColor(value.colorId)) return null;
  return {
    style: value.style,
    colorId: value.colorId,
    ...(value.style === "underline"
      ? { underlineStyle: value.underlineStyle === "squiggly" ? "squiggly" : "straight" }
      : {}),
  };
}

export const DEFAULT_VERSE_ANNOTATION: VerseAnnotation = {
  style: "highlight",
  colorId: "yellow",
};
