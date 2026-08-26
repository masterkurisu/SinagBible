import type { SearchResult } from "@sinag-bible/types";
import { getVersePreviewForTranslation, isTranslationId } from "@sinag-bible/core/bible-translations";
import { getChapterSync } from "@/lib/chapter-store";
import { getTranslationDisplayAbbreviation } from "@/lib/translation-display-label";
import { isYvpTranslationId, type YvpPassage } from "@/lib/youversion-api";
import { yvpPassageToBibleChapter } from "@/lib/yvp-chapter-payload";

const ALSO_SNIPPET_CAP = 20;

export function pickAlsoTranslationId(
  currentTranslationId: string,
  pinnedIds: readonly string[],
): string | null {
  const current = currentTranslationId.trim().toLowerCase();
  for (const id of pinnedIds) {
    const trimmed = id.trim();
    if (!trimmed) continue;
    if (trimmed.toLowerCase() === current) continue;
    return trimmed;
  }
  return null;
}

export function isAlsoTranslationId(value: string | null | undefined): value is string {
  const id = value?.trim() ?? "";
  if (!id) return false;
  return isTranslationId(id) || isYvpTranslationId(id);
}

async function alsoVerseTextForResult(
  alsoTranslationId: string,
  row: SearchResult,
  signal?: AbortSignal,
): Promise<string | null> {
  if (signal?.aborted) return null;

  if (isTranslationId(alsoTranslationId)) {
    return getVersePreviewForTranslation(
      alsoTranslationId,
      row.bookSlug,
      row.chapterNumber,
      row.verseNumber,
      row.verseNumber,
    );
  }

  if (!isYvpTranslationId(alsoTranslationId)) return null;

  const stored = getChapterSync(alsoTranslationId, row.bookSlug, row.chapterNumber);
  if (!stored || stored.source !== "yvp") return null;
  try {
    const chapter = yvpPassageToBibleChapter(
      row.bookSlug,
      row.chapterNumber,
      stored.payload as YvpPassage,
      row.bookName,
    );
    const text = chapter.verses[row.verseNumber - 1]?.trim();
    return text || null;
  } catch {
    return null;
  }
}

/**
 * Attach a same-verse snippet from another translation. Does not run a second
 * keyword search. Missing text skips that row. Cached YVP chapters only.
 */
export async function attachAlsoTranslationSnippets(
  results: SearchResult[],
  alsoTranslationId: string,
  options?: { signal?: AbortSignal },
): Promise<SearchResult[]> {
  if (!isAlsoTranslationId(alsoTranslationId)) return results;
  const label = getTranslationDisplayAbbreviation(alsoTranslationId);
  const limited = results.slice(0, ALSO_SNIPPET_CAP);
  const out: SearchResult[] = [];
  for (const row of limited) {
    if (options?.signal?.aborted) return results;
    const alsoVerseText = await alsoVerseTextForResult(alsoTranslationId, row, options?.signal);
    if (!alsoVerseText) {
      out.push(row);
      continue;
    }
    out.push({
      ...row,
      alsoVerseText,
      alsoTranslationLabel: label,
    });
  }
  if (results.length > ALSO_SNIPPET_CAP) {
    out.push(...results.slice(ALSO_SNIPPET_CAP));
  }
  return out;
}
