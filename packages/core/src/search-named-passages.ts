import type { PopularVerseRef } from "./search-keyword-popular";

/** Canonical ref for a well-known passage name (English slugs, 1-based chapter & verse). */
export type NamedPassageRef = PopularVerseRef;

function normalizeNamedPassageKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[''´`]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/^the\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** ~50 familiar passage names → anchor verse for search. */
const NAMED_PASSAGE_ENTRIES: readonly { keys: string[]; ref: NamedPassageRef }[] = [
  { keys: ["lords prayer", "our father", "the lords prayer"], ref: { slug: "matthew", chapter: 6, verse: 9 } },
  { keys: ["beatitudes", "sermon on the mount"], ref: { slug: "matthew", chapter: 5, verse: 3 } },
  { keys: ["great commission"], ref: { slug: "matthew", chapter: 28, verse: 19 } },
  { keys: ["armor of god", "armour of god", "whole armor of god", "shield of faith"], ref: { slug: "ephesians", chapter: 6, verse: 10 } },
  { keys: ["23rd psalm", "psalm 23", "shepherds psalm", "valley of the shadow", "the lord is my shepherd"], ref: { slug: "psalms", chapter: 23, verse: 1 } },
  { keys: ["ten commandments", "decalogue"], ref: { slug: "exodus", chapter: 20, verse: 1 } },
  { keys: ["fruit of the spirit"], ref: { slug: "galatians", chapter: 5, verse: 22 } },
  { keys: ["golden rule"], ref: { slug: "matthew", chapter: 7, verse: 12 } },
  { keys: ["prodigal son"], ref: { slug: "luke", chapter: 15, verse: 11 } },
  { keys: ["good samaritan"], ref: { slug: "luke", chapter: 10, verse: 25 } },
  { keys: ["last supper", "lords supper"], ref: { slug: "matthew", chapter: 26, verse: 26 } },
  { keys: ["love chapter", "love is patient"], ref: { slug: "1-corinthians", chapter: 13, verse: 4 } },
  { keys: ["faith chapter", "hall of faith", "heroes of faith"], ref: { slug: "hebrews", chapter: 11, verse: 1 } },
  { keys: ["romans road"], ref: { slug: "romans", chapter: 3, verse: 23 } },
  { keys: ["creation story", "in the beginning"], ref: { slug: "genesis", chapter: 1, verse: 1 } },
  { keys: ["fall of man", "original sin"], ref: { slug: "genesis", chapter: 3, verse: 1 } },
  { keys: ["noahs ark", "noah's ark"], ref: { slug: "genesis", chapter: 6, verse: 14 } },
  { keys: ["burning bush"], ref: { slug: "exodus", chapter: 3, verse: 2 } },
  { keys: ["parting of the red sea", "red sea crossing"], ref: { slug: "exodus", chapter: 14, verse: 21 } },
  { keys: ["ten plagues"], ref: { slug: "exodus", chapter: 7, verse: 1 } },
  { keys: ["david and goliath"], ref: { slug: "1-samuel", chapter: 17, verse: 45 } },
  { keys: ["daniel in the lions den", "lions den"], ref: { slug: "daniel", chapter: 6, verse: 16 } },
  { keys: ["fiery furnace"], ref: { slug: "daniel", chapter: 3, verse: 17 } },
  { keys: ["jonah and the whale", "jonah and the fish"], ref: { slug: "jonah", chapter: 1, verse: 17 } },
  { keys: ["birth of jesus", "nativity"], ref: { slug: "luke", chapter: 2, verse: 7 } },
  { keys: ["crucifixion"], ref: { slug: "matthew", chapter: 27, verse: 45 } },
  { keys: ["resurrection", "empty tomb"], ref: { slug: "matthew", chapter: 28, verse: 6 } },
  { keys: ["pentecost"], ref: { slug: "acts", chapter: 2, verse: 1 } },
  { keys: ["pauls conversion", "road to damascus"], ref: { slug: "acts", chapter: 9, verse: 3 } },
  { keys: ["love your neighbor"], ref: { slug: "leviticus", chapter: 19, verse: 18 } },
  { keys: ["magnificat", "marys song"], ref: { slug: "luke", chapter: 1, verse: 46 } },
  { keys: ["proverbs 31 woman", "virtuous woman"], ref: { slug: "proverbs", chapter: 31, verse: 10 } },
  { keys: ["vanity of vanities"], ref: { slug: "ecclesiastes", chapter: 1, verse: 2 } },
  { keys: ["parable of the sower"], ref: { slug: "matthew", chapter: 13, verse: 3 } },
  { keys: ["wheat and tares"], ref: { slug: "matthew", chapter: 13, verse: 24 } },
  { keys: ["wise and foolish builders"], ref: { slug: "matthew", chapter: 7, verse: 24 } },
  { keys: ["binding of isaac", "abrahams sacrifice"], ref: { slug: "genesis", chapter: 22, verse: 1 } },
  { keys: ["tower of babel"], ref: { slug: "genesis", chapter: 11, verse: 1 } },
  { keys: ["walking on water"], ref: { slug: "matthew", chapter: 14, verse: 25 } },
  { keys: ["feeding the five thousand", "feeding 5000"], ref: { slug: "matthew", chapter: 14, verse: 19 } },
  { keys: ["sermon on the plain"], ref: { slug: "luke", chapter: 6, verse: 20 } },
  { keys: ["beatitudes sermon"], ref: { slug: "matthew", chapter: 5, verse: 3 } },
  { keys: ["lords prayer matthew"], ref: { slug: "matthew", chapter: 6, verse: 9 } },
  { keys: ["new commandment"], ref: { slug: "john", chapter: 13, verse: 34 } },
  { keys: ["great commandment"], ref: { slug: "matthew", chapter: 22, verse: 37 } },
  { keys: ["shepherds and angels"], ref: { slug: "luke", chapter: 2, verse: 8 } },
  { keys: ["beatitudes mount"], ref: { slug: "matthew", chapter: 5, verse: 1 } },
  { keys: ["womens scripture", "virtuous woman proverbs"], ref: { slug: "proverbs", chapter: 31, verse: 10 } },
  { keys: ["armor of light"], ref: { slug: "romans", chapter: 13, verse: 12 } },
  { keys: ["armour of light"], ref: { slug: "romans", chapter: 13, verse: 12 } },
  { keys: ["beatitudes blessing"], ref: { slug: "matthew", chapter: 5, verse: 4 } },
  { keys: ["peacemakers beatitude"], ref: { slug: "matthew", chapter: 5, verse: 9 } },
  { keys: ["salt and light"], ref: { slug: "matthew", chapter: 5, verse: 13 } },
  { keys: ["lords prayer luke"], ref: { slug: "luke", chapter: 11, verse: 2 } },
];

const NAMED_PASSAGE_LOOKUP: ReadonlyMap<string, NamedPassageRef> = (() => {
  const map = new Map<string, NamedPassageRef>();
  for (const entry of NAMED_PASSAGE_ENTRIES) {
    for (const key of entry.keys) {
      map.set(normalizeNamedPassageKey(key), entry.ref);
    }
  }
  return map;
})();

/** Resolve a user query to a named passage anchor verse, if recognized. */
export function lookupNamedPassage(query: string): NamedPassageRef | null {
  const key = normalizeNamedPassageKey(query);
  if (!key) return null;
  return NAMED_PASSAGE_LOOKUP.get(key) ?? null;
}
