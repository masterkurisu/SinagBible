/**
 * Local journal storage (AsyncStorage), matching web `journal-local.ts` behavior.
 * Entries use ids prefixed with "local-".
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LocalJournalEntry } from "@sinag-bible/types";

export type { LocalJournalEntry };

const STORAGE_KEY = "sinagbible_journal_entries";
const SAMPLE_ENTRY_DISMISSED_KEY = "sinagbible_sample_journal_entry_dismissed";
const DEFAULT_SAMPLE_ENTRY_ID = "local-sample-john-3-16";
const DEFAULT_SAMPLE_ENTRY_CREATED_AT = "2024-01-01T00:00:00.000Z";

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

function sortEntriesNewestFirst(entries: LocalJournalEntry[]): LocalJournalEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function setLastLoadedEntriesCache(entries: LocalJournalEntry[]): void {
  lastLoadedEntriesCache = sortEntriesNewestFirst(entries);
}

/** Synchronous read of the last loaded list (e.g. journal search). */
export function getCachedLocalEntries(): LocalJournalEntry[] {
  return lastLoadedEntriesCache ?? [];
}

export function clearLocalEntriesMemoryCache(): void {
  lastLoadedEntriesCache = null;
}

/** Loads from storage and updates {@link lastLoadedEntriesCache}. */
export async function refreshLocalEntriesCache(): Promise<LocalJournalEntry[]> {
  const entries = await readEntries();
  setLastLoadedEntriesCache(entries);
  return getCachedLocalEntries();
}

async function readEntries(): Promise<LocalJournalEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return maybeWithSampleEntry([]);
    const parsed = JSON.parse(raw) as LocalJournalEntry[];
    if (!Array.isArray(parsed)) return maybeWithSampleEntry([]);
    return maybeWithSampleEntry(parsed);
  } catch {
    return maybeWithSampleEntry([]);
  }
}

async function writeEntries(entries: LocalJournalEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    if (__DEV__) {
      console.error("[journal-local] Failed to write journal entries to AsyncStorage:", error);
    }
    throw error;
  }
}

async function enqueueStorageMutation(
  mutate: (entries: LocalJournalEntry[]) => LocalJournalEntry[],
): Promise<LocalJournalEntry[]> {
  let nextEntries: LocalJournalEntry[] = [];
  writeQueue = writeQueue.then(async () => {
    const current = await readEntries();
    nextEntries = mutate(current);
    await writeEntries(nextEntries);
    setLastLoadedEntriesCache(nextEntries);
  });
  await writeQueue;
  return nextEntries;
}

export async function getLocalEntries(): Promise<LocalJournalEntry[]> {
  return refreshLocalEntriesCache();
}

export async function getLocalEntry(id: string): Promise<LocalJournalEntry | null> {
  if (!id.startsWith("local-")) return null;
  const entries = await readEntries();
  setLastLoadedEntriesCache(entries);
  return entries.find((e) => e.id === id) ?? null;
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

export async function saveLocalEntry(
  entry: Omit<LocalJournalEntry, "id" | "created_at">,
): Promise<LocalJournalEntry> {
  const created_at = new Date().toISOString();
  const id = generateLocalId();
  const full: LocalJournalEntry = { ...entry, id, created_at };
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
  await enqueueStorageMutation((entries) => {
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) return entries;
    const next = [...entries];
    next[index] = { ...next[index], ...data };
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
}
