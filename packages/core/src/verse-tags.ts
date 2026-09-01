import type { VerseTagRef, VerseTagTextSegment } from "@sinag-bible/types";

import { formatBookLabel } from "./journal";

/** v1 token inner grammar: book:chapter:verse[-end][@translation] */
const VERSE_TAG_INNER_REGEX =
  /^([a-z0-9-]+):(\d+):(\d+)(?:-(\d+))?(?:@([A-Za-z0-9_]+))?$/;

const VERSE_TAG_DATA_REF_REGEX = /^([a-z0-9-]+):(\d+):(\d+)(?:-(\d+))?$/;

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtmlAttribute(text: string): string {
  return escapeHtmlText(text).replace(/'/g, "&#39;");
}

function parseVerseTagInner(inner: string): VerseTagRef | null {
  const match = inner.match(VERSE_TAG_INNER_REGEX);
  if (!match) return null;

  const book = match[1]!;
  const chapter = Number.parseInt(match[2]!, 10);
  const verseStart = Number.parseInt(match[3]!, 10);
  const verseEnd = match[4] ? Number.parseInt(match[4], 10) : undefined;
  const translation = match[5] || undefined;

  if (!Number.isInteger(chapter) || chapter < 1) return null;
  if (!Number.isInteger(verseStart) || verseStart < 1) return null;
  if (verseEnd !== undefined) {
    if (!Number.isInteger(verseEnd) || verseEnd < 1) return null;
    if (verseEnd <= verseStart) return null;
  }

  return { book, chapter, verseStart, verseEnd, translation };
}

function unwrapVerseTagToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.startsWith("[@") && trimmed.endsWith("]")) {
    return trimmed.slice(2, -1);
  }
  if (trimmed.startsWith("@")) {
    return trimmed.slice(1);
  }
  return trimmed;
}

function isWhitespace(char: string): boolean {
  return char === " " || char === "\n" || char === "\r" || char === "\t";
}

function isNewline(char: string): boolean {
  return char === "\n" || char === "\r";
}

/** Letters, digits, colon, hyphen, and spaces — not newlines or punctuation. */
function isMentionBufferChar(char: string): boolean {
  return /[A-Za-z0-9: \t-]/.test(char);
}

function isTrailingMentionDelimiter(char: string): boolean {
  return /[.,;!?)\]]/.test(char);
}

function findVerseTagTokenRanges(text: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let index = 0;

  while (index < text.length) {
    const start = text.indexOf("[@", index);
    if (start === -1) break;

    const close = text.indexOf("]", start + 2);
    const end = close === -1 ? text.length : close + 1;
    ranges.push({ start, end });
    index = end;
  }

  return ranges;
}

function isInsideVerseTagToken(text: string, index: number): boolean {
  for (const { start, end } of findVerseTagTokenRanges(text)) {
    if (index >= start && index < end) {
      return true;
    }
  }
  return false;
}

function findActiveMentionAt(text: string, cursorIndex: number): { atIndex: number } | null {
  if (isInsideVerseTagToken(text, cursorIndex)) {
    return null;
  }

  let index = cursorIndex - 1;
  if (index >= 0 && isTrailingMentionDelimiter(text[index]!)) {
    index -= 1;
  }

  for (; index >= 0; index -= 1) {
    const char = text[index]!;
    if (char === "@") {
      if (index > 0 && !isWhitespace(text[index - 1]!)) {
        return null;
      }
      if (isInsideVerseTagToken(text, index)) {
        return null;
      }
      return { atIndex: index };
    }
    if (isNewline(char) || !isMentionBufferChar(char)) {
      return null;
    }
  }

  return null;
}

/** Encode plain-text token. Omits translation suffix when matches contextTranslation. */
export function encodeVerseTag(ref: VerseTagRef, contextTranslation?: string): string {
  let inner = `${ref.book}:${ref.chapter}:${ref.verseStart}`;
  if (ref.verseEnd !== undefined && ref.verseEnd > ref.verseStart) {
    inner += `-${ref.verseEnd}`;
  }

  const translation = ref.translation?.trim();
  const context = contextTranslation?.trim();
  if (translation && translation !== context) {
    inner += `@${translation}`;
  }

  return `[@${inner}]`;
}

/** Parse a single token (with or without [@...] wrapper). Null if malformed. */
export function parseVerseTagToken(token: string): VerseTagRef | null {
  return parseVerseTagInner(unwrapVerseTagToken(token));
}

/** Split text into segments. Never throws. Malformed → ref: null. */
export function splitTextWithVerseTags(text: string): VerseTagTextSegment[] {
  const segments: VerseTagTextSegment[] = [];
  let index = 0;

  while (index < text.length) {
    const start = text.indexOf("[@", index);
    if (start === -1) {
      if (index < text.length) {
        segments.push({ kind: "text", value: text.slice(index) });
      }
      break;
    }

    if (start > index) {
      segments.push({ kind: "text", value: text.slice(index, start) });
    }

    const close = text.indexOf("]", start + 2);
    if (close === -1) {
      segments.push({ kind: "tag", raw: text.slice(start), ref: null });
      break;
    }

    const raw = text.slice(start, close + 1);
    segments.push({ kind: "tag", raw, ref: parseVerseTagToken(raw) });
    index = close + 1;
  }

  return segments;
}

/** Human label — caller supplies resolved bookDisplayLabel. */
export function formatVerseTagLabel(ref: VerseTagRef, bookDisplayLabel?: string): string {
  const label = bookDisplayLabel?.trim() || formatBookLabel(ref.book);
  const base = `${label} ${ref.chapter}`;
  if (ref.verseEnd !== undefined && ref.verseEnd > ref.verseStart) {
    return `${base}:${ref.verseStart}-${ref.verseEnd}`;
  }
  return `${base}:${ref.verseStart}`;
}

