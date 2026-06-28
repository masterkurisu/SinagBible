/**
 * Local journal storage (AsyncStorage), matching web `journal-local.ts` behavior.
 * Entries use ids prefixed with "local-".
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LocalJournalEntry } from "@sinag-bible/types";
import {
  deleteAllJournalImages,
  deleteEntryImages,
  externalizeContentImages,
  externalizeEntryImages,
} from "@/lib/journal-content-images";

export type { LocalJournalEntry };

const STORAGE_KEY = "sinagbible_journal_entries";
const SAMPLE_ENTRY_DISMISSED_KEY = "sinagbible_sample_journal_entry_dismissed";
export const DEFAULT_SAMPLE_ENTRY_ID = "local-sample-john-3-16";
const DEFAULT_SAMPLE_ENTRY_CREATED_AT = "2024-01-01T00:00:00.000Z";

/** Older builds / sibling apps that may have stored entries under different keys. */
const LEGACY_JOURNAL_ENTRIES_KEYS = [
  "quietword_journal_entries",
  "qs:journal:entries",
  "sb:journal:entries",
  "journal_entries",
] as const;

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

export function isSampleJournalEntry(id: string): boolean {
  return id === DEFAULT_SAMPLE_ENTRY_ID;
}

function getDefaultSampleEntry(): LocalJournalEntry {
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

async function maybeWithSampleEntry(entries: LocalJournalEntry[]): Promise<LocalJournalEntry[]> {
  const hasSample = entries.some((entry) => entry.id === DEFAULT_SAMPLE_ENTRY_ID);
  if (hasSample) return entries;
  const dismissed = await isSampleEntryDismissed();
  if (dismissed) return entries;
  return [getDefaultSampleEntry(), ...entries];
}

/** Shown in UI when local journal storage cannot read or write. */
export const JOURNAL_LOCAL_STORAGE_USER_MESSAGE =
  "We couldn't access your journal on this device. Check storage space and try again.";

/** Newest-first snapshot for search and other readers; avoid AsyncStorage on every debounced query. */
let lastLoadedEntriesCache: LocalJournalEntry[] | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let legacyMigrationChecked = false;

function sortEntriesNewestFirst(entries: LocalJournalEntry[]): LocalJournalEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function setLastLoadedEntriesCache(entries: LocalJournalEntry[]): void {
  lastLoadedEntriesCache = sortEntriesNewestFirst(entries);
}

function countRealEntries(entries: LocalJournalEntry[]): number {
  return entries.filter((entry) => !isSampleJournalEntry(entry.id)).length;
}

function devLogJournalStorage(event: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  if (detail) {
    console.log(`[journal-local] ${event}`, detail);
    return;
  }
  console.log(`[journal-local] ${event}`);
}

function devLogStorageRead(rawBytes: number, entryCount: number): void {
  devLogJournalStorage("read ok", {
    rawBytes,
    rawKB: Math.round(rawBytes / 1024),
    entryCount,
    realEntryCount: entryCount,
  });
}

function devLogStorageReadFailure(error: unknown): void {
  devLogJournalStorage("read failed", {
    error: error instanceof Error ? error.message : String(error),
  });
}

function devLogStorageWrite(rawBytes: number, entryCount: number): void {
  devLogJournalStorage("write ok", {
    rawBytes,
    rawKB: Math.round(rawBytes / 1024),
    entryCount,
  });
}

/** Synchronous read of the last loaded list (e.g. journal search). */
export function getCachedLocalEntries(): LocalJournalEntry[] {
  return lastLoadedEntriesCache ?? [];
}

export function clearLocalEntriesMemoryCache(): void {
  lastLoadedEntriesCache = null;
  legacyMigrationChecked = false;
}

function ensureSampleEntryIsImmutable(entries: LocalJournalEntry[]): LocalJournalEntry[] {
  const defaultSample = getDefaultSampleEntry();
  return entries.map((entry) =>
    entry.id === DEFAULT_SAMPLE_ENTRY_ID
      ? { ...defaultSample, is_favorite: entry.is_favorite ?? false }
      : entry,
  );
}

function parseStoredEntries(raw: string): LocalJournalEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new JournalLocalStorageError("Journal data is corrupted.", "parse", error);
  }
  if (!Array.isArray(parsed)) {
    throw new JournalLocalStorageError("Journal data has an invalid format.", "parse");
  }
  return parsed as LocalJournalEntry[];
}

