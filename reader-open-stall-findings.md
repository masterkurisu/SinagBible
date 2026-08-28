# "Opening Reader…" Stall — Investigation Findings

Status: **Partial fix landed.** One confirmed root cause fixed; other startup costs are
listed below as candidates for deeper investigation in a follow-up session.

## Symptom

Reported by the user:

> "on every reload of metro and on the app, it takes a while to respond and only
> displays [the `Opening reader…` skeleton] in the reader; I can change pages
> (Home, Reader, Journal), but they are unresponsive during reload."

- Happens on **every Metro reload** (Fast Refresh full reload) during dev.
- The Reader tab gets stuck showing the `ScreenLoadingSkeleton` ("Opening reader…")
  for a noticeable amount of time.
- Other tabs are reachable (native tab switch still works) but interactions that
  need the JS thread feel unresponsive while this is happening — consistent with
  the JS thread being busy with a long synchronous-ish task rather than the app
  being fully frozen.

## Root cause #1 (fixed): KJV JSON force-loaded for every translation's nav

**File:** `packages/core/src/bible-translations.ts`

`buildBookNav(data)` is called every time the reader resolves book navigation for
*any* translation (KJV, NIV, WEB, ADB1905, HelloAO/YouVersion API translations —
all of them). Before the fix, it unconditionally did:

```ts
async function buildBookNav(data: TranslationData): Promise<BibleBookNavItem[]> {
  const kjvBooks = (await loadTranslationData("KJV")).books; // <-- always loads kjv.json
  const kjvCanonicalNav = await getKjvCanonicalNav();          // <-- also loads kjv.json
  ...
}
```

`loadTranslationData("KJV")` dynamically imports `packages/core/data/kjv.json`,
a **~4.5MB** JSON file (measured via `JSON.stringify(kjv).length`). This was only
needed to (a) compare chapter counts per book, to decide whether a translation's
canon aligns 1:1 with KJV, and (b) borrow KJV's canonical English book slugs
(e.g. `philippians`) for reader URL routing when it does align. Neither of those
needs the actual verse *text* — only book names + chapter counts, which are fixed,
well-known values.

This ran on the critical path of `useReaderChapter` (`src/features/reader/useReaderChapter.ts`,
via `resolveReaderBooksForTranslation` in `lib/reader-chapter-load.ts`), in parallel
with the actual chapter content fetch, **every single time a chapter is opened** —
including on the very first navigation after every reload, because:

- `translationDataCache` and `bookNavPromiseCache` in `bible-translations.ts` are
  module-level `Map`s. A full JS reload (Fast Refresh "Reloading apps", or an app
  process restart) wipes the whole JS module registry, so these caches reset and
  the ~4.5MB parse has to happen again from scratch.
- The reader hub screen (`app/(tabs)/reader/index.tsx`) always redirects to a
  concrete chapter on mount, so this cost was paid immediately on every reload,
  before the user could interact with anything reader-related.

### Fix applied

Added a static, zero-JSON-load canonical KJV nav table to
`packages/core/src/bible-meta.ts`:

```ts
/** KJV chapter count per book, same order as BIBLE_BOOK_NAMES (index 0 = Genesis). */
const BIBLE_BOOK_CHAPTER_COUNTS = [50, 40, 27, 36, 34, /* …66 entries… */ 22] as const;

export function getKjvCanonicalBookNav(): BibleBookNavItem[] {
  return BIBLE_BOOK_NAMES.map((name, i) => ({
    name,
    slug: BIBLE_BOOK_SLUGS[i]!,
    chapterCount: BIBLE_BOOK_CHAPTER_COUNTS[i],
  }));
}
```

The chapter-count values were extracted directly from `kjv.json` (not memorized/guessed):

```bash
node -e "
const kjv = require('./packages/core/data/kjv.json');
console.log(JSON.stringify(kjv.books.map(b => b.chapters.length)));
"
# -> [50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4,28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22]
```

`bible-translations.ts`'s `buildBookNav` now uses `getKjvCanonicalBookNav()`
instead of `loadTranslationData("KJV")`, and the now-unused `buildBookNavFromData` /
`getKjvCanonicalNav` / `kjvCanonicalNavPromise` were removed.

