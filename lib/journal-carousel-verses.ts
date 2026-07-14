import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatPassageReference, formatSelectedReference } from "@sinag-bible/core";
import type { JournalCarouselSettings } from "@/lib/journal-carousel-settings";
import { JOURNAL_CAROUSEL_MAX_VERSE_COUNT } from "@/lib/journal-carousel-settings";
import {
  dailyVerseDayKey,
  formatDailyVerseReference,
  getDailyVerse,
} from "@/lib/daily-verse";
import {
  getCarouselImageCategoryForBookSlug,
  type CarouselImageCategory,
} from "@/lib/pexels-image-mapper";
import type { CarouselImageTheme } from "@/lib/carousel-image-themes";
import {
  resolveCarouselWidthRatio,
  type CarouselCardSize,
  type CarouselDefaultCardSize,
} from "@/lib/journal-carousel-card-sizes";

const STORAGE_KEY = "sb:journal:carousel-verses";

/** Hard cap on user-saved carousel verses (oldest evicted when exceeded). */
export const JOURNAL_CAROUSEL_MAX_FAVORITES = 24;

/** Soft cap on cards rendered in the carousel (favorites + defaults). */
export const JOURNAL_CAROUSEL_DISPLAY_CAP = 20;

export type CarouselVerseRecord = {
  id: string;
  bookSlug: string;
  bookName: string;
  chapter: number;
  verseStart: number;
  verseEnd: number | null;
  text: string;
  translationId: string;
  reference: string;
  addedAt: string;
};

export type CarouselDisplayVerse = {
  id: string;
  reference: string;
  text: string;
  widthRatio: number;
  gradient: readonly [string, string, string];
  /** Pexels search bucket — stable per book category for URL caching. */
  imageCategory: CarouselImageCategory;
  isUserFavorite: boolean;
  /** Reserved first carousel slot — rotates by calendar day. */
  isDailyVerse?: boolean;
  badgeLabel?: string;
};

/** Stable id prefix for the pinned daily-verse carousel card. */
export const DAILY_VERSE_CAROUSEL_ID_PREFIX = "daily-verse:";

const CAROUSEL_GRADIENTS: readonly (readonly [string, string, string])[] = [
  // Warm earth
  ["#5c4f3a", "#4a3826", "#3d3428"],
  ["#6e5f48", "#5a4a36", "#4a3f30"],
  // Forest & moss
  ["#3d5240", "#2f4234", "#243528"],
  ["#4a5c46", "#3a4a36", "#2e3c2c"],
  // Slate & mist
  ["#4a545c", "#3a444c", "#2e363c"],
  ["#5a626a", "#4a5258", "#3c444a"],
  // Teal / ocean
  ["#2e4f54", "#234448", "#1a363a"],
  ["#3a5c60", "#2e4a4e", "#243c40"],
  // Burgundy dusk
  ["#5c3842", "#4a2e36", "#3a242c"],
  // Navy twilight
  ["#3a4258", "#2e3648", "#242c3c"],
  // Soft lavender-gray
  ["#4a4858", "#3e3c4c", "#343240"],
];

const CAROUSEL_LIGHT_GRADIENTS: readonly (readonly [string, string, string])[] = [
  // Warm cream
  ["#fff9f0", "#f5e6cc", "#e8cfaa"],
  ["#fff5e6", "#edd9b8", "#dcc090"],
  // Soft sage
  ["#f2f8ee", "#dcead4", "#c4dbb8"],
  ["#eaf4e6", "#d0e4ca", "#b6d4ae"],
  // Sky
  ["#f0f6fc", "#d4e6f4", "#b8d4ec"],
  ["#eaf2fa", "#c8dff0", "#a8cce8"],
  // Blush
  ["#fdf3f0", "#f4ddd6", "#e8c8be"],
  // Lavender
  ["#f6f2fc", "#e6dcf4", "#d4c6ea"],
  // Golden hour
  ["#fff8e8", "#fce8b8", "#f2d080"],
  // Mist
  ["#f4f6f8", "#e2e8ee", "#ccd6de"],
];

const CAROUSEL_PASTEL_SOLIDS: readonly string[] = [
  "#f9d8e5", // rose
  "#fde4cf", // peach
  "#fff1bf", // butter
  "#d8f3dc", // mint
  "#cce3ff", // sky
  "#e4d4f4", // lavender
  "#ffd6e0", // pink
  "#c8ebe8", // seafoam
  "#f5e6cc", // sand
  "#e2f0d8", // sage
  "#fce8f3", // blush
  "#dbeafe", // powder blue
  "#f3e8ff", // lilac
  "#fef08a", // soft yellow
  "#bbf7d0", // light green
  "#fecdd3", // coral
];

