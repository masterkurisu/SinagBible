/** Stable cache/API bucket for carousel background images. */
export type CarouselImageCategory =
  | "psalms-proverbs"
  | "gospels"
  | "revelation"
  | "epistles"
  | "ot-narrative"
  | "daily-verse"
  | "default";

const PSALMS_PROVERBS_SLUGS = new Set(["psalm", "psalms", "proverbs"]);
const GOSPEL_SLUGS = new Set(["matthew", "mark", "luke", "john"]);
const EPISTLE_SLUGS = new Set([
  "romans",
  "1-corinthians",
  "2-corinthians",
  "galatians",
  "ephesians",
  "philippians",
  "colossians",
  "1-thessalonians",
  "2-thessalonians",
  "1-timothy",
  "2-timothy",
  "titus",
  "philemon",
  "hebrews",
  "james",
  "1-peter",
  "2-peter",
  "1-john",
  "2-john",
  "3-john",
  "jude",
]);
const OT_NARRATIVE_SLUGS = new Set([
  "genesis",
  "exodus",
  "joshua",
  "judges",
  "ruth",
  "1-samuel",
  "2-samuel",
  "1-kings",
  "2-kings",
  "1-chronicles",
  "2-chronicles",
  "ezra",
  "nehemiah",
  "esther",
  "jonah",
]);

/** Multiple keywords per category — picked per verse for wider color variety. */
const KEYWORDS_BY_CATEGORY: Record<CarouselImageCategory, readonly string[]> = {
  "psalms-proverbs": [
    "misty mountain landscape",
    "forest river reflection",
    "alpine meadow clouds",
    "pine forest fog",
  ],
  gospels: [
    "calm ocean horizon",
    "green rolling hills",
    "peaceful lake mist",
    "coastal cliffs water",
  ],
  revelation: [
    "dramatic storm clouds",
    "lightning sky dark",
    "volcanic landscape",
    "thunderclouds mountain",
  ],
  epistles: [
    "serene lake mountains",
    "quiet river valley",
    "meadow wildflowers",
    "foggy morning field",
  ],
  "ot-narrative": [
    "desert sand dunes",
    "canyon rock formations",
    "arid landscape",
    "rocky desert valley",
  ],
  "daily-verse": [
    "soft morning mist",
    "gentle sunrise over water",
    "misty valley dawn",
    "peaceful dawn clouds",
  ],
  default: [
    "nature landscape green",
    "mountain lake reflection",
    "forest path morning",
    "ocean waves coastline",
  ],
};

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getCarouselImageCategoryForBookSlug(bookSlug: string): CarouselImageCategory {
  const slug = bookSlug.trim().toLowerCase();
  if (PSALMS_PROVERBS_SLUGS.has(slug)) return "psalms-proverbs";
  if (GOSPEL_SLUGS.has(slug)) return "gospels";
  if (slug === "revelation") return "revelation";
  if (EPISTLE_SLUGS.has(slug)) return "epistles";
  if (OT_NARRATIVE_SLUGS.has(slug)) return "ot-narrative";
  return "default";
}

export function getPexelsSearchKeywords(category: CarouselImageCategory): readonly string[] {
  return KEYWORDS_BY_CATEGORY[category];
}

/** Stable keyword per verse — same card keeps the same search theme across sessions. */
export function getPexelsSearchKeywordForVerse(
  category: CarouselImageCategory,
  verseId: string,
): string {
  const keywords = KEYWORDS_BY_CATEGORY[category];
  return keywords[hashSeed(verseId) % keywords.length]!;
}

export function getPexelsSearchKeyword(category: CarouselImageCategory): string {
  return KEYWORDS_BY_CATEGORY[category][0]!;
}

export function keywordPoolStorageSlug(keyword: string): string {
  return keyword.toLowerCase().replace(/\s+/g, "-");
}
