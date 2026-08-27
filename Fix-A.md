# Fix A: Bounded LRU Cache for Bundled Translations

**Scope:** `translationDataCache` in `packages/core/src/bible-translations.ts`
**Goal:** Stop bundled translation data (`KJV`, `WEB`, `ADB1905`, `OEB`) from staying resident in memory forever once loaded. Cap it at 2, mirroring the pattern already used for `helloaoCompleteDataCache`.
**Out of scope:** Metro/asset loading (Fix B), YVP (no in-memory full-tree cache to bound), search ranking logic, chapter-read logic. None of that changes.

---

## Background: what's being replaced

```ts
// packages/core/src/bible-translations.ts
const translationDataCache = new Map<TranslationId, Promise<TranslationData>>();

function loadTranslationData(id: TranslationId): Promise<TranslationData> {
  const ex = translationDataCache.get(id);
  if (ex) return ex;

  const p = (async () => {
    if (isApiTranslationId(id)) {
      return fetchApiTranslationData(id);
    }
    switch (id) {
      case "KJV":
        return (await import("../data/kjv.json")).default as TranslationData;
      case "WEB":
        return (await import("../data/web.json")).default as TranslationData;
      case "ADB1905":
        return (await import("../data/adb1905.json")).default as TranslationData;
      case "OEB":
        return (await import("../data/oeb.json")).default as TranslationData;
      default:
        throw new Error(`Unknown translation: ${id}`);
    }
  })();

  translationDataCache.set(id, p);
  return p;
}
```

This is a plain `Map` with no eviction. Every `TranslationId` ever requested this session (bundled *or* mapped-API, e.g. `BSB`, `ENG_ASV`) stays in here forever. The pattern to copy already exists for the dynamic HelloAO path:

```ts
const helloaoCompleteDataCache = new LruMap<string, Promise<TranslationData>>(3);
// ...
helloaoCompleteDataCache.set(cacheKey, p, evictHelloaoSearchCaches);
```

Fix A brings `translationDataCache` in line with that, capped at **2** (see Phase 1 for why 2, not 3 or 1).

Two caches key off `TranslationId` and need to be evicted in lockstep whenever a translation falls out of `translationDataCache`:

- `bookNavPromiseCache: Partial<Record<TranslationId, Promise<BibleBookNavItem[]>>>` — built from `loadTranslationData(id)`'s result.
- The runtime keyword index inside `vague-keyword-index.ts`, keyed by `searchKey` (same string as `TranslationId` for bundled translations), evicted via the existing `evictVagueKeywordIndex(cacheKey)` export.

