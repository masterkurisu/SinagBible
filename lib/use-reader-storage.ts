import { useCallback, useEffect, useState } from "react";
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
  const [highlights, setHighlights] = useState<Record<number, HighlightColor>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});

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
    let cancelled = false;
    const slug = chapter.bookSlug;
    const num = chapter.chapterNumber;
    const tid = translationId;

    void (async () => {
      try {
        const hk = getHighlightsStorageKey(slug, num, tid);
        const nk = getNotesStorageKey(slug, num, tid);
        const [hr, nr] = await Promise.all([AsyncStorage.getItem(hk), AsyncStorage.getItem(nk)]);
        if (cancelled) return;
        if (hr) {
          const parsed = JSON.parse(hr) as Record<string, HighlightColor>;
          const next: Record<number, HighlightColor> = {};
          for (const [k, v] of Object.entries(parsed)) {
            const n = parseInt(k, 10);
            if (Number.isFinite(n) && v) next[n] = v;
          }
          setHighlights(next);
        } else setHighlights({});
        if (nr) {
          const parsed = JSON.parse(nr) as Record<string, string>;
          const next: Record<number, string> = {};
          for (const [k, v] of Object.entries(parsed)) {
            const n = parseInt(k, 10);
            if (Number.isFinite(n)) next[n] = v;
          }
          setNotes(next);
        } else setNotes({});
      } catch {
        if (!cancelled) {
          setHighlights({});
          setNotes({});
        }
      }
    })();

    return () => {
      cancelled = true;
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
