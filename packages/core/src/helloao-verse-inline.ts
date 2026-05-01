import type { BibleVerseFormattedText, BibleVerseInlineItem } from "@sinag-bible/types";

function parseHelloaoVerseContentSegment(raw: unknown): BibleVerseInlineItem | null {
  if (typeof raw === "string") return raw;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.text === "string") {
    const out: BibleVerseFormattedText = { text: o.text };
    if (typeof o.poem === "number") out.poem = o.poem;
    if (o.wordsOfJesus === true) out.wordsOfJesus = true;
    return out;
  }
  if (typeof o.heading === "string") return { heading: o.heading };
  if (o.lineBreak === true) return { lineBreak: true };
  if (typeof o.noteId === "number") return { noteId: o.noteId };
  return null;
}

/** Normalizes a helloao verse `content` array into typed inline fragments. */
export function parseHelloaoVerseContentArray(raw: unknown): BibleVerseInlineItem[] {
  if (!Array.isArray(raw)) return [];
  const out: BibleVerseInlineItem[] = [];
  for (const item of raw) {
    const parsed = parseHelloaoVerseContentSegment(item);
    if (parsed !== null) out.push(parsed);
  }
  return out;
}

/**
 * Plain string for search, copy, and cache compatibility — mirrors legacy join behavior
 * for strings and `{ text }`, plus headings and line breaks; footnote refs are omitted.
 */
export function flattenHelloaoVerseText(items: BibleVerseInlineItem[]): string {
  return items
    .map((item) => {
      if (typeof item === "string") return item;
      if ("text" in item && typeof item.text === "string") return item.text;
      if ("heading" in item && typeof item.heading === "string") return item.heading;
      if ("lineBreak" in item && item.lineBreak === true) return "\n";
      return "";
    })
    .join(" ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}
