import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_CAROUSEL_DEFAULT_CARD_SIZE,
  clearCarouselCardSizes,
  normalizeCarouselDefaultCardSize,
  type CarouselDefaultCardSize,
} from "@/lib/journal-carousel-card-sizes";
import {
  DEFAULT_CAROUSEL_IMAGE_THEME,
  normalizeCarouselImageTheme,
  type CarouselImageTheme,
} from "@/lib/carousel-image-themes";

const STORAGE_KEY = "sb:journal:carousel-settings";

export type CarouselRotationInterval =
  | "10s"
  | "30s"
  | "1m"
  | "5m"
  | "30m"
  | "1h"
  | "daily";

export type CarouselImageRefreshInterval = CarouselRotationInterval | "never";

export type JournalCarouselSettings = {
  randomize: boolean;
  /** When randomize is on — include user favorites in the shuffled pool. */
  randomizeFavorites: boolean;
  /** Reshuffle default fallback verses once per calendar day. */
  shuffleDefaultsDaily: boolean;
  /** How many verse cards to show (1–20). Used when randomize is off. */
  verseCount: number;
  /** How often the visible favorites rotate. Used when randomize is off. */
  rotationInterval: CarouselRotationInterval;
  /** How often carousel card backgrounds automatically refresh. */
  imageRefreshInterval: CarouselImageRefreshInterval;
  /** Pexels search theme for carousel backgrounds. */
  imageTheme: CarouselImageTheme;
  /** Default card width preset — changing this clears all per-verse overrides. */
  defaultCardSize: CarouselDefaultCardSize;
};

export const JOURNAL_CAROUSEL_MIN_VERSE_COUNT = 1;
export const JOURNAL_CAROUSEL_MAX_VERSE_COUNT = 20;

export const CAROUSEL_ROTATION_INTERVAL_OPTIONS: {
  value: CarouselRotationInterval;
  label: string;
}[] = [
  { value: "10s", label: "10 seconds" },
  { value: "30s", label: "30 seconds" },
  { value: "1m", label: "1 minute" },
  { value: "5m", label: "5 minutes" },
  { value: "30m", label: "30 minutes" },
  { value: "1h", label: "Hourly" },
  { value: "daily", label: "Daily" },
];

export const CAROUSEL_ROTATION_INTERVAL_MS: Record<CarouselRotationInterval, number> = {
  "10s": 10_000,
  "30s": 30_000,
  "1m": 60_000,
  "5m": 300_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  daily: 86_400_000,
};

export const CAROUSEL_IMAGE_REFRESH_INTERVAL_OPTIONS: {
  value: CarouselImageRefreshInterval;
  label: string;
}[] = [
  { value: "never", label: "Manual only" },
  ...CAROUSEL_ROTATION_INTERVAL_OPTIONS,
];

export const CAROUSEL_IMAGE_REFRESH_INTERVAL_MS: Record<CarouselRotationInterval, number> =
  CAROUSEL_ROTATION_INTERVAL_MS;

export const DEFAULT_JOURNAL_CAROUSEL_SETTINGS: JournalCarouselSettings = {
  randomize: false,
  randomizeFavorites: true,
  shuffleDefaultsDaily: true,
  verseCount: 20,
  rotationInterval: "daily",
  imageRefreshInterval: "never",
  imageTheme: DEFAULT_CAROUSEL_IMAGE_THEME,
  defaultCardSize: DEFAULT_CAROUSEL_DEFAULT_CARD_SIZE,
};

/** Updated on load/save so carousel hooks can hydrate theme without waiting on AsyncStorage. */
let memoryCarouselSettings: JournalCarouselSettings | null = null;

const listeners = new Set<(settings: JournalCarouselSettings) => void>();

function clampVerseCount(count: number): number {
  return Math.min(
    JOURNAL_CAROUSEL_MAX_VERSE_COUNT,
    Math.max(JOURNAL_CAROUSEL_MIN_VERSE_COUNT, Math.round(count)),
  );
}

