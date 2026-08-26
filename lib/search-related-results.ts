import type { SearchResult } from "@sinag-bible/types";
import type { PopularVerseRef } from "@sinag-bible/core/search-keyword-popular";
import { getVersePreviewForTranslation, isTranslationId } from "@sinag-bible/core/bible-translations";
import { getBookNameFromSlug } from "@sinag-bible/core/bible-meta";
import { getChapterSync } from "@/lib/chapter-store";
import { isYvpTranslationId, type YvpPassage } from "@/lib/youversion-api";
import { yvpPassageToBibleChapter } from "@/lib/yvp-chapter-payload";

function resultKey(row: { bookSlug: string; chapterNumber: number; verseNumber: number }): string {
  return `${row.bookSlug}:${row.chapterNumber}:${row.verseNumber}`;
}

async function verseTextForTranslation(
  translationId: string,
  ref: PopularVerseRef,
  signal?: AbortSignal,
): Promise<string | null> {
  if (signal?.aborted) return null;
  if (isTranslationId(translationId)) {
    return getVersePreviewForTranslation(
      translationId,
      ref.slug,
      ref.chapter,
      ref.verse,
      ref.verse,
    );
  }
  if (!isYvpTranslationId(translationId)) return null;
  const stored = getChapterSync(translationId, ref.slug, ref.chapter);
  if (!stored || stored.source !== "yvp") return null;
  try {
    const chapter = yvpPassageToBibleChapter(
      ref.slug,
      ref.chapter,
      stored.payload as YvpPassage,
    );
    return chapter.verses[ref.verse - 1]?.trim() || null;
  } catch {
    return null;
  }
}

/** Hydrate curated related refs in the active translation. Skip verses already in primary hits. */
export async function relatedRefsToSearchResults(
  refs: PopularVerseRef[],
  translationId: string,
  options?: { exclude?: SearchResult[]; signal?: AbortSignal },
): Promise<SearchResult[]> {
  const seen = new Set((options?.exclude ?? []).map(resultKey));
  const out: SearchResult[] = [];
  for (const ref of refs) {
    if (options?.signal?.aborted) return out;
    const key = `${ref.slug}:${ref.chapter}:${ref.verse}`;
    if (seen.has(key)) continue;
    const verseText = await verseTextForTranslation(translationId, ref, options?.signal);
    if (!verseText) continue;
    seen.add(key);
    out.push({
      bookName: getBookNameFromSlug(ref.slug) ?? ref.slug,
      bookSlug: ref.slug,
      chapterNumber: ref.chapter,
      verseNumber: ref.verse,
      verseText,
    });
  }
  return out;
}