function carouselPastelSolidForVerse(verseId: string, layoutIndex: number): readonly [string, string, string] {
  const paletteIndex = (carouselHashSeed(verseId) + layoutIndex) % CAROUSEL_PASTEL_SOLIDS.length;
  const color = CAROUSEL_PASTEL_SOLIDS[paletteIndex]!;
  return [color, color, color];
}

function carouselHashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function carouselGradientForVerse(id: string, index: number): readonly [string, string, string] {
  const paletteIndex = (carouselHashSeed(id) + index) % CAROUSEL_GRADIENTS.length;
  return CAROUSEL_GRADIENTS[paletteIndex]!;
}

function carouselLightGradientForVerse(id: string, index: number): readonly [string, string, string] {
  const paletteIndex = (carouselHashSeed(id) + index) % CAROUSEL_LIGHT_GRADIENTS.length;
  return CAROUSEL_LIGHT_GRADIENTS[paletteIndex]!;
}

export function getCarouselCardGradient(
  verseId: string,
  layoutIndex: number,
  imageTheme: CarouselImageTheme,
  fallback: readonly [string, string, string],
): readonly [string, string, string] {
  if (imageTheme === "light-gradient") {
    return carouselLightGradientForVerse(verseId, layoutIndex);
  }
  if (imageTheme === "simple") {
    return carouselPastelSolidForVerse(verseId, layoutIndex);
  }
  return fallback;
}

type CarouselCardSizing = {
  overrides: Readonly<Record<string, CarouselCardSize>>;
  defaultCardSize: CarouselDefaultCardSize;
};

const DEFAULT_CAROUSEL_CARD_SIZING: CarouselCardSizing = {
  overrides: {},
  defaultCardSize: "varied",
};

function resolveCardWidthRatio(
  verseId: string,
  layoutIndex: number,
  sizing: CarouselCardSizing,
): number {
  return resolveCarouselWidthRatio(
    verseId,
    layoutIndex,
    sizing.overrides,
    sizing.defaultCardSize,
  );
}

export const DEFAULT_CAROUSEL_VERSES: Omit<CarouselVerseRecord, "addedAt">[] = [
  {
    id: "default:psalm-119-105",
    bookSlug: "psalm",
    bookName: "Psalm",
    chapter: 119,
    verseStart: 105,
    verseEnd: null,
    text: "Your word is a lamp unto my feet and a light unto my path.",
    translationId: "KJV",
    reference: "Psalm 119:105",
  },
  {
    id: "default:psalm-1-2",
    bookSlug: "psalm",
    bookName: "Psalm",
    chapter: 1,
    verseStart: 2,
    verseEnd: null,
    text: "But his delight is in the law of the Lord; and in his law doth he meditate day and night.",
    translationId: "KJV",
    reference: "Psalm 1:2",
  },
  {
    id: "default:joshua-1-8",
    bookSlug: "joshua",
    bookName: "Joshua",
    chapter: 1,
    verseStart: 8,
    verseEnd: null,
    text: "This book of the law shall not depart out of thy mouth; but thou shalt meditate therein day and night.",
    translationId: "KJV",
    reference: "Joshua 1:8",
  },
];

export function carouselVerseId(
  bookSlug: string,
  chapter: number,
  verseStart: number,
  verseEnd: number | null,
): string {
  const end = verseEnd != null && verseEnd !== verseStart ? `-${verseEnd}` : "";
  return `${bookSlug}:${chapter}:${verseStart}${end}`;
}

export function carouselRecordToDisplay(
  record: Pick<CarouselVerseRecord, "id" | "reference" | "text" | "bookSlug">,
  index: number,
  isUserFavorite: boolean,
  options?: { isDailyVerse?: boolean; badgeLabel?: string },
  sizing: CarouselCardSizing = DEFAULT_CAROUSEL_CARD_SIZING,
): CarouselDisplayVerse {
  return {
    id: record.id,
    reference: record.reference,
    text: record.text,
    widthRatio: resolveCardWidthRatio(record.id, index, sizing),
    gradient: carouselGradientForVerse(record.id, index),
    imageCategory: options?.isDailyVerse
      ? "daily-verse"
      : getCarouselImageCategoryForBookSlug(record.bookSlug),
    isUserFavorite,
    isDailyVerse: options?.isDailyVerse,
    badgeLabel: options?.badgeLabel,
  };
}

