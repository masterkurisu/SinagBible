/**
 * One-time migration of legacy plaintext AsyncStorage chapter cache into the
 * encrypted SQLite store, then removal of the plaintext copies.
 *
 * Idempotent: safe on every launch; exits fast once `@chapter_store_migrated_v1` is set.
 * Crash-safe: SQLite commits per batch; AsyncStorage keys are removed only after
 * their batch is written (INSERT OR REPLACE on re-run).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBookSlugFromUsfm } from "@sinag-bible/core/bible-meta";
import type { ApiChapter } from "@/lib/bible-api-service";
import { canonicalTranslationId } from "@/lib/canonical-translation-id";
import { openChapterDb } from "@/lib/chapter-db";
import { putChapters, type StoredChapter } from "@/lib/chapter-store";

export const MIGRATION_FLAG = "@chapter_store_migrated_v1";
const LEGACY_PREFIX = "sb:bible-api:chapter:";
const BATCH_SIZE = 50;

type LegacyRef = {
  storageKey: string;
  apiTranslationId: string;
  usfmBookId: string;
  chapterNumber: number;
};

function parseLegacyKey(storageKey: string): LegacyRef | null {
  if (!storageKey.startsWith(LEGACY_PREFIX)) return null;

  const rest = storageKey.slice(LEGACY_PREFIX.length);
  const lastSep = rest.lastIndexOf(":");
  if (lastSep < 0) return null;

  const chapterNumber = Number(rest.slice(lastSep + 1));
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) return null;

  const beforeChapter = rest.slice(0, lastSep);
  const bookSep = beforeChapter.lastIndexOf(":");
  if (bookSep < 0) return null;

  const usfmBookId = beforeChapter.slice(bookSep + 1);
  const apiTranslationId = beforeChapter.slice(0, bookSep);
  if (!apiTranslationId || !usfmBookId) return null;

  return { storageKey, apiTranslationId, usfmBookId, chapterNumber };
}

function inferSource(): "helloao" {
  return "helloao";
}

export async function migrateAsyncStorageChapters(): Promise<
  { migrated: number; skipped: number; dropped: number } | "already-done"
> {
  const done = await AsyncStorage.getItem(MIGRATION_FLAG);
  if (done === "true") return "already-done";

  await openChapterDb();

  const allKeys = await AsyncStorage.getAllKeys();
  const legacyKeys = allKeys.filter((key) => key.startsWith(LEGACY_PREFIX));

  let migrated = 0;
  let skipped = 0;
  let dropped = 0;

  const migratableRefs: LegacyRef[] = [];
  const keysToDrop: string[] = [];

  for (const key of legacyKeys) {
    const ref = parseLegacyKey(key);
    if (!ref) {
      keysToDrop.push(key);
      dropped += 1;
      continue;
    }

    const bookSlug = getBookSlugFromUsfm(ref.usfmBookId);
    if (!bookSlug) {
      keysToDrop.push(key);
      dropped += 1;
      continue;
    }

    migratableRefs.push(ref);
  }

  if (keysToDrop.length > 0) {
    await AsyncStorage.multiRemove(keysToDrop);
  }

  for (let i = 0; i < migratableRefs.length; i += BATCH_SIZE) {
    const batchRefs = migratableRefs.slice(i, i + BATCH_SIZE);
    const pairs = await AsyncStorage.multiGet(batchRefs.map((ref) => ref.storageKey));
    const toStore: StoredChapter[] = [];
    const removeKeys: string[] = [];

    for (let j = 0; j < pairs.length; j += 1) {
      const [key, value] = pairs[j]!;
      const ref = batchRefs[j]!;
      if (!value) {
        removeKeys.push(key);
        skipped += 1;
        continue;
      }

      try {
        const payload = JSON.parse(value) as ApiChapter;
        const bookSlug = getBookSlugFromUsfm(ref.usfmBookId);
        if (!bookSlug) {
          removeKeys.push(key);
          dropped += 1;
          continue;
        }

        toStore.push({
          translationId: canonicalTranslationId(ref.apiTranslationId),
          bookSlug,
          chapterNumber: ref.chapterNumber,
          source: inferSource(),
          payload,
        });
        removeKeys.push(key);
      } catch {
        removeKeys.push(key);
        skipped += 1;
      }
    }

    if (toStore.length > 0) {
      putChapters(toStore);
      migrated += toStore.length;
    }

    if (removeKeys.length > 0) {
      await AsyncStorage.multiRemove(removeKeys);
    }
  }

  const remaining = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(LEGACY_PREFIX));
  if (remaining.length === 0) {
    await AsyncStorage.setItem(MIGRATION_FLAG, "true");
  }

  return { migrated, skipped, dropped };
}
