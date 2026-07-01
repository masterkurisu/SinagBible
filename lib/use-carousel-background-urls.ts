import { useCallback, useEffect, useMemo, useState } from "react";
import type { CarouselDisplayVerse } from "@/lib/journal-carousel-verses";
import {
  buildCarouselVersesKey,
  getCarouselBackgroundUrlSession,
  resolveCarouselBackgroundUrls,
} from "@/lib/pexels-repository";

/**
 * Resolves unique Pexels background URLs for each visible carousel card.
 * URLs are cached per verse in AsyncStorage; image bytes cached on disk via expo-image.
 */
export function useCarouselBackgroundUrls(displayVerses: CarouselDisplayVerse[]) {
  const versesKey = useMemo(() => buildCarouselVersesKey(displayVerses), [displayVerses]);

  const [urlByVerseId, setUrlByVerseId] = useState<Record<string, string>>(() => {
    return getCarouselBackgroundUrlSession(displayVerses) ?? {};
  });

  useEffect(() => {
    if (displayVerses.length === 0) {
      setUrlByVerseId({});
      return;
    }

    const session = getCarouselBackgroundUrlSession(displayVerses);
    if (session) {
      setUrlByVerseId((prev) => (prev === session ? prev : session));
      return;
    }

    let cancelled = false;

    void (async () => {
      const resolved = await resolveCarouselBackgroundUrls(displayVerses);
      if (!cancelled) {
        setUrlByVerseId(resolved);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [versesKey, displayVerses]);

  const getImageUrl = useCallback(
    (verse: CarouselDisplayVerse): string | null => urlByVerseId[verse.id] ?? null,
    [urlByVerseId],
  );

  return { getImageUrl };
}
