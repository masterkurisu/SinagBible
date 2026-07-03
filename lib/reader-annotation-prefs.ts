import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_VERSE_ANNOTATION,
  isVerseAnnotation,
  type VerseAnnotation,
} from "@sinag-bible/types";

const ANNOTATION_PREFS_KEY = "sb:reader:annotation-prefs";

export async function loadReaderAnnotationPrefs(): Promise<VerseAnnotation> {
  try {
    const raw = await AsyncStorage.getItem(ANNOTATION_PREFS_KEY);
    if (!raw) return DEFAULT_VERSE_ANNOTATION;
    const parsed: unknown = JSON.parse(raw);
    if (isVerseAnnotation(parsed)) {
      return {
        style: parsed.style,
        colorId: parsed.colorId,
        ...(parsed.style === "underline"
          ? { underlineStyle: parsed.underlineStyle === "squiggly" ? "squiggly" : "straight" }
          : {}),
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_VERSE_ANNOTATION;
}

export function persistReaderAnnotationPrefs(annotation: VerseAnnotation): void {
  void AsyncStorage.setItem(ANNOTATION_PREFS_KEY, JSON.stringify(annotation)).catch(() => {
    /* ignore */
  });
}
