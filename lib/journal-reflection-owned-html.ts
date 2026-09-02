/**
 * Owned reflection HTML — canonical blank-paragraph spacing and spacer signatures.
 * HTML is authoritative for extra blank lines; markdown compare stays lossy.
 */

export const MAX_CONSECUTIVE_BLANK_PARAGRAPHS = 10;

/** Extra top margin per leading blank paragraph (tune on device in QA). */
export const REFLECTION_BLANK_STEP_PX = 24;

const TOP_LEVEL_BLOCK_RE = /<(p|div|ul|ol|h1|h2)\b[^>]*>[\s\S]*?<\/\1>/gi;
const EMPTY_PARAGRAPH = "<p></p>";

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function extractTopLevelReflectionBlocks(html: string): string[] {
  return html.match(TOP_LEVEL_BLOCK_RE) ?? [];
}

function paragraphInnerHtml(block: string): string {
  return block
    .replace(/^<(?:p|div)[^>]*>/i, "")
    .replace(/<\/(?:p|div)>$/i, "")
    .replace(/&nbsp;/gi, " ");
}

function listItemPlainText(innerHtml: string): string {
  const body = innerHtml
    .replace(/<\/?(?:p|div)\b[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, " ");
  return decodeHtmlEntities(body.replace(/<[^>]*>/g, "").trim());
}

function sanitizeOwnedListBlock(block: string): string {
  if (!/^<(?:ul|ol)\b/i.test(block)) return block;
  const open = /^<(ul|ol)([^>]*)>/i.exec(block);
  const tag = open?.[1] ?? "ul";
  const attrs = open?.[2] ?? "";
  const items = Array.from(block.matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/gi));
  const kept = items
    .map((item) => {
      const inner = item[2] ?? "";
      if (!listItemPlainText(inner)) return null;
      return `<li${item[1] ?? ""}>${inner}</li>`;
    })
    .filter((item): item is string => item != null);
  if (kept.length === 0) return "";
  return `<${tag}${attrs}>${kept.join("")}</${tag}>`;
}

export function isEmptyTopLevelParagraphBlock(block: string): boolean {
  if (!/^<(?:p|div)\b/i.test(block)) return false;
  const body = paragraphInnerHtml(block);
  if (/<span\b[^>]*\bdata-verse-ref=/i.test(body)) {
    const plain = decodeHtmlEntities(body.replace(/<[^>]*>/g, "").trim());
    if (!plain) return false;
  }
  const withoutBreaks = body.replace(/<br\s*\/?>/gi, "");
  const plain = decodeHtmlEntities(withoutBreaks.replace(/<[^>]*>/g, "").trim());
  return !plain;
}

/**
 * Strips leading/trailing empty top-level paragraphs and clamps interior runs.
 */
export function canonicalizeOwnedReflectionHtml(html: string): string {
  const blocks = extractTopLevelReflectionBlocks(html);
  if (blocks.length === 0) return html.trim() ? html : "";

  const classified = blocks.map((block) => ({
    block,
    blank: isEmptyTopLevelParagraphBlock(block),
  }));

  let start = 0;
  while (start < classified.length && classified[start]!.blank) start += 1;

  let end = classified.length;
  while (end > start && classified[end - 1]!.blank) end -= 1;

  const interior = classified.slice(start, end);
  if (interior.length === 0) return "";

  const out: string[] = [];
  let pendingBlanks = 0;

  for (const item of interior) {
    if (item.blank) {
      pendingBlanks = Math.min(pendingBlanks + 1, MAX_CONSECUTIVE_BLANK_PARAGRAPHS);
      continue;
    }
    if (out.length > 0 && pendingBlanks > 0) {
      for (let i = 0; i < pendingBlanks; i += 1) {
        out.push(EMPTY_PARAGRAPH);
      }
    }
    pendingBlanks = 0;
    const normalizedBlock = /^<(?:ul|ol)\b/i.test(item.block)
      ? sanitizeOwnedListBlock(item.block)
      : item.block;
    if (!normalizedBlock) continue;
    out.push(normalizedBlock);
  }

  return out.join("");
}

/** Interior blank-paragraph run lengths between content blocks (canonical HTML only). */
export function reflectionSpacerSignature(html: string): string {
  const blocks = extractTopLevelReflectionBlocks(canonicalizeOwnedReflectionHtml(html));
  const runs: number[] = [];
  let pendingBlanks = 0;
  let seenContent = false;

  for (const block of blocks) {
    if (isEmptyTopLevelParagraphBlock(block)) {
      pendingBlanks = Math.min(pendingBlanks + 1, MAX_CONSECUTIVE_BLANK_PARAGRAPHS);
      continue;
    }
    if (seenContent) runs.push(pendingBlanks);
    seenContent = true;
    pendingBlanks = 0;
  }

  return runs.join(",");
}
