import type { BibleVerseInlineItem, VerseAnnotation } from "@sinag-bible/types";
import type { TextLayoutLine } from "react-native";
import type { ReaderVerseFlashVerse } from "@/src/features/reader/readerVerseFlashListData";
import { paragraphUnderlineExtraOffsetY } from "@/src/features/reader/verseAnnotationUnderlineMetrics";

export type ParagraphVerseCharRange = {
  verseNum: number;
  start: number;
  end: number;
};

function flattenParagraphVerseBody(
  verse: ReaderVerseFlashVerse,
  yvpFootnotes?: Record<number, { label: string; body: string }>,
  canOpenFootnote = false,
): string {
  const inline = verse.verseInlineContent;
  if (!inline || inline.length === 0) return verse.verseText;

  let out = "";
  for (const item of inline) {
    out += flattenInlineItem(item, yvpFootnotes, canOpenFootnote);
  }
  return out;
}

function flattenInlineItem(
  item: BibleVerseInlineItem,
  yvpFootnotes: Record<number, { label: string; body: string }> | undefined,
  canOpenFootnote: boolean,
): string {
  if (typeof item === "string") return item;
  if ("lineBreak" in item && item.lineBreak === true) return "\n";
  if ("noteId" in item && typeof item.noteId === "number") {
    if (!canOpenFootnote) return "";
    const footnote = yvpFootnotes?.[item.noteId];
    return footnote?.label ?? "";
  }
  if ("heading" in item && typeof item.heading === "string") {
    return `\n${item.heading}\n`;
  }
  if ("text" in item && typeof item.text === "string") return item.text;
  return "";
}

/** Plain text as painted by `ReaderVerseParagraphBlock` (verse num + body + inter-verse space). */
export function buildParagraphRunPlainText(
  verses: readonly ReaderVerseFlashVerse[],
  yvpFootnotes?: Record<number, { label: string; body: string }>,
  canOpenFootnote = false,
): { text: string; ranges: ParagraphVerseCharRange[] } {
  let text = "";
  const ranges: ParagraphVerseCharRange[] = [];
  verses.forEach((verse, index) => {
    const verseNum = verse.verseIndex + 1;
    const numberPrefix = `${verseNum}\u00a0`;
    const body = flattenParagraphVerseBody(verse, yvpFootnotes, canOpenFootnote);
    const gap = index < verses.length - 1 ? " " : "";
    const start = text.length;
    text += numberPrefix + body + gap;
    ranges.push({
      verseNum,
      start,
      end: start + numberPrefix.length + body.length,
    });
  });
  return { text, ranges };
}

function indexOfLine(runText: string, lineText: string, from: number): number {
  if (!lineText) return from;
  const exact = runText.indexOf(lineText, from);
  if (exact >= 0) return exact;
  const runNorm = runText.replace(/\u00a0/g, " ");
  const lineNorm = lineText.replace(/\u00a0/g, " ");
  return runNorm.indexOf(lineNorm, from);
}

/**
 * Android nested `<Text>` reports ~half the painted line box (18px vs ~36px).
 * Scale y/height up to the styled line height so overlays sit on the ink.
 */
export function normalizeParagraphTextLayoutLines(
  lines: readonly TextLayoutLine[],
  styledLineHeight: number,
): TextLayoutLine[] {
  if (lines.length === 0) return [];
  const reportedStep =
    lines.length >= 2 ? lines[1]!.y - lines[0]!.y : (lines[0]!.height ?? 0);
  if (reportedStep <= 0) return lines.map((line) => ({ ...line }));
  const scale =
    reportedStep < styledLineHeight * 0.85 ? styledLineHeight / reportedStep : 1;
  if (scale === 1) return lines.map((line) => ({ ...line }));
  return lines.map((line) => ({
    ...line,
    y: line.y * scale,
    height: line.height * scale,
  }));
}

