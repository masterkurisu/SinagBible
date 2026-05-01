import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "sb:reader:favorite-translations";

async function loadFavorites(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

async function saveFavorites(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function useFavoriteTranslations(): {
  favoriteTranslationIds: string[];
  toggleFavoriteTranslation: (id: string) => void;
} {
  const [favoriteTranslationIds, setFavoriteTranslationIds] = useState<string[]>([]);

  useEffect(() => {
    void loadFavorites()
      .then(setFavoriteTranslationIds)
      .catch(() => {
        setFavoriteTranslationIds([]);
      });
  }, []);

  const toggleFavoriteTranslation = useCallback((id: string) => {
    setFavoriteTranslationIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      void saveFavorites(next);
      return next;
    });
  }, []);

  return { favoriteTranslationIds, toggleFavoriteTranslation };
}
