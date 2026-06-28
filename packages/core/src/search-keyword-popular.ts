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

/** Per-book keyword cap for curated / high-frequency theological terms (default vague cap is 1). */
export const POPULAR_KEYWORD_MAX_PER_BOOK = 3;

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
  salvation: [
    { slug: "romans", chapter: 10, verse: 9 },
    { slug: "ephesians", chapter: 2, verse: 8 },
    { slug: "acts", chapter: 4, verse: 12 },
    { slug: "titus", chapter: 3, verse: 5 },
    { slug: "john", chapter: 14, verse: 6 },
  ],
  anxiety: [
    { slug: "philippians", chapter: 4, verse: 6 },
    { slug: "matthew", chapter: 6, verse: 34 },
    { slug: "1-peter", chapter: 5, verse: 7 },
    { slug: "isaiah", chapter: 41, verse: 10 },
    { slug: "psalms", chapter: 55, verse: 22 },
  ],
  worry: [
    { slug: "philippians", chapter: 4, verse: 6 },
    { slug: "matthew", chapter: 6, verse: 34 },
    { slug: "1-peter", chapter: 5, verse: 7 },
    { slug: "isaiah", chapter: 41, verse: 10 },
    { slug: "psalms", chapter: 55, verse: 22 },
  ],
  strength: [
    { slug: "philippians", chapter: 4, verse: 13 },
    { slug: "isaiah", chapter: 40, verse: 31 },
    { slug: "psalms", chapter: 28, verse: 7 },
    { slug: "2-corinthians", chapter: 12, verse: 9 },
    { slug: "nehemiah", chapter: 8, verse: 10 },
  ],
  prayer: [
    { slug: "matthew", chapter: 6, verse: 9 },
    { slug: "1-thessalonians", chapter: 5, verse: 17 },
    { slug: "james", chapter: 5, verse: 16 },
    { slug: "philippians", chapter: 4, verse: 6 },
    { slug: "luke", chapter: 18, verse: 1 },
  ],
  light: [
    { slug: "john", chapter: 8, verse: 12 },
    { slug: "matthew", chapter: 5, verse: 14 },
    { slug: "psalms", chapter: 27, verse: 1 },
    { slug: "1-john", chapter: 1, verse: 5 },
    { slug: "isaiah", chapter: 9, verse: 2 },
  ],
  truth: [
    { slug: "john", chapter: 14, verse: 6 },
    { slug: "john", chapter: 8, verse: 32 },
    { slug: "psalms", chapter: 119, verse: 160 },
    { slug: "john", chapter: 17, verse: 17 },
    { slug: "3-john", chapter: 1, verse: 4 },
  ],
  sin: [
    { slug: "romans", chapter: 3, verse: 23 },
    { slug: "romans", chapter: 6, verse: 23 },
    { slug: "1-john", chapter: 1, verse: 9 },
    { slug: "james", chapter: 4, verse: 17 },
    { slug: "psalms", chapter: 51, verse: 2 },
  ],
  forgiveness: [
    { slug: "ephesians", chapter: 4, verse: 32 },
    { slug: "matthew", chapter: 6, verse: 14 },
    { slug: "colossians", chapter: 3, verse: 13 },
    { slug: "1-john", chapter: 1, verse: 9 },
    { slug: "luke", chapter: 23, verse: 34 },
  ],
  mercy: [
    { slug: "lamentations", chapter: 3, verse: 22 },
    { slug: "micah", chapter: 6, verse: 8 },
    { slug: "ephesians", chapter: 2, verse: 4 },
    { slug: "psalms", chapter: 23, verse: 6 },
    { slug: "hebrews", chapter: 4, verse: 16 },
  ],
  wisdom: [
    { slug: "james", chapter: 1, verse: 5 },
    { slug: "proverbs", chapter: 3, verse: 5 },
    { slug: "proverbs", chapter: 9, verse: 10 },
    { slug: "ecclesiastes", chapter: 7, verse: 12 },
    { slug: "1-corinthians", chapter: 1, verse: 30 },
  ],
  trust: [
    { slug: "proverbs", chapter: 3, verse: 5 },
    { slug: "psalms", chapter: 56, verse: 3 },
    { slug: "jeremiah", chapter: 17, verse: 7 },
    { slug: "nahum", chapter: 1, verse: 7 },
    { slug: "isaiah", chapter: 26, verse: 4 },
  ],
  fear: [
    { slug: "isaiah", chapter: 41, verse: 10 },
    { slug: "2-timothy", chapter: 1, verse: 7 },
    { slug: "psalms", chapter: 23, verse: 4 },
    { slug: "1-john", chapter: 4, verse: 18 },
    { slug: "joshua", chapter: 1, verse: 9 },
  ],
  comfort: [
    { slug: "2-corinthians", chapter: 1, verse: 3 },
    { slug: "psalms", chapter: 23, verse: 4 },
    { slug: "isaiah", chapter: 40, verse: 1 },
    { slug: "matthew", chapter: 5, verse: 4 },
    { slug: "john", chapter: 14, verse: 16 },
  ],
  healing: [
    { slug: "james", chapter: 5, verse: 15 },
    { slug: "isaiah", chapter: 53, verse: 5 },
    { slug: "psalms", chapter: 103, verse: 3 },
    { slug: "jeremiah", chapter: 17, verse: 14 },
    { slug: "1-peter", chapter: 2, verse: 24 },
  ],
  patience: [
    { slug: "romans", chapter: 12, verse: 12 },
    { slug: "james", chapter: 1, verse: 3 },
    { slug: "galatians", chapter: 5, verse: 22 },
    { slug: "romans", chapter: 8, verse: 25 },
    { slug: "ecclesiastes", chapter: 7, verse: 8 },
  ],
  blessed: [
    { slug: "matthew", chapter: 5, verse: 3 },
    { slug: "psalms", chapter: 1, verse: 1 },
    { slug: "james", chapter: 1, verse: 12 },
    { slug: "revelation", chapter: 14, verse: 13 },
    { slug: "luke", chapter: 11, verse: 28 },
  ],
  holy: [
    { slug: "leviticus", chapter: 11, verse: 44 },
    { slug: "1-peter", chapter: 1, verse: 16 },
    { slug: "isaiah", chapter: 6, verse: 3 },
    { slug: "romans", chapter: 12, verse: 1 },
    { slug: "hebrews", chapter: 12, verse: 14 },
  ],
  spirit: [
    { slug: "john", chapter: 4, verse: 24 },
    { slug: "galatians", chapter: 5, verse: 22 },
    { slug: "romans", chapter: 8, verse: 16 },
    { slug: "genesis", chapter: 1, verse: 2 },
    { slug: "acts", chapter: 2, verse: 4 },
  ],
  worship: [
    { slug: "john", chapter: 4, verse: 24 },
    { slug: "psalms", chapter: 95, verse: 6 },
    { slug: "romans", chapter: 12, verse: 1 },
    { slug: "hebrews", chapter: 12, verse: 28 },
    { slug: "psalms", chapter: 100, verse: 2 },
  ],
  righteous: [
    { slug: "romans", chapter: 3, verse: 22 },
    { slug: "matthew", chapter: 5, verse: 6 },
    { slug: "1-john", chapter: 3, verse: 7 },
    { slug: "proverbs", chapter: 21, verse: 21 },
    { slug: "2-corinthians", chapter: 5, verse: 21 },
  ],
  eternal: [
    { slug: "john", chapter: 3, verse: 16 },
    { slug: "romans", chapter: 6, verse: 23 },
    { slug: "matthew", chapter: 25, verse: 46 },
    { slug: "2-thessalonians", chapter: 2, verse: 16 },
    { slug: "1-john", chapter: 5, verse: 11 },
  ],
  repent: [
    { slug: "acts", chapter: 3, verse: 19 },
    { slug: "luke", chapter: 13, verse: 3 },
    { slug: "2-corinthians", chapter: 7, verse: 10 },
    { slug: "mark", chapter: 1, verse: 15 },
    { slug: "acts", chapter: 17, verse: 30 },
  ],
  cross: [
    { slug: "galatians", chapter: 6, verse: 14 },
    { slug: "1-corinthians", chapter: 1, verse: 18 },
    { slug: "galatians", chapter: 2, verse: 20 },
    { slug: "philippians", chapter: 2, verse: 8 },
    { slug: "colossians", chapter: 2, verse: 14 },
  ],
  resurrection: [
    { slug: "1-corinthians", chapter: 15, verse: 20 },
    { slug: "john", chapter: 11, verse: 25 },
    { slug: "romans", chapter: 6, verse: 5 },
    { slug: "1-peter", chapter: 1, verse: 3 },
    { slug: "luke", chapter: 24, verse: 6 },
  ],
  kindness: [
    { slug: "ephesians", chapter: 4, verse: 32 },
    { slug: "galatians", chapter: 5, verse: 22 },
    { slug: "colossians", chapter: 3, verse: 12 },
    { slug: "micah", chapter: 6, verse: 8 },
    { slug: "titus", chapter: 3, verse: 4 },
  ],
  courage: [
    { slug: "joshua", chapter: 1, verse: 9 },
    { slug: "deuteronomy", chapter: 31, verse: 6 },
    { slug: "2-timothy", chapter: 1, verse: 7 },
    { slug: "psalms", chapter: 27, verse: 14 },
    { slug: "isaiah", chapter: 41, verse: 10 },
  ],
  bless: [
    { slug: "numbers", chapter: 6, verse: 24 },
    { slug: "psalms", chapter: 67, verse: 1 },
    { slug: "genesis", chapter: 12, verse: 2 },
    { slug: "ephesians", chapter: 1, verse: 3 },
    { slug: "matthew", chapter: 5, verse: 9 },
  ],
  forgive: [
    { slug: "matthew", chapter: 6, verse: 14 },
    { slug: "colossians", chapter: 3, verse: 13 },
    { slug: "ephesians", chapter: 4, verse: 32 },
    { slug: "1-john", chapter: 1, verse: 9 },
    { slug: "luke", chapter: 6, verse: 37 },
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

/** Higher per-book cap for curated / theological keywords so Psalms etc. can surface multiple hits. */
export function getVagueKeywordMaxPerBook(keyword: string): number {
  return keywordHasPopularVerses(keyword) ? POPULAR_KEYWORD_MAX_PER_BOOK : 1;
}
