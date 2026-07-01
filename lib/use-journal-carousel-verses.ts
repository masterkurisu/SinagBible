import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CAROUSEL_ROTATION_INTERVAL_MS,
  DEFAULT_JOURNAL_CAROUSEL_SETTINGS,
  loadJournalCarouselSettings,
  subscribeJournalCarouselSettings,
  type JournalCarouselSettings,
} from "@/lib/journal-carousel-settings";
import {
  buildCarouselDisplayVerses,
  loadCarouselFavorites,
  removeCarouselFavorite,
  subscribeCarouselFavorites,
  toggleCarouselFavorite,
  type CarouselDisplayVerse,
  type CarouselVerseRecord,
} from "@/lib/journal-carousel-verses";

function favoritesEqual(a: CarouselVerseRecord[], b: CarouselVerseRecord[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (left.id !== right.id || left.addedAt !== right.addedAt) return false;
  }
  return true;
}

function settingsEqual(a: JournalCarouselSettings, b: JournalCarouselSettings): boolean {
  return (
    a.randomize === b.randomize &&
    a.randomizeFavorites === b.randomizeFavorites &&
    a.shuffleDefaultsDaily === b.shuffleDefaultsDaily &&
    a.verseCount === b.verseCount &&
    a.rotationInterval === b.rotationInterval
  );
}

export function useJournalCarouselVerses() {
  const [favorites, setFavorites] = useState<CarouselVerseRecord[]>([]);
  const [settings, setSettings] = useState<JournalCarouselSettings>(DEFAULT_JOURNAL_CAROUSEL_SETTINGS);
  const [rotationOffset, setRotationOffset] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const [items, nextSettings] = await Promise.all([
      loadCarouselFavorites(),
      loadJournalCarouselSettings(),
    ]);
    setFavorites((prev) => (favoritesEqual(prev, items) ? prev : items));
    setSettings((prev) => (settingsEqual(prev, nextSettings) ? prev : nextSettings));
    setLoaded(true);
    return items;
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return subscribeCarouselFavorites(() => {
      void reload();
    });
  }, [reload]);

  useEffect(() => {
    return subscribeJournalCarouselSettings((next) => {
      setSettings(next);
      setRotationOffset(0);
    });
  }, []);

  useEffect(() => {
    if (settings.randomize || favorites.length === 0) return;
    const ms = CAROUSEL_ROTATION_INTERVAL_MS[settings.rotationInterval];
    const timer = setInterval(() => {
      setRotationOffset((current) => current + settings.verseCount);
    }, ms);
    return () => clearInterval(timer);
  }, [favorites.length, settings]);

  const toggleFavorite = useCallback(async (record: CarouselVerseRecord) => {
    const { favorites: next, added } = await toggleCarouselFavorite(record);
    setFavorites(next);
    return added;
  }, []);

  const removeFavorite = useCallback(async (id: string) => {
    const next = await removeCarouselFavorite(id);
    setFavorites(next);
  }, []);

  const displayVerses = useMemo<CarouselDisplayVerse[]>(
    () => buildCarouselDisplayVerses(favorites, settings, rotationOffset),
    [favorites, rotationOffset, settings],
  );

  return {
    favorites,
    settings,
    displayVerses,
    loaded,
    reload,
    toggleFavorite,
    removeFavorite,
  };
}