/** Journal HTML storage. Writes data-* attrs + inner text = derived label. */
export function verseTagToHtml(ref: VerseTagRef, contextTranslation?: string): string {
  let dataRef = `${ref.book}:${ref.chapter}:${ref.verseStart}`;
  if (ref.verseEnd !== undefined && ref.verseEnd > ref.verseStart) {
    dataRef += `-${ref.verseEnd}`;
  }

  const attrs = [`data-verse-ref="${escapeHtmlAttribute(dataRef)}"`];
  const translation = ref.translation?.trim();
  const context = contextTranslation?.trim();
  if (translation && translation !== context) {
    attrs.push(`data-translation="${escapeHtmlAttribute(translation)}"`);
  }

  const label = escapeHtmlText(formatVerseTagLabel(ref));
  return `<span ${attrs.join(" ")}>${label}</span>`;
}

/** Parse ref from journal HTML span attributes. */
export function parseVerseTagFromHtmlAttrs(
  dataVerseRef: string,
  dataTranslation?: string | null,
): VerseTagRef | null {
  const match = dataVerseRef.trim().match(VERSE_TAG_DATA_REF_REGEX);
  if (!match) return null;

  const book = match[1]!;
  const chapter = Number.parseInt(match[2]!, 10);
  const verseStart = Number.parseInt(match[3]!, 10);
  const verseEnd = match[4] ? Number.parseInt(match[4], 10) : undefined;
  const translation = dataTranslation?.trim() || undefined;

  if (!Number.isInteger(chapter) || chapter < 1) return null;
  if (!Number.isInteger(verseStart) || verseStart < 1) return null;
  if (verseEnd !== undefined) {
    if (!Number.isInteger(verseEnd) || verseEnd < 1) return null;
    if (verseEnd <= verseStart) return null;
  }

  return { book, chapter, verseStart, verseEnd, translation };
}

/** Partial query after @ for mention sheet. */
export function parseVerseTagQuery(query: string): Partial<VerseTagRef> | null {
  const trimmed = query.trim();
  if (!trimmed) return {};

  const atParts = trimmed.split("@");
  if (atParts.length > 2) return null;

  const main = atParts[0] ?? "";
  const translation = atParts[1]?.trim() || undefined;
  if (translation !== undefined && !/^[A-Za-z0-9_]+$/.test(translation)) {
    return null;
  }

  const segments = main.split(":");
  if (segments.length > 3) return null;

  const result: Partial<VerseTagRef> = {};
  if (translation) {
    result.translation = translation;
  }

  const bookPart = segments[0] ?? "";
  if (!/^[a-z0-9-]*$/.test(bookPart)) return null;
  if (bookPart) {
    result.book = bookPart;
  }

  if (segments.length >= 2) {
    const chapterPart = segments[1]!;
    if (!/^\d+$/.test(chapterPart)) return null;
    const chapter = Number.parseInt(chapterPart, 10);
    if (!Number.isInteger(chapter) || chapter < 1) return null;
    result.chapter = chapter;
  }

  if (segments.length >= 3) {
    const versePart = segments[2]!;
    const rangeMatch = versePart.match(/^(\d+)(?:-(\d+))?$/);
    if (!rangeMatch) return null;

    const verseStart = Number.parseInt(rangeMatch[1]!, 10);
    if (!Number.isInteger(verseStart) || verseStart < 1) return null;
    result.verseStart = verseStart;

    if (rangeMatch[2]) {
      const verseEnd = Number.parseInt(rangeMatch[2], 10);
      if (!Number.isInteger(verseEnd) || verseEnd < 1 || verseEnd <= verseStart) return null;
      result.verseEnd = verseEnd;
    }
  }

  return result;
}

/** Whether @ at cursor should open mention sheet (word-boundary gating). */
export function isVerseTagMentionTrigger(text: string, cursorIndex: number): boolean {
  if (cursorIndex <= 0 || cursorIndex > text.length) {
    return false;
  }

  const atIndex = cursorIndex - 1;
  if (text[atIndex] !== "@") {
    return false;
  }

  if (isInsideVerseTagToken(text, atIndex)) {
    return false;
  }

  if (atIndex > 0 && !isWhitespace(text[atIndex - 1]!)) {
    return false;
  }

  return true;
}

/** Active mention from a word-boundary `@` to the cursor. Spaces are allowed; newlines cancel. */
export function getActiveVerseTagMention(
  text: string,
  cursorIndex: number,
): { atIndex: number; buffer: string } | null {
  const mention = findActiveMentionAt(text, cursorIndex);
  if (!mention) {
    return null;
  }

  return {
    atIndex: mention.atIndex,
    buffer: text.slice(mention.atIndex + 1, cursorIndex),
  };
}

/** Active mention query between @ and cursor, or null. */
export function extractActiveVerseTagMention(text: string, cursorIndex: number): string | null {
  return getActiveVerseTagMention(text, cursorIndex)?.buffer ?? null;
}

/** Replace active @mention with encoded token. */
export function insertVerseTagAtMention(
  text: string,
  cursorIndex: number,
  ref: VerseTagRef,
  contextTranslation?: string,
): { text: string; cursorIndex: number } {
  const mention = findActiveMentionAt(text, cursorIndex);
  if (!mention) {
    return { text, cursorIndex };
  }

  const token = encodeVerseTag(ref, contextTranslation);
  const nextText = text.slice(0, mention.atIndex) + token + text.slice(cursorIndex);
  return { text: nextText, cursorIndex: mention.atIndex + token.length };
}
