import type { HighlightColor, SearchResult, VerseAnnotation } from "@sinag-bible/types";
import { HIGHLIGHT_COLOR_IDS, isHighlightColor } from "@sinag-bible/types";
import { getBookNameFromSlug } from "@sinag-bible/core/bible-meta";
import { getVersePreviewForTranslation, isTranslationId } from "@sinag-bible/core/bible-translations";
import { loadCarouselFavorites, peekCarouselFavorites } from "@/lib/journal-carousel-verses";
import { listReaderAnnotationChapters } from "@/lib/use-reader-storage";

export const OVERLAY_MARKS_RESULT_CAP = 20;

/** `underlines` merges into `highlights` — underline marks match the "Highlights" filter too. */
export type OverlayMarksKind = "highlights" | "favorites" | "marks";

export type OverlayMarksQuery = {
  remainder: string;
  kind: OverlayMarksKind | null;
  color: HighlightColor | null;
};

export type ReaderVerseMark = {
  bookSlug: string;
  bookName: string;
  chapter: number;
  verse: number;
  translationId: string;
  kind: "highlight" | "underline" | "favorite";
  colorId?: string;
  verseText?: string;
};

export type OverlayMarksFilter = {
  kind: OverlayMarksKind | null;
  color: HighlightColor | null;
  bookScopeSlug?: string;
};

const IN_KIND_RE = /\bin:(highlights?|underlines?|favorites?|marks?)\b/gi;
const COLOR_RE = /\bcolor:(yellow|blue|pink|green|purple)\b/gi;

function lastMatch<T>(re: RegExp, raw: string, map: (value: string) => T | null): T | null {
  re.lastIndex = 0;
  let found: T | null = null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) != null) {
    found = map(match[1] ?? "");
  }
  return found;
}

function parseKindToken(value: string): OverlayMarksKind | null {
  const token = value.toLowerCase();
  if (token === "highlight" || token === "highlights") return "highlights";
  if (token === "underline" || token === "underlines") return "highlights";
  if (token === "favorite" || token === "favorites") return "favorites";
  if (token === "mark" || token === "marks") return "marks";
  return null;
}

/**
 * Pulls overlay mark gates out of the query so Bible keyword search does not
 * silently shrink. `favorites` without `in:` stays a journal token (Phase 7).
 * `color:yellow` with no `in:` token implies highlights.
 */
export function parseOverlayMarksQuery(rawQuery: string): OverlayMarksQuery {
  const raw = rawQuery.trim();
  if (!raw) return { remainder: "", kind: null, color: null };

  const kind = lastMatch(IN_KIND_RE, raw, parseKindToken);
  const color = lastMatch(COLOR_RE, raw, (value) => {
    const id = value.toLowerCase();
    return isHighlightColor(id) ? id : null;
  });

  IN_KIND_RE.lastIndex = 0;
  COLOR_RE.lastIndex = 0;
  const remainder = raw
    .replace(IN_KIND_RE, " ")
    .replace(COLOR_RE, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    remainder,
    kind: kind ?? (color ? "highlights" : null),
    color,
  };
}

export function resolveOverlayMarksFilter(
  parsed: OverlayMarksQuery,
  chipKind: OverlayMarksKind | null,
  chipColor: HighlightColor | null,
): OverlayMarksFilter {
  const kind = parsed.kind ?? chipKind;
  const color = parsed.color ?? chipColor;
  return {
    kind: kind ?? (color ? "highlights" : null),
    color,
  };
}

export function readerVerseMarkKey(mark: Pick<ReaderVerseMark, "bookSlug" | "chapter" | "verse">): string {
  return `${mark.bookSlug}:${mark.chapter}:${mark.verse}`;
}

export function searchResultMarkKey(row: Pick<SearchResult, "bookSlug" | "chapterNumber" | "verseNumber">): string {
  return `${row.bookSlug}:${row.chapterNumber}:${row.verseNumber}`;
}

export function readerMarkMatchesFilter(mark: ReaderVerseMark, filter: OverlayMarksFilter): boolean {
  if (!filter.kind) return false;
  if (filter.bookScopeSlug && mark.bookSlug !== filter.bookScopeSlug) return false;

  if (filter.kind === "highlights" && mark.kind !== "highlight" && mark.kind !== "underline") {
    return false;
  }
  if (filter.kind === "favorites" && mark.kind !== "favorite") return false;

  if (filter.color) {
    if (mark.kind === "favorite") return false;
    return mark.colorId === filter.color;
  }
  return true;
}

function sortReaderVerseMarks(marks: ReaderVerseMark[]): ReaderVerseMark[] {
  return [...marks].sort((a, b) => {
    const book = a.bookSlug.localeCompare(b.bookSlug);
    if (book !== 0) return book;
    if (a.chapter !== b.chapter) return a.chapter - b.chapter;
    if (a.verse !== b.verse) return a.verse - b.verse;
    return a.kind.localeCompare(b.kind);
  });
}

function annotationToMark(
  bookSlug: string,
  chapter: number,
  translationId: string,
  verse: number,
  annotation: VerseAnnotation,
): ReaderVerseMark {
  return {
    bookSlug,
    bookName: getBookNameFromSlug(bookSlug) ?? bookSlug,
    chapter,
    verse,
    translationId,
    kind: annotation.style,
    colorId: annotation.colorId,
  };
}

