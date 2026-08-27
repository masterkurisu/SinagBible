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
