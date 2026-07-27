import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUsfmBookId } from "@sinag-bible/core";

export const COMMENTARY_STORAGE_KEY = "selectedCommentary";
export const COMMENTARY_DEFAULT_ID = "tyndale";
export const COMMENTARY_API_BASE_URL = "https://bible.helloao.org/api";
export const COMMENTARY_REQUEST_TIMEOUT_MS = 10000;

export type CommentaryApiInlineItem =
  | string
  | { text?: string; content?: CommentaryApiInlineItem[] };

export type CommentaryApiChapterItem =
  | { type: "heading"; content?: CommentaryApiInlineItem[] }
  | { type: "verse"; number?: number; content?: CommentaryApiInlineItem[] }
  | { type: "line_break" }
  | { type: "hebrew_subtitle"; content?: CommentaryApiInlineItem[] }
  | { type: string; content?: CommentaryApiInlineItem[]; number?: number };

type CommentaryApiChapterResponse = {
  chapter?: {
    content?: CommentaryApiChapterItem[];
  };
};

const chapterCache = new Map<string, CommentaryApiChapterItem[]>();

function commentaryChapterCacheKey(
  commentaryId: string,
  bookSlug: string,
  chapterNumber: number,
): string {
  return `${commentaryId}:${bookSlug}:${chapterNumber}`;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = COMMENTARY_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const parentSignal = init?.signal;
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener("abort", onParentAbort);
    }
  }

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("commentary request aborted");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}

export function isCommentaryRequestAborted(
  cancelled: boolean,
  signal: AbortSignal,
): boolean {
  return cancelled || signal.aborted;
}

export function flattenCommentaryInline(items: CommentaryApiInlineItem[] | undefined): string {
  if (!items || items.length === 0) return "";
  return items
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item.text === "string") return item.text;
      if (Array.isArray(item.content)) return flattenCommentaryInline(item.content);
      return "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function filterCommentaryEntriesForVerses(
  commentaryEntries: CommentaryApiChapterItem[],
  selectedVerses: number[],
): CommentaryApiChapterItem[] {
  if (selectedVerses.length === 0) return commentaryEntries;
  const selectedSet = new Set(selectedVerses);
  const output: CommentaryApiChapterItem[] = [];
  let pendingHeading: CommentaryApiChapterItem | null = null;
  let previousWasSelectedVerse = false;
  for (const entry of commentaryEntries) {
    if (entry.type === "heading" || entry.type === "hebrew_subtitle") {
      pendingHeading = entry;
      previousWasSelectedVerse = false;
      continue;
    }
    if (entry.type === "verse") {
      const selected = typeof entry.number === "number" && selectedSet.has(entry.number);
      if (selected) {
        if (pendingHeading) {
          output.push(pendingHeading);
          pendingHeading = null;
        }
        output.push(entry);
      }
      previousWasSelectedVerse = selected;
      continue;
    }
    if (entry.type === "line_break") {
      if (previousWasSelectedVerse) output.push(entry);
      continue;
    }
    if (previousWasSelectedVerse) output.push(entry);
  }
  return output;
}

export function hasStudyNotesForVerses(
  commentaryEntries: CommentaryApiChapterItem[],
  selectedVerses: number[],
): boolean {
  const filtered = filterCommentaryEntriesForVerses(commentaryEntries, selectedVerses);
  return filtered.some((entry) => entry.type === "verse");
}

export async function readSelectedCommentaryId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(COMMENTARY_STORAGE_KEY);
    if (stored?.trim()) return stored.trim();
  } catch {
    // Keep default commentary when storage read fails.
  }
  return COMMENTARY_DEFAULT_ID;
}

export async function fetchCommentaryChapterEntries(
  commentaryId: string,
  bookSlug: string,
  chapterNumber: number,
  signal?: AbortSignal,
): Promise<CommentaryApiChapterItem[]> {
  const cacheKey = commentaryChapterCacheKey(commentaryId, bookSlug, chapterNumber);
  const cached = chapterCache.get(cacheKey);
  if (cached) return cached;

  const commentaryBookId = getUsfmBookId(bookSlug);
  if (!commentaryBookId) return [];

  const url = `${COMMENTARY_API_BASE_URL}/c/${encodeURIComponent(commentaryId)}/${encodeURIComponent(commentaryBookId)}/${chapterNumber}.json`;
  const res = await fetchWithTimeout(url, { signal }, COMMENTARY_REQUEST_TIMEOUT_MS);
  if (!res.ok) {
    if (res.status === 404) {
      chapterCache.set(cacheKey, []);
      return [];
    }
    throw new Error(`commentary chapter HTTP ${res.status}`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("commentary chapter unexpected content-type");
  }
  const raw = (await res.json()) as CommentaryApiChapterResponse;
  const items = Array.isArray(raw.chapter?.content) ? raw.chapter.content : [];
  chapterCache.set(cacheKey, items);
  return items;
}
