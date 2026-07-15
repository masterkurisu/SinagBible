/**
 * Local journal storage (SQLite), matching web `journal-local.ts` behavior.
 * Entries use ids prefixed with "local-".
 */

import type { LocalJournalEntry } from "@sinag-bible/types";
import {
  deleteAllJournalImages,
  deleteEntryImages,
  externalizeContentImages,
} from "@/lib/journal-content-images";
import {
  dbDelete,
  dbReplaceAll,
  dbSelectAll,
  dbSelectById,
  dbUpsert,
  dbCount,
  migrateJournalBlobIfNeeded,
} from "@/lib/journal-db";
import {
  maybeMigrateLegacyJournalEntries,
  resetLegacyJournalMigrationState,
} from "@/lib/journal-legacy-migration";
import {
  DEFAULT_SAMPLE_ENTRY_ID,
  ensureSampleEntryIsImmutable,
  getDefaultSampleEntry,
  isSampleJournalEntry,
  maybeWithSampleEntry,
  markSampleEntryDismissed,
  setSampleEntryFavorite,
} from "@/lib/journal-sample-entry";

export type { LocalJournalEntry };
export { DEFAULT_SAMPLE_ENTRY_ID, isSampleJournalEntry };
export { deleteAllJournalImages };

export class JournalLocalStorageError extends Error {
  readonly kind: "read" | "parse" | "write" | "guard";

  constructor(
    message: string,
    kind: "read" | "parse" | "write" | "guard",
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "JournalLocalStorageError";
    this.kind = kind;
  }
}

/** Shown in UI when local journal storage cannot read or write. */
export const JOURNAL_LOCAL_STORAGE_USER_MESSAGE =
  "We couldn't access your journal on this device. Check storage space and try again.";

let lastLoadedEntriesCache: LocalJournalEntry[] | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();
let startupPromise: Promise<void> | null = null;
let listRevision = 0;

function bumpJournalListRevision(): void {
  listRevision += 1;
}

/** Narrow signal for journal FlatList `extraData` — bumps on local CRUD, not on reads. */
export function getJournalListRevision(): number {
  return listRevision;
}

function sortEntriesNewestFirst(entries: LocalJournalEntry[]): LocalJournalEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function setLastLoadedEntriesCache(entries: LocalJournalEntry[]): void {
  lastLoadedEntriesCache = sortEntriesNewestFirst(entries);
}

function devLogJournalStorage(event: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  if (detail) {
    console.log(`[journal-local] ${event}`, detail);
    return;
  }
  console.log(`[journal-local] ${event}`);
}

/** Synchronous read of the last loaded list (e.g. journal search). */
export function getCachedLocalEntries(): LocalJournalEntry[] {
  return lastLoadedEntriesCache ?? [];
}

export function clearLocalEntriesMemoryCache(): void {
  lastLoadedEntriesCache = null;
  resetLegacyJournalMigrationState();
  startupPromise = null;
  listRevision = 0;
  writeQueue = Promise.resolve();
}

/** Drains in-flight journal writes/migration before a destructive wipe. */
export async function prepareJournalStorageForWipe(): Promise<void> {
  await writeQueue.catch(() => {});
  if (startupPromise) {
    await startupPromise.catch(() => {});
  }
  writeQueue = Promise.resolve();
  lastLoadedEntriesCache = null;
  resetLegacyJournalMigrationState();
  startupPromise = null;
  listRevision = 0;
}

function upsertCachedLocalEntry(entry: LocalJournalEntry): void {
  if (!lastLoadedEntriesCache) {
    setLastLoadedEntriesCache([entry]);
    return;
  }
  const byId = new Map(lastLoadedEntriesCache.map((row) => [row.id, row]));
  byId.set(entry.id, entry);
  setLastLoadedEntriesCache([...byId.values()]);
}

/**
 * Runs once: legacy-key consolidation, then blob → SQLite migration.
 * Safe to call from startup and from read/write paths.
 */
export function initJournalStorage(): Promise<void> {
  return ensureStorageReady();
}

function ensureStorageReady(): Promise<void> {
  if (!startupPromise) {
    startupPromise = (async () => {
      await maybeMigrateLegacyJournalEntries();
      await migrateJournalBlobIfNeeded();
    })().catch((error) => {
      startupPromise = null;
      throw error;
    });
  }
  return startupPromise;
}

async function readAllWithSample(): Promise<LocalJournalEntry[]> {
  await ensureStorageReady();
  try {
    const entries = await dbSelectAll();
    const withSample = await maybeWithSampleEntry(entries);
    return ensureSampleEntryIsImmutable(withSample);
  } catch (error) {
    if (lastLoadedEntriesCache) {
      devLogJournalStorage("using in-memory cache fallback", {
        cachedEntryCount: lastLoadedEntriesCache.length,
      });
      return lastLoadedEntriesCache;
    }
    if (error instanceof JournalLocalStorageError) throw error;
    throw new JournalLocalStorageError("Could not read journal storage.", "read", error);
  }
}

