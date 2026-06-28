import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager, unstable_batchedUpdates } from "react-native";
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

const READER_PREF_STORAGE_KEYS = [
  READER_FONT_SCALE_STORAGE_KEY,
  READER_LINE_SPACING_STORAGE_KEY,
  READER_TEXT_ALIGN_STORAGE_KEY,
  READER_VERSE_BODY_FONT_STORAGE_KEY,
] as const;

type CachedReaderPrefs = {
  fontScale: number;
  lineSpacingScale: number;
  verseTextAlign: ReaderVerseTextAlign;
  fontFamilyId: ReaderVerseBodyFontId;
};

const DEFAULT_CACHED_READER_PREFS: CachedReaderPrefs = {
  fontScale: 1,
  lineSpacingScale: 1,
  verseTextAlign: "justify",
  fontFamilyId: DEFAULT_READER_VERSE_BODY_FONT_ID,
};

let cachedReaderPrefs: CachedReaderPrefs | null = null;
let readerPrefsLoadPromise: Promise<CachedReaderPrefs> | null = null;

function parseReaderPrefsFromPairs(pairs: readonly [string, string | null][]): CachedReaderPrefs {
  const valuesByKey = new Map(pairs);
  const next: CachedReaderPrefs = { ...DEFAULT_CACHED_READER_PREFS };

  const rawFontScale = valuesByKey.get(READER_FONT_SCALE_STORAGE_KEY);
  if (rawFontScale) {
    const n = parseFloat(rawFontScale);
    if (Number.isFinite(n) && n >= FONT_SCALE_MIN && n <= FONT_SCALE_MAX) {
      next.fontScale = n;
    }
  }

  const rawLineSpacing = valuesByKey.get(READER_LINE_SPACING_STORAGE_KEY);
  if (rawLineSpacing) {
    const n = parseFloat(rawLineSpacing);
    if (Number.isFinite(n) && n >= LINE_SPACING_MIN && n <= LINE_SPACING_MAX) {
      next.lineSpacingScale = n;
    }
  }

  const rawTextAlign = valuesByKey.get(READER_TEXT_ALIGN_STORAGE_KEY);
  if (rawTextAlign && isReaderVerseTextAlign(rawTextAlign)) {
    next.verseTextAlign = rawTextAlign;
  }

  const rawFontFamily = valuesByKey.get(READER_VERSE_BODY_FONT_STORAGE_KEY);
  if (rawFontFamily && isReaderVerseBodyFontId(rawFontFamily)) {
    next.fontFamilyId = rawFontFamily;
  }

  return next;
}

function patchCachedReaderPrefs(patch: Partial<CachedReaderPrefs>): void {
  cachedReaderPrefs = cachedReaderPrefs
    ? { ...cachedReaderPrefs, ...patch }
    : { ...DEFAULT_CACHED_READER_PREFS, ...patch };
}

function loadReaderPreferencesFromStorage(): Promise<CachedReaderPrefs> {
  if (cachedReaderPrefs) {
    return Promise.resolve(cachedReaderPrefs);
  }
  if (readerPrefsLoadPromise) {
    return readerPrefsLoadPromise;
  }

  readerPrefsLoadPromise = AsyncStorage.multiGet([...READER_PREF_STORAGE_KEYS])
    .then((pairs) => {
      cachedReaderPrefs = parseReaderPrefsFromPairs(pairs);
      return cachedReaderPrefs;
    })
    .catch(() => {
      cachedReaderPrefs = { ...DEFAULT_CACHED_READER_PREFS };
      return cachedReaderPrefs;
    })
    .finally(() => {
      readerPrefsLoadPromise = null;
    });

  return readerPrefsLoadPromise;
}

function getInitialCachedReaderPrefs(): CachedReaderPrefs {
  return cachedReaderPrefs ?? DEFAULT_CACHED_READER_PREFS;
}

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

  const initialPrefs = getInitialCachedReaderPrefs();
  const [fontScale, setFontScaleState] = useState(initialPrefs.fontScale);
  const fontScaleUserTouchedRef = useRef(false);
  const [lineSpacingScale, setLineSpacingScaleState] = useState(initialPrefs.lineSpacingScale);
  const lineSpacingUserTouchedRef = useRef(false);
  const [verseTextAlign, setVerseTextAlignState] = useState<ReaderVerseTextAlign>(initialPrefs.verseTextAlign);
  const verseTextAlignUserTouchedRef = useRef(false);
  const [fontFamilyId, setFontFamilyIdState] = useState<ReaderVerseBodyFontId>(initialPrefs.fontFamilyId);
  const fontFamilyUserTouchedRef = useRef(false);

  useEffect(() => {
    fontScaleUserTouchedRef.current = false;
    lineSpacingUserTouchedRef.current = false;
    verseTextAlignUserTouchedRef.current = false;
    fontFamilyUserTouchedRef.current = false;

    if (cachedReaderPrefs) {
      return;
    }

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void loadReaderPreferencesFromStorage().then((prefs) => {
        if (cancelled) return;
        unstable_batchedUpdates(() => {
          if (!fontScaleUserTouchedRef.current) setFontScaleState(prefs.fontScale);
          if (!lineSpacingUserTouchedRef.current) setLineSpacingScaleState(prefs.lineSpacingScale);
          if (!verseTextAlignUserTouchedRef.current) setVerseTextAlignState(prefs.verseTextAlign);
          if (!fontFamilyUserTouchedRef.current) setFontFamilyIdState(prefs.fontFamilyId);
        });
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
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
    patchCachedReaderPrefs({ fontScale: next });
    persistReaderPref(READER_FONT_SCALE_STORAGE_KEY, String(next));
  }, []);

  const setLineSpacingScale = useCallback((v: number) => {
    lineSpacingUserTouchedRef.current = true;
    const next = Math.min(LINE_SPACING_MAX, Math.max(LINE_SPACING_MIN, v));
    setLineSpacingScaleState(next);
    patchCachedReaderPrefs({ lineSpacingScale: next });
    persistReaderPref(READER_LINE_SPACING_STORAGE_KEY, String(next));
  }, []);

  const setVerseTextAlign = useCallback((a: ReaderVerseTextAlign) => {
    hapticLightImpact();
    verseTextAlignUserTouchedRef.current = true;
    setVerseTextAlignState(a);
    patchCachedReaderPrefs({ verseTextAlign: a });
    persistReaderPref(READER_TEXT_ALIGN_STORAGE_KEY, a);
  }, []);

  const setFontFamily = useCallback((id: ReaderVerseBodyFontId) => {
    fontFamilyUserTouchedRef.current = true;
    setFontFamilyIdState(id);
    patchCachedReaderPrefs({ fontFamilyId: id });
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
