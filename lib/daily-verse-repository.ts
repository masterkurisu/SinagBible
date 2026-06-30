import {
  getDailyVerse,
  getFeaturedVerses,
  pickDailyVerse,
  type DailyVerse,
} from "@/lib/daily-verse";

/** Repository layer — offline featured pool + date-seeded selection. */
export const dailyVerseRepository = {
  getFeaturedVerses(): readonly DailyVerse[] {
    return getFeaturedVerses();
  },

  getDailyVerse(date: Date = new Date()): DailyVerse {
    return getDailyVerse(date);
  },

  pickDailyVerse(verses: readonly DailyVerse[], date: Date = new Date()): DailyVerse {
    return pickDailyVerse(verses, date);
  },
};

export type DailyVerseRepository = typeof dailyVerseRepository;
