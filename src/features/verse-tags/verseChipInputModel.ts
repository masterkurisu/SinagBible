import { splitTextWithVerseTags } from "@sinag-bible/core/verse-tags";
import type { VerseTagRef } from "@sinag-bible/types";

export type VerseChipInputTextRun = {
  kind: "text";
  id: string;
  value: string;
  start: number;
  end: number;
  lineIndex: number;
  /** Last text run on its line — grows to fill remaining width. */
  trailing: boolean;
};

export type VerseChipInputChipRun = {
  kind: "chip";
  id: string;
  raw: string;
  ref: VerseTagRef;
  start: number;
  end: number;
  lineIndex: number;
};

export type VerseChipInputRun = VerseChipInputTextRun | VerseChipInputChipRun;

export type VerseChipInputLine = {
  lineIndex: number;
  runs: VerseChipInputRun[];
};

type FlatText = {
  kind: "text";
  value: string;
  start: number;
  end: number;
};

type FlatChip = {
  kind: "chip";
  raw: string;
  ref: VerseTagRef;
  start: number;
  end: number;
};

type FlatItem = FlatText | FlatChip;

function flattenTokenizedText(text: string): FlatItem[] {
  const items: FlatItem[] = [];
  let offset = 0;

  for (const segment of splitTextWithVerseTags(text)) {
    if (segment.kind === "tag" && segment.ref) {
      items.push({
        kind: "chip",
        raw: segment.raw,
        ref: segment.ref,
        start: offset,
        end: offset + segment.raw.length,
      });
      offset += segment.raw.length;
      continue;
    }

    const value = segment.kind === "text" ? segment.value : segment.raw;
    const last = items[items.length - 1];
    if (last?.kind === "text") {
      last.value += value;
      last.end += value.length;
    } else {
      items.push({
        kind: "text",
        value,
        start: offset,
        end: offset + value.length,
      });
    }
    offset += value.length;
  }

  return items;
}

function pushTextRun(line: VerseChipInputLine, value: string, start: number): void {
  line.runs.push({
    kind: "text",
    id: `text-${start}`,
    value,
    start,
    end: start + value.length,
    lineIndex: line.lineIndex,
    trailing: false,
  });
}

/** Split a tokenized note into per-line chips + focusable text runs. */
export function buildVerseChipInputModel(text: string): VerseChipInputLine[] {
  const lines: VerseChipInputLine[] = [{ lineIndex: 0, runs: [] }];

  const currentLine = () => lines[lines.length - 1]!;

  for (const item of flattenTokenizedText(text)) {
    if (item.kind === "chip") {
      currentLine().runs.push({
        kind: "chip",
        id: `chip-${item.start}`,
        raw: item.raw,
        ref: item.ref,
        start: item.start,
        end: item.end,
        lineIndex: currentLine().lineIndex,
      });
      continue;
    }

    let local = 0;
    const parts = item.value.split("\n");
    for (let index = 0; index < parts.length; index += 1) {
      pushTextRun(currentLine(), parts[index]!, item.start + local);
      local += parts[index]!.length;
      if (index < parts.length - 1) {
        local += 1;
        lines.push({ lineIndex: lines.length, runs: [] });
      }
    }
  }

  for (const line of lines) {
    const last = line.runs[line.runs.length - 1];
    if (last?.kind === "text") {
      last.trailing = true;
      continue;
    }
    const start = last?.end ?? (line.lineIndex === 0 ? 0 : text.length);
    line.runs.push({
      kind: "text",
      id: `text-${start}`,
      value: "",
      start,
      end: start,
      lineIndex: line.lineIndex,
      trailing: true,
    });
  }

  return lines;
}

export function flattenVerseChipInputRuns(lines: VerseChipInputLine[]): VerseChipInputRun[] {
  return lines.flatMap((line) => line.runs);
}

/** Map a caret inside a text run to an index in the tokenized string. */
export function globalCursorFromLocal(runStart: number, localCursor: number): number {
  return runStart + Math.max(0, localCursor);
}

export function globalSelectionFromLocal(
  runStart: number,
  local: { start: number; end: number },
): { start: number; end: number } {
  return {
    start: globalCursorFromLocal(runStart, local.start),
    end: globalCursorFromLocal(runStart, local.end),
  };
}

export function replaceTextRunValue(
  text: string,
  run: Pick<VerseChipInputTextRun, "start" | "end">,
  nextValue: string,
): string {
  return text.slice(0, run.start) + nextValue + text.slice(run.end);
}

export function inferLocalCursorAfterEdit(
  previousValue: string,
  nextValue: string,
  localSelection: { start: number; end: number },
): number {
  const selected = localSelection.end - localSelection.start;
  const inserted = nextValue.length - (previousValue.length - selected);
  return Math.max(0, Math.min(nextValue.length, localSelection.start + inserted));
}

export function findTextRunAtCursor(
  lines: VerseChipInputLine[],
  cursorIndex: number,
): VerseChipInputTextRun | null {
  const runs = flattenVerseChipInputRuns(lines);
  let fallback: VerseChipInputTextRun | null = null;

  for (const run of runs) {
    if (run.kind !== "text") continue;
    fallback = run;
    if (run.start === run.end && run.start === cursorIndex) {
      return run;
    }
    if (run.start <= cursorIndex && cursorIndex <= run.end) {
      return run;
    }
  }

  return fallback;
}

/**
 * Empty-segment / start-of-run Backspace: delete the previous chip atomically,
 * or join lines when the previous character is a newline.
 */
export function deleteAtomicBeforeCursor(
  text: string,
  cursorIndex: number,
): { text: string; cursorIndex: number } | null {
  const lines = buildVerseChipInputModel(text);
  const run = findTextRunAtCursor(lines, cursorIndex);
  if (!run || cursorIndex !== run.start) {
    return null;
  }

  const runs = flattenVerseChipInputRuns(lines);
  const index = runs.findIndex((item) => item.id === run.id);
  const previous = index > 0 ? runs[index - 1] : undefined;
  if (previous?.kind === "chip") {
    return {
      text: text.slice(0, previous.start) + text.slice(previous.end),
      cursorIndex: previous.start,
    };
  }

  if (cursorIndex > 0 && text[cursorIndex - 1] === "\n") {
    return {
      text: text.slice(0, cursorIndex - 1) + text.slice(cursorIndex),
      cursorIndex: cursorIndex - 1,
    };
  }

  return null;
}

/** True when `@` at this caret is a mention trigger (start or after whitespace). */
export function canTriggerVerseTagAt(text: string, cursorIndex: number): boolean {
  if (cursorIndex < 0 || cursorIndex > text.length) return false;
  if (cursorIndex === 0) return true;
  const previous = text[cursorIndex - 1]!;
  return previous === " " || previous === "\n" || previous === "\r" || previous === "\t";
}
