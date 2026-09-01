/** HTML block split for journal detail — same tags as the former `renderSavedReflection`. */

export const JOURNAL_DETAIL_FLASH_LIST_MIN_BLOCKS = 12;
export const JOURNAL_DETAIL_FLASH_LIST_MIN_CONTENT_CHARS = 4000;

export type SavedReflectionBlock =
  | { key: string; kind: "fallback"; html: string }
  | { key: string; kind: "heading1"; html: string; isFirst: boolean }
  | { key: string; kind: "heading2"; html: string; isFirst: boolean }
  | { key: string; kind: "image"; uri: string }
  | { key: string; kind: "paragraph"; html: string }
  | {
      key: string;
      kind: "list-item";
      html: string;
      marker: string;
      checked: boolean;
      isLastInList: boolean;
    };

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

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
): void {
  const ordered = /^<ol\b/i.test(listBlock);
  const checklist = /^<ul\b[^>]*\bdata-checklist=["']true["']/i.test(listBlock);
  const listItems = Array.from(listBlock.matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/gi));
  listItems.forEach((li, j) => {
    const attrs = li[1] ?? "";
    const checked = checklist && /data-checked=["']true["']/i.test(attrs);
    const marker = checklist ? "" : ordered ? `${j + 1}. ` : "\u2022 ";
    out.push({
      key: `${keyPrefix}-${j}`,
      kind: "list-item",
      html: normalizeListItemBody(li[2] ?? ""),
      marker,
      checked,
      isLastInList: j >= listItems.length - 1,
    });
  });
}

/** Splits saved reflection HTML into renderable blocks (ScrollView children or FlashList `data`). */
export function splitSavedReflectionHtml(
  contentHtml: string | null | undefined,
): SavedReflectionBlock[] {
  const html = typeof contentHtml === "string" ? contentHtml : "";
  const tagged = html.match(/<(p|div|ul|ol|h1|h2)\b[^>]*>[\s\S]*?<\/\1>/gi) ?? [];
  if (tagged.length === 0 && html.trim()) {
    const forInline = html
      .replace(/<\/?p\b[^>]*>/gi, "\n")
      .replace(/<\/?div\b[^>]*>/gi, "\n")
      .trim();
    return [{ key: "fallback", kind: "fallback", html: forInline }];
  }

  const out: SavedReflectionBlock[] = [];
  tagged.forEach((block, i) => {
    if (/^<h1\b/i.test(block)) {
      const body = block.replace(/^<h1[^>]*>/i, "").replace(/<\/h1>$/i, "");
      if (!headingPlainText(body)) return;
      out.push({ key: `h1-${i}`, kind: "heading1", html: body, isFirst: i === 0 });
      return;
    }
    if (/^<h2\b/i.test(block)) {
      const body = block.replace(/^<h2[^>]*>/i, "").replace(/<\/h2>$/i, "");
      if (!headingPlainText(body)) return;
      out.push({ key: `h2-${i}`, kind: "heading2", html: body, isFirst: i === 0 });
      return;
    }
    if (/^<(?:p|div)\b/i.test(block)) {
      const imgMatch = /<img\b[^>]*src="([^"]+)"[^>]*>/i.exec(block);
      if (imgMatch?.[1]) {
        out.push({
          key: `img-${i}`,
          kind: "image",
          uri: decodeHtmlEntities(imgMatch[1]),
        });
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
          appendListItems(out, listBlock, `li-${i}-${listIndex}`);
        });
        return;
      }
      const plainBody = decodeHtmlEntities(body.replace(/<[^>]*>/g, "").trim());
      if (!plainBody) return;
      out.push({ key: `p-${i}`, kind: "paragraph", html: body });
      return;
    }

    appendListItems(out, block, `li-${i}`);
  });
  return out;
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
