/**
 * Journal new-entry draft index — one AsyncStorage key tracks which drafts exist
 * so the tab badge avoids scanning all keys on every foreground.
 *
 * Write order on register: draft payload first, index second (no phantom badge on failed save).
 * Write order on unregister: index first, draft second (no phantom badge on partial clear).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { htmlToReflectionMarkdown } from "@/lib/journal-reflection-html";
import { normalizeJournalTags } from "@/lib/journal-tags";

export const JOURNAL_DRAFT_INDEX_KEY = "sinagbible_journal_draft_index";
export const JOURNAL_DRAFT_INDEX_MIGRATED_FLAG = "sinagbible_journal_draft_index_migrated_v1";
export const JOURNAL_DRAFT_CONTENT_KEY = "sinagbible_journal_draft";
export const DEFAULT_JOURNAL_DRAFT_ID = "default";

const LEGACY_DRAFT_KEY_PATTERN = /journal.*draft|draft.*journal/i;

/** Legacy keys from prior app ids / brands — seeded into the index once. */
const LEGACY_DRAFT_KEY_CANDIDATES = [
  JOURNAL_DRAFT_CONTENT_KEY,
  "sb:journal:draft",
  "quietword_journal_draft",
  "qs:journal:draft",
  "sb-journal-draft",
  "qs-journal-draft",
  "journal_draft",
];

export type JournalNewEntryDraftPayload = {
  passage: string;
  title: string;
  /** Markdown reflection source (Phase 0+). */
  reflectionMarkdown: string;
  /** @deprecated Legacy RichEditor HTML draft — migrated on load. */
  reflectionHtml?: string;
  journalTranslationId: string;
  /** Optional category tokens; omitted on older drafts. */
  tags?: string[];
  initialParams?: {
    book?: string;
    chapter?: string;
    verseStart?: string;
    verseEnd?: string;
    translation?: string;
  };
  updatedAt: string;
};

function isNonEmptyDraftValue(raw: string | null): boolean {
  return raw != null && raw !== "null" && raw !== '""' && raw !== "{}";
}

function storageKeyForDraftId(draftId: string): string {
  if (draftId === DEFAULT_JOURNAL_DRAFT_ID) return JOURNAL_DRAFT_CONTENT_KEY;
  if (draftId.startsWith("legacy:")) return draftId.slice("legacy:".length);
  return `${JOURNAL_DRAFT_CONTENT_KEY}:${draftId}`;
}

function draftIdFromStorageKey(key: string): string {
  if (key === JOURNAL_DRAFT_CONTENT_KEY) return DEFAULT_JOURNAL_DRAFT_ID;
  if (key.startsWith(`${JOURNAL_DRAFT_CONTENT_KEY}:`)) {
    return key.slice(JOURNAL_DRAFT_CONTENT_KEY.length + 1);
  }
  return `legacy:${key}`;
}

async function readDraftIndex(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(JOURNAL_DRAFT_INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

async function writeDraftIndex(ids: string[]): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    await AsyncStorage.removeItem(JOURNAL_DRAFT_INDEX_KEY);
    return;
  }
  await AsyncStorage.setItem(JOURNAL_DRAFT_INDEX_KEY, JSON.stringify(unique));
}

/**
 * One-time scan of legacy draft keys into the canonical index. Safe to call repeatedly;
 * the flag short-circuits after the first successful run.
 */
export async function migrateJournalDraftIndexIfNeeded(): Promise<void> {
  const done = await AsyncStorage.getItem(JOURNAL_DRAFT_INDEX_MIGRATED_FLAG);
  if (done === "true") return;

  const allKeys = await AsyncStorage.getAllKeys();
  const discoveredKeys = allKeys.filter((key) => LEGACY_DRAFT_KEY_PATTERN.test(key));
  const keysToScan = [...new Set([...LEGACY_DRAFT_KEY_CANDIDATES, ...discoveredKeys])];

  const discoveredIds: string[] = [];
  for (const key of keysToScan) {
    const raw = await AsyncStorage.getItem(key);
    if (isNonEmptyDraftValue(raw)) {
      discoveredIds.push(draftIdFromStorageKey(key));
    }
  }

  const existing = await readDraftIndex();
  await writeDraftIndex([...existing, ...discoveredIds]);
  await AsyncStorage.setItem(JOURNAL_DRAFT_INDEX_MIGRATED_FLAG, "true");
}

/** Persists draft content, then adds the id to the index. */
export async function registerJournalDraft(draftId: string, payload: string): Promise<void> {
  const contentKey = storageKeyForDraftId(draftId);
  await AsyncStorage.setItem(contentKey, payload);
  const index = await readDraftIndex();
  if (!index.includes(draftId)) {
    await writeDraftIndex([...index, draftId]);
  }
}

/** Removes the id from the index first, then deletes draft content. */
export async function unregisterJournalDraft(draftId: string): Promise<void> {
  const index = (await readDraftIndex()).filter((id) => id !== draftId);
  await writeDraftIndex(index);
  await AsyncStorage.removeItem(storageKeyForDraftId(draftId));
}

export async function clearDefaultJournalDraft(): Promise<void> {
  await unregisterJournalDraft(DEFAULT_JOURNAL_DRAFT_ID);
}

export async function hasAnyJournalDraft(): Promise<boolean> {
  await migrateJournalDraftIndexIfNeeded();
  const index = await readDraftIndex();
  return index.length > 0;
}

export async function loadDefaultJournalDraft(): Promise<JournalNewEntryDraftPayload | null> {
  await migrateJournalDraftIndexIfNeeded();
  const raw = await AsyncStorage.getItem(JOURNAL_DRAFT_CONTENT_KEY);
  if (!isNonEmptyDraftValue(raw)) return null;
  try {
    const parsed = JSON.parse(raw!) as JournalNewEntryDraftPayload & { reflectionHtml?: string };
    if (typeof parsed.passage !== "string") return null;

    let reflectionMarkdown = "";
    if (typeof parsed.reflectionMarkdown === "string") {
      reflectionMarkdown = parsed.reflectionMarkdown;
    } else if (typeof parsed.reflectionHtml === "string") {
      reflectionMarkdown = parsed.reflectionHtml.trim()
        ? htmlToReflectionMarkdown(parsed.reflectionHtml)
        : "";
    } else {
      return null;
    }

    return {
      passage: parsed.passage,
      title: typeof parsed.title === "string" ? parsed.title : "",
      reflectionMarkdown,
      journalTranslationId:
        typeof parsed.journalTranslationId === "string" ? parsed.journalTranslationId : "",
      tags: normalizeJournalTags(parsed.tags),
      initialParams: parsed.initialParams,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return null;
  }
}
