import { useCallback, useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BibleChapter } from "@sinag-bible/types";
import type { HighlightColor } from "@sinag-bible/types";
import { saveReaderLastPosition } from "@/lib/reader-last-position";

const HIGHLIGHTS_STORAGE_KEY_PREFIX = "sb:reader:highlights:";
const NOTES_STORAGE_KEY_PREFIX = "sb:reader:notes:";

function getHighlightsStorageKey(bookSlug: string, chapter: number, tr: string) {
  return `${HIGHLIGHTS_STORAGE_KEY_PREFIX}${bookSlug}:${chapter}:${tr}`;
}

function getNotesStorageKey(bookSlug: string, chapter: number, tr: string) {
  return `${NOTES_STORAGE_KEY_PREFIX}${bookSlug}:${chapter}:${tr}`;
}

function chapterStorageCacheKey(bookSlug: string, chapter: number, tr: string): string {
  return `${bookSlug}:${chapter}:${tr}`;
}

type ChapterStorageSnapshot = {
  highlights: Record<number, HighlightColor>;
  notes: Record<number, string>;
};

const EMPTY_CHAPTER_STORAGE: ChapterStorageSnapshot = {
  highlights: {},
  notes: {},
};

const chapterStorageCache = new Map<string, ChapterStorageSnapshot>();
const chapterStorageLoadPromises = new Map<string, Promise<ChapterStorageSnapshot>>();

function parseHighlights(raw: string | null | undefined): Record<number, HighlightColor> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, HighlightColor>;
    const next: Record<number, HighlightColor> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = parseInt(k, 10);
      if (Number.isFinite(n) && v) next[n] = v;
    }
    return next;
  } catch {
    return {};
  }
}

function parseNotes(raw: string | null | undefined): Record<number, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const next: Record<number, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = parseInt(k, 10);
      if (Number.isFinite(n)) next[n] = v;
    }
    return next;
  } catch {
    return {};
  }
}

function patchChapterStorageCache(
  cacheKey: string,
  patch: Partial<ChapterStorageSnapshot>,
): ChapterStorageSnapshot {
  const prev = chapterStorageCache.get(cacheKey) ?? EMPTY_CHAPTER_STORAGE;
  const next = {
    highlights: patch.highlights ?? prev.highlights,
    notes: patch.notes ?? prev.notes,
  };
  chapterStorageCache.set(cacheKey, next);
  return next;
}

function loadChapterStorage(bookSlug: string, chapter: number, translationId: string): Promise<ChapterStorageSnapshot> {
  const cacheKey = chapterStorageCacheKey(bookSlug, chapter, translationId);
  const cached = chapterStorageCache.get(cacheKey);
  if (cached) {
    return Promise.resolve(cached);
  }

  const inflight = chapterStorageLoadPromises.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const hk = getHighlightsStorageKey(bookSlug, chapter, translationId);
  const nk = getNotesStorageKey(bookSlug, chapter, translationId);

  const promise = AsyncStorage.multiGet([hk, nk])
    .then((pairs) => {
      const valuesByKey = new Map(pairs);
      const snapshot: ChapterStorageSnapshot = {
        highlights: parseHighlights(valuesByKey.get(hk)),
        notes: parseNotes(valuesByKey.get(nk)),
      };
      chapterStorageCache.set(cacheKey, snapshot);
      return snapshot;
    })
    .catch(() => {
      chapterStorageCache.set(cacheKey, EMPTY_CHAPTER_STORAGE);
      return EMPTY_CHAPTER_STORAGE;
    })
    .finally(() => {
      chapterStorageLoadPromises.delete(cacheKey);
    });

  chapterStorageLoadPromises.set(cacheKey, promise);
  return promise;
}

function persistStorageSafely(key: string, value: string): void {
  void AsyncStorage.setItem(key, value).catch(() => {
    /* ignore storage write errors */
  });
}

