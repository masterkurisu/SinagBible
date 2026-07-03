import { getReaderPath } from "@sinag-bible/core";

export type ReaderNavDirection = "next" | "prev";

export type ReaderChapterRoute = { bookSlug: string; chapter: number };

/** Parses `/(tabs)/reader/{book}/{chapter}` (or without the tabs group) from expo-router pathname. */
export function parseReaderChapterFromPathname(pathname: string | null): ReaderChapterRoute | null {
  if (pathname == null || pathname === "") return null;
  const parts = pathname.split("/").filter(Boolean);
  let i = 0;
  if (parts[0] === "(tabs)") i = 1;
  if (parts[i] !== "reader") return null;
  const afterReader = parts.slice(i + 1);
  if (afterReader.length < 2 || afterReader[0] === "index") return null;
  const bookSlug = afterReader[0]!;
  const chapter = Number.parseInt(afterReader[1]!, 10);
  if (!bookSlug || !Number.isFinite(chapter) || chapter < 1) return null;
  return { bookSlug, chapter };
}

/**
 * Params for the reader chapter screen. Use with `router.setParams(...)` so the same screen
 * instance updates in place (no stack push/replace → avoids native transition flashes).
 */
export function readerChapterScreenParams(
  bookSlug: string,
  chapter: number,
  translationId: string,
  verse?: number,
): { book: string; chapter: string; translation: string; verse?: string } {
  const params: { book: string; chapter: string; translation: string; verse?: string } = {
    book: bookSlug,
    chapter: String(chapter),
    translation: translationId,
  };
  if (verse != null && verse >= 1) params.verse = String(verse);
  return params;
}

/** Builds reader URL for `router.push` (e.g. opening from Search). */
export function readerChapterHref(
  bookSlug: string,
  chapter: number,
  translationId: string,
  direction?: ReaderNavDirection,
  verse?: number,
): string {
  const q = new URLSearchParams({ translation: translationId });
  if (direction) q.set("nav", direction);
  if (verse != null && verse >= 1) q.set("verse", String(verse));
  return `${getReaderPath(bookSlug, chapter)}?${q.toString()}`;
}