export function readerMarksFromAnnotationChapters(
  chapters: Array<{
    bookSlug: string;
    chapter: number;
    translationId: string;
    annotations: Record<number, VerseAnnotation>;
  }>,
): ReaderVerseMark[] {
  const marks: ReaderVerseMark[] = [];
  for (const chapter of chapters) {
    for (const [verseKey, annotation] of Object.entries(chapter.annotations)) {
      const verse = Number(verseKey);
      if (!Number.isFinite(verse) || verse < 1) continue;
      marks.push(
        annotationToMark(chapter.bookSlug, chapter.chapter, chapter.translationId, verse, annotation),
      );
    }
  }
  return marks;
}

export function readerMarksFromCarouselFavorites(
  records: Array<{
    bookSlug: string;
    bookName: string;
    chapter: number;
    verseStart: number;
    verseEnd: number | null;
    text: string;
    translationId: string;
  }>,
): ReaderVerseMark[] {
  const marks: ReaderVerseMark[] = [];
  for (const record of records) {
    const start = record.verseStart;
    const end = record.verseEnd != null && record.verseEnd >= start ? record.verseEnd : start;
    for (let verse = start; verse <= end; verse += 1) {
      marks.push({
        bookSlug: record.bookSlug,
        bookName: record.bookName,
        chapter: record.chapter,
        verse,
        translationId: record.translationId,
        kind: "favorite",
        verseText: verse === start ? record.text : undefined,
      });
    }
  }
  return marks;
}

export async function listReaderVerseMarks(): Promise<ReaderVerseMark[]> {
  const chapters = await listReaderAnnotationChapters();
  const favorites = peekCarouselFavorites() ?? (await loadCarouselFavorites());
  return sortReaderVerseMarks([
    ...readerMarksFromAnnotationChapters(chapters),
    ...readerMarksFromCarouselFavorites(favorites),
  ]);
}

function pickMarkForResult(marks: ReaderVerseMark[]): ReaderVerseMark {
  const highlight = marks.find((mark) => mark.kind === "highlight");
  if (highlight) return highlight;
  const underline = marks.find((mark) => mark.kind === "underline");
  if (underline) return underline;
  return marks[0]!;
}

export function filterSearchResultsByReaderMarks(
  results: SearchResult[],
  marks: ReaderVerseMark[],
  filter: OverlayMarksFilter,
): SearchResult[] {
  if (!filter.kind) return results;
  const matching = marks.filter((mark) => readerMarkMatchesFilter(mark, filter));
  const byKey = new Map<string, ReaderVerseMark[]>();
  for (const mark of matching) {
    const key = readerVerseMarkKey(mark);
    const list = byKey.get(key) ?? [];
    list.push(mark);
    byKey.set(key, list);
  }
  const next: SearchResult[] = [];
  for (const row of results) {
    const hits = byKey.get(searchResultMarkKey(row));
    if (!hits || hits.length === 0) continue;
    const mark = pickMarkForResult(hits);
    next.push({
      ...row,
      markKind: mark.kind,
      ...(mark.colorId ? { markColorId: mark.colorId } : {}),
    });
  }
  return next;
}

export function formatReaderMarkCaption(row: Pick<SearchResult, "markKind" | "markColorId">): string | null {
  if (row.markKind === "favorite") return "Saved verse";
  if (row.markKind === "underline") return "Underline";
  if (row.markKind === "highlight") {
    const color = row.markColorId ? row.markColorId.charAt(0).toUpperCase() + row.markColorId.slice(1) : null;
    return color ? `Highlight · ${color}` : "Highlight";
  }
  return null;
}

function markToSearchResult(mark: ReaderVerseMark, verseText: string): SearchResult {
  return {
    bookName: mark.bookName,
    bookSlug: mark.bookSlug,
    chapterNumber: mark.chapter,
    verseNumber: mark.verse,
    verseText,
    markKind: mark.kind,
    ...(mark.colorId ? { markColorId: mark.colorId } : {}),
  };
}

export async function readerMarksToSearchResults(
  marks: ReaderVerseMark[],
  filter: OverlayMarksFilter,
  options?: { fallbackTranslationId?: string; cap?: number },
): Promise<SearchResult[]> {
  const cap = options?.cap ?? OVERLAY_MARKS_RESULT_CAP;
  const matching = sortReaderVerseMarks(marks.filter((mark) => readerMarkMatchesFilter(mark, filter)));
  const seen = new Set<string>();
  const chosen: ReaderVerseMark[] = [];
  for (const mark of matching) {
    const key = readerVerseMarkKey(mark);
    if (seen.has(key)) continue;
    seen.add(key);
    chosen.push(mark);
    if (chosen.length >= cap) break;
  }

  const fallbackId = options?.fallbackTranslationId;
  const results: SearchResult[] = [];
  for (const mark of chosen) {
    let verseText = mark.verseText?.trim() ?? "";
    if (!verseText) {
      const translationId =
        mark.translationId && isTranslationId(mark.translationId)
          ? mark.translationId
          : fallbackId && isTranslationId(fallbackId)
            ? fallbackId
            : null;
      if (translationId) {
        const preview = await getVersePreviewForTranslation(
          translationId,
          mark.bookSlug,
          mark.chapter,
          mark.verse,
          mark.verse,
        );
        verseText = preview?.trim() ?? "";
      }
    }
    results.push(markToSearchResult(mark, verseText));
  }
  return results;
}

export { HIGHLIGHT_COLOR_IDS };
