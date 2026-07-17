/**
 * Legacy RichEditor HTML → markdown for journal reflection edit-open.
 * See verse-tagging-editor-plan.md (Phase 0).
 */

const SPAN_FONT_ITALIC = String.raw`font-style\s*:\s*(?:italic|oblique)`;
const SPAN_FONT_BOLD = String.raw`font-weight\s*:\s*(?:bold|700|bolder|[6-9]00)`;

export function normalizeStyleSpansForReflectionHtml(html: string): string {
  let s = html;
  for (let n = 0; n < 20; n++) {
    const prev = s;
    s = s
      .replace(
        new RegExp(
          `<span\\b[^>]*\\b${SPAN_FONT_ITALIC}[^>]*\\b${SPAN_FONT_BOLD}[^>]*>([\\s\\S]*?)<\\/span>`,
          "gi",
        ),
        "<strong><em>$1</em></strong>",
      )
      .replace(
        new RegExp(
          `<span\\b[^>]*\\b${SPAN_FONT_BOLD}[^>]*\\b${SPAN_FONT_ITALIC}[^>]*>([\\s\\S]*?)<\\/span>`,
          "gi",
        ),
        "<strong><em>$1</em></strong>",
      )
      .replace(
        new RegExp(`<span\\b[^>]*\\b${SPAN_FONT_BOLD}[^>]*>([\\s\\S]*?)<\\/span>`, "gi"),
        "<strong>$1</strong>",
      )
      .replace(
        new RegExp(`<span\\b[^>]*\\b${SPAN_FONT_ITALIC}[^>]*>([\\s\\S]*?)<\\/span>`, "gi"),
        "<em>$1</em>",
      );
    if (s === prev) break;
  }
  return s;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Build `[image:id]` token map from `<img src="…">` tags in stored HTML. */
export function buildImageMapFromReflectionHtml(html: string): Record<string, string> {
  const map: Record<string, string> = {};
  let index = 0;
  const re = /<img\b[^>]*\bsrc=(["'])([^"']+)\1/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const src = match[2]?.trim();
    if (!src) continue;
    const existing = Object.entries(map).find(([, uri]) => uri === src);
    if (existing) continue;
    map[`img-${index++}`] = src;
  }
  return map;
}

function replaceImgTagsWithTokens(fragment: string, imageMap: Record<string, string>): string {
  return fragment.replace(/<img\b[^>]*\bsrc=(["'])([^"']+)\1[^>]*>/gi, (_full, _q, src) => {
    const trimmed = (src as string).trim();
    const existing = Object.entries(imageMap).find(([, uri]) => uri === trimmed);
    if (existing) return `[image:${existing[0]}]`;
    let nextIndex = Object.keys(imageMap).length;
    while (imageMap[`img-${nextIndex}`]) nextIndex += 1;
    const id = `img-${nextIndex}`;
    imageMap[id] = trimmed;
    return `[image:${id}]`;
  });
}

function inlineHtmlToMarkdown(fragment: string): string {
  let s = fragment;
  s = s.replace(/<br\s*\/?>/gi, "\n");
  for (let pass = 0; pass < 8; pass++) {
    const prev = s;
    s = s.replace(/<strong>([\s\S]*?)<\/strong>/gi, "**$1**");
    s = s.replace(/<em>([\s\S]*?)<\/em>/gi, "_$1_");
    if (s === prev) break;
  }
  s = s.replace(/<\/?(?:p|div|span|font|u)\b[^>]*>/gi, "");
  s = s.replace(/<[^>]+>/g, "");
  return decodeHtmlEntities(s);
}

function blockInnerHtml(block: string, tag: "p" | "div" | "ul" | "ol"): string {
  const open = new RegExp(`^<${tag}\\b[^>]*>`, "i");
  const close = new RegExp(`<\\/${tag}>$`, "i");
  return block.replace(open, "").replace(close, "");
}

function convertListBlock(block: string, ordered: boolean, imageMap: Record<string, string>): string {
  const items = Array.from(block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
  return items
    .map((li, index) => {
      const body = replaceImgTagsWithTokens(li[1] ?? "", imageMap);
      const markdown = inlineHtmlToMarkdown(body).trim();
      const prefix = ordered ? `${index + 1}. ` : "- ";
      return `${prefix}${markdown}`;
    })
    .join("\n");
}

function convertParagraphBlock(body: string, imageMap: Record<string, string>): string {
  const withTokens = replaceImgTagsWithTokens(body, imageMap).trim();
  if (/^\[image:[^\]]+\]$/i.test(withTokens)) return withTokens;
  return inlineHtmlToMarkdown(withTokens);
}

/**
 * Convert legacy journal reflection HTML (Pell / plain paragraphs) to markdown.
 * Mutates `imageMap` when new images are discovered.
 */
export function htmlToReflectionMarkdown(
  html: string,
  imageMap: Record<string, string> = {},
): string {
  const trimmed = html.trim();
  if (!trimmed) return "";

  const normalized = normalizeStyleSpansForReflectionHtml(trimmed)
    .replace(/<(\/?)b(\s[^>]*)?>/gi, "<$1strong$2>")
    .replace(/<(\/?)i(\s[^>]*)?>/gi, "<$1em$2>");

  const blocks =
    normalized.match(/<(p|div|ul|ol)\b[^>]*>[\s\S]*?<\/\1>/gi) ?? [];

  if (blocks.length === 0) {
    return convertParagraphBlock(normalized, imageMap).trim();
  }

  const parts: string[] = [];
  for (const block of blocks) {
    if (/^<ul\b/i.test(block)) {
      parts.push(convertListBlock(block, false, imageMap));
      continue;
    }
    if (/^<ol\b/i.test(block)) {
      parts.push(convertListBlock(block, true, imageMap));
      continue;
    }
    const tag = /^<div\b/i.test(block) ? "div" : "p";
    parts.push(convertParagraphBlock(blockInnerHtml(block, tag), imageMap));
  }

  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}
