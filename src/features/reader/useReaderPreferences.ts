import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { unstable_batchedUpdates } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_READER_VERSE_BODY_FONT_ID,
  isReaderVerseBodyFontId,
  READER_VERSE_BODY_FONT_STORAGE_KEY,
  readerVerseBodyFontFamily,
  readerVerseBodyFontLazyKey,
  type ReaderVerseBodyFontId,
} from "@/lib/reader-verse-body-font";
import { ensureLazyFontLoaded, useLazyFont } from "@/lib/use-lazy-font";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import type { MobileAppThemeId } from "@sinag-bible/tokens";
import { hapticLightImpact } from "@/lib/haptics";

const READER_FONT_SCALE_STORAGE_KEY = "sb:reader:fontScale";
const READER_LINE_SPACING_STORAGE_KEY = "sb:reader:lineSpacingScale";
const READER_TEXT_ALIGN_STORAGE_KEY = "sb:reader:verseTextAlign";

export type ReaderVerseTextAlign = "left" | "right" | "center" | "justify";

const READER_VERSE_TEXT_ALIGN_OPTIONS: readonly ReaderVerseTextAlign[] = [
  "left",
  "right",
  "center",
  "justify",
] as const;

const FONT_SCALE_MIN = 0.5;
const FONT_SCALE_MAX = 3;
const LINE_SPACING_MIN = 0.6;
const LINE_SPACING_MAX = 2;

function isReaderVerseTextAlign(raw: string): raw is ReaderVerseTextAlign {
  return (READER_VERSE_TEXT_ALIGN_OPTIONS as readonly string[]).includes(raw);
}

function persistReaderPref(key: string, value: string): void {
  void AsyncStorage.setItem(key, value).catch(() => {
    /* ignore storage write errors */
  });
}

export type ReaderPreferences = {
  fontFamilyId: ReaderVerseBodyFontId;
  fontScale: number;
  lineSpacingScale: number;
  verseTextAlign: ReaderVerseTextAlign;
  themeId: MobileAppThemeId;
};

