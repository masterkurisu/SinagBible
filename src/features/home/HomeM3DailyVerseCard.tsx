import { useMemo } from "react";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { dailyVerseDayKey } from "@/lib/daily-verse";
import { getDailyVerseCarouselDisplay } from "@/lib/journal-carousel-verses";
import { useCarouselBackgroundUrls } from "@/lib/use-carousel-background-urls";
import { HomeM3VerseCard } from "@/src/features/home/HomeM3VerseCard";

export type HomeM3DailyVerseCardProps = {
  bundle: MobileAppThemeBundle;
};

/** Home verse card synced with the journal carousel's pinned daily verse. */
export function HomeM3DailyVerseCard({ bundle }: HomeM3DailyVerseCardProps) {
  const dayKey = dailyVerseDayKey();
  const dailyVerse = useMemo(() => getDailyVerseCarouselDisplay(), [dayKey]);
  const displayVerses = useMemo(() => [dailyVerse], [dailyVerse]);
  const { getImageUrl } = useCarouselBackgroundUrls(displayVerses);

  return (
    <HomeM3VerseCard
      bundle={bundle}
      quote={dailyVerse.text}
      reference={dailyVerse.reference}
      badgeLabel={dailyVerse.badgeLabel}
      imageUrl={getImageUrl(dailyVerse)}
      gradient={dailyVerse.gradient}
    />
  );
}
