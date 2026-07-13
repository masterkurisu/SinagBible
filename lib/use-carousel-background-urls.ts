import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CarouselImageTheme } from "@/lib/carousel-image-themes";
import type { CarouselDisplayVerse } from "@/lib/journal-carousel-verses";
import {
  CAROUSEL_IMAGE_REFRESH_INTERVAL_MS,
  DEFAULT_CAROUSEL_IMAGE_THEME,
  loadJournalCarouselSettings,
  subscribeJournalCarouselSettings,
  type CarouselImageRefreshInterval,
} from "@/lib/journal-carousel-settings";
import {
  buildCarouselVersesKey,
  getCarouselBackgroundUrlSession,
  registerCarouselVerseConsumer,
  requestCarouselImageRefresh,
  resolveCarouselBackgroundUrls,
  subscribeCarouselImageRefresh,
} from "@/lib/pexels-repository";

/**
 * Resolves unique Pexels background URLs for each visible carousel card.
 * URLs are cached per verse in AsyncStorage; image bytes cached on disk via expo-image.
 */
export function useCarouselBackgroundUrls(displayVerses: CarouselDisplayVerse[]) {
  const [imageTheme, setImageTheme] = useState<CarouselImageTheme>(DEFAULT_CAROUSEL_IMAGE_THEME);
  const [imageRefreshInterval, setImageRefreshInterval] =
    useState<CarouselImageRefreshInterval>("never");

  const versesKey = useMemo(
    () => buildCarouselVersesKey(displayVerses, imageTheme),
    [displayVerses, imageTheme],
  );
  const displayVersesRef = useRef(displayVerses);
  displayVersesRef.current = displayVerses;
  const imageThemeRef = useRef(imageTheme);
  imageThemeRef.current = imageTheme;
  const verseConsumerRef = useRef<ReturnType<typeof registerCarouselVerseConsumer> | null>(null);

  const [urlByVerseId, setUrlByVerseId] = useState<Record<string, string>>(() => {
    return getCarouselBackgroundUrlSession(displayVerses, DEFAULT_CAROUSEL_IMAGE_THEME) ?? {};
  });

  useEffect(() => {
    const consumer = registerCarouselVerseConsumer(displayVerses);
    verseConsumerRef.current = consumer;
    return consumer.unregister;
  }, []);

  useEffect(() => {
    verseConsumerRef.current?.update(displayVerses);
  }, [displayVerses]);

  useEffect(() => {
    return subscribeCarouselImageRefresh((result) => {
      const verses = displayVersesRef.current;
      setUrlByVerseId((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const verse of verses) {
          const url = result[verse.id];
          if (url) {
            if (next[verse.id] !== url) {
              next[verse.id] = url;
              changed = true;
            }
          } else if (next[verse.id]) {
            delete next[verse.id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });
  }, []);

  useEffect(() => {
    void loadJournalCarouselSettings().then((settings) => {
      setImageTheme(settings.imageTheme);
      setImageRefreshInterval(settings.imageRefreshInterval);
    });
    return subscribeJournalCarouselSettings((settings) => {
      setImageTheme(settings.imageTheme);
      setImageRefreshInterval(settings.imageRefreshInterval);
    });
  }, []);

  useEffect(() => {
    if (imageRefreshInterval === "never" || displayVerses.length === 0) return;
    const ms = CAROUSEL_IMAGE_REFRESH_INTERVAL_MS[imageRefreshInterval];
    const timer = setInterval(() => {
      void requestCarouselImageRefresh(imageThemeRef.current);
    }, ms);
    return () => clearInterval(timer);
  }, [displayVerses.length, imageRefreshInterval]);

  useEffect(() => {
    if (displayVerses.length === 0) {
      setUrlByVerseId({});
      return;
    }

    const session = getCarouselBackgroundUrlSession(displayVerses, imageTheme);
    if (session) {
      setUrlByVerseId((prev) => (prev === session ? prev : session));
      return;
    }

    let cancelled = false;

    void (async () => {
      const resolved = await resolveCarouselBackgroundUrls(displayVerses, { imageTheme });
      if (!cancelled) {
        setUrlByVerseId(resolved);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [versesKey, displayVerses, imageTheme]);

  const getImageUrl = useCallback(
    (verse: CarouselDisplayVerse): string | null => urlByVerseId[verse.id] ?? null,
    [urlByVerseId],
  );

  return { getImageUrl, imageTheme };
}