function hasStoredJournalPayload(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

async function maybeMigrateLegacyJournalEntries(): Promise<void> {
  if (legacyMigrationChecked) return;
  legacyMigrationChecked = true;

  const currentRaw = await AsyncStorage.getItem(STORAGE_KEY);
  if (hasStoredJournalPayload(currentRaw)) return;

  for (const legacyKey of LEGACY_JOURNAL_ENTRIES_KEYS) {
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (!hasStoredJournalPayload(legacyRaw)) continue;

    devLogJournalStorage("migrating legacy journal storage key", { legacyKey });
    await AsyncStorage.setItem(STORAGE_KEY, legacyRaw!);
    await AsyncStorage.removeItem(legacyKey);
    return;
  }
}

async function compactEmbeddedImages(
  entries: LocalJournalEntry[],
  options: { persist?: boolean },
): Promise<LocalJournalEntry[]> {
  let changed = false;
  const compacted = await Promise.all(
    entries.map(async (entry) => {
      if (isSampleJournalEntry(entry.id) || !/data:image\//i.test(entry.content)) {
        return entry;
      }
      const result = await externalizeEntryImages(entry);
      if (result.changed) changed = true;
      return { ...entry, content: result.content };
    }),
  );

  if (!changed) return entries;

  devLogJournalStorage("compacted embedded journal images", {
    entryCount: compacted.length,
  });

  if (options.persist) {
    scheduleCompactionPersist(compacted);
  }

  return compacted;
}

function scheduleCompactionPersist(entries: LocalJournalEntry[]): void {
  writeQueue = writeQueue.then(async () => {
    await writeEntries(entries);
    setLastLoadedEntriesCache(entries);
  });
}

type ReadEntriesOptions = {
  /** When true, return the last loaded snapshot instead of failing (display-only reads). */
  allowCacheFallback?: boolean;
  /** Skip image compaction (used while a storage mutation is in progress). */
  skipCompaction?: boolean;
};

async function readEntriesFromStorage(options: ReadEntriesOptions = {}): Promise<LocalJournalEntry[]> {
  try {
    await maybeMigrateLegacyJournalEntries();

    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return maybeWithSampleEntry([]);
    }

    const parsed = parseStoredEntries(raw);
    const withSample = await maybeWithSampleEntry(ensureSampleEntryIsImmutable(parsed));
    const compacted = options.skipCompaction
      ? withSample
      : await compactEmbeddedImages(withSample, { persist: true });
    devLogStorageRead(raw.length, compacted.length);
    return compacted;
  } catch (error) {
    devLogStorageReadFailure(error);

    if (options.allowCacheFallback && lastLoadedEntriesCache) {
      devLogJournalStorage("using in-memory cache fallback", {
        cachedEntryCount: lastLoadedEntriesCache.length,
      });
      return lastLoadedEntriesCache;
    }

    if (error instanceof JournalLocalStorageError) throw error;
    throw new JournalLocalStorageError("Could not read journal storage.", "read", error);
  }
}

function guardAgainstDestructiveWrite(
  current: LocalJournalEntry[],
  next: LocalJournalEntry[],
): void {
  const cache = lastLoadedEntriesCache;
  if (!cache) return;

  const cacheReal = countRealEntries(cache);
  const currentReal = countRealEntries(current);
  const nextReal = countRealEntries(next);

  if (currentReal === 0 && cacheReal > 0 && nextReal < cacheReal) {
    throw new JournalLocalStorageError(
      "Refusing journal write: storage read did not match the last loaded entries.",
      "guard",
    );
  }

  if (currentReal >= 2 && nextReal === 0) {
    throw new JournalLocalStorageError(
      "Refusing journal write: too many entries would be removed at once.",
      "guard",
    );
  }

  if (currentReal > 0 && nextReal === 0 && currentReal !== 1) {
    throw new JournalLocalStorageError(
      "Refusing journal write: all entries would be removed.",
      "guard",
    );
  }
}

