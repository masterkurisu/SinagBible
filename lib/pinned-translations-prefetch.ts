import { isBundledFeaturedTranslationId } from "@sinag-bible/core/bible-translations";
import { getDefaultPinnedTranslationIds } from "@/lib/default-pinned-translations";
import { isDeviceOffline } from "@/lib/network-connectivity";
import { prefetchTranslationChaptersForReader } from "@/lib/reader-chapter-load";
import { readerPerfEnd, readerPerfStart } from "@/lib/reader-open-perf-log";
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

  // TEMPORARY (reader-open-stall-findings.md Phase 5) — remove alongside the rest of
  // the [reader-perf] logging once prefetch impact is confirmed negligible on-device.
  const perfHandle = readerPerfStart("resolvePrefetchAnchor: loadReaderLastPosition fallback");
  const fromStorage = await loadReaderLastPosition();
  readerPerfEnd(perfHandle);
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

  // TEMPORARY (reader-open-stall-findings.md Phase 5) — measures only the *synchronous*
  // dispatch cost of kicking off the fire-and-forget prefetches below, i.e. the part
  // that could actually compete with the JS thread during the reader-open stall
  // window. The prefetches themselves are async/network-bound and already individually
  // timed via `fetchReaderChapterContent`'s own `[reader-perf]` markers.
  const perfHandle = readerPerfStart(
    `runPinnedTranslationsPrefetch: dispatch loop (${pinnedTranslationIds.length} pinned)`,
  );
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
  readerPerfEnd(perfHandle);
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
