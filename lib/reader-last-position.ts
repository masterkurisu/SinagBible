import AsyncStorage from "@react-native-async-storage/async-storage";
import { isTranslationId, type TranslationId } from "@sinag-bible/core/bible-translations";
import { readerPerfStart, readerPerfEnd } from "@/lib/reader-open-perf-log";

const STORAGE_KEY = "@sinagbible/mobile/reader-last-position";

/** Updated on save/load so the reader hub can redirect without waiting on AsyncStorage. */
let memoryLastPosition: ReaderLastPosition | null = null;

export type ReaderLastPosition = {
  bookSlug: string;
  chapter: number;
  /** Internal TranslationId for known translations, or raw API ID for dynamic ones. */
  translationId: string;
};

/** Synchronous snapshot (may be null before first load/save this session). */
export function peekReaderLastPosition(): ReaderLastPosition | null {
  return memoryLastPosition;
}

export function clearReaderLastPositionMemoryCache(): void {
  memoryLastPosition = null;
}

/**
 * De-dupes concurrent callers (e.g. the tab layout's cache-warming effect and the
 * reader hub's own redirect logic both firing near cold-start) onto a single
 * `AsyncStorage.getItem` read instead of one each. Cleared once the read settles so a
 * later call (e.g. after `saveReaderLastPosition`) still re-reads fresh state.
 */
let inFlightLoad: Promise<ReaderLastPosition | null> | null = null;

async function readReaderLastPositionFromStorage(): Promise<ReaderLastPosition | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      memoryLastPosition = null;
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      memoryLastPosition = null;
      return null;
    }
    const bookSlug = (parsed as { bookSlug?: unknown }).bookSlug;
    const chapter = (parsed as { chapter?: unknown }).chapter;
    const translationId = (parsed as { translationId?: unknown }).translationId;
    if (typeof bookSlug !== "string" || bookSlug.length === 0) {
      memoryLastPosition = null;
      return null;
    }
    if (typeof chapter !== "number" || !Number.isFinite(chapter) || chapter < 1) {
      memoryLastPosition = null;
      return null;
    }
    if (typeof translationId !== "string") {
      memoryLastPosition = null;
      return null;
    }
    const result = { bookSlug, chapter, translationId };
    memoryLastPosition = result;
    return result;
  } catch {
    memoryLastPosition = null;
    return null;
  }
}

export async function loadReaderLastPosition(): Promise<ReaderLastPosition | null> {
  if (inFlightLoad) {
    // TEMPORARY (reader-open-stall-findings.md Phase 2) — confirms the dedupe is
    // actually hit on-device; remove alongside the rest of the [reader-perf] logging.
    const perfHandle = readerPerfStart("loadReaderLastPosition: joined in-flight read (deduped)");
    return inFlightLoad.finally(() => readerPerfEnd(perfHandle));
  }
  const p = readReaderLastPositionFromStorage().finally(() => {
    if (inFlightLoad === p) inFlightLoad = null;
  });
  inFlightLoad = p;
  return p;
}

export async function saveReaderLastPosition(position: ReaderLastPosition): Promise<void> {
  memoryLastPosition = position;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  } catch {
    /* ignore */
  }
}

const FALLBACK_TRANSLATION: TranslationId = "KJV";

/** Translation from last reader session (AsyncStorage); use for search, deep links, etc. */
export async function getPreferredReaderTranslation(): Promise<string> {
  const pos = await loadReaderLastPosition();
  const tid = pos?.translationId?.trim();
  if (tid) return tid;
  return FALLBACK_TRANSLATION;
}

/** @deprecated Prefer {@link getPreferredReaderTranslation} for API/YVP ids. */
export async function getPreferredReaderTranslationId(): Promise<TranslationId> {
  const tid = await getPreferredReaderTranslation();
  if (isTranslationId(tid)) return tid;
  return FALLBACK_TRANSLATION;
}
