/** User-selectable Pexels search theme for carousel card backgrounds. */
export type CarouselImageTheme =
  | "auto"
  | "mountains"
  | "nature"
  | "trees"
  | "fields"
  | "stars"
  | "oceans"
  | "rivers"
  | "leaves"
  | "grass"
  | "gradient"
  | "light-gradient"
  | "simple";

export const CAROUSEL_IMAGE_THEME_OPTIONS: {
  value: CarouselImageTheme;
  label: string;
}[] = [
  { value: "auto", label: "Auto (match verse)" },
  { value: "mountains", label: "Mountains" },
  { value: "nature", label: "Nature" },
  { value: "trees", label: "Trees" },
  { value: "fields", label: "Fields" },
  { value: "stars", label: "Stars" },
  { value: "oceans", label: "Oceans" },
  { value: "rivers", label: "Rivers" },
  { value: "leaves", label: "Leaves" },
  { value: "grass", label: "Grass" },
  { value: "gradient", label: "Gradient" },
  { value: "light-gradient", label: "Light gradient" },
  { value: "simple", label: "Simple (solid color)" },
];

export const DEFAULT_CAROUSEL_IMAGE_THEME: CarouselImageTheme = "auto";

const NON_PEXELS_THEMES = new Set<CarouselImageTheme>([
  "auto",
  "gradient",
  "light-gradient",
  "simple",
]);

const PEXELS_KEYWORDS_BY_THEME: Record<
  Exclude<CarouselImageTheme, "auto" | "gradient" | "light-gradient" | "simple">,
  readonly string[]
> = {
  mountains: [
    "misty mountain landscape",
    "snow capped mountain peaks",
    "mountain range sunset",
    "alpine mountain vista",
  ],
  nature: [
    "nature landscape green",
    "scenic wilderness landscape",
    "natural landscape horizon",
    "peaceful nature scenery",
  ],
  trees: [
    "forest trees canopy",
    "pine forest path",
    "autumn trees landscape",
    "tall trees sunlight",
  ],
  fields: [
    "rolling field meadow",
    "wheat field golden",
    "open meadow wildflowers",
    "green field countryside",
  ],
  stars: [
    "starry night sky",
    "milky way night sky",
    "stars galaxy sky",
    "night sky stars landscape",
  ],
  oceans: [
    "calm ocean horizon",
    "ocean waves coastline",
    "tropical ocean water",
    "deep blue ocean aerial",
  ],
  rivers: [
    "river flowing landscape",
    "forest river reflection",
    "mountain river valley",
    "peaceful river morning",
  ],
  leaves: [
    "autumn leaves closeup",
    "fall foliage leaves",
    "green leaves sunlight",
    "forest leaves ground",
  ],
  grass: [
    "green grass meadow",
    "grass field morning dew",
    "tall grass field sunlight",
    "lush grass landscape",
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

export function normalizeCarouselImageTheme(value: unknown): CarouselImageTheme {
  if (
    typeof value === "string" &&
    CAROUSEL_IMAGE_THEME_OPTIONS.some((option) => option.value === value)
  ) {
    return value as CarouselImageTheme;
  }
  return DEFAULT_CAROUSEL_IMAGE_THEME;
}

export function getCarouselImageThemeLabel(theme: CarouselImageTheme): string {
  return CAROUSEL_IMAGE_THEME_OPTIONS.find((option) => option.value === theme)?.label ?? "Auto";
}

export function isPexelsCarouselImageTheme(
  theme: CarouselImageTheme,
): theme is Exclude<CarouselImageTheme, "auto" | "gradient" | "light-gradient" | "simple"> {
  return !NON_PEXELS_THEMES.has(theme);
}

export function usesCarouselPhotoBackground(theme: CarouselImageTheme): boolean {
  return theme === "auto" || isPexelsCarouselImageTheme(theme);
}

export function isCarouselGradientTheme(theme: CarouselImageTheme): boolean {
  return theme === "gradient" || theme === "light-gradient";
}

export function isCarouselLightBackgroundTheme(theme: CarouselImageTheme): boolean {
  return theme === "light-gradient" || theme === "simple";
}

export function getPexelsKeywordsForImageTheme(
  theme: CarouselImageTheme,
): readonly string[] | null {
  if (!isPexelsCarouselImageTheme(theme)) return null;
  return PEXELS_KEYWORDS_BY_THEME[theme];
}

export function getPexelsSearchKeywordForImageTheme(
  theme: CarouselImageTheme,
  verseId: string,
): string | null {
  const keywords = getPexelsKeywordsForImageTheme(theme);
  if (!keywords) return null;
  return keywords[hashSeed(verseId) % keywords.length]!;
}

export function carouselImageThemeStorageSlug(theme: CarouselImageTheme): string {
  return theme;
}
