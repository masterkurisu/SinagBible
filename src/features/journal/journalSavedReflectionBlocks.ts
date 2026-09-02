/** HTML block split for journal detail — same tags as the former `renderSavedReflection`. */

import {
  decodeHtmlEntities,
  isEmptyTopLevelParagraphBlock,
  MAX_CONSECUTIVE_BLANK_PARAGRAPHS,
} from "@/lib/journal-reflection-owned-html";

export {
  decodeHtmlEntities,
  MAX_CONSECUTIVE_BLANK_PARAGRAPHS,
  REFLECTION_BLANK_STEP_PX,
} from "@/lib/journal-reflection-owned-html";

export const JOURNAL_DETAIL_FLASH_LIST_MIN_BLOCKS = 12;
export const JOURNAL_DETAIL_FLASH_LIST_MIN_CONTENT_CHARS = 4000;

type BlockSpacing = {
  leadingBlankCount?: number;
};

export type SavedReflectionBlock =
  | ({ key: string; kind: "fallback"; html: string } & BlockSpacing)
  | ({ key: string; kind: "heading1"; html: string; isFirst: boolean } & BlockSpacing)
  | ({ key: string; kind: "heading2"; html: string; isFirst: boolean } & BlockSpacing)
  | ({ key: string; kind: "image"; uri: string } & BlockSpacing)
  | ({ key: string; kind: "paragraph"; html: string } & BlockSpacing)
  | ({
      key: string;
      kind: "list-item";
      html: string;
      marker: string;
      checked: boolean;
      isLastInList: boolean;
    } & BlockSpacing);

function normalizeListItemBody(html: string): string {
  return html
    .replace(/<\/?(?:p|div)\b[^>]*>/gi, "")
    .replace(/^(?:\s|<br\s*\/?>)+/gi, "")
    .replace(/(?:\s|<br\s*\/?>)+$/gi, "");
}

function headingPlainText(bodyHtml: string): string {
  return decodeHtmlEntities(bodyHtml.replace(/<[^>]*>/g, "").trim());
}

