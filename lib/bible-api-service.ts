/**
 * Bible API service for bible.helloao.org (Free Use Bible API).
 *
 * - Available translations: fetched once and kept in a module-level promise cache.
 * - Chapters: offline-first — served from AsyncStorage when available, otherwise
 *   fetched over the network and persisted for future offline access.
 *
 * Base URL:  https://bible.helloao.org/api
 * Key endpoints:
 *   GET /available_translations.json          → all translations
 *   GET /{translationId}/{bookId}/{chapter}.json → single chapter
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  flattenHelloaoVerseText,
  parseHelloaoVerseContentArray,
} from "@sinag-bible/core/helloao-verse-inline";
import type { BibleVerseInlineItem } from "@sinag-bible/types";

const BIBLE_API_BASE_URL = "https://bible.helloao.org/api";
const CHAPTER_CACHE_KEY_PREFIX = "sb:bible-api:chapter:";
const BIBLE_API_TIMEOUT_MS = 12_000;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single translation entry returned by the available-translations endpoint. */
export type ApiTranslation = {
  id: string;
  name: string;
  /** English display name (may equal `name` for English translations). */
  englishName: string;
  shortName: string;
  /** BCP-47-ish language code, e.g. `"eng"`, `"tgl"`. */
  language: string;
  /** Human-readable language name in English, e.g. `"English"`, `"Filipino"`. */
  languageEnglishName?: string;
  textDirection: "ltr" | "rtl";
};

/** A single verse within a fetched chapter. */
export type ApiVerse = {
  number: number;
  text: string;
  inlineContent?: BibleVerseInlineItem[];
};

/** A fully resolved chapter, ready for display or caching. */
export type ApiChapter = {
  translationId: string;
  bookId: string;
  chapterNumber: number;
  bookName: string;
  verses: ApiVerse[];
};

/**
 * A flattened picker entry for translation-selector UI.
 * Label format: `"BSB - Berean Standard Bible"`.
 */
export type TranslationPickerApiItem = {
  id: string;
  label: string;
  /** Sheet section title, e.g. `"English"` or `"Filipino"`. */
  languageSection: string;
};

// ---------------------------------------------------------------------------
// Internal response shapes (not exported — implementation detail)
// ---------------------------------------------------------------------------

type AvailableTranslationsResponse = {
  translations: ApiTranslation[];
};

type ApiContentItem = {
  type: string;
  number?: number;
  content?: unknown[];
};

type ApiChapterResponse = {
  book: {
    id: string;
    name: string;
    commonName?: string;
  };
  chapter: {
    number: number;
    content: ApiContentItem[];
  };
};

// ---------------------------------------------------------------------------
// Available translations — in-memory promise cache
// ---------------------------------------------------------------------------

let availableTranslationsCache: Promise<ApiTranslation[]> | null = null;