/** Loads from storage and updates {@link lastLoadedEntriesCache}. */
export async function refreshLocalEntriesCache(): Promise<LocalJournalEntry[]> {
  const entries = await readAllWithSample();
  setLastLoadedEntriesCache(entries);
  return getCachedLocalEntries();
}

export async function getLocalEntries(): Promise<LocalJournalEntry[]> {
  return refreshLocalEntriesCache();
}

export async function getLocalEntry(id: string): Promise<LocalJournalEntry | null> {
  if (!id.startsWith("local-")) return null;
  const cached = getCachedLocalEntries().find((e) => e.id === id);

  try {
    await ensureStorageReady();
    if (isSampleJournalEntry(id)) {
      const entries = await readAllWithSample();
      return entries.find((e) => e.id === id) ?? cached ?? null;
    }
    const fromDisk = await dbSelectById(id);
    if (fromDisk) {
      upsertCachedLocalEntry(fromDisk);
      return fromDisk;
    }
    return cached ?? null;
  } catch {
    return cached ?? null;
  }
}

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = writeQueue.catch(() => {}).then(async () => {
    await ensureStorageReady();
    return job();
  });
  writeQueue = run;
  return run;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Store plain reflection as simple HTML for parity with web TipTap entries. */
export function plainReflectionToContent(text: string): string {
  const trimmed = text.trim();
  const escaped = escapeXml(trimmed);
  const withBreaks = escaped.split(/\n+/).join("</p><p>");
  return `<p>${withBreaks}</p>`;
}

function escapeXmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function applyItalic(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (s[i] === "_") {
      const j = s.indexOf("_", i + 1);
      if (j !== -1 && j > i + 1) {
        out += "<em>" + escapeXml(s.slice(i + 1, j)) + "</em>";
        i = j + 1;
        continue;
      }
    }
    const j = s.indexOf("_", i);
    const end = j === -1 ? s.length : j;
    if (end === i) {
      out += escapeXml(s[i] ?? "");
      i += 1;
      continue;
    }
    out += escapeXml(s.slice(i, end));
    i = end;
  }
  return out;
}

function applyBold(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (s.slice(i, i + 2) === "**") {
      const j = s.indexOf("**", i + 2);
      if (j !== -1) {
        const inner = s.slice(i + 2, j);
        out += "<strong>" + applyItalic(inner) + "</strong>";
        i = j + 2;
        continue;
      }
      out += escapeXml("**");
      i += 2;
      continue;
    }
    const j = s.indexOf("**", i);
    const end = j === -1 ? s.length : j;
    out += applyItalic(s.slice(i, end));
    i = end;
  }
  return out;
}

function paragraphBlock(chunk: string, images: Record<string, string>): string {
  const trimmed = chunk.trim();
  const imgOnly = /^\[image:([^\]]+)\]$/.exec(trimmed);
  if (imgOnly) {
    const src = images[imgOnly[1] ?? ""];
    if (src) {
      return `<p><img src="${escapeXmlAttr(src)}" alt="" /></p>`;
    }
  }

  const lines = chunk.split("\n");
  const nonEmpty = lines.map((l) => l.trimEnd()).filter((l) => l.length > 0);
  if (nonEmpty.length === 0) return "";

  if (nonEmpty.every((l) => /^\s*-\s+/.test(l))) {
    const items = nonEmpty
      .map((l) => `<li>${applyBold(l.replace(/^\s*-\s+/, ""))}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  }

  if (nonEmpty.every((l) => /^\s*\d+\.\s+/.test(l))) {
    const items = nonEmpty
      .map((l) => `<li>${applyBold(l.replace(/^\s*\d+\.\s+/, ""))}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  }

  const joined = lines.join("\n");
  return `<p>${applyBold(joined).replace(/\n/g, "<br/>")}</p>`;
}

/**
 * Convert mobile reflection editor text (markdown-style markers + `[image:id]` tokens)
 * to HTML for the journal entry `content` field.
 */
export function reflectionMarkdownToContent(
  text: string,
  images: Record<string, string>,
): string {
  const trimmed = text.trim();
  if (!trimmed) return "<p></p>";
  const chunks = trimmed.split(/\n+/);
  const html = chunks.map((c) => paragraphBlock(c, images)).filter(Boolean).join("");
  return html || "<p></p>";
}

function generateLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

async function prepareEntryForStorage(entry: LocalJournalEntry): Promise<LocalJournalEntry> {
  return {
    ...entry,
    content: await externalizeContentImages(entry.content, entry.id),
  };
}

