/**
 * One-time consolidation of legacy AsyncStorage journal blob keys.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "sinagbible_journal_entries";

const LEGACY_JOURNAL_ENTRIES_KEYS = [
  "quietword_journal_entries",
  "qs:journal:entries",
  "sb:journal:entries",
  "journal_entries",
] as const;

let legacyMigrationChecked = false;

function hasStoredJournalPayload(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

export function resetLegacyJournalMigrationState(): void {
  legacyMigrationChecked = false;
}

/** Copies the first non-empty legacy key into the canonical blob key. */
export async function maybeMigrateLegacyJournalEntries(): Promise<void> {
  if (legacyMigrationChecked) return;
  legacyMigrationChecked = true;

  const currentRaw = await AsyncStorage.getItem(STORAGE_KEY);
  if (hasStoredJournalPayload(currentRaw)) return;

  for (const legacyKey of LEGACY_JOURNAL_ENTRIES_KEYS) {
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (!hasStoredJournalPayload(legacyRaw)) continue;

    if (__DEV__) {
      console.log("[journal-local] migrating legacy journal storage key", { legacyKey });
    }
    await AsyncStorage.setItem(STORAGE_KEY, legacyRaw!);
    await AsyncStorage.removeItem(legacyKey);
    return;
  }
}
