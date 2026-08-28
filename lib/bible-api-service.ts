/**
 * Bible API service for bible.helloao.org (Free Use Bible API).
 *
 * - Available translations: fetched once and kept in a module-level promise cache.
 * - Chapters: offline-first — served from encrypted SQLite when available, otherwise
 *   fetched over the network and persisted for future offline access.
 *
 * Base URL:  https://bible.helloao.org/api
 * Key endpoints:
 *   GET /available_translations.json          → all translations
 *   GET /{translationId}/books.json           → localized book list for a translation
 *   GET /{translationId}/{bookId}/{chapter}.json → single chapter
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBookSlugFromUsfm } from "@sinag-bible/core/bible-meta";
import {
  getExternalApiId,
  getFeaturedTranslationSortIndex,
  isBundledFeaturedTranslationId,
  isFeaturedTranslationId,
  isTranslationId,
  resolveFeaturedTranslationApiId,
} from "@sinag-bible/core/bible-translations";
import {
  flattenHelloaoVerseText,
  parseHelloaoVerseContentArray,
} from "@sinag-bible/core/helloao-verse-inline";
import type { BibleBookNavItem, BibleChapter } from "@sinag-bible/types";
import type { BibleVerseInlineItem } from "@sinag-bible/types";
import { canonicalTranslationId } from "@/lib/canonical-translation-id";
import { isChapterDbOpen } from "@/lib/chapter-db";
import {
  clearAllStoredChapters,
  clearChapterStoreMemoryCache,
  getChapterSync,
  getTranslationMetaSync,
  hasChapterSync,
  putChapter,
} from "@/lib/chapter-store";
import { clearYvpMemoryCaches } from "@/lib/youversion-api";

const BIBLE_API_BASE_URL = "https://bible.helloao.org/api";
const CHAPTER_CACHE_KEY_PREFIX = "sb:bible-api:chapter:";
const BOOKS_CACHE_KEY_PREFIX = "sb:bible-api:books:";
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

type ApiTranslationBook = {
  id: string;
  name: string;
  commonName?: string;
  order: number;
  numberOfChapters: number;
};

type ApiTranslationBooksResponse = {
  books: ApiTranslationBook[];
};

function resolveApiTranslationId(translationId: string): string {
  if (isTranslationId(translationId)) return getExternalApiId(translationId);
  return resolveFeaturedTranslationApiId(translationId.toLowerCase());
}

/** Resolves reader / picker ids to helloao.org API translation ids. */
export function resolveHelloaoApiTranslationId(translationId: string): string {
  return resolveApiTranslationId(translationId);
}

function booksStorageKey(translationId: string): string {
  return `${BOOKS_CACHE_KEY_PREFIX}${translationId}`;
}

function chapterFetchDedupKey(
  canonicalId: string,
  bookSlug: string,
  chapterNumber: number,
): string {
  return `${canonicalId}:${bookSlug}:${chapterNumber}`;
}

function readStoredHelloaoChapter(
  canonicalId: string,
  bookSlug: string,
  chapterNumber: number,
): ApiChapter | null {
  if (!isChapterDbOpen()) return null;

  const stored = getChapterSync(canonicalId, bookSlug, chapterNumber);
  if (!stored || stored.source !== "helloao") return null;

  return stored.payload as ApiChapter;
}

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
 * Returns featured translations from the API, sorted for grouped pickers:
 * curated order within each language section, then by short name.
 * Bundled-only versions (e.g. local `ADB1905`) are merged in separately by the picker hook.
 */
export async function getTranslationPickerItemsFromApi(): Promise<TranslationPickerApiItem[]> {
  const all = await fetchAvailableTranslations();
  return all
    .filter(
      (t) =>
        !isBundledFeaturedTranslationId(t.shortName) &&
        isFeaturedTranslationId(t.id, t.shortName),
    )
    .slice()
    .sort((a, b) => {
      const la = (a.languageEnglishName ?? a.language).toLowerCase();
      const lb = (b.languageEnglishName ?? b.language).toLowerCase();
      if (la !== lb) return la.localeCompare(lb);
      const orderA = getFeaturedTranslationSortIndex(a.id, a.shortName);
      const orderB = getFeaturedTranslationSortIndex(b.id, b.shortName);
      if (orderA !== orderB) return orderA - orderB;
      return a.shortName.localeCompare(b.shortName);
    })
    .map((t) => ({
      id: t.id,
      label: `${t.shortName} - ${t.englishName || t.name}`,
      languageSection: (t.languageEnglishName ?? t.language).trim() || "Other",
    }));
}

// ---------------------------------------------------------------------------
// Chapter fetch — offline-first with encrypted SQLite persistence
// ---------------------------------------------------------------------------

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
const translationBooksCache = new Map<string, Promise<BibleBookNavItem[]>>();

function parseTranslationBooksResponse(raw: ApiTranslationBooksResponse): BibleBookNavItem[] {
  const books = Array.isArray(raw?.books) ? raw.books : [];
  return books
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((book) => {
      const slug = getBookSlugFromUsfm(book.id);
      if (!slug) return null;
      return {
        name: (book.commonName ?? book.name).trim() || book.name,
        slug,
        chapterCount: book.numberOfChapters,
      };
    })
    .filter((item): item is BibleBookNavItem => item != null);
}

/**
 * Localized book nav for API-only translations (e.g. `tgl_ulb`).
 * Canonical reader slugs (KJV-shaped) are preserved for routing.
 */
