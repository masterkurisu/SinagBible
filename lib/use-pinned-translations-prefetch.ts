import { useEffect, useMemo } from "react";
import NetInfo from "@react-native-community/netinfo";
import { usePathname } from "expo-router";
import { isOfflineNetInfo } from "@/lib/network-connectivity";
import {
  pinnedIdsForPrefetch,
  runPinnedTranslationsPrefetch,
} from "@/lib/pinned-translations-prefetch";
import { useFavoriteTranslations } from "@/lib/use-favorite-translations";

/**
 * After the first online session, prefetches ±2 chapters for each pinned translation
 * around the active reader position, last-read position, or Genesis 1.
 */
export function usePinnedTranslationsPrefetch(): void {
  const pathname = usePathname();
  const { favoriteTranslationIds } = useFavoriteTranslations();
  const pinnedIds = useMemo(
    () => pinnedIdsForPrefetch(favoriteTranslationIds),
    [favoriteTranslationIds],
  );
  const pinnedKey = pinnedIds.join("\0");

  useEffect(() => {
    void runPinnedTranslationsPrefetch(pinnedIds, pathname);
  }, [pinnedIds, pinnedKey, pathname]);

  useEffect(() => {
    const subscription = NetInfo.addEventListener((state) => {
      if (!isOfflineNetInfo(state)) {
        void runPinnedTranslationsPrefetch(pinnedIds, pathname);
      }
    });
    return () => subscription();
  }, [pinnedIds, pinnedKey, pathname]);
}
