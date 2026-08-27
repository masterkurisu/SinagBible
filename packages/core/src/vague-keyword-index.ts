import type { KJVData } from "@sinag-bible/types";

export type VagueKeywordVerseRef = {
  bookIndex: number;
  chapter: number;
  verse: number;
};

type TranslationData = KJVData;

const TOKEN_RE = /[a-z']+/g;
const INDEX_TICK_BUDGET_MS = 8;

const indexByTranslation = new Map<string, Map<string, VagueKeywordVerseRef[]>>();
/** Bumped to cancel an in-flight chunked warm when a sync build must win. */
const buildGenerationByTranslation = new Map<string, number>();

function indexBook(
  index: Map<string, VagueKeywordVerseRef[]>,
  data: TranslationData,
  bookIndex: number,
): void {
  const book = data.books[bookIndex];
  if (!book) return;

  for (let ch = 0; ch < book.chapters.length; ch++) {
    const verses = book.chapters[ch];
    if (!verses) continue;
    const chapter = ch + 1;

    for (let v = 0; v < verses.length; v++) {
      const verse = v + 1;
      const text = verses[v] ?? "";
      const tokens = text.toLowerCase().match(TOKEN_RE);
      if (!tokens?.length) continue;

      const seenInVerse = new Set<string>();
      const ref: VagueKeywordVerseRef = { bookIndex, chapter, verse };

      for (const token of tokens) {
        if (seenInVerse.has(token)) continue;
        seenInVerse.add(token);

        let list = index.get(token);
        if (!list) {
          list = [];
          index.set(token, list);
        }
        list.push(ref);
      }
    }
  }
}

function verseRefKey(ref: VagueKeywordVerseRef): string {
  return `${ref.bookIndex}:${ref.chapter}:${ref.verse}`;
}

/** One inverted index per translation — built lazily on first keyword search. */
export function buildVagueKeywordIndex(data: TranslationData): Map<string, VagueKeywordVerseRef[]> {
  const index = new Map<string, VagueKeywordVerseRef[]>();
  for (let bookIndex = 0; bookIndex < data.books.length; bookIndex++) {
    indexBook(index, data, bookIndex);
  }
  return index;
}

/**
 * Yields to the JS event loop between books so tab chrome / overlay can paint.
 * A later {@link getOrBuildVagueKeywordIndex} call cancels this and builds synchronously.
 */
export function scheduleVagueKeywordIndexBuild(id: string, data: TranslationData): void {
  if (indexByTranslation.has(id)) return;
  const generation = (buildGenerationByTranslation.get(id) ?? 0) + 1;
  buildGenerationByTranslation.set(id, generation);
  const index = new Map<string, VagueKeywordVerseRef[]>();
  let bookIndex = 0;

  const tick = () => {
    if (buildGenerationByTranslation.get(id) !== generation) return;
    const startedAt = Date.now();
    while (bookIndex < data.books.length && Date.now() - startedAt < INDEX_TICK_BUDGET_MS) {
      indexBook(index, data, bookIndex);
      bookIndex += 1;
    }
    if (bookIndex < data.books.length) {
      setTimeout(tick, 0);
      return;
    }
    if (buildGenerationByTranslation.get(id) !== generation) return;
    indexByTranslation.set(id, index);
  };

  setTimeout(tick, 0);
}

export function getOrBuildVagueKeywordIndex(
  id: string,
  data: TranslationData,
): Map<string, VagueKeywordVerseRef[]> {
  const cached = indexByTranslation.get(id);
  if (cached) return cached;

  buildGenerationByTranslation.set(id, (buildGenerationByTranslation.get(id) ?? 0) + 1);
  const index = buildVagueKeywordIndex(data);
  indexByTranslation.set(id, index);
  return index;
}

/** Drop a cached inverted index when its translation corpus is evicted from memory. */
export function evictVagueKeywordIndex(id: string): void {
  buildGenerationByTranslation.set(id, (buildGenerationByTranslation.get(id) ?? 0) + 1);
  indexByTranslation.delete(id);
}

/** Dev/diagnostic — number of cached keyword indexes. */
export function getVagueKeywordIndexCacheSize(): number {
  return indexByTranslation.size;
}

/** Dev/diagnostic — whether a keyword index is currently cached for `id`. */
export function hasVagueKeywordIndex(id: string): boolean {
  return indexByTranslation.has(id);
}

/**
 * Whole-word hits first; when none exist and the query is long enough, include words
 * that start with the query (e.g. "test" → testify, testimony) in canonical order.
 */
export function lookupKeywordVerseRefs(
  index: Map<string, VagueKeywordVerseRef[]>,
  rawQuery: string,
): VagueKeywordVerseRef[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];

  const exact = index.get(q) ?? [];
  if (exact.length > 0 || q.length < 3) {
    return exact;
  }

  const merged: VagueKeywordVerseRef[] = [];
  const seen = new Set<string>();

  for (const [word, refs] of index) {
    if (!word.startsWith(q)) continue;
    for (const ref of refs) {
      const key = verseRefKey(ref);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(ref);
    }
  }

  return merged;
}
