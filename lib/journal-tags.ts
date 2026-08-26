const MAX_TAGS_PER_ENTRY = 8;
const MAX_TAG_LENGTH = 24;

/** Suggested category chips on the journal form. Custom tags are also allowed. */
export const JOURNAL_TAG_SUGGESTIONS = [
  "gratitude",
  "forgiveness",
  "prayer",
  "faith",
  "hope",
  "worship",
  "family",
  "healing",
] as const;

export function formatJournalTagLabel(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function formatJournalTagList(tags: string[] | undefined): string {
  return (tags ?? []).map(formatJournalTagLabel).join(" · ");
}

export function normalizeJournalTag(raw: string): string | null {
  const tag = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!tag || tag.length > MAX_TAG_LENGTH) return null;
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '-]*$/u.test(tag)) return null;
  return tag;
}

export function normalizeJournalTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const tag = normalizeJournalTag(item);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= MAX_TAGS_PER_ENTRY) break;
  }
  return out;
}

export function parseJournalTagsJson(raw: string | null | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  try {
    return normalizeJournalTags(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function serializeJournalTags(tags: unknown): string | null {
  const normalized = normalizeJournalTags(tags);
  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}