export function fetchTranslationBookNav(translationId: string): Promise<BibleBookNavItem[]> {
  const apiId = resolveApiTranslationId(translationId);
  const inflight = translationBooksCache.get(apiId);
  if (inflight) return inflight;

  const p = (async () => {
    try {
      const cached = await AsyncStorage.getItem(booksStorageKey(apiId));
      if (cached) {
        const parsed = JSON.parse(cached) as BibleBookNavItem[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      /* ignore storage read errors */
    }

    const url = `${BIBLE_API_BASE_URL}/${apiId}/books.json`;
    const raw = await fetchJsonWithTimeout<ApiTranslationBooksResponse>(url);
    const nav = parseTranslationBooksResponse(raw);
    if (nav.length === 0) {
      throw new Error(`bible-api: no canonical books in ${apiId}/books.json`);
    }

    try {
      await AsyncStorage.setItem(booksStorageKey(apiId), JSON.stringify(nav));
    } catch {
      /* ignore storage write errors */
    }

    return nav;
  })();

  translationBooksCache.set(apiId, p);
  void p.catch(() => translationBooksCache.delete(apiId));
  return p;
}

/**
 * Fetches a single Bible chapter.
 *
 * Resolution order:
 *  1. In-flight promise (de-duplication within the same session)
 *  2. Encrypted SQLite store (helloao chapters)
 *  3. Network — result is persisted to SQLite before returning
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
  const apiId = resolveApiTranslationId(translationId);
  const canonicalId = canonicalTranslationId(apiId);
  const bookSlug = getBookSlugFromUsfm(bookId);
  const dedupKey = bookSlug
    ? chapterFetchDedupKey(canonicalId, bookSlug, chapterNumber)
    : `${apiId}:${bookId}:${chapterNumber}`;

  const inflight = chapterFetchCache.get(dedupKey);
  if (inflight) return inflight;

  const p = (async () => {
    if (bookSlug) {
      const stored = readStoredHelloaoChapter(canonicalId, bookSlug, chapterNumber);
      if (stored) return stored;

      const meta = getTranslationMetaSync(canonicalId);
      if (meta?.fullyDownloaded) {
        throw new Error(
          `bible-api: chapter missing from fully downloaded translation ${canonicalId}/${bookSlug}/${chapterNumber}`,
        );
      }
    }

    const url = `${BIBLE_API_BASE_URL}/${apiId}/${bookId}/${chapterNumber}.json`;
    const raw = await fetchJsonWithTimeout<ApiChapterResponse>(url);
    const chapter = parseChapterResponse(apiId, bookId, chapterNumber, raw);

    if (bookSlug && isChapterDbOpen()) {
      try {
        putChapter({
          translationId: canonicalId,
          bookSlug,
          chapterNumber,
          source: "helloao",
          payload: chapter,
        });
      } catch {
        /* ignore store write errors — still return the fetched chapter */
      }
    }

    return chapter;
  })();

  chapterFetchCache.set(dedupKey, p);

  void p.catch(() => chapterFetchCache.delete(dedupKey));

  return p;
}

/** Converts a fetched API chapter into the reader's `BibleChapter` shape. */
export function apiChapterToBibleChapter(bookSlug: string, api: ApiChapter): BibleChapter {
  const verseInlineContent = api.verses.map((v) => v.inlineContent ?? []);
  const hasInline = verseInlineContent.some((row) => row.length > 0);
  return {
    bookName: api.bookName,
    bookSlug,
    chapterNumber: api.chapterNumber,
    verses: api.verses.map((v) => v.text),
    ...(hasInline ? { verseInlineContent } : {}),
  };
}

/**
 * Checks whether a chapter is already stored locally (available offline).
 */
export async function isChapterCached(
  translationId: string,
  bookId: string,
  chapterNumber: number,
): Promise<boolean> {
  if (!isChapterDbOpen()) return false;

  const bookSlug = getBookSlugFromUsfm(bookId);
  if (!bookSlug) return false;

  return hasChapterSync(canonicalTranslationId(translationId), bookSlug, chapterNumber);
}

/**
 * Clears all persisted chapter rows from encrypted SQLite (`helloao` and `yvp`
 * sources). Translation metadata (`fully_downloaded`, copyright notices) is kept.
 * Also removes legacy plaintext chapter keys from AsyncStorage and clears
 * in-flight helloao fetch dedup state.
 *
 * For a full encrypted store wipe (delete-my-data), use {@link deleteChapterDatabase}.
 */
export async function clearChapterCache(): Promise<void> {
  if (isChapterDbOpen()) {
    try {
      clearAllStoredChapters();
    } catch {
      /* ignore */
    }
  }

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

/**
 * Does *not* reset pinned-translations-prefetch or translation-download session
 * bookkeeping — callers that need those too (e.g. delete-my-data) should call
 * `resetPinnedTranslationsPrefetchSession()` (`@/lib/pinned-translations-prefetch`)
 * and `clearTranslationDownloadSession()` (`@/lib/translation-download`) themselves.
 * Kept out of this module deliberately to avoid require cycles — both of those
 * modules import from this one (`pinned-translations-prefetch.ts ->
 * reader-chapter-load.ts -> bible-api-service.ts`, and `translation-download.ts ->
 * bible-api-service.ts` directly); importing back from here would close the loop.
 * See reader-open-stall-findings.md Phase 4.
 */
export function clearBibleApiMemoryCaches(): void {
  availableTranslationsCache = null;
  chapterFetchCache.clear();
  translationBooksCache.clear();
  clearChapterStoreMemoryCache();
  clearYvpMemoryCaches();
}