async function fetchJsonWithTimeout<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BIBLE_API_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`bible-api: HTTP ${res.status} — ${url}`);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`bible-api: request timed out after ${BIBLE_API_TIMEOUT_MS}ms — ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Fetches all available translations. Result is cached for the lifetime of the session. */
export function fetchAvailableTranslations(): Promise<ApiTranslation[]> {
  if (!availableTranslationsCache) {
    availableTranslationsCache = (async () => {
      const data = await fetchJsonWithTimeout<AvailableTranslationsResponse>(
        `${BIBLE_API_BASE_URL}/available_translations.json`,
      );
      if (!Array.isArray(data?.translations)) {
        throw new Error("bible-api: available_translations payload missing translations array");
      }
      return data.translations;
    })();

    // Allow the next call to retry if this one fails.
    void availableTranslationsCache.catch(() => {
      availableTranslationsCache = null;
    });
  }
  return availableTranslationsCache;
}

/**
 * Returns every translation from the API, sorted for grouped pickers:
 * by `languageEnglishName`, then short name. Bundled-only versions (e.g.
 * local `ADB1905`) are merged in separately by the picker hook.
 */
export async function getTranslationPickerItemsFromApi(): Promise<TranslationPickerApiItem[]> {
  const all = await fetchAvailableTranslations();
  return all
    .slice()
    .sort((a, b) => {
      const la = (a.languageEnglishName ?? a.language).toLowerCase();
      const lb = (b.languageEnglishName ?? b.language).toLowerCase();
      if (la !== lb) return la.localeCompare(lb);
      return a.shortName.localeCompare(b.shortName);
    })
    .map((t) => ({
      id: t.id,
      label: `${t.shortName} - ${t.englishName || t.name}`,
      languageSection: (t.languageEnglishName ?? t.language).trim() || "Other",
    }));
}

// ---------------------------------------------------------------------------
// Chapter fetch — offline-first with AsyncStorage persistence
// ---------------------------------------------------------------------------

function chapterStorageKey(translationId: string, bookId: string, chapter: number): string {
  return `${CHAPTER_CACHE_KEY_PREFIX}${translationId}:${bookId}:${chapter}`;
}

function parseChapterResponse(
  translationId: string,
  bookId: string,
  chapterNumber: number,
  raw: ApiChapterResponse,
): ApiChapter {
  const book = raw?.book;
  const chapter = raw?.chapter;
  if (!book || typeof book.name !== "string") {
    throw new Error(`bible-api: malformed chapter payload (book missing) for ${translationId}/${bookId}/${chapterNumber}`);
  }
  if (!chapter || !Array.isArray(chapter.content)) {
    throw new Error(
      `bible-api: malformed chapter payload (chapter.content missing) for ${translationId}/${bookId}/${chapterNumber}`,
    );
  }
  const verseItems = chapter.content.filter(
    (item): item is ApiContentItem & { number: number } =>
      item.type === "verse" && typeof item.number === "number",
  );
  return {
    translationId,
    bookId,
    chapterNumber,
    bookName: book.commonName ?? book.name,
    verses: verseItems.map((item) => {
      const inline = parseHelloaoVerseContentArray(item.content ?? []);
      return {
        number: item.number,
        text: flattenHelloaoVerseText(inline),
        ...(inline.length > 0 ? { inlineContent: inline } : {}),
      };
    }),
  };
}

/**
 * De-duplicates concurrent requests for the same chapter so we never fire
 * two network calls for the same key within a single session.
 */
const chapterFetchCache = new Map<string, Promise<ApiChapter>>();

/**
 * Fetches a single Bible chapter.
 *
 * Resolution order:
 *  1. In-flight promise (de-duplication within the same session)
 *  2. AsyncStorage (offline cache)
 *  3. Network — result is persisted to AsyncStorage before returning
 *
 * @param translationId  API translation ID, e.g. `"BSB"` or `"eng_asv"`.
 * @param bookId         USFM book code, e.g. `"GEN"`, `"MAT"`.
 * @param chapterNumber  1-based chapter number.
 */
export function fetchChapter(
  translationId: string,
  bookId: string,
  chapterNumber: number,
): Promise<ApiChapter> {
  const storageKey = chapterStorageKey(translationId, bookId, chapterNumber);

  const inflight = chapterFetchCache.get(storageKey);
  if (inflight) return inflight;

  const p = (async () => {
    // 1. Offline-first: return cached copy immediately if available.
    try {
      const cached = await AsyncStorage.getItem(storageKey);
      if (cached) {
        return JSON.parse(cached) as ApiChapter;
      }
    } catch {
      /* ignore storage read errors — fall through to network */
    }

    // 2. Network fetch.
    const url = `${BIBLE_API_BASE_URL}/${translationId}/${bookId}/${chapterNumber}.json`;
    const raw = await fetchJsonWithTimeout<ApiChapterResponse>(url);
    const chapter = parseChapterResponse(translationId, bookId, chapterNumber, raw);

    // 3. Persist for offline access; ignore write failures.
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(chapter));
    } catch {
      /* ignore storage write errors */
    }

    return chapter;
  })();

  chapterFetchCache.set(storageKey, p);

  // On failure: remove from in-flight cache so the next call can retry.
  void p.catch(() => chapterFetchCache.delete(storageKey));

  return p;
}

/**
 * Checks whether a chapter is already stored locally (available offline).
 */
export async function isChapterCached(
  translationId: string,
  bookId: string,
  chapterNumber: number,
): Promise<boolean> {
  try {
    const key = chapterStorageKey(translationId, bookId, chapterNumber);
    const value = await AsyncStorage.getItem(key);
    return value !== null;
  } catch {
    return false;
  }
}

/**
 * Removes all bible-api chapter entries from AsyncStorage and clears the
 * in-flight cache. Useful for a "clear offline data" setting.
 */
export async function clearChapterCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const chapterKeys = allKeys.filter((k) => k.startsWith(CHAPTER_CACHE_KEY_PREFIX));
    if (chapterKeys.length > 0) {
      await AsyncStorage.multiRemove(chapterKeys);
    }
  } catch {
    /* ignore */
  }
  chapterFetchCache.clear();
}

export function clearBibleApiMemoryCaches(): void {
  availableTranslationsCache = null;
  chapterFetchCache.clear();
}
