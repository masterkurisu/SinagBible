import AsyncStorage from "@react-native-async-storage/async-storage";
import { isTranslationId, type TranslationId } from "@sinag-bible/core/bible-translations";

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

export async function loadReaderLastPosition(): Promise<ReaderLastPosition | null> {
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
