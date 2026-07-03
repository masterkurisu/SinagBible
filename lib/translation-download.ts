import { getBookSlugFromUsfm } from "@sinag-bible/core/bible-meta";
import {
  flattenHelloaoVerseText,
  parseHelloaoVerseContentArray,
} from "@sinag-bible/core/helloao-verse-inline";
import { canonicalTranslationId } from "@/lib/canonical-translation-id";
import { isChapterDbOpen } from "@/lib/chapter-db";
import {
  putChapters,
  setTranslationFullyDownloaded,
  type StoredChapter,
} from "@/lib/chapter-store";
import { isDeviceOffline } from "@/lib/network-connectivity";
import {
  resolveHelloaoApiTranslationId,
  type ApiChapter,
} from "@/lib/bible-api-service";
import { supportsFullTranslationDownload } from "@/lib/translation-offline-capability";

const BIBLE_API_BASE_URL = "https://bible.helloao.org/api";
const DOWNLOAD_BATCH_SIZE = 50;
const DOWNLOAD_TIMEOUT_MS = 120_000;

type ApiContentItem = {
  type: string;
  number?: number;
  content?: unknown[];
};

type ApiCompleteChapter = { number: number; content: ApiContentItem[] };

type ApiCompleteBook = {
  id: string;
  name: string;
  commonName?: string;
  chapters: ApiCompleteChapter[];
};

type ApiCompleteResponse = {
  translation: { id: string; name: string; language: string };
  books: ApiCompleteBook[];
};

export type TranslationDownloadStatus = "idle" | "downloading" | "complete" | "error";

export type TranslationDownloadState = {
  translationId: string;
  status: TranslationDownloadStatus;
  completedChapters: number;
  totalChapters: number;
  errorMessage: string | null;
};

const downloadStates = new Map<string, TranslationDownloadState>();
const downloadInflight = new Map<string, Promise<void>>();
const listeners = new Set<(translationId: string) => void>();

function defaultDownloadState(translationId: string): TranslationDownloadState {
  return {
    translationId,
    status: "idle",
    completedChapters: 0,
    totalChapters: 0,
    errorMessage: null,
  };
}

function setDownloadState(translationId: string, patch: Partial<TranslationDownloadState>): void {
  const canonicalId = canonicalTranslationId(translationId);
  const prev = downloadStates.get(canonicalId) ?? defaultDownloadState(canonicalId);
  const next: TranslationDownloadState = { ...prev, ...patch, translationId: canonicalId };
  downloadStates.set(canonicalId, next);
  for (const listener of listeners) {
    listener(canonicalId);
  }
}

export function subscribeTranslationDownload(listener: (translationId: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTranslationDownloadState(translationId: string): TranslationDownloadState {
  const canonicalId = canonicalTranslationId(translationId);
  return downloadStates.get(canonicalId) ?? defaultDownloadState(canonicalId);
}

function parseCompleteChapter(
  apiTranslationId: string,
  bookId: string,
  bookName: string,
  chapterNumber: number,
  content: ApiContentItem[],
): ApiChapter {
  const verseItems = content.filter(
    (item): item is ApiContentItem & { number: number } =>
      item.type === "verse" && typeof item.number === "number",
  );
  return {
    translationId: apiTranslationId,
    bookId,
    chapterNumber,
    bookName,
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

function completeResponseToStoredChapters(
  canonicalId: string,
  apiTranslationId: string,
  response: ApiCompleteResponse,
): StoredChapter[] {
  const chapters: StoredChapter[] = [];

  for (const book of response.books ?? []) {
    const bookSlug = getBookSlugFromUsfm(book.id);
    if (!bookSlug) continue;
    const bookName = (book.commonName ?? book.name).trim() || book.name;

    for (const chapter of book.chapters ?? []) {
      if (!Number.isInteger(chapter.number) || chapter.number < 1) continue;
      const payload = parseCompleteChapter(
        apiTranslationId,
        book.id,
        bookName,
        chapter.number,
        chapter.content ?? [],
      );
      chapters.push({
        translationId: canonicalId,
        bookSlug,
        chapterNumber: chapter.number,
        source: "helloao",
        payload,
      });
    }
  }

  return chapters;
}

async function fetchCompleteTranslation(apiId: string): Promise<ApiCompleteResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const url = `${BIBLE_API_BASE_URL}/${apiId}/complete.json`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Download failed (HTTP ${res.status})`);
    }
    return (await res.json()) as ApiCompleteResponse;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Download timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runTranslationDownload(translationId: string): Promise<void> {
  const canonicalId = canonicalTranslationId(translationId);
  const apiId = resolveHelloaoApiTranslationId(translationId);

  if (!isChapterDbOpen()) {
    throw new Error("Offline store is not ready");
  }
  if (!supportsFullTranslationDownload(translationId)) {
    throw new Error("This translation cannot be downloaded");
  }
  if (await isDeviceOffline()) {
    throw new Error("Connect to the internet to download");
  }

  setDownloadState(canonicalId, {
    status: "downloading",
    completedChapters: 0,
    totalChapters: 0,
    errorMessage: null,
  });

  const response = await fetchCompleteTranslation(apiId);
  const allChapters = completeResponseToStoredChapters(canonicalId, apiId, response);
  if (allChapters.length === 0) {
    throw new Error("Translation download returned no chapters");
  }

  setDownloadState(canonicalId, { totalChapters: allChapters.length });

  for (let i = 0; i < allChapters.length; i += DOWNLOAD_BATCH_SIZE) {
    const batch = allChapters.slice(i, i + DOWNLOAD_BATCH_SIZE);
    putChapters(batch);
    setDownloadState(canonicalId, {
      completedChapters: Math.min(i + batch.length, allChapters.length),
    });
  }

  setTranslationFullyDownloaded(canonicalId, true);
  setDownloadState(canonicalId, {
    status: "complete",
    completedChapters: allChapters.length,
    totalChapters: allChapters.length,
    errorMessage: null,
  });
}

/**
 * Downloads an entire helloao translation into encrypted SQLite.
 * Resolves with existing inflight work when a download is already running.
 */
export function startTranslationDownload(translationId: string): Promise<void> {
  const canonicalId = canonicalTranslationId(translationId);
  const existing = downloadInflight.get(canonicalId);
  if (existing) return existing;

  const p = runTranslationDownload(translationId)
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Download failed";
      setDownloadState(canonicalId, {
        status: "error",
        errorMessage: message,
      });
      throw error;
    })
    .finally(() => {
      downloadInflight.delete(canonicalId);
    });

  downloadInflight.set(canonicalId, p);
  return p;
}

/** Clears in-memory download progress (e.g. delete-my-data in Phase 7). */
export function clearTranslationDownloadSession(): void {
  downloadStates.clear();
  downloadInflight.clear();
}