function appendListItems(
  out: SavedReflectionBlock[],
  listBlock: string,
  keyPrefix: string,
  leadingBlankCount = 0,
): void {
  const ordered = /^<ol\b/i.test(listBlock);
  const checklist = /^<ul\b[^>]*\bdata-checklist=["']true["']/i.test(listBlock);
  const listItems = Array.from(listBlock.matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/gi));
  listItems.forEach((li, j) => {
    const attrs = li[1] ?? "";
    const body = normalizeListItemBody(li[2] ?? "");
    if (!decodeHtmlEntities(body.replace(/<[^>]*>/g, "").trim())) return;
    const checked = checklist && /data-checked=["']true["']/i.test(attrs);
    const marker = checklist ? "" : ordered ? `${j + 1}. ` : "\u2022 ";
    out.push({
      key: `${keyPrefix}-${j}`,
      kind: "list-item",
      html: body,
      marker,
      checked,
      isLastInList: j >= listItems.length - 1,
      ...(j === 0 && leadingBlankCount > 0 ? { leadingBlankCount } : {}),
    });
  });
}

/** Parses owned reflection HTML into renderable blocks (saved detail, compact preview). */
export function parseOwnedReflectionHtml(contentHtml: string): SavedReflectionBlock[] {
  const html = contentHtml;
  const tagged = html.match(/<(p|div|ul|ol|h1|h2)\b[^>]*>[\s\S]*?<\/\1>/gi) ?? [];
  if (tagged.length === 0 && html.trim()) {
    const forInline = html
      .replace(/<\/?p\b[^>]*>/gi, "\n")
      .replace(/<\/?div\b[^>]*>/gi, "\n")
      .trim();
    return [{ key: "fallback", kind: "fallback", html: forInline }];
  }

  const out: SavedReflectionBlock[] = [];
  let pendingBlanks = 0;
  let seenContent = false;

  const takeLeadingBlankCount = () => {
    const leadingBlankCount = seenContent ? pendingBlanks : 0;
    pendingBlanks = 0;
    seenContent = true;
    return leadingBlankCount;
  };

  const withLeadingBlanks = <T extends SavedReflectionBlock>(block: T, leadingBlankCount: number): T =>
    leadingBlankCount > 0 ? { ...block, leadingBlankCount } : block;

  tagged.forEach((block, i) => {
    if (isEmptyTopLevelParagraphBlock(block)) {
      pendingBlanks = Math.min(pendingBlanks + 1, MAX_CONSECUTIVE_BLANK_PARAGRAPHS);
      return;
    }

    const leadingBlankCount = takeLeadingBlankCount();

    if (/^<h1\b/i.test(block)) {
      const body = block.replace(/^<h1[^>]*>/i, "").replace(/<\/h1>$/i, "");
      if (!headingPlainText(body)) return;
      out.push(
        withLeadingBlanks(
          {
            key: `h1-${i}`,
            kind: "heading1",
            html: body,
            isFirst: out.length === 0,
          },
          leadingBlankCount,
        ),
      );
      return;
    }
    if (/^<h2\b/i.test(block)) {
      const body = block.replace(/^<h2[^>]*>/i, "").replace(/<\/h2>$/i, "");
      if (!headingPlainText(body)) return;
      out.push(
        withLeadingBlanks(
          {
            key: `h2-${i}`,
            kind: "heading2",
            html: body,
            isFirst: out.length === 0,
          },
          leadingBlankCount,
        ),
      );
      return;
    }
    if (/^<(?:p|div)\b/i.test(block)) {
      const imgMatch = /<img\b[^>]*src="([^"]+)"[^>]*>/i.exec(block);
      if (imgMatch?.[1]) {
        out.push(
          withLeadingBlanks(
            {
              key: `img-${i}`,
              kind: "image",
              uri: decodeHtmlEntities(imgMatch[1]),
            },
            leadingBlankCount,
          ),
        );
        const bodyAfterImg = block
          .replace(/^<(?:p|div)[^>]*>/i, "")
          .replace(/<\/(?:p|div)>$/i, "")
          .replace(/<img\b[^>]*>/gi, "")
          .replace(/&nbsp;/gi, " ");
        const plainAfterImg = decodeHtmlEntities(bodyAfterImg.replace(/<[^>]*>/g, "").trim());
        if (plainAfterImg) {
          out.push({ key: `p-after-img-${i}`, kind: "paragraph", html: bodyAfterImg });
        }
        return;
      }
      const body = block
        .replace(/^<(?:p|div)[^>]*>/i, "")
        .replace(/<\/(?:p|div)>$/i, "")
        .replace(/&nbsp;/gi, " ");
      const nestedLists = body.match(/<(ul|ol)\b[^>]*>[\s\S]*?<\/\1>/gi) ?? [];
      if (nestedLists.length > 0) {
        nestedLists.forEach((listBlock, listIndex) => {
          appendListItems(out, listBlock, `li-${i}-${listIndex}`, listIndex === 0 ? leadingBlankCount : 0);
        });
        return;
      }
      const plainBody = decodeHtmlEntities(body.replace(/<[^>]*>/g, "").trim());
      if (!plainBody) return;
      out.push(withLeadingBlanks({ key: `p-${i}`, kind: "paragraph", html: body }, leadingBlankCount));
      return;
    }

    appendListItems(out, block, `li-${i}`, leadingBlankCount);
  });
  return out;
}

/** Splits saved reflection HTML into renderable blocks (ScrollView children or FlashList `data`). */
export function splitSavedReflectionHtml(
  contentHtml: string | null | undefined,
): SavedReflectionBlock[] {
  return parseOwnedReflectionHtml(typeof contentHtml === "string" ? contentHtml : "");
}

export function shouldVirtualizeJournalReflection(
  blockCount: number,
  contentLength: number,
): boolean {
  return (
    blockCount >= JOURNAL_DETAIL_FLASH_LIST_MIN_BLOCKS ||
    contentLength >= JOURNAL_DETAIL_FLASH_LIST_MIN_CONTENT_CHARS
  );
}