export function getDailyVerseCarouselDisplay(
  date: Date = new Date(),
  sizing: CarouselCardSizing = DEFAULT_CAROUSEL_CARD_SIZING,
): CarouselDisplayVerse {
  const daily = getDailyVerse(date);
  const dayKey = dailyVerseDayKey(date);
  return {
    id: `${DAILY_VERSE_CAROUSEL_ID_PREFIX}${dayKey}`,
    reference: formatDailyVerseReference(daily.reference),
    text: daily.text,
    widthRatio: resolveCardWidthRatio(`${DAILY_VERSE_CAROUSEL_ID_PREFIX}${dayKey}`, 0, sizing),
    gradient: carouselGradientForVerse(dayKey, 0),
    imageCategory: "daily-verse",
    isUserFavorite: false,
    isDailyVerse: true,
    badgeLabel: "Daily Verse",
  };
}

function normalizeCarouselReference(reference: string): string {
  return reference.toUpperCase().replace(/\s+/g, " ").trim();
}

function matchesDailyVerseReference(reference: string, date: Date = new Date()): boolean {
  const daily = getDailyVerse(date);
  return (
    normalizeCarouselReference(reference) ===
      normalizeCarouselReference(formatDailyVerseReference(daily.reference))
  );
}

function restyleCarouselVerses(
  verses: CarouselDisplayVerse[],
  sizing: CarouselCardSizing = DEFAULT_CAROUSEL_CARD_SIZING,
): CarouselDisplayVerse[] {
  return verses.map((verse, index) => ({
    ...verse,
    widthRatio: resolveCardWidthRatio(verse.id, index + 1, sizing),
    gradient: carouselGradientForVerse(verse.id, index + 1),
  }));
}

function withPinnedDailyVerse(
  verses: CarouselDisplayVerse[],
  date: Date = new Date(),
  sizing: CarouselCardSizing = DEFAULT_CAROUSEL_CARD_SIZING,
): CarouselDisplayVerse[] {
  const daily = getDailyVerseCarouselDisplay(date, sizing);
  const dailyRef = normalizeCarouselReference(daily.reference);
  const rest = verses.filter(
    (verse) =>
      !verse.isDailyVerse &&
      !verse.id.startsWith(DAILY_VERSE_CAROUSEL_ID_PREFIX) &&
      normalizeCarouselReference(verse.reference) !== dailyRef,
  );
  return [daily, ...restyleCarouselVerses(rest, sizing)];
}

function excludeDailyVerseFromPool(records: CarouselPoolRecord[], date: Date = new Date()): CarouselPoolRecord[] {
  return records.filter((record) => !matchesDailyVerseReference(record.reference, date));
}

export function mergeCarouselDisplayVerses(
  favorites: CarouselVerseRecord[],
  settings?: JournalCarouselSettings,
  rotationOffset = 0,
  cardSizeOverrides: Record<string, CarouselCardSize> = {},
): CarouselDisplayVerse[] {
  if (!settings) {
    return mergeCarouselDisplayVersesLegacy(favorites, cardSizeOverrides);
  }
  return buildCarouselDisplayVerses(favorites, settings, rotationOffset, cardSizeOverrides);
}

function mergeCarouselDisplayVersesLegacy(
  favorites: CarouselVerseRecord[],
  cardSizeOverrides: Record<string, CarouselCardSize> = {},
): CarouselDisplayVerse[] {
  const sizing: CarouselCardSizing = { overrides: cardSizeOverrides, defaultCardSize: "varied" };
  const seen = new Set<string>();
  const merged: CarouselDisplayVerse[] = [];

  const sortedFavorites = [...favorites].sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
  );

  for (const record of sortedFavorites) {
    if (seen.has(record.id)) continue;
    if (matchesDailyVerseReference(record.reference)) continue;
    seen.add(record.id);
    merged.push(carouselRecordToDisplay(record, merged.length, true, undefined, sizing));
    if (merged.length >= JOURNAL_CAROUSEL_DISPLAY_CAP - 1) break;
  }

  for (const fallback of DEFAULT_CAROUSEL_VERSES) {
    if (merged.length >= JOURNAL_CAROUSEL_DISPLAY_CAP - 1) break;
    const passageKey = carouselVerseId(
      fallback.bookSlug,
      fallback.chapter,
      fallback.verseStart,
      fallback.verseEnd,
    );
    if (seen.has(passageKey) || seen.has(fallback.id)) continue;
    if (matchesDailyVerseReference(fallback.reference)) continue;
    seen.add(fallback.id);
    merged.push(carouselRecordToDisplay(fallback, merged.length, false, undefined, sizing));
  }

  return withPinnedDailyVerse(merged, new Date(), sizing);
}