export function useReaderPreferences() {
  const { bundle, themeId, setThemeId } = useMobileAppTheme();
  useLazyFont();

  const [fontScale, setFontScaleState] = useState(1);
  const fontScaleUserTouchedRef = useRef(false);
  const [lineSpacingScale, setLineSpacingScaleState] = useState(1);
  const lineSpacingUserTouchedRef = useRef(false);
  const [verseTextAlign, setVerseTextAlignState] = useState<ReaderVerseTextAlign>("justify");
  const verseTextAlignUserTouchedRef = useRef(false);
  const [fontFamilyId, setFontFamilyIdState] =
    useState<ReaderVerseBodyFontId>(DEFAULT_READER_VERSE_BODY_FONT_ID);
  const fontFamilyUserTouchedRef = useRef(false);

  useEffect(() => {
    fontScaleUserTouchedRef.current = false;
    lineSpacingUserTouchedRef.current = false;
    verseTextAlignUserTouchedRef.current = false;
    fontFamilyUserTouchedRef.current = false;
    let cancelled = false;
    void (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([
          READER_FONT_SCALE_STORAGE_KEY,
          READER_LINE_SPACING_STORAGE_KEY,
          READER_TEXT_ALIGN_STORAGE_KEY,
          READER_VERSE_BODY_FONT_STORAGE_KEY,
        ]);
        if (cancelled) return;
        const valuesByKey = new Map(pairs);

        let nextFontScale: number | null = null;
        const rawFontScale = valuesByKey.get(READER_FONT_SCALE_STORAGE_KEY);
        if (rawFontScale && !fontScaleUserTouchedRef.current) {
          const n = parseFloat(rawFontScale);
          if (Number.isFinite(n) && n >= FONT_SCALE_MIN && n <= FONT_SCALE_MAX) {
            nextFontScale = n;
          }
        }

        let nextLineSpacingScale: number | null = null;
        const rawLineSpacing = valuesByKey.get(READER_LINE_SPACING_STORAGE_KEY);
        if (rawLineSpacing && !lineSpacingUserTouchedRef.current) {
          const n = parseFloat(rawLineSpacing);
          if (Number.isFinite(n) && n >= LINE_SPACING_MIN && n <= LINE_SPACING_MAX) {
            nextLineSpacingScale = n;
          }
        }

        let nextVerseTextAlign: ReaderVerseTextAlign | null = null;
        const rawTextAlign = valuesByKey.get(READER_TEXT_ALIGN_STORAGE_KEY);
        if (rawTextAlign && !verseTextAlignUserTouchedRef.current && isReaderVerseTextAlign(rawTextAlign)) {
          nextVerseTextAlign = rawTextAlign;
        }

        let nextFontFamilyId: ReaderVerseBodyFontId | null = null;
        const rawFontFamily = valuesByKey.get(READER_VERSE_BODY_FONT_STORAGE_KEY);
        if (
          rawFontFamily &&
          !fontFamilyUserTouchedRef.current &&
          isReaderVerseBodyFontId(rawFontFamily)
        ) {
          nextFontFamilyId = rawFontFamily;
        }

        unstable_batchedUpdates(() => {
          if (nextFontScale != null) setFontScaleState(nextFontScale);
          if (nextLineSpacingScale != null) setLineSpacingScaleState(nextLineSpacingScale);
          if (nextVerseTextAlign != null) setVerseTextAlignState(nextVerseTextAlign);
          if (nextFontFamilyId != null) setFontFamilyIdState(nextFontFamilyId);
        });
      } catch {
        // ignore corrupt storage
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const lazyKey = readerVerseBodyFontLazyKey(fontFamilyId);
    if (lazyKey) {
      void ensureLazyFontLoaded(lazyKey);
    }
  }, [fontFamilyId]);

  const setFontScale = useCallback((v: number) => {
    fontScaleUserTouchedRef.current = true;
    const next = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, v));
    setFontScaleState(next);
    persistReaderPref(READER_FONT_SCALE_STORAGE_KEY, String(next));
  }, []);

  const setLineSpacingScale = useCallback((v: number) => {
    lineSpacingUserTouchedRef.current = true;
    const next = Math.min(LINE_SPACING_MAX, Math.max(LINE_SPACING_MIN, v));
    setLineSpacingScaleState(next);
    persistReaderPref(READER_LINE_SPACING_STORAGE_KEY, String(next));
  }, []);

  const setVerseTextAlign = useCallback((a: ReaderVerseTextAlign) => {
    hapticLightImpact();
    verseTextAlignUserTouchedRef.current = true;
    setVerseTextAlignState(a);
    persistReaderPref(READER_TEXT_ALIGN_STORAGE_KEY, a);
  }, []);

  const setFontFamily = useCallback((id: ReaderVerseBodyFontId) => {
    fontFamilyUserTouchedRef.current = true;
    setFontFamilyIdState(id);
    persistReaderPref(READER_VERSE_BODY_FONT_STORAGE_KEY, id);
  }, []);

  const prefs = useMemo<ReaderPreferences>(
    () => ({
      fontFamilyId,
      fontScale,
      lineSpacingScale,
      verseTextAlign,
      themeId,
    }),
    [fontFamilyId, fontScale, lineSpacingScale, verseTextAlign, themeId],
  );

  const readerVerseFontSize = 16 * fontScale;
  const readerVerseLineHeight = 28 * fontScale * lineSpacingScale;
  const readerVerseBodyFontFamilyValue = readerVerseBodyFontFamily(fontFamilyId);

  return {
    prefs,
    bundle,
    setFontFamily,
    setFontScale,
    setLineSpacingScale,
    setVerseTextAlign,
    setThemeId,
    readerVerseFontSize,
    readerVerseLineHeight,
    readerVerseBodyFontFamily: readerVerseBodyFontFamilyValue,
  };
}
