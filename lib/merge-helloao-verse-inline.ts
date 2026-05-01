import type { BibleChapter } from "@sinag-bible/types";
import type { ApiChapter } from "@/lib/bible-api-service";

/**
 * Copies structured verse fragments (e.g. `wordsOfJesus`) from a helloao chapter
 * onto a locally loaded chapter with the same verse count and order.
 * Verse body strings stay unchanged; only `verseInlineContent` is added for styling.
 */
export function mergeVerseInlineFromHelloaoChapter(
  local: BibleChapter,
  api: ApiChapter,
): BibleChapter {
  if (api.verses.length !== local.verses.length) return local;

  const byVerseNumber = new Map<number, NonNullable<ApiChapter["verses"][number]["inlineContent"]>>();
  for (const v of api.verses) {
    const inline = v.inlineContent;
    if (inline && inline.length > 0) {
      byVerseNumber.set(v.number, inline);
    }
  }
  if (byVerseNumber.size === 0) return local;

  const verseInlineContent = local.verses.map((_, i) => byVerseNumber.get(i + 1) ?? []);
  const hasRich = verseInlineContent.some((row) => row.length > 0);
  return hasRich ? { ...local, verseInlineContent } : local;
}
