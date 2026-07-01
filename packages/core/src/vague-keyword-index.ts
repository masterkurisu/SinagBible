import type { KJVData } from "@sinag-bible/types";

export type VagueKeywordVerseRef = {
  bookIndex: number;
  chapter: number;
  verse: number;
};

type TranslationData = KJVData;

const TOKEN_RE = /[a-z']+/g;

const indexByTranslation = new Map<string, Map<string, VagueKeywordVerseRef[]>>();

function verseRefKey(ref: VagueKeywordVerseRef): string {
  return `${ref.bookIndex}:${ref.chapter}:${ref.verse}`;
}

/** One inverted index per translation — built lazily on first keyword search. */
export function buildVagueKeywordIndex(data: TranslationData): Map<string, VagueKeywordVerseRef[]> {
  const index = new Map<string, VagueKeywordVerseRef[]>();

  for (let bookIndex = 0; bookIndex < data.books.length; bookIndex++) {
    const book = data.books[bookIndex];
    if (!book) continue;

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

  return index;
}

export function getOrBuildVagueKeywordIndex(
  id: string,
  data: TranslationData,
): Map<string, VagueKeywordVerseRef[]> {
  const cached = indexByTranslation.get(id);
  if (cached) return cached;

  const index = buildVagueKeywordIndex(data);
  indexByTranslation.set(id, index);
  return index;
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
