import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CAROUSEL_ROTATION_INTERVAL_MS,
  DEFAULT_JOURNAL_CAROUSEL_SETTINGS,
  loadJournalCarouselSettings,
  subscribeJournalCarouselSettings,
  type JournalCarouselSettings,
} from "@/lib/journal-carousel-settings";
import {
  loadCarouselCardSizes,
  subscribeCarouselCardSizes,
  type CarouselCardSize,
} from "@/lib/journal-carousel-card-sizes";
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

/** Favorites list + toggle only — for reader selection without carousel rotation/settings. */
export function useCarouselFavorites() {
  const [favorites, setFavorites] = useState<CarouselVerseRecord[]>([]);

  const reloadFavorites = useCallback(async () => {
    const items = await loadCarouselFavorites();
    setFavorites((prev) => (favoritesEqual(prev, items) ? prev : items));
    return items;
  }, []);

  useEffect(() => {
    void reloadFavorites();
  }, [reloadFavorites]);

  useEffect(() => {
    return subscribeCarouselFavorites(() => {
      void reloadFavorites();
    });
  }, [reloadFavorites]);

  const toggleFavorite = useCallback(async (record: CarouselVerseRecord) => {
    const { favorites: next, added } = await toggleCarouselFavorite(record);
    setFavorites(next);
    return added;
  }, []);

  const removeFavorite = useCallback(async (id: string) => {
    const next = await removeCarouselFavorite(id);
    setFavorites(next);
  }, []);

  return {
    favorites,
    toggleFavorite,
    removeFavorite,
    reloadFavorites,
  };
}

function settingsEqual(a: JournalCarouselSettings, b: JournalCarouselSettings): boolean {
  return (
    a.randomize === b.randomize &&
    a.randomizeFavorites === b.randomizeFavorites &&
    a.shuffleDefaultsDaily === b.shuffleDefaultsDaily &&
    a.verseCount === b.verseCount &&
    a.rotationInterval === b.rotationInterval &&
    a.imageRefreshInterval === b.imageRefreshInterval &&
    a.imageTheme === b.imageTheme &&
    a.defaultCardSize === b.defaultCardSize
  );
}

function cardSizeOverridesEqual(
  a: Record<string, CarouselCardSize>,
  b: Record<string, CarouselCardSize>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function useJournalCarouselVerses() {
  const { favorites, toggleFavorite, removeFavorite, reloadFavorites } = useCarouselFavorites();
  const [settings, setSettings] = useState<JournalCarouselSettings>(DEFAULT_JOURNAL_CAROUSEL_SETTINGS);
  const [cardSizeOverrides, setCardSizeOverrides] = useState<Record<string, CarouselCardSize>>({});
  const [rotationOffset, setRotationOffset] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const [, nextSettings, overrides] = await Promise.all([
      reloadFavorites(),
      loadJournalCarouselSettings(),
      loadCarouselCardSizes(),
    ]);
    setSettings((prev) => (settingsEqual(prev, nextSettings) ? prev : nextSettings));
    setCardSizeOverrides((prev) =>
      cardSizeOverridesEqual(prev, overrides) ? prev : overrides,
    );
    setLoaded(true);
  }, [reloadFavorites]);

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
    return subscribeCarouselCardSizes(setCardSizeOverrides);
  }, []);

  useEffect(() => {
    if (settings.randomize || favorites.length === 0) return;
    const ms = CAROUSEL_ROTATION_INTERVAL_MS[settings.rotationInterval];
    const timer = setInterval(() => {
      setRotationOffset((current) => current + settings.verseCount);
    }, ms);
    return () => clearInterval(timer);
  }, [favorites.length, settings]);

  const displayVerses = useMemo<CarouselDisplayVerse[]>(
    () => buildCarouselDisplayVerses(favorites, settings, rotationOffset, cardSizeOverrides),
    [cardSizeOverrides, favorites, rotationOffset, settings],
  );

  return {
    favorites,
    settings,
    cardSizeOverrides,
    displayVerses,
    loaded,
    reload,
    toggleFavorite,
    removeFavorite,
  };
}