async function externalizeEntriesForWrite(entries: LocalJournalEntry[]): Promise<LocalJournalEntry[]> {
  return Promise.all(
    entries.map(async (entry) => {
      if (!/data:image\//i.test(entry.content)) return entry;
      return {
        ...entry,
        content: await externalizeContentImages(entry.content, entry.id),
      };
    }),
  );
}

async function writeEntries(entries: LocalJournalEntry[]): Promise<void> {
  const payload = JSON.stringify(entries);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, payload);
    devLogStorageWrite(payload.length, entries.length);
  } catch (error) {
    devLogJournalStorage("write failed", {
      error: error instanceof Error ? error.message : String(error),
      rawKB: Math.round(payload.length / 1024),
    });
    if (__DEV__) {
      console.error("[journal-local] Failed to write journal entries to AsyncStorage:", error);
    }
    throw new JournalLocalStorageError("Could not save journal storage.", "write", error);
  }
}

async function enqueueStorageMutation(
  mutate: (entries: LocalJournalEntry[]) => LocalJournalEntry[],
): Promise<LocalJournalEntry[]> {
  let nextEntries: LocalJournalEntry[] = [];
  writeQueue = writeQueue.then(async () => {
    const current = await readEntriesFromStorage({
      allowCacheFallback: false,
      skipCompaction: true,
    });
    nextEntries = mutate(current);
    guardAgainstDestructiveWrite(current, nextEntries);
    nextEntries = await externalizeEntriesForWrite(nextEntries);
    await writeEntries(nextEntries);
    setLastLoadedEntriesCache(nextEntries);
  });
  await writeQueue;
  return nextEntries;
}

/** Loads from storage and updates {@link lastLoadedEntriesCache}. */
export async function refreshLocalEntriesCache(): Promise<LocalJournalEntry[]> {
  const entries = await readEntriesFromStorage({ allowCacheFallback: true });
  setLastLoadedEntriesCache(entries);
  return getCachedLocalEntries();
}

export async function getLocalEntries(): Promise<LocalJournalEntry[]> {
  return refreshLocalEntriesCache();
}

export async function getLocalEntry(id: string): Promise<LocalJournalEntry | null> {
  if (!id.startsWith("local-")) return null;
  try {
    const entries = await readEntriesFromStorage({ allowCacheFallback: true });
    setLastLoadedEntriesCache(entries);
    return entries.find((e) => e.id === id) ?? null;
  } catch {
    return getCachedLocalEntries().find((e) => e.id === id) ?? null;
  }
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
 *
 * Bold: `**text**`, italic: `_text_`, bullets: lines starting with `- `, numbered: `1. ` …
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
  await enqueueStorageMutation((entries) => {
    const next = [...entries];
    next.unshift(full);
    return next;
  });
  return full;
}

export async function updateLocalEntry(
  id: string,
  data: Partial<Omit<LocalJournalEntry, "id" | "created_at">>,
): Promise<void> {
  if (!id.startsWith("local-")) return;
  if (isSampleJournalEntry(id)) {
    const keys = Object.keys(data);
    if (keys.length === 0 || keys.some((k) => k !== "is_favorite")) return;
  }

  const patch = data.content
    ? { ...data, content: await externalizeContentImages(data.content, id) }
    : data;

  await enqueueStorageMutation((entries) => {
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) return entries;
    const next = [...entries];
    next[index] = { ...next[index], ...patch };
    return next;
  });
}

export async function deleteLocalEntry(id: string): Promise<void> {
  if (!id.startsWith("local-")) return;
  if (id === DEFAULT_SAMPLE_ENTRY_ID) {
    try {
      await AsyncStorage.setItem(SAMPLE_ENTRY_DISMISSED_KEY, "1");
    } catch {
      // Best-effort preference: if this fails we still delete the entry itself.
    }
  }
  await enqueueStorageMutation((entries) => entries.filter((e) => e.id !== id));
  await deleteEntryImages(id);
}

export { deleteAllJournalImages };
