import { expandReferenceQuery } from "@sinag-bible/core/reference-aliases";
import { getBookNameFromSlug } from "@sinag-bible/core/bible-meta";
import {
  getClosestBookSuggestionsForTranslation,
  isTranslationId,
} from "@sinag-bible/core/bible-translations";
import { formatVerseTagLabel, parseVerseTagQuery } from "@sinag-bible/core";
import { parsePassageReference } from "@sinag-bible/core/journal";
import type { VerseTagRef } from "@sinag-bible/types";
import {
  getJournalChapter,
  getJournalVersePreview,
  normalizeJournalTranslationId,
  resolveJournalPassageBookSlug,
} from "@/lib/journal-verse-preview";

const VERSE_PREVIEW_LIMIT = 140;

export type VerseTagSuggestion =
  | {
      kind: "ref";
      ref: VerseTagRef;
      label: string;
      preview: string | null;
    }
  | {
      kind: "query";
      query: string;
      label: string;
      subtitle?: string;
    };

function suggestionTranslationId(translationId: string) {
  const normalized = normalizeJournalTranslationId(translationId);
  return isTranslationId(normalized) ? normalized : "KJV";
}

function normalizeSearchQuery(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.includes(" ")) {
    return expandReferenceQuery(trimmed);
  }
  const [bookPart, ...rest] = trimmed.split(":");
  if (!bookPart) return expandReferenceQuery(trimmed);
  return [expandReferenceQuery(bookPart), ...rest].join(":");
}

function truncatePreview(text: string | null): string | null {
  if (!text) return null;
  if (text.length <= VERSE_PREVIEW_LIMIT) return text;
  return `${text.slice(0, VERSE_PREVIEW_LIMIT).trimEnd()}...`;
}

async function buildRefSuggestion(
  ref: VerseTagRef,
  translationId: string,
): Promise<VerseTagSuggestion | null> {
  const canonicalBook = await resolveJournalPassageBookSlug(translationId, ref.book);
  if (!canonicalBook) return null;

  const chapterData = await getJournalChapter(translationId, canonicalBook, ref.chapter);
  if (!chapterData) return null;

  const maxVerse = chapterData.verses.length;
  if (ref.verseStart < 1 || ref.verseStart > maxVerse) return null;
  if (ref.verseEnd != null && (ref.verseEnd < 1 || ref.verseEnd > maxVerse || ref.verseEnd <= ref.verseStart)) {
    return null;
  }

  const resolvedRef: VerseTagRef = { ...ref, book: canonicalBook };
  const preview = await getJournalVersePreview(
    translationId,
    canonicalBook,
    ref.chapter,
    ref.verseStart,
    ref.verseEnd ?? null,
  );
  const bookLabel = chapterData.bookName || getBookNameFromSlug(canonicalBook) || canonicalBook;
  return {
    kind: "ref",
    ref: resolvedRef,
    label: formatVerseTagLabel(resolvedRef, bookLabel),
    preview: truncatePreview(preview),
  };
}

async function resolveCompleteRef(
  query: string,
  translationId: string,
): Promise<VerseTagSuggestion | null> {
  const tagPartial = parseVerseTagQuery(query);
  if (tagPartial?.book && tagPartial.chapter && tagPartial.verseStart) {
    return buildRefSuggestion(
      {
        book: tagPartial.book,
        chapter: tagPartial.chapter,
        verseStart: tagPartial.verseStart,
        verseEnd: tagPartial.verseEnd,
        translation: tagPartial.translation,
      },
      translationId,
    );
  }

  const passage = parsePassageReference(query);
  if (!passage?.verseStart) return null;

  const canonicalBook = await resolveJournalPassageBookSlug(translationId, passage.book);
  if (!canonicalBook) return null;

  return buildRefSuggestion(
    {
      book: canonicalBook,
      chapter: passage.chapter,
      verseStart: passage.verseStart,
      verseEnd: passage.verseEnd ?? undefined,
    },
    translationId,
  );
}

/** Fuzzy verse-tag suggestions for the mention sheet. */
export async function searchVerseTagSuggestions(
  rawQuery: string,
  translationId: string,
): Promise<VerseTagSuggestion[]> {
  const query = normalizeSearchQuery(rawQuery);
  if (!query) return [];

  const complete = await resolveCompleteRef(query, translationId);
  if (complete) return [complete];

  const bookInput = (parseVerseTagQuery(query)?.book || query.split(/[:\s]/)[0] || query).trim();
  if (!bookInput) return [];

  const bookSuggestions = await getClosestBookSuggestionsForTranslation(
    suggestionTranslationId(translationId),
    expandReferenceQuery(bookInput),
    { limit: 6 },
  );

  return bookSuggestions.map((item) => {
    const slug = item.bookSlug ?? item.bookName.toLowerCase().replace(/\s+/g, "-");
    const nextQuery = query.includes(":")
      ? `${slug}${query.slice(query.indexOf(":"))}`
      : `${slug}:`;
    return {
      kind: "query" as const,
      query: nextQuery,
      label: item.bookName,
      subtitle: "Continue with chapter:verse",
    };
  });
}
