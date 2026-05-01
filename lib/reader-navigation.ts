import { getReaderPath } from "@sinag-bible/core";

export type ReaderNavDirection = "next" | "prev";

/**
 * Params for the reader chapter screen. Use with `router.setParams(...)` so the same screen
 * instance updates in place (no stack push/replace → avoids native transition flashes).
 */
export function readerChapterScreenParams(
  bookSlug: string,
  chapter: number,
  translationId: string,
): { book: string; chapter: string; translation: string } {
  return {
    book: bookSlug,
    chapter: String(chapter),
    translation: translationId,
  };
}

/** Builds reader URL for `router.push` (e.g. opening from Search). */
export function readerChapterHref(
  bookSlug: string,
  chapter: number,
  translationId: string,
  direction?: ReaderNavDirection,
): string {
  const q = new URLSearchParams({ translation: translationId });
  if (direction) q.set("nav", direction);
  return `${getReaderPath(bookSlug, chapter)}?${q.toString()}`;
}