type CarouselPoolRecord = Omit<CarouselVerseRecord, "addedAt"> & { addedAt?: string };

function carouselDailySeed(): string {
  return new Date().toISOString().slice(0, 10);
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const next = [...items];
  let state = hashSeed(seed) || 1;
  for (let i = next.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

function isUserCarouselRecord(record: CarouselPoolRecord): boolean {
  return !record.id.startsWith("default:");
}

function dedupeCarouselPool(records: CarouselPoolRecord[]): CarouselPoolRecord[] {
  const seen = new Set<string>();
  const merged: CarouselPoolRecord[] = [];
  for (const record of records) {
    const passageKey = carouselVerseId(
      record.bookSlug,
      record.chapter,
      record.verseStart,
      record.verseEnd,
    );
    if (seen.has(record.id) || seen.has(passageKey)) continue;
    seen.add(record.id);
    seen.add(passageKey);
    merged.push(record);
  }
  return merged;
}

function orderedCarouselPool(favorites: CarouselVerseRecord[], shuffleDefaultsDaily: boolean): CarouselPoolRecord[] {
  const sortedFavorites = [...favorites].sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
  );
  const defaults = shuffleDefaultsDaily
    ? seededShuffle(DEFAULT_CAROUSEL_VERSES, `defaults:${carouselDailySeed()}`)
    : [...DEFAULT_CAROUSEL_VERSES];
  return dedupeCarouselPool([...sortedFavorites, ...defaults]);
}

function rotatingWindow<T>(items: readonly T[], start: number, count: number): T[] {
  if (items.length === 0 || count <= 0) return [];
  const size = Math.min(count, items.length);
  const offset = ((start % items.length) + items.length) % items.length;
  const picked: T[] = [];
  for (let i = 0; i < size; i++) {
    picked.push(items[(offset + i) % items.length]!);
  }
  return picked;
}

export function buildCarouselDisplayVerses(
  favorites: CarouselVerseRecord[],
  settings: JournalCarouselSettings,
  rotationOffset = 0,
  cardSizeOverrides: Record<string, CarouselCardSize> = {},
): CarouselDisplayVerse[] {
  const sizing: CarouselCardSizing = {
    overrides: cardSizeOverrides,
    defaultCardSize: settings.defaultCardSize,
  };

  if (settings.randomize) {
    const pool: CarouselPoolRecord[] = [];
    if (settings.randomizeFavorites) {
      pool.push(
        ...[...favorites].sort(
          (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
        ),
      );
    }
    const defaults = settings.shuffleDefaultsDaily
      ? seededShuffle(DEFAULT_CAROUSEL_VERSES, `defaults:${carouselDailySeed()}`)
      : [...DEFAULT_CAROUSEL_VERSES];
    pool.push(...defaults);

    const deduped = excludeDailyVerseFromPool(dedupeCarouselPool(pool));
    const shuffled = seededShuffle(
      deduped,
      settings.shuffleDefaultsDaily
        ? `randomize:${carouselDailySeed()}`
        : `randomize:${deduped.map((r) => r.id).join("|")}`,
    );
    const limit = Math.min(JOURNAL_CAROUSEL_MAX_VERSE_COUNT - 1, shuffled.length);
    const rest = shuffled
      .slice(0, limit)
      .map((record, index) =>
        carouselRecordToDisplay(record, index + 1, isUserCarouselRecord(record), undefined, sizing),
      );
    return withPinnedDailyVerse(rest, new Date(), sizing);
  }

  const pool = excludeDailyVerseFromPool(
    orderedCarouselPool(
      favorites,
      settings.randomize ? settings.shuffleDefaultsDaily : false,
    ),
  );
  const window = rotatingWindow(pool, rotationOffset, Math.max(0, settings.verseCount - 1));
  const rest = window.map((record, index) =>
    carouselRecordToDisplay(record, index + 1, isUserCarouselRecord(record), undefined, sizing),
  );
  return withPinnedDailyVerse(rest, new Date(), sizing);
}

export async function loadCarouselFavorites(): Promise<CarouselVerseRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCarouselVerseRecord);
  } catch {
    return [];
  }
}

async function saveCarouselFavorites(records: CarouselVerseRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    notifyCarouselFavoritesChanged();
  } catch {
    /* ignore */
  }
}

