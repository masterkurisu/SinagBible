import type { PopularVerseRef } from "./search-keyword-popular";
import { lookupNamedPassage } from "./search-named-passages";
import { parsePassageReference } from "./journal";
import { parseStrongsQuery } from "./search-strongs-index";

export const RELATED_VERSE_CAP = 5;

function canonicalKey(slug: string, chapter: number, verse: number): string {
  return `${slug}:${chapter}:${verse}`;
}

/**
 * Explicit cross-references (not keyword-search leftovers).
 * Keyed by canonical `bookSlug:chapter:verse`.
 */
const RELATED_VERSES: Record<string, PopularVerseRef[]> = {
  "john:3:16": [
    { slug: "romans", chapter: 5, verse: 8 },
    { slug: "1-john", chapter: 4, verse: 9 },
    { slug: "ephesians", chapter: 2, verse: 8 },
    { slug: "isaiah", chapter: 53, verse: 5 },
    { slug: "john", chapter: 1, verse: 12 },
  ],
  "matthew:6:9": [
    { slug: "luke", chapter: 11, verse: 2 },
    { slug: "matthew", chapter: 6, verse: 11 },
    { slug: "philippians", chapter: 4, verse: 6 },
    { slug: "john", chapter: 17, verse: 1 },
    { slug: "psalms", chapter: 145, verse: 18 },
  ],
  "psalms:23:1": [
    { slug: "john", chapter: 10, verse: 11 },
    { slug: "ezekiel", chapter: 34, verse: 11 },
    { slug: "hebrews", chapter: 13, verse: 20 },
    { slug: "1-peter", chapter: 2, verse: 25 },
    { slug: "isaiah", chapter: 40, verse: 11 },
  ],
  "romans:8:1": [
    { slug: "romans", chapter: 8, verse: 28 },
    { slug: "john", chapter: 5, verse: 24 },
    { slug: "romans", chapter: 5, verse: 1 },
    { slug: "2-corinthians", chapter: 5, verse: 17 },
    { slug: "galatians", chapter: 5, verse: 1 },
  ],
  "philippians:4:13": [
    { slug: "2-corinthians", chapter: 12, verse: 9 },
    { slug: "isaiah", chapter: 41, verse: 10 },
    { slug: "john", chapter: 15, verse: 5 },
    { slug: "ephesians", chapter: 6, verse: 10 },
    { slug: "joshua", chapter: 1, verse: 9 },
  ],
  "genesis:1:1": [
    { slug: "john", chapter: 1, verse: 1 },
    { slug: "colossians", chapter: 1, verse: 16 },
    { slug: "hebrews", chapter: 11, verse: 3 },
    { slug: "psalms", chapter: 33, verse: 6 },
    { slug: "hebrews", chapter: 1, verse: 10 },
  ],
  "john:1:1": [
    { slug: "genesis", chapter: 1, verse: 1 },
    { slug: "john", chapter: 1, verse: 14 },
    { slug: "colossians", chapter: 1, verse: 15 },
    { slug: "hebrews", chapter: 1, verse: 2 },
    { slug: "revelation", chapter: 19, verse: 13 },
  ],
  "matthew:28:19": [
    { slug: "acts", chapter: 1, verse: 8 },
    { slug: "mark", chapter: 16, verse: 15 },
    { slug: "matthew", chapter: 28, verse: 20 },
    { slug: "luke", chapter: 24, verse: 47 },
    { slug: "2-corinthians", chapter: 13, verse: 14 },
  ],
  "romans:3:23": [
    { slug: "romans", chapter: 6, verse: 23 },
    { slug: "isaiah", chapter: 53, verse: 6 },
    { slug: "1-john", chapter: 1, verse: 8 },
    { slug: "ecclesiastes", chapter: 7, verse: 20 },
    { slug: "romans", chapter: 5, verse: 12 },
  ],
  "ephesians:2:8": [
    { slug: "titus", chapter: 3, verse: 5 },
    { slug: "romans", chapter: 10, verse: 9 },
    { slug: "john", chapter: 3, verse: 16 },
    { slug: "romans", chapter: 3, verse: 24 },
    { slug: "2-timothy", chapter: 1, verse: 9 },
  ],
  "isaiah:53:5": [
    { slug: "1-peter", chapter: 2, verse: 24 },
    { slug: "2-corinthians", chapter: 5, verse: 21 },
    { slug: "john", chapter: 1, verse: 29 },
    { slug: "romans", chapter: 5, verse: 8 },
    { slug: "hebrews", chapter: 9, verse: 28 },
  ],
  "john:14:6": [
    { slug: "acts", chapter: 4, verse: 12 },
    { slug: "1-timothy", chapter: 2, verse: 5 },
    { slug: "john", chapter: 10, verse: 9 },
    { slug: "hebrews", chapter: 10, verse: 20 },
    { slug: "matthew", chapter: 11, verse: 27 },
  ],
  "hebrews:11:1": [
    { slug: "romans", chapter: 10, verse: 17 },
    { slug: "2-corinthians", chapter: 5, verse: 7 },
    { slug: "james", chapter: 2, verse: 17 },
    { slug: "hebrews", chapter: 11, verse: 6 },
    { slug: "1-peter", chapter: 1, verse: 8 },
  ],
  "1-corinthians:13:4": [
    { slug: "1-john", chapter: 4, verse: 8 },
    { slug: "john", chapter: 13, verse: 34 },
    { slug: "romans", chapter: 13, verse: 10 },
    { slug: "colossians", chapter: 3, verse: 14 },
    { slug: "ephesians", chapter: 4, verse: 2 },
  ],
  "proverbs:3:5": [
    { slug: "jeremiah", chapter: 17, verse: 7 },
    { slug: "psalms", chapter: 37, verse: 5 },
    { slug: "isaiah", chapter: 26, verse: 3 },
    { slug: "psalms", chapter: 118, verse: 8 },
    { slug: "james", chapter: 1, verse: 5 },
  ],
};

function sourceRefForQuery(query: string): PopularVerseRef | null {
  const trimmed = query.trim();
  if (!trimmed || parseStrongsQuery(trimmed)) return null;

  const named = lookupNamedPassage(trimmed);
  if (named) return named;

  const parsed = parsePassageReference(trimmed);
  if (!parsed) return null;
  return {
    slug: parsed.book,
    chapter: parsed.chapter,
    verse: parsed.verseStart ?? 1,
  };
}

/**
 * Related verses for a reference or named-passage query.
 * Keyword searches (`love`) return nothing so this is not ad-hoc from keyword hits.
 */
export function getRelatedVerseRefsForQuery(query: string): PopularVerseRef[] {
  const source = sourceRefForQuery(query);
  if (!source) return [];
  const list = RELATED_VERSES[canonicalKey(source.slug, source.chapter, source.verse)] ?? [];
  const sourceKey = canonicalKey(source.slug, source.chapter, source.verse);
  return list
    .filter((ref) => canonicalKey(ref.slug, ref.chapter, ref.verse) !== sourceKey)
    .slice(0, RELATED_VERSE_CAP);
}
