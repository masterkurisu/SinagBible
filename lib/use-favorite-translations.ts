import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULTS_MIGRATION_KEY,
  getDefaultPinnedTranslationIds,
  MAX_PINNED_TRANSLATIONS,
} from "@/lib/default-pinned-translations";

export type ToggleFavoriteTranslationResult = "pinned" | "unpinned" | "limit_reached";

const STORAGE_KEY = "sb:reader:favorite-translations";

let memoryFavoriteTranslationIds: string[] | null = null;

function mergeWithDefaultPins(stored: string[]): string[] {
  const seen = new Set(stored);
  const merged = [...stored];
  for (const id of getDefaultPinnedTranslationIds()) {
    if (!seen.has(id)) {
      merged.push(id);
    }
  }
  return merged;
}

async function loadFavorites(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const migrated = await AsyncStorage.getItem(DEFAULTS_MIGRATION_KEY);

    if (raw == null) {
      const defaults = getDefaultPinnedTranslationIds();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      await AsyncStorage.setItem(DEFAULTS_MIGRATION_KEY, "1");
      memoryFavoriteTranslationIds = defaults;
      return defaults;
    }

    const parsed = JSON.parse(raw);
    const stored = Array.isArray(parsed) ? (parsed as string[]) : [];

    if (!migrated) {
      const merged = mergeWithDefaultPins(stored);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      await AsyncStorage.setItem(DEFAULTS_MIGRATION_KEY, "1");
      memoryFavoriteTranslationIds = merged;
      return merged;
    }

    memoryFavoriteTranslationIds = stored;
    return stored;
  } catch {
    const defaults = getDefaultPinnedTranslationIds();
    memoryFavoriteTranslationIds = defaults;
    return defaults;
  }
}

async function saveFavorites(ids: string[]): Promise<void> {
  memoryFavoriteTranslationIds = ids;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

/** Synchronous snapshot (null before first load/save this session). */
export function peekFavoriteTranslationIds(): string[] | null {
  return memoryFavoriteTranslationIds;
}

export async function loadFavoriteTranslationIds(): Promise<string[]> {
  return loadFavorites();
}

export function useFavoriteTranslations(): {
  favoriteTranslationIds: string[];
  toggleFavoriteTranslation: (id: string) => ToggleFavoriteTranslationResult;
} {
  const [favoriteTranslationIds, setFavoriteTranslationIds] = useState<string[]>([]);

  useEffect(() => {
    void loadFavorites()
      .then((ids) => {
        memoryFavoriteTranslationIds = ids;
        setFavoriteTranslationIds(ids);
      })
      .catch(() => {
        const defaults = getDefaultPinnedTranslationIds();
        memoryFavoriteTranslationIds = defaults;
        setFavoriteTranslationIds(defaults);
      });
  }, []);

  const toggleFavoriteTranslation = useCallback((id: string): ToggleFavoriteTranslationResult => {
    let result: ToggleFavoriteTranslationResult = "unpinned";
    setFavoriteTranslationIds((prev) => {
      if (prev.includes(id)) {
        result = "unpinned";
        const next = prev.filter((x) => x !== id);
        void saveFavorites(next);
        return next;
      }
      if (prev.length >= MAX_PINNED_TRANSLATIONS) {
        result = "limit_reached";
        return prev;
      }
      result = "pinned";
      const next = [...prev, id];
      void saveFavorites(next);
      return next;
    });
    return result;
  }, []);

  return { favoriteTranslationIds, toggleFavoriteTranslation };
}
