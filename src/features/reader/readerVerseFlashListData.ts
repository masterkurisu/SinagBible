import type { BibleVerseInlineItem } from "@sinag-bible/types";

export type ReaderVerseFlashItem =
  | { kind: "verse"; verseIndex: number; verseText: string; verseInlineContent?: BibleVerseInlineItem[] }
  | { kind: "empty"; side: "left" | "right"; row: number };

/**
 * Tablet landscape uses FlashList masonry so each column stacks by its own
 * verse heights. Sequential placement (optimizeItemArrangement: false) keeps
 * interleaved [left, right, left, right] order instead of shortest-column fill.
 */
export function readerVerseFlashListColumnProps(twoColumn: boolean): {
  numColumns: 1 | 2;
  masonry: boolean;
  optimizeItemArrangement: false;
} {
  return {
    numColumns: twoColumn ? 2 : 1,
    masonry: twoColumn,
    optimizeItemArrangement: false,
  };
}

function verseFlashInlineAt(
  verseInlineContent: readonly BibleVerseInlineItem[][] | undefined,
  verseIndex: number,
): BibleVerseInlineItem[] | undefined {
  const row = verseInlineContent?.[verseIndex];
  return row && row.length > 0 ? [...row] : undefined;
}

export function buildReaderVerseFlashListData(
  verses: readonly string[],
  twoColumn: boolean,
  splitIndex: number,
  verseInlineContent?: readonly BibleVerseInlineItem[][] | undefined,
): ReaderVerseFlashItem[] {
  if (!twoColumn) {
    return verses.map((text, i) => ({
      kind: "verse" as const,
      verseIndex: i,
      verseText: text,
      verseInlineContent: verseFlashInlineAt(verseInlineContent, i),
    }));
  }
  const leftLen = splitIndex;
  const rightLen = Math.max(0, verses.length - splitIndex);
  const rows = Math.max(leftLen, rightLen);
  const out: ReaderVerseFlashItem[] = [];
  for (let r = 0; r < rows; r++) {
    if (r < leftLen) {
      out.push({
        kind: "verse",
        verseIndex: r,
        verseText: verses[r] ?? "",
        verseInlineContent: verseFlashInlineAt(verseInlineContent, r),
      });
    } else {
      out.push({ kind: "empty", side: "left", row: r });
    }
    if (r < rightLen) {
      const vi = splitIndex + r;
      out.push({
        kind: "verse",
        verseIndex: vi,
        verseText: verses[vi] ?? "",
        verseInlineContent: verseFlashInlineAt(verseInlineContent, vi),
      });
    } else {
      out.push({ kind: "empty", side: "right", row: r });
    }
  }
  return out;
}

/** FlashList row index for a 1-based verse number (handles two-column interleaving). */
export function findFlashListIndexForVerseNumber(
  items: ReaderVerseFlashItem[],
  verseNumber: number,
): number | null {
  const targetIndex = verseNumber - 1;
  const idx = items.findIndex(
    (item) => item.kind === "verse" && item.verseIndex === targetIndex,
  );
  return idx >= 0 ? idx : null;
}

/** Index of first verse in the right column; left column is verse indices [0, index). */
export function splitVerseIndexForBalancedColumns(verses: readonly string[]): number {
  const n = verses.length;
  if (n <= 1) return n;
  let total = 0;
  const lengths = verses.map((v) => v.length);
  for (const l of lengths) total += l;
  if (total === 0) return Math.ceil(n / 2);
  const target = total / 2;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += lengths[i] ?? 0;
    if (acc >= target && i < n - 1) {
      return i + 1;
    }
  }
  return Math.ceil(n / 2);
}