**Related but out-of-scope note:** for non-KJV bundled translations (`WEB`, `ADB1905`, `OEB`), the Reader's `fetchReaderChapterContent` (`lib/reader-chapter-load.ts`) tries the HelloAO API *first* for every chapter and only falls back to `getChapterBySlugForTranslation` → `loadTranslationData` on failure. Since HelloAO doesn't list `ADB1905`/`OEB` (and presumably not `WEB` either — its HelloAO equivalent is the differently-named `eng_web`), this fails and falls back on effectively every chapter read. That means `translationDataCache` still gets populated reliably when reading these translations (Fix A's premise holds), just after a wasted network round-trip that's a separate, pre-existing inefficiency. Not something Fix A needs to fix — just context so the fallback path isn't mistaken for a bug while tracing chapter loads during Phase 0/3.

---

## Phase 0 — Verify assumptions before touching code

These are cheap to check and materially affect Phase 1's cap size and Phase 2's design. Do this first; if either answer is different than assumed, revisit the cap before writing code.

1. **Confirm whether onboarding/cold start loads both default pins concurrently.**
   Default pins are `KJV` and `ADB1905`. Already traced this — bring a fresh pair of eyes to re-verify before relying on it, since Fix A's cap size depends on it:
   - **Onboarding/pin-warming does *not* cause concurrent loads.** `usePinnedTranslationsPrefetch` → `runPinnedTranslationsPrefetch` (`lib/pinned-translations-prefetch.ts`) explicitly skips bundled translations via `shouldPrefetchTranslation` (`if (isBundledFeaturedTranslationId(translationId)) return false;`). So pinning `KJV` + `ADB1905` at onboarding does not fire concurrent `loadTranslationData` calls. `warmTranslationSearchCache` (defaults to `"KJV"`) is likewise only triggered by search actions in `lib/bible-search-service.ts`, not at startup — corroborated by the existing `reader-open-stall-findings.md` (item 5) in this repo.
   - **The real concurrency source is `lib/search-also-translation.ts`.** When search results render, `attachAlsoTranslationSnippets` calls `getVersePreviewForTranslation` for the first pinned translation that differs from the one currently active (`pickAlsoTranslationId`). With the shipped defaults (`["KJV", "yvp:111", "ADB1905", "yvp:1264"]`), searching while reading `ADB1905` picks `KJV` as the "also" translation — requiring two bundled translations resident at once. This mechanism only ever picks *one* "also" id, so it can never require a 3rd bundled translation concurrently.
   - There is no "parallel/compare translations" reader feature in the codebase (checked) — so that hypothetical concurrency source doesn't apply here.

   **Conclusion: a cap of 2 is sufficient for every concurrency path found in the current codebase.** If a future feature adds a second simultaneous "also" translation or a real side-by-side view, revisit this cap then — until then, don't second-guess it further.

2. **Grep for every direct read of `translationDataCache`.**
   Confirm it's only touched inside `loadTranslationData`. If anything elsewhere reads or mutates it directly (rather than going through the function), that call site needs to be updated too or it will bypass the new eviction logic.

3. **Confirm `LruMap`'s existing behavior matches what you need.**
   Open `packages/core/src/lru-map.ts` and confirm:
   - Constructor signature (`new LruMap<K, V>(capacity)`).
   - `.set(key, value, onEvict?)` — does the eviction callback fire synchronously on the evicted key/value, and does `.set`-ing an *existing* key refresh its recency (move-to-front) without evicting anything?
   - `.get(key)` — does a `get` also count as "recently used" (move-to-front), or only `.set`? This affects whether re-reading an already-cached translation resets its eviction order (it should).
   - Does it expose a way to iterate current keys (needed for Phase 3 tests), or a `.size` getter (already referenced elsewhere as `getHelloaoCompleteDataCacheSize`)?

   Do not assume — read the implementation, since Fix A's correctness depends on `LruMap`'s exact eviction semantics.

**Exit criteria for Phase 0:** You know (a) whether concurrent-pin-loading is a real scenario, (b) every call site that touches `translationDataCache`, (c) `LruMap`'s exact `.set`/`.get`/eviction-callback contract.

---

## Phase 1 — Swap `Map` for `LruMap`

1. **Change the declaration:**

   ```ts
   const translationDataCache = new LruMap<TranslationId, Promise<TranslationData>>(2);
   ```

   **Why 2, not 1 or 3:**
   - **1** would mean the two default pins (`KJV`, `ADB1905`) evict each other on a fresh install before the user does anything — switching between them would re-trigger the full parse every time. Strictly worse than today's unbounded cache for the exact translations you ship as defaults.
   - **3** matches `helloaoCompleteDataCache`'s cap, but that cache holds fetched-and-discarded API data, which is a different usage pattern than "the two things you defaulted the user into." Bundled trees are also larger per-entry (4-4.7MB) than typical API payloads, so a tighter cap is the more conservative choice until you have a concrete reason to raise it.
   - Revisit this number if a future feature needs 3+ bundled translations concurrently warm (see Phase 0, step 1 — not the case today).

2. **Decide whether `isApiTranslationId(id)` entries (`BSB`, `ENG_ASV`, `ENG_BBE`, `ENG_DARBY`, `ENG_WEBBE`) should share this same cache or get pulled out.**

   Currently *both* bundled and mapped-API translations flow through `translationDataCache`. That's arguably a second, smaller bug: `fetchApiTranslationData` results for e.g. `BSB` are also uncapped today. Two options:

   - **Option 1 (smaller diff):** Leave both types sharing one `LruMap(2)`. Simple, fixes the same unbounded-growth bug for both categories in one change. Slight downside: a mapped-API fetch could evict a bundled translation's cache entry (and vice versa) even though they have very different reload costs (network fetch vs. local file parse).
   - **Option 2 (more precise):** Split into two caches — `bundledTranslationDataCache = new LruMap<TranslationId, Promise<TranslationData>>(2)` for `KJV`/`WEB`/`ADB1905`/`OEB`, and leave (or separately cap) the mapped-API branch. This avoids a `BSB` fetch ever evicting `KJV` from memory, which seems like the more correct behavior since they have very different reload costs.

   **Recommendation:** Option 2. It's a small additional diff (one more `if` branching to the right cache inside `loadTranslationData`) and avoids a cross-category eviction bug that would be confusing to debug later. Document this decision in the PR either way, since Option 1 is defensible too if you want the smallest possible diff.

3. **Update `loadTranslationData` to use the new cache object's `.get`/`.set` calls in place of `Map`'s.** No change to the function's return type or async shape — this is purely a cache-implementation swap.

4. **Do not add the eviction callback yet.** Phase 1 is "cache is now bounded," verified in isolation before Phase 2 wires up the cross-cache cleanup. Keeping these phases separate makes it easier to bisect if something breaks later.

**Exit criteria for Phase 1:** `translationDataCache` (or its split replacement(s)) is an `LruMap` with a chosen capacity, every existing call site compiles, and — without an eviction callback yet — loading a 3rd bundled translation correctly evicts the least-recently-used one from *this* cache specifically (verify with a quick manual/console check or a throwaway test before moving on).

---

## Phase 2 — Wire the eviction callback (cache coherence)

This is the phase most likely to introduce a subtle bug if rushed, because three caches must agree on the same key at all times.

1. **Write the eviction callback**, modeled directly on the existing `evictHelloaoSearchCaches`:

   ```ts
   function evictHelloaoSearchCaches(cacheKey: string): void {
     dynamicBookNavPromiseCache.delete(cacheKey);
     evictVagueKeywordIndex(cacheKey);
   }
   ```

   The bundled equivalent needs to clear:
   - `bookNavPromiseCache[id]` — delete the key (it's a `Partial<Record<...>>`, not a `Map`, so use `delete bookNavPromiseCache[id]`, not `.delete()`).
   - `evictVagueKeywordIndex(id)` — same function, since bundled `TranslationId`s (`"KJV"`, etc.) are also valid `searchKey` values used to build the keyword index (confirm this in `vague-keyword-index.ts` — the cache key space should already be shared, since `resolveSearchTranslationContext` uses the `TranslationId` string itself as `searchKey` for bundled translations).

   ```ts
   function evictBundledTranslationCaches(id: TranslationId): void {
     delete bookNavPromiseCache[id];
     evictVagueKeywordIndex(id);
   }
   ```

2. **Pass this callback into every `.set()` call** on the bundled cache:

   ```ts
   translationDataCache.set(id, p, evictBundledTranslationCaches);
   ```

3. **Confirm the callback's timing against `LruMap`'s actual implementation** (from Phase 0, step 3). Specifically confirm:
   - The callback fires with the *evicted* key, not the newly-inserted one.
   - The callback fires synchronously as part of `.set()`, not on some later tick — if it's deferred, there's a window where `translationDataCache` no longer has an entry for `id` but `bookNavPromiseCache[id]` still does, which could serve a stale book-nav for a translation whose text has already been evicted from memory (not incorrect, since book nav is small and would just get rebuilt on next access, but worth confirming isn't a bigger issue depending on how the two are consumed together elsewhere).

4. **Trace what happens on the very next access after an eviction**, to confirm nothing assumes the two caches are always in sync outside of eviction moments:
   - `getBookNavForTranslationData(id)` checks `bookNavPromiseCache[id]` first; if evicted, it re-derives nav by calling `loadTranslationData(id)` again — which is now correctly a fresh load into the (now-vacant) LRU slot. Confirm this round-trip actually re-populates both caches correctly, not just one.
   - `getOrBuildVagueKeywordIndex(searchKey, data)` — confirm it correctly rebuilds from scratch (not silently reusing a stale index) when `evictVagueKeywordIndex` has cleared its entry and `data` is the newly-reloaded object.

**Exit criteria for Phase 2:** Loading a 3rd bundled translation evicts the LRU one from all three caches (`translationDataCache`, `bookNavPromiseCache`, keyword index) in the same operation — never a partial eviction where one cache still references the evicted translation and another doesn't.

---

## Phase 3 — Testing

1. **Unit test: basic LRU behavior in isolation.**
   Directly exercise the cache (not necessarily through the full `loadTranslationData` flow) to assert: loading a 3rd distinct key evicts the least-recently-used one; re-accessing (`.get`) a cached key before loading a 3rd one changes which entry gets evicted next (recency updates on read, per Phase 0's confirmation).

2. **Unit test: cross-cache eviction coherence.**
   This is the test most worth writing carefully, since it's the part most likely to regress silently:
   - Load `KJV`, then `WEB`, then `ADB1905` (3 distinct bundled ids, cap of 2) via `loadTranslationData`.
   - Assert `KJV` (the LRU one) is gone from `translationDataCache`.
   - Assert `bookNavPromiseCache["KJV"]` is also gone (`undefined`).
   - Assert the keyword index no longer has an entry for `"KJV"` (via whatever inspection `vague-keyword-index.ts` exposes, or indirectly by asserting a subsequent search rebuilds it rather than reusing stale state).
   - Then call `loadTranslationData("KJV")` again and assert it correctly reloads (doesn't throw, doesn't return a stale/undefined value) and repopulates all three caches.

3. **Regression pass on existing search test suites** — `overlay-power-search`, `overlay-vague-ranking`, `overlay-numeric-search`, `overlay-book-suggestions`, `overlay-differentiating`, `overlay-result-ux`, `overlay-reference-input`, and `overlay-marks-search`. These construct `KJVData` fixtures directly per earlier analysis, so they likely don't exercise `loadTranslationData`'s cache at all — confirm that's actually true (grep for `loadTranslationData` or `translationDataCache` inside the test files) rather than assuming, since if any of them *do* go through the real loader, a shrinking cache mid-suite could change behavior between tests that didn't interact before. (Already grepped as of this writing: zero matches across all 8 files.)

4. **Wire a cache-size diagnostic into the existing perf snapshot.** `lib/perf-cache-snapshot.ts`'s `getPerfCacheSnapshot()` already tracks `helloaoCompleteData` and `vagueKeywordIndex` sizes for dev profiling, but has nothing for `translationDataCache`. Since Phase 1 gives the new `LruMap` a `.size` getter for free, add a `getTranslationDataCacheSize()` export (mirroring `getHelloaoCompleteDataCacheSize()`) and wire it into `PerfCacheSnapshot` — if Option 2 (split caches) is chosen, expose both bundled and mapped-API sizes. This directly supports the manual device check below and Phase 4's memory-monitoring goal.

5. **Manual on-device check (both platforms):**
   Two scenarios worth covering, both grounded in Phase 0's findings:
   - Fresh install with default pins (`KJV` + `ADB1905`), read a 3rd bundled translation (`WEB` or `OEB`), then switch back to one of the two pins. Confirm no crash, no visibly stale content, and (if you have a way to sample JS heap, e.g. via Hermes/Flipper memory tooling) that memory doesn't keep climbing as you cycle through all 4 bundled translations repeatedly.
   - The actual concurrent-load path: read `ADB1905`, run a search (triggers the `KJV` "also translation" snippet per Phase 0), then read `WEB` or `OEB`, then switch back to `ADB1905`. Confirm the "also" snippet and the reader content both still render correctly after the eviction.

**Exit criteria for Phase 3:** New unit tests pass and specifically assert cross-cache coherence (not just "no crash"), existing overlay/search suites are green and confirmed to either bypass or correctly tolerate the new cache behavior, and a manual device pass shows flat (not climbing) memory across a translation-cycling session.

---

## Phase 4 — Rollout

1. **Ship Fix A alone.** Per the earlier discussion, this is intentionally decoupled from Fix B (Metro asset loading) — do not bundle them into the same PR/release, since it makes it harder to attribute a regression to one or the other if something surfaces post-release.
2. **What to watch after release:**
   - Any crash reports or error logs referencing `bookNavPromiseCache`, `vagueKeywordIndex`, or `loadTranslationData` — the eviction path is new code, so this is where a coherence bug would surface first.
   - Any user reports of "chapter reset to wrong translation" or "search results look wrong after switching versions" — vague symptoms, but plausible if a partial-eviction bug slipped through Phase 2/3.
   - If you have any client-side telemetry for JS heap size or app cold-start memory, compare before/after — this is the metric Fix A is actually meant to move.
3. **Rollback plan:** Since this is a self-contained cache-implementation change with no data-shape or API changes, reverting is a straightforward single-PR revert if needed — no migration or data cleanup involved.

---

## Summary checklist

- [ ] Phase 0: Confirmed onboarding/pin-loading concurrency, all `translationDataCache` call sites, `LruMap` exact semantics
- [ ] Phase 1: `translationDataCache` (or split bundled/API caches) is an `LruMap`, capacity decided and documented
- [ ] Phase 2: Eviction callback clears `bookNavPromiseCache` + keyword index in lockstep; re-load-after-eviction path verified
- [ ] Phase 3: New unit tests for LRU behavior + cross-cache coherence; existing search suites confirmed unaffected; manual device pass shows flat memory
- [ ] Phase 4: Shipped standalone (not bundled with Fix B); monitoring plan in place
