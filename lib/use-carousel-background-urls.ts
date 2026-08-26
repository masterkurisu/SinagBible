import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CarouselImageTheme } from "@/lib/carousel-image-themes";
import type { CarouselDisplayVerse } from "@/lib/journal-carousel-verses";
import {
  CAROUSEL_IMAGE_REFRESH_INTERVAL_MS,
  loadJournalCarouselSettings,
  peekJournalCarouselImageTheme,
  peekJournalCarouselSettings,
  subscribeJournalCarouselSettings,
  type CarouselImageRefreshInterval,
} from "@/lib/journal-carousel-settings";
import {
  buildCarouselVersesKey,
  getCarouselBackgroundUrlSession,
  prefetchCarouselPhotoUrls,
  registerCarouselVerseConsumer,
  requestCarouselImageRefresh,
  resolveCarouselBackgroundUrls,
  subscribeCarouselImageRefresh,
} from "@/lib/pexels-repository";

/** Last non-empty URL map — reused on remount so session lookup is not a frame behind. */
let memoryUrlByVerseId: Record<string, string> = {};

function rememberCarouselBackgroundUrls(urls: Record<string, string>): void {
  if (Object.keys(urls).length === 0) return;
  memoryUrlByVerseId = urls;
}

function initialCarouselUrls(displayVerses: CarouselDisplayVerse[]): Record<string, string> {
  const session = getCarouselBackgroundUrlSession(
    displayVerses,
    peekJournalCarouselImageTheme(),
  );
  if (session) return session;
  return displayVerses.length === 0 ? {} : memoryUrlByVerseId;
}

/**
 * Resolves unique Pexels background URLs for each visible carousel card.
 * URLs are cached per verse in AsyncStorage; image bytes cached via expo-image.
 */
export function useCarouselBackgroundUrls(displayVerses: CarouselDisplayVerse[]) {
  const [imageTheme, setImageTheme] = useState<CarouselImageTheme>(peekJournalCarouselImageTheme);
  const [imageRefreshInterval, setImageRefreshInterval] =
    useState<CarouselImageRefreshInterval>(
      () => peekJournalCarouselSettings()?.imageRefreshInterval ?? "never",
    );

  const versesKey = useMemo(
    () => buildCarouselVersesKey(displayVerses, imageTheme),
    [displayVerses, imageTheme],
  );
  const displayVersesRef = useRef(displayVerses);
  displayVersesRef.current = displayVerses;
  const imageThemeRef = useRef(imageTheme);
  imageThemeRef.current = imageTheme;
  const verseConsumerRef = useRef<ReturnType<typeof registerCarouselVerseConsumer> | null>(null);

  const [urlByVerseId, setUrlByVerseId] = useState<Record<string, string>>(() =>
    initialCarouselUrls(displayVerses),
  );
  const [sessionUrlByVerseId, setSessionUrlByVerseId] = useState<Record<string, string>>(() => {
    return getCarouselBackgroundUrlSession(displayVerses, peekJournalCarouselImageTheme()) ?? {};
  });

  useEffect(() => {
    const consumer = registerCarouselVerseConsumer(displayVersesRef.current);
    verseConsumerRef.current = consumer;
    return () => {
      consumer.unregister();
      verseConsumerRef.current = null;
    };
  }, []);

  useEffect(() => {
    verseConsumerRef.current?.update(displayVerses);
  }, [displayVerses]);

  useEffect(() => {
    return subscribeCarouselImageRefresh((result) => {
      const verses = displayVersesRef.current;
      setSessionUrlByVerseId((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const verse of verses) {
          if (result[verse.id] && next[verse.id]) {
            delete next[verse.id];
            changed = true;
          } else if (!result[verse.id] && next[verse.id]) {
            delete next[verse.id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
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
        if (changed) rememberCarouselBackgroundUrls(next);
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
      return;
    }

    const session = getCarouselBackgroundUrlSession(displayVerses, imageTheme);
    if (session) {
      prefetchCarouselPhotoUrls(Object.values(session));
      rememberCarouselBackgroundUrls(session);
      setSessionUrlByVerseId(session);
      setUrlByVerseId((prev) => (prev === session ? prev : session));
      return;
    }

    let cancelled = false;
    setSessionUrlByVerseId({});

    void (async () => {
      const resolved = await resolveCarouselBackgroundUrls(displayVerses, { imageTheme });
      if (!cancelled) {
        rememberCarouselBackgroundUrls(resolved);
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

  const isCachedImageUrl = useCallback(
    (verseId: string, url: string | null): boolean => {
      if (!url) return false;
      return sessionUrlByVerseId[verseId] === url;
    },
    [sessionUrlByVerseId],
  );

  return { getImageUrl, isCachedImageUrl, imageTheme };
}
