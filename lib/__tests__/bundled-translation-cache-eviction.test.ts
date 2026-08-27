import { describe, expect, it } from "vitest";
import {
  getBundledTranslationDataCacheSize,
  getSearchResultsForTranslation,
  isBookNavCached,
  isTranslationDataCached,
} from "@sinag-bible/core/bible-translations";
import { hasVagueKeywordIndex } from "@sinag-bible/core/vague-keyword-index";

/**
 * Fix A: `bundledTranslationDataCache` is an `LruMap(2)`. Loading a 3rd distinct
 * bundled translation must evict the least-recently-used one from all three caches
 * that key off `TranslationId` — the translation text cache itself, `bookNavPromiseCache`,
 * and the vague-keyword index — in the same operation, never a partial eviction.
 */
describe("bundled translation cache eviction coherence", () => {
  it("evicts bookNavPromiseCache + keyword index in lockstep with the bundled data cache", async () => {
    await getSearchResultsForTranslation("KJV", "love");
    expect(isTranslationDataCached("KJV")).toBe(true);
    expect(isBookNavCached("KJV")).toBe(true);
    expect(hasVagueKeywordIndex("KJV")).toBe(true);
    expect(getBundledTranslationDataCacheSize()).toBe(1);

    await getSearchResultsForTranslation("WEB", "love");
    expect(isTranslationDataCached("WEB")).toBe(true);
    expect(isBookNavCached("WEB")).toBe(true);
    expect(hasVagueKeywordIndex("WEB")).toBe(true);
    expect(getBundledTranslationDataCacheSize()).toBe(2);

    // 3rd distinct bundled id at cap 2: evicts KJV (least-recently-used, never re-touched).
    await getSearchResultsForTranslation("ADB1905", "pag-ibig");
    expect(getBundledTranslationDataCacheSize()).toBe(2);

    expect(isTranslationDataCached("KJV")).toBe(false);
    expect(isBookNavCached("KJV")).toBe(false);
    expect(hasVagueKeywordIndex("KJV")).toBe(false);

    expect(isTranslationDataCached("WEB")).toBe(true);
    expect(isTranslationDataCached("ADB1905")).toBe(true);

    // Re-load-after-eviction: KJV reloads cleanly and repopulates all three caches,
    // evicting WEB in turn (now the least-recently-used of the two).
    const kjvAgain = await getSearchResultsForTranslation("KJV", "love");
    expect(kjvAgain.results.length).toBeGreaterThan(0);
    expect(isTranslationDataCached("KJV")).toBe(true);
    expect(isBookNavCached("KJV")).toBe(true);
    expect(hasVagueKeywordIndex("KJV")).toBe(true);
    expect(getBundledTranslationDataCacheSize()).toBe(2);

    expect(isTranslationDataCached("WEB")).toBe(false);
    expect(isBookNavCached("WEB")).toBe(false);
    expect(hasVagueKeywordIndex("WEB")).toBe(false);
  });

  it("recency updates on read: re-touching a cached id changes what gets evicted next", async () => {
    await getSearchResultsForTranslation("KJV", "faith");
    await getSearchResultsForTranslation("OEB", "faith");
    expect(getBundledTranslationDataCacheSize()).toBe(2);

    // Re-read KJV so it's no longer the least-recently-used entry.
    await getSearchResultsForTranslation("KJV", "faith");

    // Loading a 3rd distinct id now evicts OEB, not KJV.
    await getSearchResultsForTranslation("WEB", "faith");
    expect(isTranslationDataCached("KJV")).toBe(true);
    expect(isTranslationDataCached("OEB")).toBe(false);
    expect(isBookNavCached("OEB")).toBe(false);
    expect(hasVagueKeywordIndex("OEB")).toBe(false);
  });
});
