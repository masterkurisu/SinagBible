import { useCallback, useEffect, useMemo, useState } from "react";
import { dailyVerseRepository } from "@/lib/daily-verse-repository";
import { dailyVerseDayKey, type DailyVerse } from "@/lib/daily-verse";

/** ViewModel equivalent — exposes today's verse with a simple loading gate. */
export function useDailyVerse(date: Date = new Date()) {
  const [loaded, setLoaded] = useState(false);
  const dayKey = dailyVerseDayKey(date);

  const dailyVerse = useMemo<DailyVerse>(
    () => dailyVerseRepository.getDailyVerse(date),
    [dayKey],
  );

  const reload = useCallback(() => {
    setLoaded(true);
    return dailyVerseRepository.getDailyVerse(new Date());
  }, []);

  useEffect(() => {
    setLoaded(true);
  }, [dailyVerse.id, dayKey]);

  return {
    dailyVerse,
    loading: !loaded,
    reload,
  };
}
