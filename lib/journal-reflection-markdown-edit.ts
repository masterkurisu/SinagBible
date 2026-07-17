/**
 * Native markdown reflection editor helpers (toolbar insert/wrap).
 */

export type ReflectionTextSelection = { start: number; end: number };

export function wrapMarkdownMarker(
  text: string,
  selection: ReflectionTextSelection,
  marker: "**" | "_",
): { text: string; selection: ReflectionTextSelection } {
  const { start, end } = selection;
  const selected = text.slice(start, end);
  if (start === end) {
    const insert = `${marker}${marker}`;
    const next = text.slice(0, start) + insert + text.slice(end);
    return {
      text: next,
      selection: { start: start + marker.length, end: start + marker.length },
    };
  }
  const wrapped = `${marker}${selected}${marker}`;
  const next = text.slice(0, start) + wrapped + text.slice(end);
  return {
    text: next,
    selection: { start, end: end + marker.length * 2 },
  };
}

function lineRangeForIndex(text: string, index: number): { lineStart: number; lineEnd: number } {
  const safe = Math.max(0, Math.min(index, text.length));
  const lineStart = text.lastIndexOf("\n", safe - 1) + 1;
  const nextBreak = text.indexOf("\n", safe);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  return { lineStart, lineEnd };
}

export function insertLinePrefix(
  text: string,
  selection: ReflectionTextSelection,
  prefix: string,
): { text: string; selection: ReflectionTextSelection } {
  const { lineStart, lineEnd } = lineRangeForIndex(text, selection.start);
  const line = text.slice(lineStart, lineEnd);
  const stripped = line.replace(/^\s+/, "");
  const leading = line.slice(0, line.length - stripped.length);
  const nextLine = `${leading}${prefix}${stripped}`;
  const next = text.slice(0, lineStart) + nextLine + text.slice(lineEnd);
  const delta = prefix.length;
  return {
    text: next,
    selection: {
      start: selection.start + delta,
      end: selection.end + delta,
    },
  };
}

export function insertTextAtSelection(
  text: string,
  selection: ReflectionTextSelection,
  insert: string,
): { text: string; selection: ReflectionTextSelection } {
  const { start, end } = selection;
  const next = text.slice(0, start) + insert + text.slice(end);
  const cursor = start + insert.length;
  return { text: next, selection: { start: cursor, end: cursor } };
}

export function reflectionMarkdownHasContent(markdown: string): boolean {
  return markdown.replace(/\s+/g, "").length > 0;
}
