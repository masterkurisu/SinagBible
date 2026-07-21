import { isBundledFeaturedTranslationId } from "@sinag-bible/core/bible-translations";
import { getDefaultPinnedTranslationIds } from "@/lib/default-pinned-translations";
import { isDeviceOffline } from "@/lib/network-connectivity";
import { prefetchTranslationChaptersForReader } from "@/lib/reader-chapter-load";
import { loadReaderLastPosition, peekReaderLastPosition } from "@/lib/reader-last-position";
import { parseReaderChapterFromPathname } from "@/lib/reader-navigation";
import { isYvpApiConfigured, isYvpTranslationId } from "@/lib/youversion-api";

const DEFAULT_PREFETCH_ANCHOR = { bookSlug: "genesis", chapter: 1 };

/** Translations whose ±2 neighborhood was already primed this session. */
const prefetchedTranslationIds = new Set<string>();

export async function resolvePrefetchAnchor(
  pathname: string | null,
): Promise<{ bookSlug: string; chapter: number }> {
  const fromRoute = parseReaderChapterFromPathname(pathname);
  if (fromRoute) return fromRoute;

  const fromMemory = peekReaderLastPosition();
  if (fromMemory) {
    return { bookSlug: fromMemory.bookSlug, chapter: fromMemory.chapter };
  }

  const fromStorage = await loadReaderLastPosition();
  if (fromStorage) {
    return { bookSlug: fromStorage.bookSlug, chapter: fromStorage.chapter };
  }

  return DEFAULT_PREFETCH_ANCHOR;
}

function shouldPrefetchTranslation(translationId: string): boolean {
  if (translationId === "KJV") return false;
  if (isBundledFeaturedTranslationId(translationId)) return false;
  if (isYvpTranslationId(translationId) && !isYvpApiConfigured()) return false;
  return true;
}

/**
 * Best-effort ±2 chapter prefetch for pinned translations after the first online session.
 * Skips translations already primed; safe to call when connectivity returns or pins change.
 */
export async function runPinnedTranslationsPrefetch(
  pinnedTranslationIds: string[],
  pathname: string | null,
): Promise<void> {
  if (pinnedTranslationIds.length === 0) return;
  if (await isDeviceOffline()) return;

  const anchor = await resolvePrefetchAnchor(pathname);

  for (const translationId of pinnedTranslationIds) {
    if (!shouldPrefetchTranslation(translationId)) {
      prefetchedTranslationIds.add(translationId);
      continue;
    }
    if (prefetchedTranslationIds.has(translationId)) continue;
    prefetchedTranslationIds.add(translationId);
    prefetchTranslationChaptersForReader(
      translationId,
      anchor.bookSlug,
      anchor.chapter,
      null,
    );
  }
}

/** Pinned ids for prefetch — defaults until favorites finish loading from AsyncStorage. */
export function pinnedIdsForPrefetch(favoriteTranslationIds: string[]): string[] {
  return favoriteTranslationIds.length > 0
    ? favoriteTranslationIds
    : getDefaultPinnedTranslationIds();
}

/** Clears session prefetch bookkeeping (e.g. after delete-my-data). */
export function resetPinnedTranslationsPrefetchSession(): void {
  prefetchedTranslationIds.clear();
}
