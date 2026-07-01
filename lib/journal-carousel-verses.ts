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

/** Warm gold gradient for the daily verse hero card. */
const DAILY_VERSE_GRADIENT: readonly [string, string, string] = [
  "#6b5540",
  "#5c4f3a",
  "#3d3428",
];

const CAROUSEL_GRADIENTS: readonly (readonly [string, string, string])[] = [
  ["#3d3428", "#2c2416", "#1a160f"],
  ["#5c4f3a", "#4a3826", "#3d3428"],
  ["#6b5540", "#5c4f3a", "#4a3826"],
  ["#4a3826", "#3d3428", "#2c2416"],
  ["#5c4f3a", "#6b5540", "#4a3826"],
];

const WIDTH_RATIOS = [0.58, 0.72, 0.64] as const;

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
): CarouselDisplayVerse {
  return {
    id: record.id,
    reference: record.reference,
    text: record.text,
    widthRatio: WIDTH_RATIOS[index % WIDTH_RATIOS.length]!,
    gradient: CAROUSEL_GRADIENTS[index % CAROUSEL_GRADIENTS.length]!,
    imageCategory: options?.isDailyVerse
      ? "daily-verse"
      : getCarouselImageCategoryForBookSlug(record.bookSlug),
    isUserFavorite,
    isDailyVerse: options?.isDailyVerse,
    badgeLabel: options?.badgeLabel,
  };
}

export function getDailyVerseCarouselDisplay(date: Date = new Date()): CarouselDisplayVerse {
  const daily = getDailyVerse(date);
  return {
    id: `${DAILY_VERSE_CAROUSEL_ID_PREFIX}${dailyVerseDayKey(date)}`,
    reference: formatDailyVerseReference(daily.reference),
    text: daily.text,
    widthRatio: WIDTH_RATIOS[0]!,
    gradient: DAILY_VERSE_GRADIENT,
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

function restyleCarouselVerses(verses: CarouselDisplayVerse[]): CarouselDisplayVerse[] {
  return verses.map((verse, index) => ({
    ...verse,
    widthRatio: WIDTH_RATIOS[(index + 1) % WIDTH_RATIOS.length]!,
    gradient: CAROUSEL_GRADIENTS[(index + 1) % CAROUSEL_GRADIENTS.length]!,
  }));
}

function withPinnedDailyVerse(
  verses: CarouselDisplayVerse[],
  date: Date = new Date(),
): CarouselDisplayVerse[] {
  const daily = getDailyVerseCarouselDisplay(date);
  const dailyRef = normalizeCarouselReference(daily.reference);
  const rest = verses.filter(
    (verse) =>
      !verse.isDailyVerse &&
      !verse.id.startsWith(DAILY_VERSE_CAROUSEL_ID_PREFIX) &&
      normalizeCarouselReference(verse.reference) !== dailyRef,
  );
  return [daily, ...restyleCarouselVerses(rest)];
}

function excludeDailyVerseFromPool(records: CarouselPoolRecord[], date: Date = new Date()): CarouselPoolRecord[] {
  return records.filter((record) => !matchesDailyVerseReference(record.reference, date));
}

export function mergeCarouselDisplayVerses(
  favorites: CarouselVerseRecord[],
  settings?: JournalCarouselSettings,
  rotationOffset = 0,
): CarouselDisplayVerse[] {
  if (!settings) {
    return mergeCarouselDisplayVersesLegacy(favorites);
  }
  return buildCarouselDisplayVerses(favorites, settings, rotationOffset);
}

function mergeCarouselDisplayVersesLegacy(favorites: CarouselVerseRecord[]): CarouselDisplayVerse[] {
  const seen = new Set<string>();
  const merged: CarouselDisplayVerse[] = [];

  const sortedFavorites = [...favorites].sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
  );

  for (const record of sortedFavorites) {
    if (seen.has(record.id)) continue;
    if (matchesDailyVerseReference(record.reference)) continue;
    seen.add(record.id);
    merged.push(carouselRecordToDisplay(record, merged.length, true));
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
    merged.push(carouselRecordToDisplay(fallback, merged.length, false));
  }

  return withPinnedDailyVerse(merged);
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
): CarouselDisplayVerse[] {
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
        carouselRecordToDisplay(record, index + 1, isUserCarouselRecord(record)),
      );
    return withPinnedDailyVerse(rest);
  }

  const pool = excludeDailyVerseFromPool(
    orderedCarouselPool(
      favorites,
      settings.randomize ? settings.shuffleDefaultsDaily : false,
    ),
  );
  const window = rotatingWindow(pool, rotationOffset, Math.max(0, settings.verseCount - 1));
  const rest = window.map((record, index) =>
    carouselRecordToDisplay(record, index + 1, isUserCarouselRecord(record)),
  );
  return withPinnedDailyVerse(rest);
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
  } catch {
    /* ignore */
  }
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
