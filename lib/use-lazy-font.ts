import * as Font from "expo-font";
import { useCallback, useEffect, useState } from "react";
import {
  LAZY_FONT_MAP,
  OPEN_DYSLEXIC_FONT,
  type LazyLoadableFontKey,
  type LazyFontKey,
  type OpenDyslexicFontKey,
} from "./app-font-map";

const loadedFonts = new Set<string>();
const loadingFonts = new Map<string, Promise<void>>();
const loadListeners = new Set<() => void>();

function notifyFontLoaded(): void {
  loadListeners.forEach((listener) => listener());
}

function lazyFontAsset(key: LazyLoadableFontKey): number {
  if (key in LAZY_FONT_MAP) {
    return LAZY_FONT_MAP[key as LazyFontKey];
  }
  return OPEN_DYSLEXIC_FONT[key as OpenDyslexicFontKey];
}

export function isLazyFontLoaded(fontKey: LazyLoadableFontKey): boolean {
  return loadedFonts.has(fontKey);
}

export async function ensureLazyFontLoaded(fontKey: LazyLoadableFontKey): Promise<void> {
  if (loadedFonts.has(fontKey)) return;
  if (loadingFonts.has(fontKey)) {
    await loadingFonts.get(fontKey);
    return;
  }

  const promise = Font.loadAsync({ [fontKey]: lazyFontAsset(fontKey) })
    .then(() => {
      loadedFonts.add(fontKey);
      loadingFonts.delete(fontKey);
      notifyFontLoaded();
    })
    .catch(() => {
      loadingFonts.delete(fontKey);
    });

  loadingFonts.set(fontKey, promise);
  await promise;
}

export function useLazyFont() {
  const [loadedVersion, setLoadedVersion] = useState(0);

  useEffect(() => {
    const listener = () => setLoadedVersion((v) => v + 1);
    loadListeners.add(listener);
    return () => {
      loadListeners.delete(listener);
    };
  }, []);

  const ensureFontLoaded = useCallback(async (fontKey: LazyLoadableFontKey) => {
    await ensureLazyFontLoaded(fontKey);
  }, []);

  const isFontLoaded = useCallback(
    (fontKey: LazyLoadableFontKey) => loadedFonts.has(fontKey),
    [loadedVersion],
  );

  return { ensureFontLoaded, isFontLoaded };
}