/**
 * Per-chapter reader persistence: highlights, verse notes (AsyncStorage), and last-read
 * position via {@link saveReaderLastPosition}. Font/spacing UI prefs stay in the screen
 * until a future `useReaderUI` extraction.
 */
export function useReaderStorage(
  chapter: BibleChapter | undefined,
  translationId: string | undefined,
) {
  const cacheKey =
    chapter && translationId
      ? chapterStorageCacheKey(chapter.bookSlug, chapter.chapterNumber, translationId)
      : null;
  const cachedSnapshot = cacheKey ? chapterStorageCache.get(cacheKey) : undefined;

  const [highlights, setHighlights] = useState<Record<number, HighlightColor>>(
    () => cachedSnapshot?.highlights ?? {},
  );
  const [notes, setNotes] = useState<Record<number, string>>(() => cachedSnapshot?.notes ?? {});

  useEffect(() => {
    if (!chapter || !translationId) return;
    void saveReaderLastPosition({
      bookSlug: chapter.bookSlug,
      chapter: chapter.chapterNumber,
      translationId,
    });
  }, [chapter?.bookSlug, chapter?.chapterNumber, translationId]);

  useEffect(() => {
    if (!chapter || !translationId) return;
    const slug = chapter.bookSlug;
    const num = chapter.chapterNumber;
    const tid = translationId;
    const key = chapterStorageCacheKey(slug, num, tid);

    if (chapterStorageCache.has(key)) {
      const snapshot = chapterStorageCache.get(key)!;
      setHighlights(snapshot.highlights);
      setNotes(snapshot.notes);
      return;
    }

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void loadChapterStorage(slug, num, tid).then((snapshot) => {
        if (cancelled) return;
        setHighlights(snapshot.highlights);
        setNotes(snapshot.notes);
      });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [chapter?.bookSlug, chapter?.chapterNumber, translationId]);

  const removeHighlightsFromVerses = useCallback(
    (verseNumbers: number[]) => {
      if (!chapter || !translationId || verseNumbers.length === 0) return;
      setHighlights((curr) => {
        const next = { ...curr };
        for (const v of verseNumbers) delete next[v];
        const key = getHighlightsStorageKey(chapter.bookSlug, chapter.chapterNumber, translationId);
        persistStorageSafely(key, JSON.stringify(next));
        patchChapterStorageCache(chapterStorageCacheKey(chapter.bookSlug, chapter.chapterNumber, translationId), {
          highlights: next,
        });
        return next;
      });
    },
    [chapter, translationId],
  );

  const applyHighlightToVerses = useCallback(
    (verseNumbers: number[], color: HighlightColor) => {
      if (!chapter || !translationId || verseNumbers.length === 0) return;
      setHighlights((curr) => {
        const next = { ...curr };
        for (const v of verseNumbers) next[v] = color;
        const key = getHighlightsStorageKey(chapter.bookSlug, chapter.chapterNumber, translationId);
        persistStorageSafely(key, JSON.stringify(next));
        patchChapterStorageCache(chapterStorageCacheKey(chapter.bookSlug, chapter.chapterNumber, translationId), {
          highlights: next,
        });
        return next;
      });
    },
    [chapter, translationId],
  );

  const persistNoteForVerse = useCallback(
    (verse: number, trimmed: string) => {
      if (!chapter || !translationId) return;
      setNotes((prev) => {
        const next = { ...prev };
        if (trimmed) next[verse] = trimmed;
        else delete next[verse];
        const key = getNotesStorageKey(chapter.bookSlug, chapter.chapterNumber, translationId);
        persistStorageSafely(key, JSON.stringify(next));
        patchChapterStorageCache(chapterStorageCacheKey(chapter.bookSlug, chapter.chapterNumber, translationId), {
          notes: next,
        });
        return next;
      });
    },
    [chapter, translationId],
  );

  return {
    highlights,
    notes,
    removeHighlightsFromVerses,
    applyHighlightToVerses,
    persistNoteForVerse,
  };
}
