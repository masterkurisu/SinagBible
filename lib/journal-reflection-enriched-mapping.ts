/**
 * Phase 3 mappings between owned journal HTML and Enriched native HTML.
 *
 * Only dialects that survived 0b: verse mentions (`data-verse-ref`), images (`<img>`),
 * and checklists. Nested lists stay on the legacy route.
 */

import {
  formatVerseTagLabel,
  parseVerseTagFromHtmlAttrs,
  verseTagToHtml,
} from "@sinag-bible/core/verse-tags";
import type { VerseTagRef } from "@sinag-bible/types";

const CHECKLIST_GLYPH_RE = /^[☐☑✓✔]\s*/;

function stripChecklistGlyph(text: string): string {
  return text.replace(CHECKLIST_GLYPH_RE, "");
}

function attr(source: string, name: string): string | null {
  const match = new RegExp(`\\b${name}=(["'])([^"']*)\\1`, "i").exec(source);
  return match?.[2] ?? null;
}

function liIsChecked(attrs: string): boolean {
  if (/data-checked=["']true["']/i.test(attrs)) return true;
  if (/data-checked=["']false["']/i.test(attrs)) return false;
  return /(?:^|\s)checked(?:\s|=|$)/i.test(attrs);
}

function isOwnedChecklist(block: string): boolean {
  return /^<ul\b[^>]*\bdata-checklist=["']true["']/i.test(block);
}

function isEnrichedCheckbox(block: string): boolean {
  return /^<ul\b[^>]*\bdata-type=["']checkbox(?:List)?["']/i.test(block);
}

function checkboxItemPlainText(inner: string): string {
  const withoutLabel = inner.replace(/<label\b[\s\S]*?<\/label>/gi, "");
  const unwrapped = withoutLabel.replace(/<\/?(?:p|div|span)\b[^>]*>/gi, "");
  return stripChecklistGlyph(unwrapped.replace(/<[^>]+>/g, "").trim());
}

export function verseTagToEnrichedMention(
  ref: VerseTagRef,
  contextTranslation?: string,
): { text: string; attributes: Record<string, string> } {
  let dataRef = `${ref.book}:${ref.chapter}:${ref.verseStart}`;
  if (ref.verseEnd !== undefined && ref.verseEnd > ref.verseStart) {
    dataRef += `-${ref.verseEnd}`;
  }
  const attributes: Record<string, string> = { "data-verse-ref": dataRef };
  const translation = ref.translation?.trim();
  const context = contextTranslation?.trim();
  if (translation && translation !== context) {
    attributes["data-translation"] = translation;
  }
  return { text: formatVerseTagLabel(ref), attributes };
}

function mentionToOwnedSpan(full: string, attrs: string, inner: string): string {
  const dataRef = attr(attrs, "data-verse-ref");
  if (!dataRef) return inner;
  const translation = attr(attrs, "data-translation");
  const ref = parseVerseTagFromHtmlAttrs(dataRef, translation);
  if (!ref) return inner;
  return verseTagToHtml(ref);
}

function spanToEnrichedMention(full: string, attrs: string, inner: string): string {
  const dataRef = attr(attrs, "data-verse-ref");
  if (!dataRef) return full;
  const translation = attr(attrs, "data-translation");
  const ref = parseVerseTagFromHtmlAttrs(dataRef, translation);
  const text = inner.replace(/<[^>]+>/g, "").trim() || (ref ? formatVerseTagLabel(ref) : inner);
  const extra = [
    `indicator="@"`,
    `text="${text.replace(/"/g, "&quot;")}"`,
    `data-verse-ref="${dataRef}"`,
  ];
  if (translation) extra.push(`data-translation="${translation}"`);
  return `<mention ${extra.join(" ")}>${inner}</mention>`;
}

function ownedChecklistToEnriched(block: string): string {
  const items = Array.from(block.matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/gi));
  const mapped = items
    .map((item) => {
      const checked = liIsChecked(item[1] ?? "");
      const body = checkboxItemPlainText(item[2] ?? "");
      return checked ? `<li checked>${body}</li>` : `<li>${body}</li>`;
    })
    .join("");
  return `<ul data-type="checkbox">${mapped}</ul>`;
}

function enrichedCheckboxToOwned(block: string): string {
  const items = Array.from(block.matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/gi));
  const mapped = items
    .map((item) => {
      const checked = liIsChecked(item[1] ?? "");
      const body = checkboxItemPlainText(item[2] ?? "");
      const glyph = checked ? "☑ " : "☐ ";
      return `<li data-checked="${checked}">${glyph}${body}</li>`;
    })
    .join("");
  return `<ul data-checklist="true">${mapped}</ul>`;
}

function mapListBlocks(html: string, mapper: (block: string) => string | null): string {
  return html.replace(/<ul\b[^>]*>[\s\S]*?<\/ul>/gi, (block) => mapper(block) ?? block);
}

/**
 * Owned journal HTML → Enriched `setValue` dialect.
 * Verse spans become `<mention>`; owned checklists become `ul[data-type=checkbox]`.
 * Images (`<img>`) already match Enriched and pass through.
 */
export function ownedHtmlToEnrichedHtml(html: string): string {
  const withMentions = html.replace(
    /<span\b([^>]*\bdata-verse-ref=[^>]*)>([\s\S]*?)<\/span>/gi,
    (full, attrs: string, inner: string) => spanToEnrichedMention(full, attrs, inner),
  );
  return mapListBlocks(withMentions, (block) =>
    isOwnedChecklist(block) ? ownedChecklistToEnriched(block) : null,
  );
}

/**
 * Enriched `getHTML()` → owned journal HTML for dual-write `content`
 * (read renderer still expects spans + `data-checklist`).
 */
export function enrichedHtmlToOwnedHtml(html: string): string {
  const withSpans = html.replace(
    /<mention\b([^>]*)>([\s\S]*?)<\/mention>/gi,
    (full, attrs: string, inner: string) => mentionToOwnedSpan(full, attrs, inner),
  );
  return mapListBlocks(withSpans, (block) =>
    isEnrichedCheckbox(block) ? enrichedCheckboxToOwned(block) : null,
  );
}
