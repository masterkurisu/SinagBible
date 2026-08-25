/**
 * Splits reflection markdown into block units for the read-only formatted preview
 * (`components/reflection-formatted-preview.tsx`). Grouping rules match
 * `journal-local.ts`'s `splitReflectionMarkdownIntoChunks`: a blank line always starts a
 * new block; an `[image:id]` line is always its own block; and a run of consecutive
 * same-kind lines (all "- " bullets, all "1. " ordered, all "- [ ] " checklist items, or
 * plain text) stays together as one block.
 */

export type ReflectionBlockKind =
  | "image"
  | "heading1"
  | "heading2"
  | "checklist"
  | "bullet"
  | "ordered"
  | "plain";

export type ReflectionBlock = {
  kind: ReflectionBlockKind;
  /** Raw markdown text for this block, possibly spanning multiple lines (joined by "\n"). */
  text: string;
  /** Start offset of this block within the source markdown string. */
  start: number;
  /** End offset (exclusive) of this block within the source markdown string. */
  end: number;
};

function classifyReflectionLineKind(line: string): ReflectionBlockKind {
  const t = line.trim();
  if (/^\[image:[^\]]+\]$/.test(t)) return "image";
  if (/^##\s+/.test(t)) return "heading2";
  if (/^#\s+/.test(t)) return "heading1";
  if (/^-\s\[[ xX]\]\s/.test(t)) return "checklist";
  if (/^-\s+/.test(t)) return "bullet";
  if (/^\d+\.\s+/.test(t)) return "ordered";
  return "plain";
}

/** Splits `markdown` into blocks, preserving each block's character offset range. */
export function computeReflectionBlocks(markdown: string): ReflectionBlock[] {
  const blocks: ReflectionBlock[] = [];
  let currentLines: { text: string; start: number; end: number }[] = [];
  let currentKind: ReflectionBlockKind | null = null;

  const flush = () => {
    if (currentLines.length === 0) return;
    const start = currentLines[0]!.start;
    const end = currentLines[currentLines.length - 1]!.end;
    const text = currentLines.map((l) => l.text).join("\n");
    blocks.push({ kind: currentKind ?? "plain", text, start, end });
    currentLines = [];
    currentKind = null;
  };

  let pos = 0;
  while (pos <= markdown.length) {
    const nlIndex = markdown.indexOf("\n", pos);
    const lineEnd = nlIndex === -1 ? markdown.length : nlIndex;
    const rawLine = markdown.slice(pos, lineEnd);

    if (rawLine.trim().length === 0) {
      flush();
    } else {
      const kind = classifyReflectionLineKind(rawLine);
      if (kind === "image") {
        flush();
        blocks.push({ kind: "image", text: rawLine, start: pos, end: lineEnd });
      } else {
        if (currentKind !== null && kind !== currentKind) flush();
        currentLines.push({ text: rawLine, start: pos, end: lineEnd });
        currentKind = kind;
      }
    }

    if (nlIndex === -1) break;
    pos = nlIndex + 1;
  }
  flush();
  return blocks;
}
