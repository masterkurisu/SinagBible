/**
 * Virtual sample journal entry — injected on read, not stored in SQLite.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LocalJournalEntry } from "@sinag-bible/types";

const SAMPLE_ENTRY_DISMISSED_KEY = "sinagbible_sample_journal_entry_dismissed";
const SAMPLE_ENTRY_FAVORITE_KEY = "sinagbible_sample_journal_entry_favorite";

export const DEFAULT_SAMPLE_ENTRY_ID = "local-sample-john-3-16";
const DEFAULT_SAMPLE_ENTRY_CREATED_AT = "2024-01-01T00:00:00.000Z";

export function isSampleJournalEntry(id: string): boolean {
  return id === DEFAULT_SAMPLE_ENTRY_ID;
}

export const isSampleEntryId = isSampleJournalEntry;

export function getDefaultSampleEntry(): LocalJournalEntry {
  return {
    id: DEFAULT_SAMPLE_ENTRY_ID,
    book: "john",
    chapter: 3,
    verse_start: 16,
    verse_end: null,
    bible_translation: "KJV",
    title: "God's love for the world",
    content:
      "<p>Sample journal entry</p><p>John 3:16 reminds us that God's love is personal and sacrificial. Use this space to write what this verse means to you today.</p><ul><li>Capture one key phrase from the verse</li><li>Write a short prayer response</li><li>Mark it as favorite so you can find it again</li></ul>",
    created_at: DEFAULT_SAMPLE_ENTRY_CREATED_AT,
    is_favorite: false,
    tags: ["gratitude"],
  };
}

async function isSampleEntryDismissed(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SAMPLE_ENTRY_DISMISSED_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}

async function getSampleEntryFavorite(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SAMPLE_ENTRY_FAVORITE_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}

export async function setSampleEntryFavorite(isFavorite: boolean): Promise<void> {
  try {
    if (isFavorite) {
      await AsyncStorage.setItem(SAMPLE_ENTRY_FAVORITE_KEY, "1");
    } else {
      await AsyncStorage.removeItem(SAMPLE_ENTRY_FAVORITE_KEY);
    }
  } catch {
    // Best-effort preference: UI cache still reflects the toggle.
  }
}

export async function markSampleEntryDismissed(): Promise<void> {
  try {
    await AsyncStorage.setItem(SAMPLE_ENTRY_DISMISSED_KEY, "1");
    await AsyncStorage.removeItem(SAMPLE_ENTRY_FAVORITE_KEY);
  } catch {
    // Best-effort preference.
  }
}

export async function maybeWithSampleEntry(
  entries: LocalJournalEntry[],
): Promise<LocalJournalEntry[]> {
  const hasSample = entries.some((entry) => entry.id === DEFAULT_SAMPLE_ENTRY_ID);
  if (hasSample) return entries;
  const dismissed = await isSampleEntryDismissed();
  if (dismissed) return entries;
  const is_favorite = await getSampleEntryFavorite();
  return [{ ...getDefaultSampleEntry(), is_favorite }, ...entries];
}

export function ensureSampleEntryIsImmutable(entries: LocalJournalEntry[]): LocalJournalEntry[] {
  const defaultSample = getDefaultSampleEntry();
  return entries.map((entry) =>
    entry.id === DEFAULT_SAMPLE_ENTRY_ID
      ? { ...defaultSample, is_favorite: entry.is_favorite ?? false }
      : entry,
  );
}
