import type { PopularVerseRef } from "./search-keyword-popular";

export const STRONGS_INDEX_VERSE_CAP = 5;

export type StrongsPrefix = "G" | "H";

export type StrongsQuery = {
  prefix: StrongsPrefix;
  number: number;
  id: string;
};

export type StrongsIndexHit = StrongsQuery & {
  gloss: string;
  refs: PopularVerseRef[];
};

const STRONGS_INDEX: Record<string, { gloss: string; refs: PopularVerseRef[] }> = {
  G26: {
    gloss: "agape",
    refs: [
      { slug: "1-john", chapter: 4, verse: 8 },
      { slug: "john", chapter: 3, verse: 16 },
      { slug: "1-corinthians", chapter: 13, verse: 4 },
      { slug: "romans", chapter: 5, verse: 8 },
      { slug: "john", chapter: 15, verse: 13 },
    ],
  },
  G4102: {
    gloss: "pistis",
    refs: [
      { slug: "hebrews", chapter: 11, verse: 1 },
      { slug: "ephesians", chapter: 2, verse: 8 },
      { slug: "romans", chapter: 10, verse: 17 },
      { slug: "james", chapter: 2, verse: 17 },
      { slug: "galatians", chapter: 2, verse: 16 },
    ],
  },
  G5485: {
    gloss: "charis",
    refs: [
      { slug: "ephesians", chapter: 2, verse: 8 },
      { slug: "john", chapter: 1, verse: 16 },
      { slug: "2-corinthians", chapter: 12, verse: 9 },
      { slug: "romans", chapter: 3, verse: 24 },
      { slug: "titus", chapter: 2, verse: 11 },
    ],
  },
  G5547: {
    gloss: "Christos",
    refs: [
      { slug: "matthew", chapter: 16, verse: 16 },
      { slug: "john", chapter: 1, verse: 41 },
      { slug: "acts", chapter: 2, verse: 36 },
      { slug: "philippians", chapter: 2, verse: 11 },
      { slug: "1-john", chapter: 2, verse: 22 },
    ],
  },
  G2424: {
    gloss: "Iesous",
    refs: [
      { slug: "matthew", chapter: 1, verse: 21 },
      { slug: "acts", chapter: 4, verse: 12 },
      { slug: "philippians", chapter: 2, verse: 10 },
      { slug: "john", chapter: 14, verse: 6 },
      { slug: "hebrews", chapter: 12, verse: 2 },
    ],
  },
  G4151: {
    gloss: "pneuma",
    refs: [
      { slug: "john", chapter: 14, verse: 26 },
      { slug: "acts", chapter: 1, verse: 8 },
      { slug: "galatians", chapter: 5, verse: 22 },
      { slug: "romans", chapter: 8, verse: 26 },
      { slug: "acts", chapter: 2, verse: 4 },
    ],
  },
  G3056: {
    gloss: "logos",
    refs: [
      { slug: "john", chapter: 1, verse: 1 },
      { slug: "hebrews", chapter: 4, verse: 12 },
      { slug: "john", chapter: 1, verse: 14 },
      { slug: "1-peter", chapter: 1, verse: 23 },
      { slug: "revelation", chapter: 19, verse: 13 },
    ],
  },
  G266: {
    gloss: "hamartia",
    refs: [
      { slug: "romans", chapter: 3, verse: 23 },
      { slug: "romans", chapter: 6, verse: 23 },
      { slug: "1-john", chapter: 1, verse: 9 },
      { slug: "james", chapter: 4, verse: 17 },
      { slug: "isaiah", chapter: 53, verse: 6 },
    ],
  },
  G1680: {
    gloss: "elpis",
    refs: [
      { slug: "romans", chapter: 15, verse: 13 },
      { slug: "hebrews", chapter: 6, verse: 19 },
      { slug: "romans", chapter: 8, verse: 24 },
      { slug: "1-peter", chapter: 1, verse: 3 },
      { slug: "psalms", chapter: 39, verse: 7 },
    ],
  },
  G1515: {
    gloss: "eirene",
    refs: [
      { slug: "john", chapter: 14, verse: 27 },
      { slug: "philippians", chapter: 4, verse: 7 },
      { slug: "romans", chapter: 5, verse: 1 },
      { slug: "isaiah", chapter: 26, verse: 3 },
      { slug: "colossians", chapter: 3, verse: 15 },
    ],
  },
  H3068: {
    gloss: "YHWH",
    refs: [
      { slug: "exodus", chapter: 3, verse: 14 },
      { slug: "deuteronomy", chapter: 6, verse: 4 },
      { slug: "psalms", chapter: 23, verse: 1 },
      { slug: "isaiah", chapter: 42, verse: 8 },
      { slug: "psalms", chapter: 83, verse: 18 },
    ],
  },
  H430: {
    gloss: "Elohim",
    refs: [
      { slug: "genesis", chapter: 1, verse: 1 },
      { slug: "deuteronomy", chapter: 6, verse: 4 },
      { slug: "psalms", chapter: 19, verse: 1 },
      { slug: "isaiah", chapter: 45, verse: 5 },
      { slug: "exodus", chapter: 20, verse: 2 },
    ],
  },
  H2617: {
    gloss: "chesed",
    refs: [
      { slug: "psalms", chapter: 136, verse: 1 },
      { slug: "lamentations", chapter: 3, verse: 22 },
      { slug: "micah", chapter: 6, verse: 8 },
      { slug: "psalms", chapter: 23, verse: 6 },
      { slug: "exodus", chapter: 34, verse: 6 },
    ],
  },
  H7225: {
    gloss: "reshith",
    refs: [
      { slug: "genesis", chapter: 1, verse: 1 },
      { slug: "proverbs", chapter: 8, verse: 22 },
      { slug: "john", chapter: 1, verse: 1 },
      { slug: "colossians", chapter: 1, verse: 16 },
      { slug: "hebrews", chapter: 11, verse: 3 },
    ],
  },
  H8451: {
    gloss: "torah",
    refs: [
      { slug: "psalms", chapter: 19, verse: 7 },
      { slug: "psalms", chapter: 119, verse: 97 },
      { slug: "joshua", chapter: 1, verse: 8 },
      { slug: "deuteronomy", chapter: 6, verse: 6 },
      { slug: "psalms", chapter: 119, verse: 105 },
    ],
  },
};

/**
 * Parse a Strong’s number query. Digit-only `26` / `316` is not Strong’s.
 * Accepts `G26`, `H7225`, `strong:g26`, `strongs:H430`.
 */
export function parseStrongsQuery(raw: string): StrongsQuery | null {
  const q = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!q) return null;
  const match = q.match(/^(?:strongs?:)?([gh])(\d{1,5})$/);
  if (!match) return null;
  const prefix = match[1]!.toUpperCase() as StrongsPrefix;
  const number = Number(match[2]);
  if (!Number.isInteger(number) || number < 1) return null;
  return { prefix, number, id: `${prefix}${number}` };
}

export function lookupStrongsQuery(raw: string): StrongsIndexHit | null {
  const parsed = parseStrongsQuery(raw);
  if (!parsed) return null;
  const entry = STRONGS_INDEX[parsed.id];
  if (!entry) {
    return { ...parsed, gloss: "", refs: [] };
  }
  return {
    ...parsed,
    gloss: entry.gloss,
    refs: entry.refs.slice(0, STRONGS_INDEX_VERSE_CAP),
  };
}

export function formatStrongsLabel(hit: StrongsIndexHit): string {
  return hit.gloss ? `${hit.id} · ${hit.gloss}` : hit.id;
}
