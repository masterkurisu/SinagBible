import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "sb:journal:carousel-settings";

export type CarouselRotationInterval =
  | "10s"
  | "30s"
  | "1m"
  | "5m"
  | "30m"
  | "1h"
  | "daily";

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

export const DEFAULT_JOURNAL_CAROUSEL_SETTINGS: JournalCarouselSettings = {
  randomize: false,
  randomizeFavorites: true,
  shuffleDefaultsDaily: true,
  verseCount: 20,
  rotationInterval: "daily",
};

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

  return {
    randomize: raw.randomize ?? DEFAULT_JOURNAL_CAROUSEL_SETTINGS.randomize,
    randomizeFavorites:
      raw.randomizeFavorites ?? DEFAULT_JOURNAL_CAROUSEL_SETTINGS.randomizeFavorites,
    shuffleDefaultsDaily:
      raw.shuffleDefaultsDaily ?? DEFAULT_JOURNAL_CAROUSEL_SETTINGS.shuffleDefaultsDaily,
    verseCount: clampVerseCount(raw.verseCount ?? DEFAULT_JOURNAL_CAROUSEL_SETTINGS.verseCount),
    rotationInterval: interval,
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

export async function loadJournalCarouselSettings(): Promise<JournalCarouselSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_JOURNAL_CAROUSEL_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<JournalCarouselSettings>;
    return normalizeSettings(parsed);
  } catch {
    return { ...DEFAULT_JOURNAL_CAROUSEL_SETTINGS };
  }
}

export async function saveJournalCarouselSettings(
  settings: JournalCarouselSettings,
): Promise<JournalCarouselSettings> {
  const next = normalizeSettings(settings);
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
  return saveJournalCarouselSettings({ ...current, ...patch });
}