/** Replaces all user-saved carousel favorite verses (used by data import). */
export async function replaceCarouselFavorites(records: CarouselVerseRecord[]): Promise<void> {
  const valid = records.filter(isCarouselVerseRecord).slice(0, JOURNAL_CAROUSEL_MAX_FAVORITES);
  await saveCarouselFavorites(valid);
}

const carouselFavoriteListeners = new Set<() => void>();

function notifyCarouselFavoritesChanged(): void {
  for (const listener of carouselFavoriteListeners) {
    listener();
  }
}

export function subscribeCarouselFavorites(listener: () => void): () => void {
  carouselFavoriteListeners.add(listener);
  return () => carouselFavoriteListeners.delete(listener);
}

function isCarouselVerseRecord(value: unknown): value is CarouselVerseRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as CarouselVerseRecord;
  return (
    typeof r.id === "string" &&
    typeof r.bookSlug === "string" &&
    typeof r.bookName === "string" &&
    typeof r.chapter === "number" &&
    typeof r.verseStart === "number" &&
    typeof r.text === "string" &&
    typeof r.translationId === "string" &&
    typeof r.reference === "string" &&
    typeof r.addedAt === "string"
  );
}

export type BuildCarouselVerseInput = {
  bookSlug: string;
  bookName: string;
  chapter: number;
  verses: readonly string[];
  selectedVerses: number[];
  translationId: string;
};

export function buildCarouselVerseFromSelection({
  bookSlug,
  bookName,
  chapter,
  verses,
  selectedVerses,
  translationId,
}: BuildCarouselVerseInput): CarouselVerseRecord | null {
  if (selectedVerses.length === 0) return null;
  const sorted = [...selectedVerses].sort((a, b) => a - b);
  const verseStart = sorted[0]!;
  const verseEnd = sorted.length > 1 ? sorted[sorted.length - 1]! : null;
  const text = sorted
    .map((n) => verses[n - 1])
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!text) return null;

  const reference = formatSelectedReference(bookName, chapter, sorted);
  const id = carouselVerseId(bookSlug, chapter, verseStart, verseEnd);

  return {
    id,
    bookSlug,
    bookName,
    chapter,
    verseStart,
    verseEnd,
    text,
    translationId,
    reference,
    addedAt: new Date().toISOString(),
  };
}

export function isPassageInCarouselFavorites(
  favorites: CarouselVerseRecord[],
  bookSlug: string,
  chapter: number,
  verseStart: number,
  verseEnd: number | null,
): boolean {
  const id = carouselVerseId(bookSlug, chapter, verseStart, verseEnd);
  return favorites.some((f) => f.id === id);
}

export async function removeCarouselFavorite(id: string): Promise<CarouselVerseRecord[]> {
  const current = await loadCarouselFavorites();
  const next = current.filter((f) => f.id !== id);
  await saveCarouselFavorites(next);
  return next;
}

export async function toggleCarouselFavorite(
  record: CarouselVerseRecord,
): Promise<{ favorites: CarouselVerseRecord[]; added: boolean }> {
  const current = await loadCarouselFavorites();
  const existingIndex = current.findIndex((f) => f.id === record.id);

  if (existingIndex >= 0) {
    const next = current.filter((f) => f.id !== record.id);
    await saveCarouselFavorites(next);
    return { favorites: next, added: false };
  }

  const next = [record, ...current];
  if (next.length > JOURNAL_CAROUSEL_MAX_FAVORITES) {
    next.length = JOURNAL_CAROUSEL_MAX_FAVORITES;
  }
  await saveCarouselFavorites(next);
  return { favorites: next, added: true };
}

/** Match a reader selection against a stored carousel record. */
export function selectionMatchesCarouselRecord(
  favorites: CarouselVerseRecord[],
  bookSlug: string,
  chapter: number,
  selectedVerses: number[],
): CarouselVerseRecord | null {
  if (selectedVerses.length === 0) return null;
  const sorted = [...selectedVerses].sort((a, b) => a - b);
  const verseStart = sorted[0]!;
  const verseEnd = sorted.length > 1 ? sorted[sorted.length - 1]! : null;
  const id = carouselVerseId(bookSlug, chapter, verseStart, verseEnd);
  return favorites.find((f) => f.id === id) ?? null;
}

export function formatCarouselPassageLabel(record: CarouselVerseRecord): string {
  return (
    record.reference ||
    formatPassageReference({
      book: record.bookSlug,
      chapter: record.chapter,
      verseStart: record.verseStart,
      verseEnd: record.verseEnd,
      bookDisplayLabel: record.bookName,
    })
  );
}
