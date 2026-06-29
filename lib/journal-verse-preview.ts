import {
  getChapterBySlugForTranslation,
  getClosestBookSuggestionForTranslation,
  getInternalIdFromApiId,
  getVersePreviewForTranslation,
  isTranslationId,
  resolveFeaturedTranslationApiId,
  resolvePassageBookSlugForTranslation,
  type TranslationId,
} from "@sinag-bible/core/bible-translations";
import type { BibleChapter } from "@sinag-bible/types";
import { fetchReaderChapterContent } from "@/lib/reader-chapter-load";
import { isYvpTranslationId } from "@/lib/youversion-api";

/**
 * Resolve a journal translation id from route params, saved entry, or reader context.
 * Preserves API ids (e.g. `tgl_ulb`); maps known aliases to internal ids when possible.
 */
export function normalizeJournalTranslationId(raw: string | null | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) return "KJV";
  const upper = trimmed.toUpperCase();
  if (isTranslationId(upper)) return upper;
  const resolved = getInternalIdFromApiId(trimmed);
  if (resolved) return resolved;
  return trimmed;
}

/** Translation id passed to chapter fetch (resolves featured aliases and API casing). */
export function resolveJournalTranslationForFetch(translationId: string): string {
  const normalized = normalizeJournalTranslationId(translationId);
  if (isTranslationId(normalized)) return normalized;
  if (isYvpTranslationId(normalized)) return normalized;
  return resolveFeaturedTranslationApiId(normalized.toLowerCase());
}

function bookSuggestionTranslationId(translationId: string): TranslationId {
  const normalized = normalizeJournalTranslationId(translationId);
  return isTranslationId(normalized) ? normalized : "KJV";
}

/** Map user-typed book names to canonical reader slugs for the given translation. */
export async function resolveJournalPassageBookSlug(
  translationId: string,
  bookInputSlug: string,
): Promise<string | null> {
  const normalized = normalizeJournalTranslationId(translationId);
  if (isTranslationId(normalized)) {
    return resolvePassageBookSlugForTranslation(normalized, bookInputSlug);
  }
  return resolvePassageBookSlugForTranslation("KJV", bookInputSlug);
}

export async function getJournalClosestBookSuggestion(
  translationId: string,
  bookInput: string,
): Promise<Awaited<ReturnType<typeof getClosestBookSuggestionForTranslation>>> {
  return getClosestBookSuggestionForTranslation(bookSuggestionTranslationId(translationId), bookInput);
}

export async function getJournalChapter(
  translationId: string,
  bookSlug: string,
  chapterNumber: number,
): Promise<BibleChapter | null> {
  const normalized = normalizeJournalTranslationId(translationId);
  if (normalized === "KJV") {
    return getChapterBySlugForTranslation("KJV", bookSlug, chapterNumber);
  }
  const fetchId = resolveJournalTranslationForFetch(translationId);
  const fromReader = await fetchReaderChapterContent(fetchId, bookSlug, chapterNumber);
  if (fromReader) return fromReader;
  if (isTranslationId(normalized)) {
    return getChapterBySlugForTranslation(normalized, bookSlug, chapterNumber);
  }
  return null;
}

/** Verse text for journal previews, using the translation frozen on the entry (or current reader). */
export async function getJournalVersePreview(
  translationId: string,
  bookSlug: string,
  chapter: number,
  verseStart: number | null,
  verseEnd: number | null,
): Promise<string | null> {
  if (verseStart == null || verseStart < 1) return null;

  const normalized = normalizeJournalTranslationId(translationId);
  if (isTranslationId(normalized)) {
    const viaCore = await getVersePreviewForTranslation(
      normalized,
      bookSlug,
      chapter,
      verseStart,
      verseEnd,
    );
    if (viaCore) return viaCore;
  }

  const ch = await getJournalChapter(normalized, bookSlug, chapter);
  if (!ch?.verses.length) return null;

  const end = verseEnd != null && verseEnd >= verseStart ? verseEnd : verseStart;
  const startIdx = verseStart - 1;
  const endIdx = Math.min(end, ch.verses.length) - 1;
  if (startIdx > endIdx) return null;

  return ch.verses.slice(startIdx, endIdx + 1).join(" ").trim() || null;
}
