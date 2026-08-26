import { useCallback, useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BibleChapter } from "@sinag-bible/types";
import {
  isHighlightColor,
  parseStoredVerseAnnotation,
  type HighlightColor,
  type VerseAnnotation,
} from "@sinag-bible/types";
import { saveReaderLastPosition } from "@/lib/reader-last-position";
import { registerReaderDataImportReload } from "@/lib/reader-data-import-sync";
import { LruMap } from "@sinag-bible/core/lru-map";

const ANNOTATIONS_STORAGE_KEY_PREFIX = "sb:reader:highlights:";
const NOTES_STORAGE_KEY_PREFIX = "sb:reader:notes:";

export function getReaderAnnotationsStorageKey(bookSlug: string, chapter: number, tr: string) {
  return `${ANNOTATIONS_STORAGE_KEY_PREFIX}${bookSlug}:${chapter}:${tr}`;
}

function getNotesStorageKey(bookSlug: string, chapter: number, tr: string) {
  return `${NOTES_STORAGE_KEY_PREFIX}${bookSlug}:${chapter}:${tr}`;
}

function chapterStorageCacheKey(bookSlug: string, chapter: number, tr: string): string {
  return `${bookSlug}:${chapter}:${tr}`;
}

type ChapterStorageSnapshot = {
  annotations: Record<number, VerseAnnotation>;
  notes: Record<number, string>;
};

const EMPTY_CHAPTER_STORAGE: ChapterStorageSnapshot = {
  annotations: {},
  notes: {},
};

/** Soft cap for in-memory annotation/note snapshots during long reading sessions. */
const CHAPTER_STORAGE_CACHE_MAX = 80;
const chapterStorageCache = new LruMap<string, ChapterStorageSnapshot>(CHAPTER_STORAGE_CACHE_MAX);
const chapterStorageLoadPromises = new Map<string, Promise<ChapterStorageSnapshot>>();

