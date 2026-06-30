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
  toggleCarouselFavorite,
  type CarouselDisplayVerse,
  type CarouselVerseRecord,
} from "@/lib/journal-carousel-verses";

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
    setFavorites(items);
    setSettings(nextSettings);
    setLoaded(true);
    return items;
  }, []);

  useEffect(() => {
    void reload();
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
