import type { PopularVerseRef } from "./search-keyword-popular";
import { keywordHasPopularVerses } from "./search-keyword-popular";

export const TOPICAL_INDEX_VERSE_CAP = 5;

function normalizeTopicalKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[''´`]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Theme → verse refs where the topic word often does **not** appear in the verse.
 * Do not add keys that already live in {@link POPULAR_KEYWORD_VERSES} — those are
 * whole-word keyword hits, not a topical index.
 */
const TOPICAL_INDEX_ENTRIES: readonly { keys: string[]; refs: PopularVerseRef[] }[] = [
  {
    keys: ["trinity", "triune", "godhead"],
    refs: [
      { slug: "matthew", chapter: 28, verse: 19 },
      { slug: "2-corinthians", chapter: 13, verse: 14 },
      { slug: "john", chapter: 1, verse: 1 },
      { slug: "john", chapter: 14, verse: 16 },
      { slug: "genesis", chapter: 1, verse: 26 },
    ],
  },
  {
    keys: ["holy spirit", "holy ghost", "paraclete"],
    refs: [
      { slug: "john", chapter: 14, verse: 26 },
      { slug: "acts", chapter: 1, verse: 8 },
      { slug: "romans", chapter: 8, verse: 26 },
      { slug: "galatians", chapter: 5, verse: 22 },
      { slug: "acts", chapter: 2, verse: 4 },
    ],
  },
  {
    keys: ["baptism", "baptize", "baptized"],
    refs: [
      { slug: "matthew", chapter: 28, verse: 19 },
      { slug: "acts", chapter: 2, verse: 38 },
      { slug: "romans", chapter: 6, verse: 4 },
      { slug: "matthew", chapter: 3, verse: 16 },
      { slug: "acts", chapter: 8, verse: 36 },
    ],
  },
  {
    keys: ["communion", "eucharist", "lords table"],
    refs: [
      { slug: "1-corinthians", chapter: 11, verse: 23 },
      { slug: "matthew", chapter: 26, verse: 26 },
      { slug: "luke", chapter: 22, verse: 19 },
      { slug: "1-corinthians", chapter: 10, verse: 16 },
      { slug: "john", chapter: 6, verse: 53 },
    ],
  },
  {
    keys: ["sabbath"],
    refs: [
      { slug: "exodus", chapter: 20, verse: 8 },
      { slug: "genesis", chapter: 2, verse: 3 },
      { slug: "mark", chapter: 2, verse: 27 },
      { slug: "isaiah", chapter: 58, verse: 13 },
      { slug: "luke", chapter: 4, verse: 16 },
    ],
  },
  {
    keys: ["tithing", "tithe", "tithes"],
    refs: [
      { slug: "malachi", chapter: 3, verse: 10 },
      { slug: "leviticus", chapter: 27, verse: 30 },
      { slug: "matthew", chapter: 23, verse: 23 },
      { slug: "genesis", chapter: 14, verse: 20 },
      { slug: "proverbs", chapter: 3, verse: 9 },
    ],
  },
  {
    keys: ["second coming", "return of christ", "parousia"],
    refs: [
      { slug: "matthew", chapter: 24, verse: 30 },
      { slug: "1-thessalonians", chapter: 4, verse: 16 },
      { slug: "revelation", chapter: 1, verse: 7 },
      { slug: "acts", chapter: 1, verse: 11 },
      { slug: "john", chapter: 14, verse: 3 },
    ],
  },
  {
    keys: ["spiritual warfare"],
    refs: [
      { slug: "ephesians", chapter: 6, verse: 12 },
      { slug: "2-corinthians", chapter: 10, verse: 4 },
      { slug: "james", chapter: 4, verse: 7 },
      { slug: "1-peter", chapter: 5, verse: 8 },
      { slug: "2-timothy", chapter: 2, verse: 3 },
    ],
  },
  {
    keys: ["incarnation"],
    refs: [
      { slug: "john", chapter: 1, verse: 14 },
      { slug: "philippians", chapter: 2, verse: 6 },
      { slug: "matthew", chapter: 1, verse: 23 },
      { slug: "galatians", chapter: 4, verse: 4 },
      { slug: "1-timothy", chapter: 3, verse: 16 },
    ],
  },
  {
    keys: ["atonement"],
    refs: [
      { slug: "isaiah", chapter: 53, verse: 5 },
      { slug: "romans", chapter: 5, verse: 11 },
      { slug: "1-john", chapter: 2, verse: 2 },
      { slug: "hebrews", chapter: 9, verse: 22 },
      { slug: "leviticus", chapter: 17, verse: 11 },
    ],
  },
  {
    keys: ["justification"],
    refs: [
      { slug: "romans", chapter: 5, verse: 1 },
      { slug: "romans", chapter: 3, verse: 24 },
      { slug: "galatians", chapter: 2, verse: 16 },
      { slug: "titus", chapter: 3, verse: 7 },
      { slug: "romans", chapter: 8, verse: 30 },
    ],
  },
  {
    keys: ["sanctification"],
    refs: [
      { slug: "1-thessalonians", chapter: 4, verse: 3 },
      { slug: "john", chapter: 17, verse: 17 },
      { slug: "1-corinthians", chapter: 6, verse: 11 },
      { slug: "hebrews", chapter: 10, verse: 10 },
      { slug: "2-thessalonians", chapter: 2, verse: 13 },
    ],
  },
  {
    keys: ["providence"],
    refs: [
      { slug: "romans", chapter: 8, verse: 28 },
      { slug: "genesis", chapter: 50, verse: 20 },
      { slug: "matthew", chapter: 6, verse: 26 },
      { slug: "philippians", chapter: 4, verse: 19 },
      { slug: "psalms", chapter: 23, verse: 1 },
    ],
  },
  {
    keys: ["idolatry"],
    refs: [
      { slug: "exodus", chapter: 20, verse: 3 },
      { slug: "1-john", chapter: 5, verse: 21 },
      { slug: "1-corinthians", chapter: 10, verse: 14 },
      { slug: "colossians", chapter: 3, verse: 5 },
      { slug: "isaiah", chapter: 44, verse: 9 },
    ],
  },
];

const TOPICAL_LOOKUP: ReadonlyMap<string, PopularVerseRef[]> = (() => {
  const map = new Map<string, PopularVerseRef[]>();
  for (const entry of TOPICAL_INDEX_ENTRIES) {
    for (const key of entry.keys) {
      map.set(normalizeTopicalKey(key), entry.refs);
    }
  }
  return map;
})();

/** Theme refs for a query. Empty when the key is a popular whole-word keyword. */
export function getTopicalVerseRefsForQuery(query: string): PopularVerseRef[] {
  const key = normalizeTopicalKey(query);
  if (!key || keywordHasPopularVerses(key)) return [];
  const list = TOPICAL_LOOKUP.get(key);
  return list ? list.slice(0, TOPICAL_INDEX_VERSE_CAP) : [];
}

export function queryHasTopicalVerses(query: string): boolean {
  return getTopicalVerseRefsForQuery(query).length > 0;
}
