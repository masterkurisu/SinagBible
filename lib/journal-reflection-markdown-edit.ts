/**
 * Native markdown reflection editor helpers (toolbar insert/wrap).
 */

export type ReflectionTextSelection = { start: number; end: number };
export type ReflectionMarkdownEditResult = { text: string; selection: ReflectionTextSelection };

const CHECKLIST_PREFIX_RE = /^-\s\[[ xX]\]\s/;
const BULLET_PREFIX_RE = /^-\s(?!\[)/;
const ORDERED_PREFIX_RE = /^\d+\.\s/;
const HEADING_PREFIX_RE = /^#{1,2}\s/;

/**
 * Wrap (or, if the selection already sits inside a matching pair, unwrap) the current
 * selection with a marker. Pressing the same toolbar button twice on the same text now toggles
 * the style off instead of stacking `****bold****`.
 */
export function wrapMarkdownMarker(
  text: string,
  selection: ReflectionTextSelection,
  marker: "**" | "_",
): ReflectionMarkdownEditResult {
  const { start, end } = selection;
  const before = text.slice(Math.max(0, start - marker.length), start);
  const after = text.slice(end, end + marker.length);

  // Toggle off: cursor/selection sits immediately inside `marker...marker`.
  if (before === marker && after === marker) {
    const next =
      text.slice(0, start - marker.length) + text.slice(start, end) + text.slice(end + marker.length);
    const cursor = start - marker.length;
    return { text: next, selection: { start: cursor, end: cursor + (end - start) } };
  }

  if (start === end) {
    const insert = `${marker}${marker}`;
    const next = text.slice(0, start) + insert + text.slice(end);
    return {
      text: next,
      selection: { start: start + marker.length, end: start + marker.length },
    };
  }

  const selected = text.slice(start, end);
  // Toggle off when the selection itself carries the markers, e.g. selecting "**word**".
  if (
    selected.length >= marker.length * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const inner = selected.slice(marker.length, selected.length - marker.length);
    const next = text.slice(0, start) + inner + text.slice(end);
    return { text: next, selection: { start, end: start + inner.length } };
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

type LinePrefixKind = "heading" | "checklist" | "bullet" | "ordered" | null;

function classifyLinePrefix(prefix: string): LinePrefixKind {
  if (HEADING_PREFIX_RE.test(prefix)) return "heading";
  if (CHECKLIST_PREFIX_RE.test(prefix)) return "checklist";
  if (BULLET_PREFIX_RE.test(prefix)) return "bullet";
  if (ORDERED_PREFIX_RE.test(prefix)) return "ordered";
  return null;
}

function matchExistingLinePrefix(withoutLeadingWs: string): string {
  const heading = withoutLeadingWs.match(HEADING_PREFIX_RE);
  if (heading) return heading[0];
  const checklist = withoutLeadingWs.match(CHECKLIST_PREFIX_RE);
  if (checklist) return checklist[0];
  const ordered = withoutLeadingWs.match(ORDERED_PREFIX_RE);
  if (ordered) return ordered[0];
  const bullet = withoutLeadingWs.match(BULLET_PREFIX_RE);
  if (bullet) return bullet[0];
  return "";
}

/**
 * Toggle a line-level prefix (heading, checklist, bullet, ordered) on the line the selection
 * starts in. Pressing the same style again removes it; applying a different line style (e.g.
 * bullet -> heading) replaces the old prefix instead of stacking "## - text".
 */
export function toggleLinePrefix(
  text: string,
  selection: ReflectionTextSelection,
  prefix: string,
): ReflectionMarkdownEditResult {
  const { lineStart, lineEnd } = lineRangeForIndex(text, selection.start);
  const line = text.slice(lineStart, lineEnd);
  const leadingWs = line.match(/^\s*/)?.[0] ?? "";
  const withoutLeading = line.slice(leadingWs.length);
  const existingPrefix = matchExistingLinePrefix(withoutLeading);
  const body = withoutLeading.slice(existingPrefix.length);

  const turningOff =
    existingPrefix !== "" && classifyLinePrefix(existingPrefix) === classifyLinePrefix(prefix);
  const nextLine = turningOff ? `${leadingWs}${body}` : `${leadingWs}${prefix}${body}`;
  const next = text.slice(0, lineStart) + nextLine + text.slice(lineEnd);
  const delta = (turningOff ? 0 : prefix.length) - existingPrefix.length;
  return {
    text: next,
    selection: {
      start: Math.max(lineStart, selection.start + delta),
      end: Math.max(lineStart, selection.end + delta),
    },
  };
}

function insertTextAtSelection(
  text: string,
  selection: ReflectionTextSelection,
  insert: string,
): ReflectionMarkdownEditResult {
  const { start, end } = selection;
  const next = text.slice(0, start) + insert + text.slice(end);
  const cursor = start + insert.length;
  return { text: next, selection: { start: cursor, end: cursor } };
}

/**
 * Insert (or wrap the selection in) `[text](url)` link markdown. With no selection, inserts a
 * template and places the cursor inside the link-text brackets. With a selection, wraps it as
 * the link text and selects the URL placeholder so typing a URL replaces it immediately.
 */
export function insertMarkdownLink(
  text: string,
  selection: ReflectionTextSelection,
): ReflectionMarkdownEditResult {
  const { start, end } = selection;
  if (start === end) {
    const insert = "[](https://)";
    const next = text.slice(0, start) + insert + text.slice(end);
    return { text: next, selection: { start: start + 1, end: start + 1 } };
  }
  const selected = text.slice(start, end);
  const insert = `[${selected}](https://)`;
  const next = text.slice(0, start) + insert + text.slice(end);
  const urlStart = start + selected.length + 3; // "[" + selected + "]("
  const urlEnd = urlStart + "https://".length;
  return { text: next, selection: { start: urlStart, end: urlEnd } };
}

/** Format-toolbar actions that only need `(text, selection)` — image attach also needs an id. */
export type ReflectionToolbarFormatAction =
  | "bold"
  | "italic"
  | "heading"
  | "bullet"
  | "numbered"
  | "checklist"
  | "link";

/**
 * Apply a formatting-toolbar button against the full reflection document at `selection`.
 * Callers must pass the live input's document-level caret (not a per-block slice).
 */
export function applyReflectionToolbarAction(
  text: string,
  selection: ReflectionTextSelection,
  action: ReflectionToolbarFormatAction,
): ReflectionMarkdownEditResult {
  switch (action) {
    case "bold":
      return wrapMarkdownMarker(text, selection, "**");
    case "italic":
      return wrapMarkdownMarker(text, selection, "_");
    case "heading":
      return toggleLinePrefix(text, selection, "## ");
    case "bullet":
      return toggleLinePrefix(text, selection, "- ");
    case "numbered":
      return toggleLinePrefix(text, selection, "1. ");
    case "checklist":
      return toggleLinePrefix(text, selection, "- [ ] ");
    case "link":
      return insertMarkdownLink(text, selection);
  }
}

/** Insert a `[image:id]` token at the caret, same wrapping the image toolbar button uses. */
export function insertReflectionImageToken(
  text: string,
  selection: ReflectionTextSelection,
  imageId: string,
): ReflectionMarkdownEditResult {
  return insertTextAtSelection(text, selection, `\n[image:${imageId}]\n`);
}

type ListPrefixInfo = { kind: "bullet" | "ordered" | "checklist"; raw: string; orderedNumber?: number };

function detectListPrefix(line: string): ListPrefixInfo | null {
  const checklist = line.match(CHECKLIST_PREFIX_RE);
  if (checklist) return { kind: "checklist", raw: checklist[0] };
  const ordered = line.match(ORDERED_PREFIX_RE);
  if (ordered) {
    return {
      kind: "ordered",
      raw: ordered[0],
      orderedNumber: parseInt(ordered[0], 10),
    };
  }
  const bullet = line.match(BULLET_PREFIX_RE);
  if (bullet) return { kind: "bullet", raw: bullet[0] };
  return null;
}

/**
 * Auto-continue (or, on an empty item, exit) a markdown list when the user presses Enter —
 * matches Notes / Word list behavior instead of leaving the user to type "- " by hand on every
 * line. Call this from the reflection field's `onChangeText` with the *previous* markdown value;
 * returns `null` when the change wasn't a single newline insertion (paste, delete, autocorrect,
 * etc.), in which case the caller should just apply `nextText` unchanged.
 */
export function continueListOnNewline(
  prevText: string,
  nextText: string,
): ReflectionMarkdownEditResult | null {
  if (nextText.length !== prevText.length + 1) return null;

  let p = 0;
  const maxCommon = Math.min(prevText.length, nextText.length);
  while (p < maxCommon && prevText[p] === nextText[p]) p++;
  if (nextText[p] !== "\n") return null;
  if (prevText.slice(p) !== nextText.slice(p + 1)) return null;

  const { lineStart, lineEnd } = lineRangeForIndex(prevText, p);
  const originalLine = prevText.slice(lineStart, lineEnd);
  const info = detectListPrefix(originalLine);
  if (!info) return null;

  const bodyBeforeCursor = prevText.slice(lineStart + info.raw.length, p);
  const bodyAfterCursor = prevText.slice(p, lineEnd);
  const lineIsEffectivelyEmpty = bodyBeforeCursor.trim() === "" && bodyAfterCursor.trim() === "";

  if (lineIsEffectivelyEmpty) {
    // Enter on an empty list item exits the list rather than adding another bullet.
    const next =
      prevText.slice(0, lineStart) +
      prevText.slice(lineStart + info.raw.length, p) +
      "\n" +
      prevText.slice(p);
    const cursor = lineStart + bodyBeforeCursor.length + 1;
    return { text: next, selection: { start: cursor, end: cursor } };
  }

  const continuation =
    info.kind === "ordered"
      ? `${(info.orderedNumber ?? 0) + 1}. `
      : info.kind === "checklist"
        ? "- [ ] "
        : "- ";
  const next = prevText.slice(0, p) + "\n" + continuation + prevText.slice(p);
  const cursor = p + 1 + continuation.length;
  return { text: next, selection: { start: cursor, end: cursor } };
}

export function reflectionMarkdownHasContent(markdown: string): boolean {
  return markdown.replace(/\s+/g, "").length > 0;
}

/** Image ids referenced as `[image:id]` tokens, in document order (duplicates kept). */
export function listReflectionImageIds(markdown: string): string[] {
  const ids: string[] = [];
  const re = /\[image:([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    const id = match[1];
    if (id) ids.push(id);
  }
  return ids;
}
