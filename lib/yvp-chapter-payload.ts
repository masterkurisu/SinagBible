/**
 * YVP chapter storage + render contract.
 *
 * Stored SQLite payload (`source: 'yvp'`): verbatim JSON from
 * `GET /v1/bibles/{id}/passages/{passage_id}` — minimum fields `id`, `content`, `reference`.
 * Transform to display only at render time; never persist parsed `BibleChapter`.
 */
import type { BibleChapter, BibleVerseInlineItem, YvpFootnoteBody } from "@sinag-bible/types";
import type { YvpPassage } from "@/lib/youversion-api";

export type StoredYvpChapterPayload = YvpPassage;

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bookNameFromReference(reference: string, fallback: string): string {
  const trimmed = reference.replace(/\s+\d[\d:–-]*$/, "").trim();
  return trimmed || fallback;
}

function parseFootnoteInner(html: string): { label: string; body: string } {
  const labelMatch = html.match(/<span[^>]*class="[^"]*label[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  const bodyMatch = html.match(/<span[^>]*class="[^"]*body[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  return {
    label: labelMatch ? stripHtmlTags(labelMatch[1] ?? "") : "†",
    body: bodyMatch ? stripHtmlTags(bodyMatch[1] ?? "") : stripHtmlTags(html),
  };
}

function parseVerseInlineFromHtml(
  verseHtml: string,
  footnotes: Map<number, YvpFootnoteBody>,
): BibleVerseInlineItem[] {
  const items: BibleVerseInlineItem[] = [];
  const noteRe = /<span[^>]*class="[^"]*yv-n[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = noteRe.exec(verseHtml)) !== null) {
    const before = stripHtmlTags(verseHtml.slice(lastIndex, match.index));
    if (before) items.push(before);

    const parsed = parseFootnoteInner(match[1] ?? "");
    const noteId = footnotes.size + 1;
    footnotes.set(noteId, parsed);
    items.push({ noteId });
    lastIndex = match.index + match[0].length;
  }

  const tail = stripHtmlTags(verseHtml.slice(lastIndex));
  if (tail) items.push(tail);
  return items;
}

function parseYvpChapterHtml(
  html: string,
  footnotes: Map<number, YvpFootnoteBody>,
): { number: number; text: string; inline: BibleVerseInlineItem[] }[] {
  const verses: { number: number; text: string; inline: BibleVerseInlineItem[] }[] = [];
  const parts = html.split(/<span class="yv-vlbl">(\d+)<\/span>/);

  for (let i = 1; i < parts.length; i += 2) {
    const num = Number.parseInt(parts[i] ?? "", 10);
    const raw = parts[i + 1] ?? "";
    const inline = parseVerseInlineFromHtml(raw, footnotes);
    const text = inline
      .map((item) => {
        if (typeof item === "string") return item;
        if ("text" in item && typeof item.text === "string") return item.text;
        if ("heading" in item && typeof item.heading === "string") return item.heading;
        return "";
      })
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (num > 0 && text) {
      verses.push({ number: num, text, inline });
    }
  }

  return verses;
}

/** Converts a stored or freshly fetched YVP passage into reader `BibleChapter` shape. */
export function yvpPassageToBibleChapter(
  bookSlug: string,
  chapterNumber: number,
  passage: StoredYvpChapterPayload,
  bookName?: string,
): BibleChapter {
  const footnotes = new Map<number, YvpFootnoteBody>();
  const parsedVerses = parseYvpChapterHtml(passage.content ?? "", footnotes);

  if (parsedVerses.length === 0) {
    throw new Error(`yvp-chapter-payload: no verses parsed for ${passage.id ?? bookSlug}`);
  }

  const yvpFootnotes: Record<number, YvpFootnoteBody> = {};
  for (const [noteId, body] of footnotes) {
    yvpFootnotes[noteId] = body;
  }

  const verseInlineContent = parsedVerses.map((verse) => verse.inline);
  const hasRichInline = verseInlineContent.some((row) =>
    row.some((item) => typeof item !== "string" && !("text" in item && typeof item.text === "string")),
  );

  return {
    bookName: bookName ?? bookNameFromReference(passage.reference ?? "", bookSlug),
    bookSlug,
    chapterNumber,
    verses: parsedVerses.map((verse) => verse.text),
    ...(hasRichInline || Object.keys(yvpFootnotes).length > 0 ? { verseInlineContent } : {}),
    ...(Object.keys(yvpFootnotes).length > 0 ? { yvpFootnotes } : {}),
  };
}