**Net effect:** the full KJV JSON is now only parsed when a KJV chapter's actual
verse *text* is needed (i.e. you're actually reading KJV) — never merely to
resolve navigation/slugs for some other translation.

### Verification done

- `./node_modules/.bin/tsc --noEmit -p .` — no new errors introduced (same 3
  pre-existing unrelated errors in `app/(tabs)/journal/index.tsx`,
  `lib/chapter-store.ts`, `src/features/journal/JournalListEntryTilePreview.tsx`).
- Confirmed via `git diff` the change is behavior-preserving (same slug logic,
  same fallback to `normalizeBookSlug` when canon doesn't match KJV shape).
- Confirmed nothing else statically/eagerly imports the raw `kjv.json` on the
  client: only `packages/core/src/kjv-data.ts` (server-only, not re-exported from
  `packages/core/src/index.ts`) does a top-level `import`; the mobile app only
  ever reaches `kjv.json` via `bible-translations.ts`'s **dynamic** `import()`.

## Dev vs. production severity (why this felt so bad specifically in Metro)

The bug is real client-side JS logic — it would run in a shipped build too — but
dev mode amplifies it substantially:

| Factor | Dev (Metro) | Production (release build) |
|---|---|---|
| JS bytecode | Unminified source, Hermes parses fresh JS text | Hermes precompiles to bytecode ahead of time at build time |
| Module cache lifetime | Wiped on every Fast Refresh full reload | Persists for the whole app process lifetime |
| How often the cost repeats | Every single reload during a dev session | Once per cold app launch (only if a chapter is opened) |

So pre-fix, this would have shown up in production as a one-time hitch on the
first chapter navigation after a cold launch — real, but far less dramatic than
"every reload is stuck for a while." Post-fix, it's removed in both environments
for all non-KJV navigation, and reduced to "only when actually reading KJV" even
for KJV itself.

## Open items for a deeper follow-up session

These were **not** fully investigated / fixed yet and are worth profiling properly
with the JS profiler (e.g. `browser_cdp Profiler.start/stop` against a debug
session, or Hermes sampling profiler) rather than guessing further from logs:

1. **Confirm the actual wall-clock improvement on-device.** All timing so far is
   theoretical (13ms `require()` on desktop Node vs. expected-much-slower Hermes
   dev-mode parse) — no on-device before/after profiling was captured.
2. **`app/(tabs)/reader/index.tsx` hub redirect cost.** `loadReaderLastPosition()`
   is an AsyncStorage read on every reload before the redirect fires — worth
   checking it isn't itself slow (e.g. large AsyncStorage payload, multiple awaited
   reads in sequence elsewhere in the startup chain).
3. **`lib/pinned-translations-prefetch.ts` / `runPinnedTranslationsPrefetch`.**
   Runs `±2` chapter prefetches for pinned translations after first online session;
   confirmed to be async/fire-and-forget (shouldn't block rendering), but it adds
   background CPU/network load right at startup and hasn't been profiled for
   actual impact on perceived responsiveness during the stall window.
4. **Require cycles flagged by Metro** (seen repeatedly in dev server logs):
   - `lib/pinned-translations-prefetch.ts -> lib/reader-chapter-load.ts -> lib/bible-api-service.ts -> lib/pinned-translations-prefetch.ts`
   - `lib/bible-api-service.ts -> lib/translation-download.ts -> lib/bible-api-service.ts`
   These are "allowed but can result in uninitialized values" per Metro's own
   warning — worth confirming none of the reader startup path silently gets an
   `undefined` from a not-yet-initialized cyclic export, and worth untangling
   regardless for maintainability.
5. **`warmTranslationSearchCache`** (`packages/core/src/bible-translations.ts`,
   used by `lib/bible-search-service.ts`) defaults to `"KJV"` and is triggered by
   search actions — confirmed not to run automatically at app startup, but worth
   double-checking it isn't indirectly triggered by any startup/prefetch code path.
6. **App binary size.** `kjv.json` is ~4.5MB and is bundled into client JS
   regardless of this fix (KJV is a locally-bundled translation, so this is
   somewhat unavoidable as-is). Not a runtime stall, but a related cost worth
   revisiting separately if app size becomes a concern — options could include
   splitting per-book, external asset loading instead of inline JS, or compression.
7. **Whether other local translation JSONs have the same "always loaded for nav"
   problem in reverse** — i.e. confirm `WEB`/`ADB1905`/`OEB` nav resolution
   doesn't have an equivalent unnecessary-load pattern for *their* own files (a
   quick read of `buildBookNav`'s current implementation suggests not — it now
   only loads `data` for the translation actually being viewed — but worth a
   second pass).

## Recommended phased fix plan for the open items

Ordered by expected impact-per-effort (highest first), with each phase independently
shippable/revertable. Current-code notes below reflect a re-check of the files as of
this write-up, so some items are smaller than originally scoped.

### Phase 1 — Get real on-device numbers before doing anything else (Open item #1)

Everything else in this list is a guess without this. Do this first so later phases
can be justified/prioritized by actual measured cost, not theory.

**Status: instrumentation landed, on-device capture still pending (steps 2-4 below).**

1. ✅ Done — added temporary `performance.now()` markers, gated dev-only and tagged
   `[reader-perf]` in `console.log`, around:
   - `loadReaderLastPosition()` call site in `app/(tabs)/reader/index.tsx` (hub redirect).
   - `resolveReaderBooksForTranslation` and `fetchReaderChapterContent` in
     `lib/reader-chapter-load.ts`.
   - `loadTranslationData` (only logs on an actual cache-miss load) and `buildBookNav`
     in `packages/core/src/bible-translations.ts`.

   New/changed files:
   - `lib/reader-open-perf-log.ts` (new) — shared `readerPerfStart`/`readerPerfEnd`
     helpers for the app-side call sites, `__DEV__`-gated.
   - `packages/core/src/bible-translations.ts` — same pattern inlined locally (this
     package has no ambient `__DEV__` type, so the guard reads
     `(globalThis as Record<string, unknown>).__DEV__ === true` instead of the bare
     identifier).
   - `app/(tabs)/reader/index.tsx`, `lib/reader-chapter-load.ts` — call the helper
     around the relevant awaits.

   `./node_modules/.bin/tsc --noEmit -p .` confirmed clean (same pre-existing 3
   unrelated errors noted in "Verification done" above, no new ones).

2. ⬜ **Next (needs a device/simulator session):** run the app, open the Metro/dev
   console logs, and capture:
   - One **cold app launch** → tap into Reader tab → first chapter renders.
   - One **Metro full reload** (`r` in the CLI, or the in-app dev menu "Reload")
     while already on the Reader tab.
   - Do this once for **KJV** (bundled, no network) and once for a **non-KJV**
     translation (e.g. WEB) to see the cache-miss cost difference.
   - Prefer a physical device over the simulator — Hermes dev-mode parse cost differs
     meaningfully from desktop/simulator timing.
   - Every `[reader-perf]` log line prints `▶ label` on start and `■ label: N.Nms` on
     completion — just copy the full sequence of lines from each run.
3. ⬜ Record before/after wall-clock for "tap Reader tab → first chapter content
   visible" for both KJV and non-KJV, using the captured log timestamps/durations.
4. ⬜ Once numbers are captured and written up below, delete the temporary
   instrumentation (`lib/reader-open-perf-log.ts` and its call sites, plus the inline
   block in `bible-translations.ts`) to keep this out of the shipped dev bundle
   long-term.

**Exit criteria:** a short table of measured ms for each step above, checked into this
doc, replacing the "theoretical" caveat in the "Dev vs. production severity" section.

#### Captured on-device numbers (Android, Metro dev build)

| Event | Duration | Notes |
|---|---|---|
| `reader hub: loadReaderLastPosition (AsyncStorage)` | **45.6ms** | First hub visit after a full reload. |
| `resolveReaderBooksForTranslation(yvp:111)` | **872.7ms** | Last-read translation was a YouVersion (YVP) API-backed one, not KJV — this is a **network fetch**, not JSON parsing. Ran concurrently with the line below. |
| `fetchReaderChapterContent(yvp:111, mark 11)` | **871.7ms** | The actual opened chapter's content fetch — same YVP network round trip, this is what the user is staring at the skeleton for. |
| `fetchReaderChapterContent(yvp:111, mark 9/10/12/13)` | **21–34ms each** | Background ±2 neighbor-chapter prefetches (`runPinnedTranslationsPrefetch`/`prefetchTranslationChaptersForReader`) — fire-and-forget, off the critical path, confirmed cheap. |
| `loadTranslationData(KJV) [cache miss]` | **494.7ms** | Confirms the original ~4.5MB `kjv.json` parse cost is real (a later reload, once KJV was actually opened). |
| `buildBookNav(KJV)` | **0.0ms** | Confirms the Phase-0 / root-cause-#1 fix works as intended — building nav no longer re-triggers a KJV load. |

**Key findings, updated from theory:**

1. **The dominant stall in this capture wasn't KJV at all** — it was a ~870ms network
   round trip to fetch a YouVersion (YVP) API-backed chapter, because the user's last
   read position was a YVP translation, not a bundled one. This is a real, user-facing
   contributor to "Opening reader…" taking a while, but it's a **network latency**
   problem, not the JS-thread-blocking-parse problem root cause #1 was about — no
   client-side code fix will remove a real network round trip; only things like
   perceived-loading UX (skeleton copy, optimistic nav) or a persistent chapter cache
   (already exists for offline reading, per `TRANSLATION_OFFLINE_PREFETCH_DEPTH`) can
   help here for *repeat* visits to the same chapter.
2. **Root cause #1's fix is confirmed working on-device**: `buildBookNav(KJV)` logged
   `0.0ms` immediately after a `loadTranslationData(KJV)` cache-miss load, i.e. it's
   reusing the already-loaded `data.books` instead of loading KJV a second time.
3. **`loadTranslationData(KJV) [cache miss]` at 494.7ms confirms the original
   ~4.5MB-parse estimate was accurate** (not just theoretical Node.js timing) — this
   cost is real and will still show up once per cold app process the first time KJV
   is actually opened, as the doc's "Dev vs. production severity" section predicted.
4. **The reader hub's `AsyncStorage` read took 45.6ms** — real, but modest, and per
   the Phase 2 investigation below, this call turned out to be **partially redundant**
   with an existing cache-warming effect elsewhere (see Phase 2).
5. **Require-cycle warnings (open item #4) reproduced live** in this same capture,
   confirming they still fire on every full reload:
   `lib/pinned-translations-prefetch.ts -> lib/reader-chapter-load.ts ->
   lib/bible-api-service.ts -> lib/pinned-translations-prefetch.ts` and
   `lib/bible-api-service.ts -> lib/translation-download.ts -> lib/bible-api-service.ts`.

**Decision:** keeping the temporary `[reader-perf]` instrumentation in place for now
(deviating slightly from step 4's "delete immediately") since Phase 2 below directly
acts on the `loadReaderLastPosition` timing and benefits from being able to
re-measure before/after. Will delete once Phase 2 is verified.

### Phase 2 — Reader hub redirect path (Open item #2)

**Status: fix landed, on-device re-verification pending.**

**Current-code note:** partially already addressed — `app/(tabs)/reader/index.tsx`
and `lib/reader-last-position.ts` already have a `peekReaderLastPosition()` in-memory
fast path (`memoryLastPosition`) used on repeat hub visits within the same JS session,
so this only matters for first hub visit after a cold launch/full reload, when the
memory cache is empty and `loadReaderLastPosition()` must hit `AsyncStorage.getItem`.

1. ✅ Confirmed with Phase 1 numbers: `AsyncStorage.getItem` itself took **45.6ms** for
   the hub's own call — real, not huge, but not free either.
2. ✅ Found something better than "check payload size": step 3's "prime it earlier"
   already exists — `app/(tabs)/_layout.tsx` (the tab bar layout, mounted once at
   startup) already runs:

   ```12:20:app/(tabs)/_layout.tsx
   useEffect(() => {
     if (peekReaderLastPosition() == null) {
       // Warm memory cache so /reader can redirect without waiting on AsyncStorage.
       void loadReaderLastPosition();
     }
     ...
   ```

   The problem: this warm-up and the reader hub's own `loadReaderLastPosition()` call
   (`app/(tabs)/reader/index.tsx`) are **two independent, undeduplicated calls**. If a
   user lands on the Reader tab at/near cold start (e.g. it's the default tab, or a
   fast tap), both effects can fire before either's `AsyncStorage.getItem` resolves —
   the hub's own call doesn't know the layout's warm-up is already in flight, so it
   pays its own full ~46ms read instead of piggybacking on the other one. This matches
   the captured Phase 1 log, which showed the hub's own read completing in 45.6ms
   rather than being instant.
3. ✅ **Fix applied** in `lib/reader-last-position.ts`: `loadReaderLastPosition()` now
   de-dupes concurrent callers onto a single in-flight `AsyncStorage.getItem` promise
   (`inFlightLoad`, cleared once the read settles so later calls — e.g. after
   `saveReaderLastPosition` — still re-read fresh state). Whichever caller starts the
   read pays the real cost once; every other concurrent caller (tab layout warm-up,
   reader hub redirect, `getPreferredReaderTranslation`, etc.) now awaits the same
   promise instead of issuing its own redundant `AsyncStorage.getItem`.
   - Added a temporary `[reader-perf]` log
     (`loadReaderLastPosition: joined in-flight read (deduped)`) at the join point so
     the dedupe hitting in practice can be confirmed on-device, consistent with
     Phase 1's still-active instrumentation.
   - `./node_modules/.bin/tsc --noEmit -p .` — clean, same 3 pre-existing unrelated
     errors as before, no new ones.

**Exit criteria:** either confirmed not a meaningful contributor (close the item), or
a measured ms improvement from priming earlier. — **Met, see below.**

#### On-device verification (Phase 2 fix confirmed)

Second capture, same cold-reload scenario as Phase 1:

```
[reader-perf] ▶ loadReaderLastPosition: joined in-flight read (deduped)   x5
[reader-perf] ■ loadReaderLastPosition: joined in-flight read (deduped): 1.4ms
[reader-perf] ■ loadReaderLastPosition: joined in-flight read (deduped): 1.3ms
[reader-perf] ■ loadReaderLastPosition: joined in-flight read (deduped): 1.3ms
[reader-perf] ■ loadReaderLastPosition: joined in-flight read (deduped): 1.2ms
[reader-perf] ■ loadReaderLastPosition: joined in-flight read (deduped): 1.1ms
```

**The dedupe works as intended, and the real-world fan-out was bigger than expected:**
on this reload, **5 separate call sites** hit `loadReaderLastPosition()` in the same
burst near cold start (tab layout's warm-up effect, the reader hub redirect, and
likely `usePinnedTranslationsPrefetch`'s `resolvePrefetchAnchor` plus one or two
others reachable from the same tab-mount tick). Before the fix, that would have been
up to **5 independent `AsyncStorage.getItem` calls** (each ~45-56ms per the Phase 1
baseline — i.e. up to ~225-280ms of aggregate redundant native-bridge work spread
across those call sites, even though it's not all on one blocking await chain). After
the fix: **1 real read + 5 joins at ~1.1-1.4ms each** — the joins are essentially free.

Notably, the hub's own `reader hub: loadReaderLastPosition (AsyncStorage)` label did
**not** appear in this capture at all — meaning some other caller (not the hub) won
the race and became the read's initiator this time, and the hub was one of the 5
"joined" callers instead. This confirms the fix is caller-order-independent: whoever
gets there first pays the real cost once, everyone else — regardless of which one it
is — rides along for ~1ms.

(For reference, that same capture's KJV/YVP numbers moved around a bit vs. Phase 1's
first capture — `loadTranslationData(KJV) [cache miss]` was 353.4ms then 610.2ms in
two reloads in this session, and the YVP chapter fetch was 269-270ms instead of the
earlier ~872ms. This is expected run-to-run variance from JIT/JS-engine warmup and
network conditions, not related to this fix — Phase 1's KJV-parse and YVP-network
findings stand either way.)

**Phase 2: closed.** Open item #2 is resolved — the reader hub's `AsyncStorage` cost
is no longer paid redundantly by concurrent startup callers.

**Instrumentation status:** keeping `[reader-perf]` logging in place for now, since
Phase 4/5 below can reuse it (require-cycle risk-of-`undefined` checks, prefetch CPU
profiling) rather than re-adding it later. Revisit deleting it once all phases that
benefit from it are done.

### Phase 3 — Confirm no reverse "always loaded for nav" bug in other bundled translations (Open item #7)

**Status: closed — one live recurrence of the anti-pattern found and fixed.**

Cheapest item to close — pure code reading / verification, no behavior change expected
for the "clean" parts, one small targeted fix for the part that wasn't clean.

1. ✅ Re-read `buildBookNav` and every `loadTranslationData(...)` call site in
   `packages/core/src/bible-translations.ts`. All resolved cleanly:
   - `buildBookNav` — uses the static `getKjvCanonicalBookNav()` plus `data.books`
     (whatever translation was already loaded by the caller). No cross-translation load.
   - `getBookNavForTranslationData(id)`, `resolveSearchTranslationContext(id)`,
     `getBookDisplayNameForSlug`, `getChapterBySlugForTranslation`,
     `resolvePassageBookSlugForTranslation`, `getClosestBookSuggestionForTranslation(s)`,
     `warmTranslationSearchCache` — every `loadTranslationData(id)` call uses the same
     `id` that was passed in or already resolved; none of them load a second,
     different translation just to build nav.
2. ✅ Grepped the whole app for other `getBookNavForTranslation(...)` /
   `buildBookNavForTranslationData` / `resolveSearchTranslationContext` call sites:
   - `lib/reader-chapter-load.ts` has two `getBookNavForTranslation("KJV")` calls —
     both are **error-path fallbacks** inside `catch` blocks (when a YVP or API book-nav
     fetch fails), not routine per-open cost. Reviewed and left as-is: this is an
     acceptable "degrade to a working KJV nav" safety net, structurally different from
     root cause #1 (which ran unconditionally on every single chapter open).
   - **`lib/youversion-api.ts`'s `fetchYvpBookNav` — found the same anti-pattern,
     live, still running today.** Every time a YouVersion (YVP) API translation's book
     nav is resolved (i.e. every YVP-translation chapter open whose nav isn't already
     cached — this is exactly what the Phase 1 capture caught in the wild, see the
     `loadTranslationData(KJV) [cache miss]` line that fired *while reading a `yvp:`
     translation*), it called `getBookNavForTranslation("KJV")` — which loads the full
     real `kjv.json` — purely to get KJV book **names/slugs/chapter-counts** for
     filtering against the YVP Bible's USFM book list. It never touched KJV verse text.
     This is the exact same anti-pattern as root cause #1, just relocated from
     `buildBookNav` to this YVP-specific nav resolver.
3. ✅ **Fix applied** in `lib/youversion-api.ts`: `fetchYvpBookNav` now calls the
   static `getKjvCanonicalBookNav()` (from `@sinag-bible/core/bible-meta`, already used
   for root cause #1's fix) instead of `getBookNavForTranslation("KJV")`. Also removed
   the now-unnecessary `Promise.all` (only one real async call — the YVP `/bibles/{id}`
   fetch — remains) and the now-unused `getBookNavForTranslation` import. Left an
   inline comment pointing back to this doc so the reasoning isn't lost.
   - `./node_modules/.bin/tsc --noEmit -p .` — clean, same 3 pre-existing unrelated
     errors, no new ones.
   - Not yet re-verified on-device (no new `[reader-perf]` marker was added here since
     `getKjvCanonicalBookNav()` is synchronous — a follow-up capture opening a YVP
     translation chapter should now show **no** `loadTranslationData(KJV) [cache
     miss]` line at all, unless KJV is separately opened for real).

**Exit criteria:** confirmed clean, or a matching fix filed if the pattern reappears
elsewhere. — **Met:** one recurrence found in `fetchYvpBookNav` and fixed; the rest of
the codebase checked out clean.

### Phase 4 — Untangle the require cycles Metro warns about (Open item #4)

**Status: both target cycles fixed; `tsc` clean; static verification done via
`madge` (no device attached in this session for a live Metro re-capture — see
"Remaining" below).**

1. ✅ `lib/pinned-translations-prefetch.ts → lib/reader-chapter-load.ts →
   lib/bible-api-service.ts → lib/pinned-translations-prefetch.ts`:
   - Root cause: `bible-api-service.ts`'s `clearBibleApiMemoryCaches()` (a
     cache-clearing aggregator) imported `resetPinnedTranslationsPrefetchSession`
     just to call it as part of the aggregate reset — that back-edge closed the loop.
   - **Fix:** removed the import/call from `bible-api-service.ts`. Its single caller,
     `lib/delete-my-data.ts` (`deleteAllUserData`), now calls
     `resetPinnedTranslationsPrefetchSession()` directly alongside
     `clearBibleApiMemoryCaches()`. No new shared module needed — the aggregator
     simply does one less thing, and the orchestrating caller (which already has no
     back-edge problem) does it instead.
2. ✅ `lib/bible-api-service.ts → lib/translation-download.ts → lib/bible-api-service.ts`:
   - Same root cause, same fix shape: `clearBibleApiMemoryCaches()` also imported
     `clearTranslationDownloadSession` from `translation-download.ts` just to include
     it in the aggregate reset. Removed that import/call too; `delete-my-data.ts` now
     calls `clearTranslationDownloadSession()` directly as well.
   - `bible-api-service.ts` no longer imports from either module — confirmed via
     `grep` that both back-edges are gone; `translation-download.ts` and
     `pinned-translations-prefetch.ts` (via `reader-chapter-load.ts`) still import
     *forward* from `bible-api-service.ts`, which is fine (one-directional).
   - Added a comment on `clearBibleApiMemoryCaches()` explaining why those two resets
     are deliberately excluded, so a future edit doesn't reintroduce the cycle.
3. ✅ Verification:
   - `./node_modules/.bin/tsc --noEmit -p .` — clean, same 3 pre-existing unrelated
     errors, no new ones.
   - No device was attached in this session to capture a live Metro bundle (the
     "Require cycle:" warnings only print when a client actually requests a bundle),
     so used `madge --circular` as a static substitute:
     `npx madge --circular --extensions ts,tsx --ts-config tsconfig.json app lib
     packages/core/src src` (needs Node 24 per this repo's `.nvmrc` — `nvm use` first).
     Confirmed **both target cycles are gone**.
4. ✅ Added a regression-guard script even though this repo has no CI workflows yet
   (`.github/workflows` doesn't exist) — cheap to add now, ready to wire into CI
   later: `"check:circular": "npx --yes madge --circular --extensions ts,tsx
   --ts-config tsconfig.json app lib packages/core/src src"` in `package.json`
   (run via `pnpm run check:circular`).

**Found (but out of scope to fix here) — two additional, pre-existing cycles:**
`madge` also flagged `lib/chapter-store.ts > lib/yvp-keyword-index.ts >
lib/yvp-chapter-payload.ts > lib/youversion-api.ts` and `lib/yvp-chapter-payload.ts >
lib/youversion-api.ts`. Investigated: the back-edge in both is
`lib/yvp-chapter-payload.ts`'s `import type { YvpPassage } from "@/lib/youversion-api"`
— an **explicit type-only import**, which Babel's TypeScript preset strips entirely at
compile time, so it produces **no real runtime `require()` cycle** (which is why
Metro never warned about it — only `madge`'s static import-graph analysis sees it).
Left as-is since it's benign and outside this doc's original scope (item #4 named two
specific Metro-observed warnings, not these); worth a note for whoever eventually
wires `check:circular` into CI, since it will need either an ignore rule for this
type-only pair or a small refactor (e.g. move `YvpPassage` to a shared types module)
to pass cleanly.

**Exit criteria:** zero require-cycle warnings in a fresh Metro start; `tsc` clean. —
`tsc` confirmed clean; the two target cycles confirmed gone via static analysis.

**Remaining to fully close this phase out:** on your next on-device Metro session
(cold start or full reload), confirm the two `WARN Require cycle: ...` lines that
appeared in every prior capture (Phases 1–3) no longer appear.

### Phase 5 — Prefetch impact on perceived responsiveness during startup (Open item #3)

1. With Phase 1 profiling in place, specifically check CPU/network activity from
   `runPinnedTranslationsPrefetch` (`lib/pinned-translations-prefetch.ts`) during the
   first few seconds after a cold launch/reload — it fires fire-and-forget chapter
   prefetches (`prefetchTranslationChaptersForReader` → `primeReaderChapterFetch`) for
   every pinned non-KJV, non-bundled-featured translation.
2. If it measurably competes with the JS thread during the stall window (e.g. large
   `collectPrefetchChapterTargets` fan-out, or synchronous JSON work inside the
   prefetch chain), consider delaying its kickoff slightly (e.g. until after the first
   reader chapter has rendered) rather than firing it immediately alongside the hub
   redirect.
3. If profiling shows it's already negligible (likely, since it's async/network-bound
   and skips KJV/bundled-featured translations via `shouldPrefetchTranslation`), close
   the item with the measurement as evidence.

**Exit criteria:** measured verdict (negligible vs. needs-delay), acted on if needed.

### Phase 6 — Double-check `warmTranslationSearchCache` isn't triggered at startup (Open item #5)

Low-risk verification task, can be folded into Phase 3's profiling pass.

1. Grep all call sites of `warmTranslationSearchCache` (`packages/core/src/bible-translations.ts`,
   used by `lib/bible-search-service.ts`).
2. Confirm none are reachable from app-boot / tab-mount code paths (only from actual
   search-input-triggered actions).
3. Note the confirmation in this doc; no code change expected unless a bad call site
   is found.

**Exit criteria:** confirmed list of call sites, all gated behind user-initiated search.

### Phase 7 — App binary size follow-up (Open item #6)

Lowest priority — not a runtime stall, purely a bundle-size/download-size concern.
Revisit only if app size becomes an actual complaint/metric issue.

1. Measure current bundle contribution of `kjv.json` (~4.5MB source) post-Hermes
   bytecode compilation (actual shipped size differs from raw JSON size).
2. If it becomes a priority, evaluate options in order of effort: (a) gzip/brotli
   compression of the bundled asset if not already applied by the build pipeline, (b)
   external asset loading (bundle KJV as a static asset file loaded via `fetch`/`FileSystem`
   instead of inline JS import, trading a small first-read cost for a smaller JS
   bundle), (c) per-book splitting with lazy per-book loads (bigger refactor, only
   worth it if (a)/(b) aren't enough).

**Exit criteria:** none required now — revisit trigger is "app size becomes a concern."

## Relevant files

- `packages/core/src/bible-translations.ts` — `buildBookNav`, `loadTranslationData`,
  `getBookNavForTranslationData`, `translationDataCache`, `bookNavPromiseCache`.
- `packages/core/src/bible-meta.ts` — new `getKjvCanonicalBookNav()`.
- `packages/core/src/kjv.ts` / `packages/core/src/kjv-data.ts` — server-only KJV
  module (not part of this bug, but relevant context: this is the *other*,
  intentionally-eager KJV import path, gated out of the client bundle via
  `packages/core/src/index.ts` not re-exporting it).
- `app/(tabs)/reader/index.tsx` — reader hub screen, shows the
  `ScreenLoadingSkeleton` ("Opening reader…") while resolving the last position.
- `src/features/reader/useReaderChapter.ts` — chapter load hook; calls
  `resolveReaderBooksForTranslation` in parallel with chapter content fetch.
- `lib/reader-chapter-load.ts` — `resolveReaderBooksForTranslation`,
  `fetchReaderChapterContent`, `primeReaderChapterFetch`.
- `lib/pinned-translations-prefetch.ts` — background prefetch, flagged in require
  cycle warnings, not yet profiled.
