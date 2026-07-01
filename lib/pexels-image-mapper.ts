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

const KEYWORD_BY_CATEGORY: Record<CarouselImageCategory, string> = {
  "psalms-proverbs": "mountains nature",
  gospels: "sunrise golden light",
  revelation: "dramatic storm clouds sky",
  epistles: "calm lake peaceful",
  "ot-narrative": "desert landscape",
  "daily-verse": "golden light dawn",
  default: "nature landscape",
};

export function getCarouselImageCategoryForBookSlug(bookSlug: string): CarouselImageCategory {
  const slug = bookSlug.trim().toLowerCase();
  if (PSALMS_PROVERBS_SLUGS.has(slug)) return "psalms-proverbs";
  if (GOSPEL_SLUGS.has(slug)) return "gospels";
  if (slug === "revelation") return "revelation";
  if (EPISTLE_SLUGS.has(slug)) return "epistles";
  if (OT_NARRATIVE_SLUGS.has(slug)) return "ot-narrative";
  return "default";
}

export function getPexelsSearchKeyword(category: CarouselImageCategory): string {
  return KEYWORD_BY_CATEGORY[category];
}