export async function saveLocalEntry(
  entry: Omit<LocalJournalEntry, "id" | "created_at">,
): Promise<LocalJournalEntry> {
  const created_at = new Date().toISOString();
  const id = generateLocalId();
  const full = await prepareEntryForStorage({ ...entry, id, created_at });

  return enqueue(async () => {
    try {
      await dbUpsert(full);
    } catch (error) {
      throw new JournalLocalStorageError("Could not save journal entry.", "write", error);
    }
    upsertCachedLocalEntry(full);
    bumpJournalListRevision();
    return full;
  });
}

export async function updateLocalEntry(
  id: string,
  data: Partial<Omit<LocalJournalEntry, "id" | "created_at">>,
): Promise<LocalJournalEntry | null> {
  if (!id.startsWith("local-")) return null;

  if (isSampleJournalEntry(id)) {
    const keys = Object.keys(data);
    if (keys.length === 0 || keys.some((k) => k !== "is_favorite")) return null;

    const isFavorite = data.is_favorite === true;
    await setSampleEntryFavorite(isFavorite);

    const persisted = await dbSelectById(id);
    if (persisted) {
      await enqueue(async () => {
        const updated = { ...persisted, is_favorite: isFavorite };
        try {
          await dbUpsert(updated);
        } catch (error) {
          throw new JournalLocalStorageError("Could not update journal entry.", "write", error);
        }
        upsertCachedLocalEntry(updated);
      });
    }

    const updated = { ...getDefaultSampleEntry(), is_favorite: isFavorite };
    upsertCachedLocalEntry(updated);
    bumpJournalListRevision();
    return updated;
  }

  const patch = data.content
    ? { ...data, content: await externalizeContentImages(data.content, id) }
    : data;

  let updated: LocalJournalEntry | null = null;
  await enqueue(async () => {
    const current = await dbSelectById(id);
    if (!current) {
      throw new JournalLocalStorageError(`Journal entry not found: ${id}`, "write");
    }

    const merged = { ...current, ...patch, id };
    try {
      await dbUpsert(merged);
    } catch (error) {
      throw new JournalLocalStorageError("Could not update journal entry.", "write", error);
    }

    const verified = await dbSelectById(id);
    if (!verified) {
      throw new JournalLocalStorageError("Journal entry did not persist after save.", "write");
    }
    if (patch.content !== undefined && verified.content !== merged.content) {
      throw new JournalLocalStorageError("Journal entry did not persist after save.", "write");
    }

    updated = verified;
    upsertCachedLocalEntry(verified);
    bumpJournalListRevision();

    if (__DEV__) {
      devLogJournalStorage("updateLocalEntry ok", {
        id,
        contentLen: verified.content.length,
      });
    }
  });

  return updated;
}

/**
 * Replaces all journal entries (used by data import). Clears on-disk images first,
 * then externalizes any embedded data URLs in the incoming payload.
 */
export async function replaceAllLocalEntries(entries: LocalJournalEntry[]): Promise<void> {
  return enqueue(async () => {
    await deleteAllJournalImages();
    const valid = entries.filter(
      (entry) => typeof entry.id === "string" && entry.id.startsWith("local-"),
    );
    const prepared = await Promise.all(valid.map((entry) => prepareEntryForStorage(entry)));
    try {
      await dbReplaceAll(prepared);
      const stored = await dbCount();
      if (stored !== prepared.length) {
        throw new JournalLocalStorageError(
          `Journal import verification failed: expected ${prepared.length}, found ${stored}`,
          "write",
        );
      }
      const readBack = await dbSelectAll();
      if (readBack.length !== prepared.length) {
        throw new JournalLocalStorageError(
          `Journal import read-back failed: expected ${prepared.length}, found ${readBack.length}`,
          "write",
        );
      }
    } catch (error) {
      if (error instanceof JournalLocalStorageError) throw error;
      throw new JournalLocalStorageError("Could not import journal entries.", "write", error);
    }
    const withSample = await maybeWithSampleEntry(prepared);
    setLastLoadedEntriesCache(ensureSampleEntryIsImmutable(withSample));
    bumpJournalListRevision();
  });
}

export async function deleteLocalEntry(id: string): Promise<void> {
  if (!id.startsWith("local-")) return;

  if (id === DEFAULT_SAMPLE_ENTRY_ID) {
    await markSampleEntryDismissed();
  }

  await enqueue(async () => {
    if (!isSampleJournalEntry(id)) {
      try {
        await dbDelete(id);
      } catch (error) {
        throw new JournalLocalStorageError("Could not delete journal entry.", "write", error);
      }
      await deleteEntryImages(id);
    }
    setLastLoadedEntriesCache(getCachedLocalEntries().filter((e) => e.id !== id));
    bumpJournalListRevision();
  });
}
