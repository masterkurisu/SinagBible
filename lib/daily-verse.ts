/** Offline daily verse — curated pool + date-seeded selection (no server). */

import {
  FEATURED_DAILY_VERSES,
  type DailyVerse,
  type DailyVerseTheme,
} from "@/lib/daily-verse-data";

export type { DailyVerse, DailyVerseTheme } from "@/lib/daily-verse-data";

/** @deprecated Use FEATURED_DAILY_VERSES — kept for backward-compatible imports. */
export const DAILY_VERSES = FEATURED_DAILY_VERSES;

/** @deprecated Use DailyVerse */
export type DailyVerseEntry = DailyVerse;

/** Calendar day-of-year (1–366), aligned with Java LocalDate.dayOfYear. */
export function dayOfYear(date: Date = new Date()): number {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const yearStart = new Date(date.getFullYear(), 0, 0);
  return Math.floor((local.getTime() - yearStart.getTime()) / 86400000);
}

/** All featured verses eligible for the daily pool. */
export function getFeaturedVerses(): readonly DailyVerse[] {
  return FEATURED_DAILY_VERSES;
}

/**
 * Deterministic index shared by all users on the same calendar day.
 * Mirrors Kotlin: ((dayOfYear * year) % verses.size).absoluteValue
 */
export function getDailyVerseIndex(date: Date, poolSize: number): number {
  if (poolSize <= 0) return 0;
  const index = (dayOfYear(date) * date.getFullYear()) % poolSize;
  return Math.abs(index);
}

export function pickDailyVerse(verses: readonly DailyVerse[], date: Date = new Date()): DailyVerse {
  const pool = verses.length > 0 ? verses : FEATURED_DAILY_VERSES;
  return pool[getDailyVerseIndex(date, pool.length)]!;
}

export function getDailyVerse(date: Date = new Date()): DailyVerse {
  return pickDailyVerse(getFeaturedVerses(), date);
}

export function formatDailyVerseReference(reference: string): string {
  return reference.trim();
}

export function dailyVerseDayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
