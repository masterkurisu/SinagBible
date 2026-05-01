/**
 * Curated “well-known” verse refs for vague keyword search (canonical English slugs,
 * 1-based chapter & verse). Used when the query has no chapter/verse digits.
 * Aligned with KJV-shaped {@link BibleBookNavItem.slug}; same order translations reuse slugs.
 */
export type PopularVerseRef = {
  slug: string;
  chapter: number;
  verse: number;
};

/** Max popular picks prepended before book anchors / scan (see vague search). */
export const POPULAR_KEYWORD_VERSE_CAP = 5;

/** KJV-checked: each verse contains the keyword as a whole word (or is standard for that theme). */
export const POPULAR_KEYWORD_VERSES: Record<string, PopularVerseRef[]> = {
  love: [
    { slug: "leviticus", chapter: 19, verse: 18 },
    { slug: "deuteronomy", chapter: 6, verse: 5 },
    { slug: "matthew", chapter: 22, verse: 37 },
    { slug: "john", chapter: 15, verse: 13 },
    { slug: "1-john", chapter: 4, verse: 8 },
  ],
  faith: [
    { slug: "hebrews", chapter: 11, verse: 1 },
    { slug: "hebrews", chapter: 11, verse: 6 },
    { slug: "romans", chapter: 10, verse: 17 },
    { slug: "ephesians", chapter: 2, verse: 8 },
    { slug: "james", chapter: 2, verse: 17 },
  ],
  hope: [
    { slug: "romans", chapter: 15, verse: 13 },
    { slug: "hebrews", chapter: 6, verse: 19 },
    { slug: "romans", chapter: 8, verse: 24 },
    { slug: "1-peter", chapter: 1, verse: 3 },
    { slug: "psalms", chapter: 39, verse: 7 },
  ],
  peace: [
    { slug: "john", chapter: 14, verse: 27 },
    { slug: "philippians", chapter: 4, verse: 7 },
    { slug: "romans", chapter: 5, verse: 1 },
    { slug: "isaiah", chapter: 26, verse: 3 },
    { slug: "colossians", chapter: 3, verse: 15 },
  ],
  joy: [
    { slug: "john", chapter: 15, verse: 11 },
    { slug: "psalms", chapter: 16, verse: 11 },
    { slug: "romans", chapter: 14, verse: 17 },
    { slug: "james", chapter: 1, verse: 2 },
    { slug: "john", chapter: 16, verse: 24 },
  ],
  grace: [
    { slug: "john", chapter: 1, verse: 16 },
    { slug: "romans", chapter: 3, verse: 24 },
    { slug: "2-corinthians", chapter: 12, verse: 9 },
    { slug: "ephesians", chapter: 1, verse: 7 },
    { slug: "titus", chapter: 2, verse: 11 },
  ],
};

export function getPopularVerseRefsForKeyword(keyword: string): PopularVerseRef[] {
  const k = keyword.trim().toLowerCase();
  if (!k) return [];
  const list = POPULAR_KEYWORD_VERSES[k];
  return list ? list.slice(0, POPULAR_KEYWORD_VERSE_CAP) : [];
}

export function keywordHasPopularVerses(keyword: string): boolean {
  return getPopularVerseRefsForKeyword(keyword).length > 0;
}