function clipLineToRange(
  line: TextLayoutLine,
  lineStart: number,
  lineEnd: number,
  rangeStart: number,
  rangeEnd: number,
): TextLayoutLine | null {
  const overlapStart = Math.max(rangeStart, lineStart);
  const overlapEnd = Math.min(rangeEnd, lineEnd);
  if (overlapEnd <= overlapStart) return null;
  const lineLen = lineEnd - lineStart;
  if (lineLen <= 0) return null;
  const startRatio = (overlapStart - lineStart) / lineLen;
  const endRatio = (overlapEnd - lineStart) / lineLen;
  return {
    ...line,
    x: line.x + startRatio * line.width,
    width: Math.max(1, (endRatio - startRatio) * line.width),
  };
}

function collectParagraphVerseLinesByVerse(
  lines: readonly TextLayoutLine[],
  verses: readonly ReaderVerseFlashVerse[],
  includeVerse: (verseNum: number) => boolean,
  styledLineHeight: number,
  yvpFootnotes?: Record<number, { label: string; body: string }>,
  canOpenFootnote = false,
  offsetY = 0,
): Map<number, TextLayoutLine[]> {
  const result = new Map<number, TextLayoutLine[]>();
  const included = verses.filter((verse) => includeVerse(verse.verseIndex + 1));
  if (included.length === 0 || lines.length === 0) return result;

  const normalized = normalizeParagraphTextLayoutLines(lines, styledLineHeight).map((line) =>
    offsetY === 0 ? line : { ...line, y: line.y + offsetY },
  );
  const { text, ranges } = buildParagraphRunPlainText(
    verses,
    yvpFootnotes,
    canOpenFootnote,
  );
  const rangeByVerse = new Map(ranges.map((range) => [range.verseNum, range]));

  let cursor = 0;
  for (const line of normalized) {
    const lineText = line.text ?? "";
    const found = indexOfLine(text, lineText, cursor);
    const lineStart = found >= 0 ? found : cursor;
    const lineEnd = lineStart + (lineText.length || 0);
    if (found >= 0) cursor = lineEnd;

    for (const verse of included) {
      const verseNum = verse.verseIndex + 1;
      const range = rangeByVerse.get(verseNum);
      if (!range) continue;
      const clipped = clipLineToRange(line, lineStart, lineEnd, range.start, range.end);
      if (!clipped) continue;
      const bucket = result.get(verseNum);
      if (bucket) bucket.push(clipped);
      else result.set(verseNum, [clipped]);
    }
  }

  return result;
}

export function collectParagraphUnderlineLinesByVerse(
  lines: readonly TextLayoutLine[],
  verses: readonly ReaderVerseFlashVerse[],
  annotations: Record<number, VerseAnnotation | undefined>,
  selectedVerseNumbers: ReadonlySet<number>,
  styledLineHeight: number,
  yvpFootnotes?: Record<number, { label: string; body: string }>,
  canOpenFootnote = false,
  fontSize = 0,
): Map<number, TextLayoutLine[]> {
  const extraY = paragraphUnderlineExtraOffsetY(fontSize, lines[0]?.descender ?? 0);
  return collectParagraphVerseLinesByVerse(
    lines,
    verses,
    (verseNum) =>
      !selectedVerseNumbers.has(verseNum) && annotations[verseNum]?.style === "underline",
    styledLineHeight,
    yvpFootnotes,
    canOpenFootnote,
    extraY,
  );
}

/** Highlight / selection fill rects — no underline extraY (fills cover the line box). */
export function collectParagraphFillLinesByVerse(
  lines: readonly TextLayoutLine[],
  verses: readonly ReaderVerseFlashVerse[],
  annotations: Record<number, VerseAnnotation | undefined>,
  selectedVerseNumbers: ReadonlySet<number>,
  styledLineHeight: number,
  yvpFootnotes?: Record<number, { label: string; body: string }>,
  canOpenFootnote = false,
): Map<number, TextLayoutLine[]> {
  return collectParagraphVerseLinesByVerse(
    lines,
    verses,
    (verseNum) =>
      selectedVerseNumbers.has(verseNum) || annotations[verseNum]?.style === "highlight",
    styledLineHeight,
    yvpFootnotes,
    canOpenFootnote,
    0,
  );
}