function parseAnnotations(raw: string | null | undefined): Record<number, VerseAnnotation> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<number, VerseAnnotation> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = parseInt(k, 10);
      if (!Number.isFinite(n)) continue;
      const annotation = parseStoredVerseAnnotation(v);
      if (annotation) next[n] = annotation;
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
    annotations: patch.annotations ?? prev.annotations,
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

  const ak = getReaderAnnotationsStorageKey(bookSlug, chapter, translationId);
  const nk = getNotesStorageKey(bookSlug, chapter, translationId);

  const promise = AsyncStorage.multiGet([ak, nk])
    .then((pairs) => {
      const valuesByKey = new Map(pairs);
      const snapshot: ChapterStorageSnapshot = {
        annotations: parseAnnotations(valuesByKey.get(ak)),
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

/** Convert legacy v1 backup highlights into annotations. */
export function annotationsFromLegacyHighlights(
  highlights: Record<number, HighlightColor>,
): Record<number, VerseAnnotation> {
  const next: Record<number, VerseAnnotation> = {};
  for (const [verseKey, color] of Object.entries(highlights)) {
    const verse = parseInt(verseKey, 10);
    if (!Number.isFinite(verse) || !isHighlightColor(color)) continue;
    next[verse] = { style: "highlight", colorId: color };
  }
  return next;
}

/**
 * Per-chapter reader persistence: verse annotations, verse notes (AsyncStorage), and last-read
 * position via {@link saveReaderLastPosition}.
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

  const [annotations, setAnnotations] = useState<Record<number, VerseAnnotation>>(
    () => cachedSnapshot?.annotations ?? {},
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
      setAnnotations(snapshot.annotations);
      setNotes(snapshot.notes);
      return;
    }

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void loadChapterStorage(slug, num, tid).then((snapshot) => {
        if (cancelled) return;
        setAnnotations(snapshot.annotations);
        setNotes(snapshot.notes);
      });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [chapter?.bookSlug, chapter?.chapterNumber, translationId]);

  useEffect(() => {
    if (!chapter || !translationId) {
      return () => {};
    }
    const slug = chapter.bookSlug;
    const num = chapter.chapterNumber;
    const tid = translationId;

    return registerReaderDataImportReload(async () => {
      const snapshot = await loadChapterStorage(slug, num, tid);
      setAnnotations(snapshot.annotations);
      setNotes(snapshot.notes);
    });
  }, [chapter?.bookSlug, chapter?.chapterNumber, translationId]);

  const removeAnnotationsFromVerses = useCallback(
    (verseNumbers: number[]) => {
      if (!chapter || !translationId || verseNumbers.length === 0) return;
      setAnnotations((curr) => {
        const next = { ...curr };
        for (const v of verseNumbers) delete next[v];
        const key = getReaderAnnotationsStorageKey(chapter.bookSlug, chapter.chapterNumber, translationId);
        persistStorageSafely(key, JSON.stringify(next));
        patchChapterStorageCache(chapterStorageCacheKey(chapter.bookSlug, chapter.chapterNumber, translationId), {
          annotations: next,
        });
        return next;
      });
    },
    [chapter, translationId],
  );

  const applyAnnotationToVerses = useCallback(
    (verseNumbers: number[], annotation: VerseAnnotation) => {
      if (!chapter || !translationId || verseNumbers.length === 0) return;
      setAnnotations((curr) => {
        const next = { ...curr };
        for (const v of verseNumbers) next[v] = annotation;
        const key = getReaderAnnotationsStorageKey(chapter.bookSlug, chapter.chapterNumber, translationId);
        persistStorageSafely(key, JSON.stringify(next));
        patchChapterStorageCache(chapterStorageCacheKey(chapter.bookSlug, chapter.chapterNumber, translationId), {
          annotations: next,
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
    annotations,
    notes,
    removeAnnotationsFromVerses,
    applyAnnotationToVerses,
    persistNoteForVerse,
  };
}

export type ReaderChapterAnnotationExport = {
  bookSlug: string;
  chapter: number;
  translationId: string;
  annotations: Record<number, VerseAnnotation>;
  notes: Record<number, string>;
  /** v1 backup field — import only. */
  highlights?: Record<number, HighlightColor>;
};

function parseChapterStorageKey(
  key: string,
  prefix: string,
): { bookSlug: string; chapter: number; translationId: string } | null {
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  const lastColon = rest.lastIndexOf(":");
  if (lastColon <= 0) return null;
  const secondLastColon = rest.lastIndexOf(":", lastColon - 1);
  if (secondLastColon <= 0) return null;
  const bookSlug = rest.slice(0, secondLastColon);
  const chapter = parseInt(rest.slice(secondLastColon + 1, lastColon), 10);
  const translationId = rest.slice(lastColon + 1);
  if (!bookSlug || !Number.isFinite(chapter) || !translationId) return null;
  return { bookSlug, chapter, translationId };
}

function chapterExportKey(bookSlug: string, chapter: number, translationId: string): string {
  return `${bookSlug}:${chapter}:${translationId}`;
}

/** Clears in-memory reader annotation cache (e.g. after a full data import). */
export function clearReaderChapterStorageCache(): void {
  chapterStorageCache.clear();
  chapterStorageLoadPromises.clear();
}

/** Dev/diagnostic — current in-memory chapter storage entry count. */
export function getReaderChapterStorageCacheSize(): number {
  return chapterStorageCache.size;
}

export type ReaderAnnotationChapter = {
  bookSlug: string;
  chapter: number;
  translationId: string;
  annotations: Record<number, VerseAnnotation>;
};

/** Loads persisted highlight/underline maps only (no notes). Used by overlay marks search. */
export async function listReaderAnnotationChapters(): Promise<ReaderAnnotationChapter[]> {
  const allKeys = await AsyncStorage.getAllKeys();
  const annotationKeys = allKeys.filter((key) => key.startsWith(ANNOTATIONS_STORAGE_KEY_PREFIX));
  if (annotationKeys.length === 0) return [];

  const pairs = await AsyncStorage.multiGet(annotationKeys);
  const chapters: ReaderAnnotationChapter[] = [];
  for (const [key, raw] of pairs) {
    const parsed = parseChapterStorageKey(key, ANNOTATIONS_STORAGE_KEY_PREFIX);
    if (!parsed) continue;
    const annotations = parseAnnotations(raw);
    if (Object.keys(annotations).length === 0) continue;
    chapters.push({
      bookSlug: parsed.bookSlug,
      chapter: parsed.chapter,
      translationId: parsed.translationId,
      annotations,
    });
  }
  return chapters;
}

/** Loads every persisted annotation and note chapter from AsyncStorage. */
export async function exportAllReaderChapterAnnotations(): Promise<ReaderChapterAnnotationExport[]> {
  const allKeys = await AsyncStorage.getAllKeys();
  const chapters = new Map<string, ReaderChapterAnnotationExport>();

  for (const key of allKeys) {
    let parsed: { bookSlug: string; chapter: number; translationId: string } | null = null;
    let kind: "annotations" | "notes" | null = null;

    if (key.startsWith(ANNOTATIONS_STORAGE_KEY_PREFIX)) {
      parsed = parseChapterStorageKey(key, ANNOTATIONS_STORAGE_KEY_PREFIX);
      kind = "annotations";
    } else if (key.startsWith(NOTES_STORAGE_KEY_PREFIX)) {
      parsed = parseChapterStorageKey(key, NOTES_STORAGE_KEY_PREFIX);
      kind = "notes";
    }

    if (!parsed || !kind) continue;

    const mapKey = chapterExportKey(parsed.bookSlug, parsed.chapter, parsed.translationId);
    const existing = chapters.get(mapKey) ?? {
      bookSlug: parsed.bookSlug,
      chapter: parsed.chapter,
      translationId: parsed.translationId,
      annotations: {},
      notes: {},
    };

    const raw = await AsyncStorage.getItem(key);
    if (kind === "annotations") {
      existing.annotations = parseAnnotations(raw);
    } else {
      existing.notes = parseNotes(raw);
    }
    chapters.set(mapKey, existing);
  }

  return Array.from(chapters.values()).filter(
    (chapter) =>
      Object.keys(chapter.annotations).length > 0 || Object.keys(chapter.notes).length > 0,
  );
}

/** Replaces all reader annotations and notes with the provided export payload. */
export async function importAllReaderChapterAnnotations(
  chapters: ReaderChapterAnnotationExport[],
): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const keysToRemove = allKeys.filter(
    (key) =>
      key.startsWith(ANNOTATIONS_STORAGE_KEY_PREFIX) || key.startsWith(NOTES_STORAGE_KEY_PREFIX),
  );
  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
  }

  const writes: [string, string][] = [];
  for (const chapter of chapters) {
    const { bookSlug, chapter: chapterNum, translationId, notes } = chapter;
    const annotations =
      Object.keys(chapter.annotations).length > 0
        ? chapter.annotations
        : chapter.highlights
          ? annotationsFromLegacyHighlights(chapter.highlights)
          : {};
    if (Object.keys(annotations).length > 0) {
      writes.push([
        getReaderAnnotationsStorageKey(bookSlug, chapterNum, translationId),
        JSON.stringify(annotations),
      ]);
    }
    if (Object.keys(notes).length > 0) {
      writes.push([
        getNotesStorageKey(bookSlug, chapterNum, translationId),
        JSON.stringify(notes),
      ]);
    }
  }

  if (writes.length > 0) {
    await AsyncStorage.multiSet(writes);
  }

  clearReaderChapterStorageCache();
}