function normalizeSettings(raw: Partial<JournalCarouselSettings>): JournalCarouselSettings {
  const interval = CAROUSEL_ROTATION_INTERVAL_OPTIONS.some((o) => o.value === raw.rotationInterval)
    ? raw.rotationInterval!
    : DEFAULT_JOURNAL_CAROUSEL_SETTINGS.rotationInterval;

  const imageRefreshInterval = CAROUSEL_IMAGE_REFRESH_INTERVAL_OPTIONS.some(
    (o) => o.value === raw.imageRefreshInterval,
  )
    ? raw.imageRefreshInterval!
    : DEFAULT_JOURNAL_CAROUSEL_SETTINGS.imageRefreshInterval;

  return {
    randomize: raw.randomize ?? DEFAULT_JOURNAL_CAROUSEL_SETTINGS.randomize,
    randomizeFavorites:
      raw.randomizeFavorites ?? DEFAULT_JOURNAL_CAROUSEL_SETTINGS.randomizeFavorites,
    shuffleDefaultsDaily:
      raw.shuffleDefaultsDaily ?? DEFAULT_JOURNAL_CAROUSEL_SETTINGS.shuffleDefaultsDaily,
    verseCount: clampVerseCount(raw.verseCount ?? DEFAULT_JOURNAL_CAROUSEL_SETTINGS.verseCount),
    rotationInterval: interval,
    imageRefreshInterval,
    imageTheme: normalizeCarouselImageTheme(raw.imageTheme),
    defaultCardSize: normalizeCarouselDefaultCardSize(raw.defaultCardSize),
  };
}

function notifyListeners(settings: JournalCarouselSettings) {
  for (const listener of listeners) {
    listener(settings);
  }
}

export function subscribeJournalCarouselSettings(
  listener: (settings: JournalCarouselSettings) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Synchronous snapshot (null before first load/save this session). */
export function peekJournalCarouselSettings(): JournalCarouselSettings | null {
  return memoryCarouselSettings;
}

export function peekJournalCarouselImageTheme(): CarouselImageTheme {
  return memoryCarouselSettings?.imageTheme ?? DEFAULT_CAROUSEL_IMAGE_THEME;
}

export async function loadJournalCarouselSettings(): Promise<JournalCarouselSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaults = { ...DEFAULT_JOURNAL_CAROUSEL_SETTINGS };
      memoryCarouselSettings = defaults;
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<JournalCarouselSettings>;
    const next = normalizeSettings(parsed);
    memoryCarouselSettings = next;
    return next;
  } catch {
    const defaults = { ...DEFAULT_JOURNAL_CAROUSEL_SETTINGS };
    memoryCarouselSettings = defaults;
    return defaults;
  }
}

export async function saveJournalCarouselSettings(
  settings: JournalCarouselSettings,
): Promise<JournalCarouselSettings> {
  const next = normalizeSettings(settings);
  memoryCarouselSettings = next;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notifyListeners(next);
  return next;
}

export async function patchJournalCarouselSettings(
  patch: Partial<JournalCarouselSettings>,
): Promise<JournalCarouselSettings> {
  const current = await loadJournalCarouselSettings();
  if (
    patch.defaultCardSize != null &&
    patch.defaultCardSize !== current.defaultCardSize
  ) {
    await clearCarouselCardSizes();
  }
  return saveJournalCarouselSettings({ ...current, ...patch });
}

export type { CarouselImageTheme } from "@/lib/carousel-image-themes";
export {
  CAROUSEL_IMAGE_THEME_OPTIONS,
  DEFAULT_CAROUSEL_IMAGE_THEME,
  getCarouselImageThemeLabel,
} from "@/lib/carousel-image-themes";
export type { CarouselCardSize, CarouselDefaultCardSize } from "@/lib/journal-carousel-card-sizes";
export {
  CAROUSEL_CARD_SIZE_OPTIONS,
  CAROUSEL_DEFAULT_CARD_SIZE_OPTIONS,
  getCarouselCardSizeLabel,
  getCarouselDefaultCardSizeLabel,
} from "@/lib/journal-carousel-card-sizes";
