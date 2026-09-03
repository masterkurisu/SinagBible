import {
  MAX_TAGS_PER_ENTRY,
  normalizeJournalTag,
} from "@/lib/journal-tags";

export { MAX_TAGS_PER_ENTRY };

/** Selected catalog tags (and any in-flight rename) use the editable chip with long-press. */
export function shouldUseEditableCatalogChip(
  tag: string,
  tags: string[],
  renamingTag: string | null,
): boolean {
  return tags.includes(tag) || renamingTag === tag;
}

export function canCommitTagDraft(tags: string[], raw: string): boolean {
  const normalized = normalizeJournalTag(raw);
  if (!normalized) return false;
  if (tags.includes(normalized)) return false;
  if (tags.length >= MAX_TAGS_PER_ENTRY) return false;
  return true;
}

export function canAcceptSuggestionAdd(tags: string[], tag: string): boolean {
  if (tags.includes(tag)) return true;
  return tags.length < MAX_TAGS_PER_ENTRY;
}

export function isTagDraftAddError(addExpanded: boolean, tagDraft: string, tags: string[]): boolean {
  if (!addExpanded || !tagDraft.trim()) return false;
  return !canCommitTagDraft(tags, tagDraft);
}

export function isRenameDraftError(
  renamingTag: string | null,
  renameDraft: string,
  tags: string[],
): boolean {
  if (!renamingTag) return false;
  const trimmed = renameDraft.trim();
  if (!trimmed) return false;
  const normalized = normalizeJournalTag(renameDraft);
  if (!normalized) return true;
  return tags.some((tag) => tag !== renamingTag && tag === normalized);
}
