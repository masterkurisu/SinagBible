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

### Phase 2 — Reader hub redirect path (Open item #2)

**Current-code note:** partially already addressed — `app/(tabs)/reader/index.tsx`
and `lib/reader-last-position.ts` already have a `peekReaderLastPosition()` in-memory
fast path (`memoryLastPosition`) used on repeat hub visits within the same JS session,
so this only matters for first hub visit after a cold launch/full reload, when the
memory cache is empty and `loadReaderLastPosition()` must hit `AsyncStorage.getItem`.

1. Confirm with Phase 1 numbers whether the `AsyncStorage.getItem` call itself is
   slow, or whether the redirect is actually gated on something else (e.g. waiting on
   `useFocusEffect` timing, router transition cost).
2. If `AsyncStorage.getItem` is meaningfully slow: check payload size (should be a
   tiny JSON object — `bookSlug`, `chapter`, `translationId`) and whether other
   startup code paths are doing their own AsyncStorage reads concurrently and
   contending for the same underlying store/lock.
3. Consider priming `memoryLastPosition` earlier in the app boot sequence (e.g. in the
   root layout, before the reader tab ever mounts) so the hub's first redirect can use
   the synchronous `peekReaderLastPosition()` path even on a cold start.

**Exit criteria:** either confirmed not a meaningful contributor (close the item), or
a measured ms improvement from priming earlier.

### Phase 3 — Confirm no reverse "always loaded for nav" bug in other bundled translations (Open item #7)

Cheapest item to close — pure code reading / verification, no behavior change expected.

1. Re-read `buildBookNav` in `packages/core/src/bible-translations.ts` (current
   version already only calls `getKjvCanonicalBookNav()` — a static table, no JSON —
   plus `data.books`, which is whatever translation's data was already loaded by the
   caller). Confirm no other function in the file calls `loadTranslationData` for a
   translation other than the one being resolved.
2. Grep the mobile app (`lib/`, `src/`) for any other call sites that resolve one
   translation's nav/slugs by loading a *different* translation's JSON (the same
   anti-pattern as root cause #1, just for WEB/ADB1905/OEB instead of KJV).
3. Add a short code comment or a lightweight dev-only assertion (e.g. in
   `loadBundledTranslationData`) if useful to prevent regression.

**Exit criteria:** confirmed clean, or a matching fix filed if the pattern reappears
elsewhere.

### Phase 4 — Untangle the require cycles Metro warns about (Open item #4)

Do this after Phases 1–3 so you're not chasing a cycle that turns out to be
performance-irrelevant; this is primarily a correctness/maintainability risk
(possible `undefined` from a not-yet-initialized cyclic export) rather than a
confirmed stall cause.

1. `lib/pinned-translations-prefetch.ts → lib/reader-chapter-load.ts →
   lib/bible-api-service.ts → lib/pinned-translations-prefetch.ts`:
   - Identify the actual symbol(s) each edge needs from the next module.
   - Likely fix: extract the shared piece `bible-api-service.ts` and
     `pinned-translations-prefetch.ts` both need (or that `reader-chapter-load.ts`
     re-exports) into a small standalone module with no back-edge, e.g. a
     `reader-prefetch-types.ts` or similar, and have both sides import from that
     instead of from each other.
2. `lib/bible-api-service.ts → lib/translation-download.ts → lib/bible-api-service.ts`:
   - Same approach — find the specific shared function/type causing the back-edge and
     hoist it to a leaf module.
3. After breaking each cycle, run `./node_modules/.bin/tsc --noEmit -p .` and start
   Metro fresh to confirm the "Require cycle:" warnings are gone from the dev server
   log.
4. Add a regression guard if the repo has (or can cheaply add) a lint rule / madge-style
   circular-dependency check in CI, so these don't silently reappear.

**Exit criteria:** zero require-cycle warnings in a fresh Metro start; `tsc` clean.

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
