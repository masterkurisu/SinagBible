import { router, type Href } from "expo-router";
import type { VerseTagRef } from "@sinag-bible/types";
import { readerChapterHref } from "@/lib/reader-navigation";
import { saveReaderLastPosition } from "@/lib/reader-last-position";

/** Navigate to a tagged verse in the reader and persist last position. */
export function openVerseTagInReader(ref: VerseTagRef, contextTranslationId: string): void {
  const translationId = ref.translation?.trim() || contextTranslationId;
  void saveReaderLastPosition({
    bookSlug: ref.book,
    chapter: ref.chapter,
    translationId,
  });
  router.push(
    readerChapterHref(ref.book, ref.chapter, translationId, undefined, ref.verseStart) as Href,
  );
}
