import { expandReferenceQuery } from "@sinag-bible/core/reference-aliases";
import { getBookNameFromSlug } from "@sinag-bible/core/bible-meta";
import {
  extractJournalSearchDateRangeFromText,
  type JournalSearchCombinator,
} from "@/lib/journal-local-search";
import { parseOverlayMarksQuery, type OverlayMarksQuery } from "@/lib/reader-marks-search";

const ALSO_TOKEN_RE = /\balso:([a-z0-9:_-]+)\b/gi;
const BOOK_TOKEN_RE = /\bbook:([a-z0-9-]+)\b/gi;
const TAG_TOKEN_RE = /\btag:([\p{L}\p{N}][\p{L}\p{N}'-]*)\b/giu;
const BARE_AND_RE = /\b(?:and|AND)\b/g;

const ALSO_TRANSLATION_ALIASES: Record<string, string> = {
  kjv: "KJV",
  web: "WEB",
  oeb: "OEB",
  adb: "ADB1905",
  adb1905: "ADB1905",
  niv: "yvp:111",
  asd: "yvp:1264",
};

export type OverlayPowerQuery = OverlayMarksQuery & {
  keyword: string;
  bookSlug: string | null;
  tags: string[];
  dateRange: JournalSearchCombinator["dateRange"];
  alsoTranslationId: string | null;
  /** True when tag / book / date fields are present (AND journal matching). */
  hasJournalCombinator: boolean;
};

function lastCaptured(re: RegExp, raw: string): string | null {
  re.lastIndex = 0;
  let found: string | null = null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) != null) {
    found = match[1] ?? null;
  }
  return found;
}

function allCaptured(re: RegExp, raw: string): string[] {
  re.lastIndex = 0;
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) != null) {
    const value = match[1]?.trim().toLowerCase();
    if (value) out.push(value);
  }
  return out;
}

export function resolveAlsoTranslationId(raw: string): string | null {
  const token = raw.trim().toLowerCase();
  if (!token) return null;
  return ALSO_TRANSLATION_ALIASES[token] ?? (token.includes(":") ? token : token.toUpperCase());
}

export function resolvePowerBookSlug(raw: string): string | null {
  const expanded = expandReferenceQuery(raw.trim().toLowerCase());
  if (!expanded) return null;
  const slug = expanded.replace(/\s+/g, "-");
  if (getBookNameFromSlug(slug)) return slug;
  if (getBookNameFromSlug(expanded)) return expanded;
  return null;
}

export function overlayPowerToJournalCombinator(
  power: OverlayPowerQuery,
): JournalSearchCombinator | undefined {
  if (!power.hasJournalCombinator) return undefined;
  return {
    keyword: power.keyword,
    tags: power.tags,
    dateRange: power.dateRange,
    bookSlug: power.bookSlug,
  };
}

/**
 * Field combinators for overlay power search. AND-only (no OR / NOT / parentheses).
 * `in:highlights` stays in {@link parseOverlayMarksQuery}; `in:john` is not a book gate
 * (`book:john` is).
 */
export function parseOverlayPowerQuery(rawQuery: string, now: Date = new Date()): OverlayPowerQuery {
  const marks = parseOverlayMarksQuery(rawQuery);
  let leftover = marks.remainder.replace(BARE_AND_RE, " ").replace(/\s+/g, " ").trim();

  const alsoRaw = lastCaptured(ALSO_TOKEN_RE, leftover);
  const bookRaw = lastCaptured(BOOK_TOKEN_RE, leftover);
  const tags = allCaptured(TAG_TOKEN_RE, leftover);

  ALSO_TOKEN_RE.lastIndex = 0;
  BOOK_TOKEN_RE.lastIndex = 0;
  TAG_TOKEN_RE.lastIndex = 0;
  leftover = leftover
    .replace(ALSO_TOKEN_RE, " ")
    .replace(BOOK_TOKEN_RE, " ")
    .replace(TAG_TOKEN_RE, " ")
    .replace(/\s+/g, " ")
    .trim();

  const dated = extractJournalSearchDateRangeFromText(leftover, now);
  const bookSlug = bookRaw ? resolvePowerBookSlug(bookRaw) : null;
  const alsoTranslationId = alsoRaw ? resolveAlsoTranslationId(alsoRaw) : null;

  return {
    ...marks,
    keyword: dated.remainder,
    bookSlug,
    tags,
    dateRange: dated.dateRange,
    alsoTranslationId,
    hasJournalCombinator: tags.length > 0 || bookSlug != null || dated.dateRange != null,
  };
}
