import {
  getApiTranslationDataCacheSize,
  getBundledTranslationDataCacheSize,
  getHelloaoCompleteDataCacheSize,
} from "@sinag-bible/core/bible-translations";
import { getVagueKeywordIndexCacheSize } from "@sinag-bible/core/vague-keyword-index";
import { getPexelsSessionCacheSizes } from "@/lib/pexels-repository";
import { getReaderChapterStorageCacheSize } from "@/lib/use-reader-storage";
import { getYvpSearchContextCacheSize } from "@/lib/yvp-search-corpus";

export type PerfCacheSnapshot = {
  bundledTranslationData: number;
  apiTranslationData: number;
  helloaoCompleteData: number;
  yvpSearchContext: number;
  vagueKeywordIndex: number;
  pexelsSessionCardUrls: number;
  pexelsSessionResolvedKeys: number;
  readerChapterStorage: number;
};

/** Snapshot of in-memory cache entry counts for dev profiling. */
export function getPerfCacheSnapshot(): PerfCacheSnapshot {
  const pexels = getPexelsSessionCacheSizes();
  return {
    bundledTranslationData: getBundledTranslationDataCacheSize(),
    apiTranslationData: getApiTranslationDataCacheSize(),
    helloaoCompleteData: getHelloaoCompleteDataCacheSize(),
    yvpSearchContext: getYvpSearchContextCacheSize(),
    vagueKeywordIndex: getVagueKeywordIndexCacheSize(),
    pexelsSessionCardUrls: pexels.cardUrls,
    pexelsSessionResolvedKeys: pexels.resolvedKeys,
    readerChapterStorage: getReaderChapterStorageCacheSize(),
  };
}

/**
 * Logs cache sizes in dev. Opt-in via `global.__SINAG_LOG_PERF_CACHES__ = true` before
 * backgrounding the app, or call manually from the dev console.
 */
export function logPerfCacheSnapshot(): void {
  if (!__DEV__) return;
  console.log("[perf-cache]", getPerfCacheSnapshot());
}

declare global {
  // eslint-disable-next-line no-var
  var __SINAG_LOG_PERF_CACHES__: boolean | undefined;
}

export function maybeLogPerfCacheSnapshotOnBackground(): void {
  if (__DEV__ && globalThis.__SINAG_LOG_PERF_CACHES__) {
    logPerfCacheSnapshot();
  }
}
