# Search feature

This document describes how search is structured, what it can do, and how a query becomes results. The primary product surface is the **tab-bar search overlay** (Bible + journal together). The **journal list** has a second, list-only search. A few other screens reuse pieces of the same matching logic.

---

## 1. What the user sees

### Global search (tab-bar overlay)

Search is not a full-screen tab. The fourth bottom-nav slot is a disabled native-tab placeholder. A circular magnifying-glass FAB sits on top of that slot. Tapping it opens a Material 3 overlay:

- A **frosted** wash covers the current tab so the sheet keeps focus.
- A **search bar** (M3 stadium, `surface-container-high`, elevation 1) expands from the FAB above the tab bar.
- A **results sheet** (`surface-container-low`, 28dp top corners) sits above the bar. Idle is ~74% of screen height; while querying or showing results it extends to the top safe area.
- **Filter** chips wrap as M3 filter chips (32dp, 8dp corners). Quick picks are filled 12dp cards (`surface-container-highest`). Recent and Bible hits use two-line list items with outline-variant dividers.
- Android hardware back, tapping the frost, or the close control dismisses the overlay and clears the query.

Placeholder copy: *“Search Bible, references, and journal”*.

The overlay is available on Home, Bible, and Journal. On Android reader chapter screens, the FAB can hide with the tab bar on scroll; a parallel chrome component (`ReaderBottomNavSlideChrome`) keeps the FAB in that motion.

### Idle vs querying

| State | What appears |
| --- | --- |
| Empty query | **Filter** chips, then **Quick picks** (up to 5 cards) and **Recent** (up to 3 pill rows, removable). Optional mic on the pill. |
| Empty query + a Marks chip | **Marks** section: highlighted, underlined, or saved verses (cap 20). Not Quick Picks. |
| Typing, no results yet | Centered “Searching…” spinner (chips stay visible) |
| Matches | Sectioned list: **Journal** first, then **Bible** (or **Marks** when listing personal marks with no keyword), then **Related** for reference / named-passage queries. Bible snippets highlight the match, may show a neighbor verse, and may show an also-in line. |
| Still loading more Bible hits | Inline “Searching Bible…” under existing journal rows |
| Partial YVP hydrate | Footer: “Some verses could not be loaded. Tap to retry.” |
| No matches | “No matches.” plus optional **Did you mean** book chips (and the retry footer if hydrations failed) |
| Error | “Search is unavailable right now. Please try again.” |

Tapping a Bible row opens that verse in the reader (same translation as search) and saves last-read position. Tapping a journal row opens `/journal/{id}`. Both dismiss the overlay.

### Journal-tab search (list filter)

The Journal tab has its own search bar (iOS header bar; Android large app bar). It only filters **local journal entries**, does not search the Bible, and does not share the overlay’s history or quick picks. Placeholder: *“Search entries, verses, dates, tags…”*.

---

## 2. Feature set

**Bible**

- Passage references (`John 3:16`, `john 3 16`, `jn 3 16`, `Romans 8`, `Genesis 1:1-3`, `John 3:16-18`)
- Book names and prefixes while typing (`mat` → Matthew)
- Whole-word keyword search (`love`, `faith`, `anxiety`)
- English synonym expansion for overlay keywords (`anxious` → also search `anxiety`; KJV/WEB/YVP English, not Tagalog/Cebuano)
- Named-passage aliases (`lord's prayer`, `prodigal son`, `23rd psalm`)
- Curated popular verses for thematic keywords
- Typo / near-miss book titles (“Did you mean”)
- Common aliases: `Psalm` → `Psalms`, `prov` → `proverbs`, `II Corinthians`, `1st John`, `St. John`, plus shorts (`jn`, `rom`, `ps`/`psa`, `mt`/`mk`/`lk`, `1jn`/`1pe`, …)
- Results in the **active reader translation** (bundled, helloao, or YouVersion)
- Optional **also-in** snippet: same verse in another pinned translation (`Also in NIV` chip, or `also:WEB` / `also:niv`). Not a second result list
- Capped keyword lists (score, then per-book cap, then max 20; NT/OT mix is a tie-break)
- Overlay scope: **Whole Bible** (default) vs **this book** (last-read). Keywords stay in-book; `John 3:16` and named passages still navigate. Typed `book:john` overrides the chip
- Bible row preview: highlighted match span plus an optional neighboring verse; journal rows keep the ~160-character body preview
- Personal marks (opt-in): **Marks** / **Highlights** / **Underlines** / **Saved verses** chips, highlight color dots, or `in:highlights` / `in:underlines` / `in:favorites` / `in:marks` / `color:yellow`. Keyword search does **not** shrink to marked verses unless a gate is on
- Topical index for themes whose word often does not appear in the verse (`trinity`, `baptism`, `holy spirit`, …). Separate from popular whole-word verses
- AND combinators in one query: `book:john`, `tag:gratitude`, date phrases (`last week`, `2026-01`), plus a keyword remainder. No OR / NOT / parentheses
- Strong’s numbers (`G26`, `H7225`, `strong:g26`) → a small curated verse list with a `G26 · agape` caption. Not a Greek/Hebrew corpus or lemma search. Digit-only `26` / `316` stay locked
- Related verses after a **reference or named passage** (separate **Related** section). Explicit cross-ref table, not leftover `love` keyword hits. Not Quick Picks and not “Did you mean”
- Optional **voice search** (mic on the pill). Overlay typing still works if the OS recognizer, permission, or native module is missing

**Journal (global overlay)**

- Same query runs against local entries (synchronous below 200 cached entries; 140 ms debounce at 200+)
- Matches title, body, passage, book, chapter, translation tokens, tags, dates (`today` / `yesterday` / `last week` / `2026-01` / `jan 1 - jan 7`)
- Power-search AND: `love tag:gratitude last week` requires the keyword, tag, and date together. `tag:gratitude` alone lists tagged entries. Bare `gratitude` still OR-matches a tag or Bible keyword
- Passage queries accept the same shapes as Bible overlay (`John 3:16`, `john 3 16`, `jn 3:16`)
- Exact query `favorite` / `favorites` (or the overlay **Favorites** chip) restricts overlay journal hits to starred entries
- Fuzzy title matching (Levenshtein)
- Overlay list ranks by `journalEntrySearchRelevanceScore`, then `created_at` descending
- Journal-tab search **does** rank by relevance, then the current sort (unchanged; still uses `journalEntryMatchesSearchQuery`). The tab’s Favorites filter is unchanged

**Session / chrome**

- 280 ms debounce while typing Bible search
- History recorded on **submit** (keyboard Search) or **immediate** picks (quick pick, recent, book chip) — not on every keystroke
- Up to 10 history items in AsyncStorage; overlay shows 3
- Cache warm-up for the reader translation’s keyword index (YVP also indexes already-cached Psalms / John / Romans chapters)
- Overlay resets when closed; in-flight YVP hydration is cooperatively cancelled
- Partial YVP hydration can show a footer retry (“Some verses could not be loaded”)
- When last-read is set, **Whole Bible** / **{Book}** chips scope Bible results; overlay close resets to Whole Bible
- **Favorites** chip (always visible) restricts overlay journal rows to starred entries; empty query still shows Quick Picks. Overlay close clears the chip. The Journal tab Favorites filter is separate and unchanged
- **Highlights** / **Underlines** / **Saved verses** chips opt into reader marks (not journal favorites). **Marks** is any of the three. Color dots appear for highlights / all-marks. Overlay close clears them. `in:favorites` is saved carousel verses; plain `favorites` is still journal
- **Also in {abbr}** chip (first pinned translation that is not the reader translation) adds a muted second-line snippet. Overlay close clears it. Typed `also:WEB` wins over the chip
- **Voice.** Mic on the search pill when the OS recognizer is available. Decline permission or missing native module → keep typing. Overlay close stops listening. Interim speech fills the box without searching; the final phrase runs the search

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Native tab bar  (Home · Bible · Journal · disabled Search slot)│
│  TabBarSearchFab  →  TabBarSearchProvider.isOpen                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    TabBarSearchLayer (overlay)
                               │
              ┌────────────────┴────────────────┐
              │         useBibleSearch           │
              │  query, debounce, history, UI    │
              └────────────┬──────────┬─────────┘
                           │          │
                           │          └── journal-local-search (overlay ranks; journal page filters)
                           │
                bible-search-service (router)
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    Bundled IDs      helloao API ids     YouVersion (yvp:N)
    (KJV, WEB, …)    (eng_net, …)        native index if coverage, else KJV + hydrate
         │                 │                 │
         └────────┬────────┘                 │
                  ▼                          ▼
     searchLoadedTranslation      getSearchResultsForYvpTranslation
     (@sinag-bible/core)          (native postings or KJV → fetch hit chapters)
```

Search is **client-side**. There is no remote search API. Bundled and helloao translations search an in-memory verse corpus. YouVersion translations use an incremental native keyword index when cached chapters cover the query tokens; otherwise they search KJV first, then fetch only the chapters that contain hits and swap in YVP verse text. Overlay **query** never calls `getYvpSearchTranslationContext`. Warm-up may start a background corpus **fill** (`scheduleYvpSearchCorpusJob`) that writes chapters through `fetchYvpChapter` / `putChapter` so the native index can grow.

---

## 4. File map

### Overlay UI and state

| Path | Role |
| --- | --- |
| `app/(tabs)/_layout.tsx` | Wraps tabs in `TabBarSearchProvider`; mounts FAB + overlay; warms search cache |
| `app/(tabs)/search.tsx` | Empty placeholder so the fourth nav slot exists |
| `lib/tab-bar-search-context.tsx` | `isOpen` / `openSearch` / `closeSearch` |
| `src/features/search/TabBarSearchFab.tsx` | Circular FAB in the fourth slot |
| `src/features/search/tabBarSearchFabChrome.ts` | FAB size (64px), position, Android scroll-hide distance |
| `src/features/search/TabBarSearchLayer.tsx` | Overlay animation, pill input, optional voice mic, results sheet |
| `src/features/search/SearchResultsBody.tsx` | Idle / loading / empty / error / sectioned results; scope chips; journal Favorites; Highlights / Underlines / Saved verses; Also in; color dots; verse highlight; Related section |
| `src/features/search/searchVerseSnippet.ts` | Match-span finder for Bible overlay snippets |
| `src/features/search/useBibleSearch.ts` | Query lifecycle, debounce, dual result sources, Bible scope, overlay journal favorites, reader marks, also-in, power combinators, related verses |
| `src/features/search/useSearchVoice.ts` | Optional speech-to-text; typing still works without it |
| `src/features/search/ReaderBottomNavSlideChrome.tsx` | Android reader: FAB slides with the tab bar |

### Bible search engine

| Path | Role |
| --- | --- |
| `lib/bible-search-service.ts` | Route by translation id → bundled / helloao / YVP; English synonym expand + merge |
| `lib/search-query-synonyms.ts` | Small English clusters (`anxious` / `anxiety` / `worry`, …) |
| `packages/core/src/bible-translations.ts` | Main search: vague vs specific, scoring, suggestions, this-book scope |
| `packages/core/src/vague-keyword-index.ts` | Per-translation inverted word index |
| `packages/core/src/search-keyword-popular.ts` | Curated verses for ~30 thematic keywords (whole-word hits) |
| `packages/core/src/search-topical-index.ts` | Theme → verse refs where the topic word often does not appear (`trinity`, …) |
| `packages/core/src/search-named-passages.ts` | ~50 named-passage aliases → one anchor verse |
| `packages/core/src/search-strongs-index.ts` | Curated Strong’s `G##` / `H####` → verse refs + English gloss (not a lemma corpus) |
| `packages/core/src/search-related-verses.ts` | Explicit cross-ref table for reference / named-passage queries |
| `packages/core/src/reference-aliases.ts` | `Psalm`/`prov`/`II`/`1st`/`St.` expansions; space-separated `john 3 16`; book shorts (`jn`, `rom`, `ps`, `1jn`, …) |
| `packages/core/src/book-aliases.ts` | Known misspellings (`mathew` → Matthew) |
| `packages/core/src/text-utils.ts` | Levenshtein + fuzzy distance by query length |
| `packages/core/src/kjv.ts` | Chapter/nav/data for non-client use (`getChapterBySlug`). Search APIs live in `bible-translations.ts`. |

### YouVersion

| Path | Role |
| --- | --- |
| `lib/yvp-translation-search.ts` | **Live path:** native YVP index when coverage is enough; else KJV search then hydrate hit chapters (concurrency 4, overlay `AbortSignal`) |
| `lib/yvp-keyword-index.ts` | Incremental per-`translationId` postings (parse via `yvpPassageToBibleChapter`); SQLite persist; 60-chapter **memory** LRU (SQLite postings are not deleted on evict) |
| `lib/yvp-corpus-policy.ts` | Wi-Fi / idle / disk / storage gates and missing-chapter math for the background fill |
| `lib/yvp-corpus-job.ts` | Resumable background fill of missing YVP chapters via `fetchYvpChapter` (not overlay query) |
| `lib/yvp-search-corpus.ts` | RAM corpus builder for perf snapshot only; re-exports `scheduleYvpSearchCorpusJob` |
| `lib/yvp-translation-search.test.ts` | Hydration, cancel, failed-count, and native-index tests |

### Personal marks

| Path | Role |
| --- | --- |
| `lib/reader-marks-search.ts` | `in:` / `color:` parser; filter Bible hits; list marks as overlay rows |
| `lib/search-power-query.ts` | AND combinators (`book:`, `tag:`, `also:`, date phrases) on the marks remainder |
| `lib/search-also-translation.ts` | Same-verse snippet from a second translation (bundled preview or cached YVP chapter) |
| `lib/search-related-results.ts` | Hydrate related refs in the active translation |
| `lib/search-voice.ts` | Optional speech-recognition facade; overlay typing works without the native module |
| `lib/use-favorite-translations.ts` | Pinned translation ids; `peekFavoriteTranslationIds` for the Also-in chip |
| `lib/use-reader-storage.ts` | Per-chapter highlight/underline maps; `listReaderAnnotationChapters` for overlay |
| `lib/journal-carousel-verses.ts` | Saved (favorited) verses for the journal carousel |

### Journal search

| Path | Role |
| --- | --- |
| `lib/journal-local-search.ts` | Match + relevance score; overlay rank helper; date ranges; tags; overlay favorites; AND combinators |
| `lib/journal-tags.ts` | Tag normalize / suggest / display |
| `src/features/journal/JournalListSearchBar.tsx` | iOS journal-list search input |
| `src/features/journal/JournalListAndroidAppBar.tsx` | Android app-bar search |
| `app/(tabs)/journal/index.tsx` | Applies filter, then relevance sort |

### History, idle content, types, theme

| Path | Role |
| --- | --- |
| `lib/search-history.ts` | AsyncStorage `search_history`, max 10, most recent first |
| `lib/search-quick-picks.ts` | Idle cards: recents + continue-reading + time-of-day verses |
| `packages/types/src/bible.ts` | `SearchResult`, `BookSuggestion`, `TranslationSearchOutcome` |
| `packages/tokens/src/mobile-app-theme.ts` | Per-theme `bundle.search` colors |
| `packages/tokens/src/search-overlay.ts` | Web overlay tokens (not the mobile overlay) |
| `lib/book-genre-display.ts` | “Did you mean” chip labels (`Romans · NT Epistle`) |

### Related (not the overlay)

| Path | Role |
| --- | --- |
| `src/features/verse-tags/searchVerseTagSuggestions.ts` | `@` verse-tag mention suggestions |
| `src/features/reader/TranslationPickerSheet.tsx` | Filter translations by name / abbreviation / language |

---

## 5. Overlay lifecycle

### Open

1. FAB calls `openSearch()`.
2. `TabBarSearchLayer` mounts (or was already mounted for the close animation).
3. Progress animates 0 → 1 (pill expands, sheet fades/slides up, frost wash appears).
4. Input focuses after a short delay.
5. `useBibleSearch({ enabled: true })` loads preferred reader translation, search history, journal cache, reader marks, and warms the keyword index.

### Type

- Each keystroke: selection haptic + `setQuery`.
- Journal filter runs from `getCachedLocalEntries()` via `rankLocalJournalEntriesForOverlay` on the query **remainder** after `in:` / `color:` tokens are stripped. Synchronous below 200 cached entries; **140 ms debounce** when the cache has 200 or more. Overlay **Favorites** re-ranks journal only (Bible search is not re-run).
- Marks chips re-run Bible/marks listing (not journal ranking). Keyword search is unchanged unless a marks gate is on.
- Bible search is **debounced 280 ms**, unless skipped (clear, submit, quick pick, recent, book chip).
- In-flight Bible requests use a monotonically increasing request id **and** an overlay-owned `AbortSignal`; stale responses are ignored. The signal cancels further YVP hydration work without aborting shared `fetchYvpChapter` / `yvpFetch`.
- Retry footer re-runs the current query **without** recording history.

### Submit vs debounce

| Action | Records history | Debounce |
| --- | --- | --- |
| Typing | No | Yes (280 ms) |
| Keyboard Search / Enter | Yes | Flushed immediately |
| Quick pick / recent / “Did you mean” | Yes | Skipped |
| Clear | No | Skipped; results wiped |
| Close overlay | No | Query and results reset; in-flight YVP hydrate cancelled |
| Retry footer | No | Immediate re-run |

### Close

`closeSearch()` dismisses the keyboard, animates reverse, then unmounts after the return animation + 50 ms. Android back is intercepted while open.

### Translation changes

Search uses `getPreferredReaderTranslation()` (fallback `KJV`). If that id changes while a query is active, Bible search re-runs immediately without recording history.

---

## 6. How a Bible query is classified

Entry point: `getSearchResultsForReaderTranslation(translationId, query)` → `searchLoadedTranslation`.

Query is trimmed and lowercased; spaces around `:` are collapsed (`john 3: 16` → `john 3:16`). Book + chapter + verse typed with spaces (`john 3 16`, `John 3 16-18`) is normalized to colon form during alias expansion. Digit-only `316` / `23` and bookless `3 16` are **not** rewritten as `C:VV`.

### Branch A — named passage (checked first)

Exact (normalized) match against `lookupNamedPassage`. Normalization strips punctuation, leading “the”, and extra spaces.

Examples: `lord's prayer`, `the lords prayer`, `prodigal son`, `armor of god`, `nativity`.

On hit, search returns **one** verse (the curated anchor) and skips everything else. No book-suggestion banner.

### Branch B — vague (no digits in the query)

Used for `love`, `john`, `matthew`, `faith`. Cap: **20** results (`VAGUE_SEARCH_MAX_RESULTS`).

Order inside `vagueSearchTranslation`:

1. **Named passage again** (same lookup on the normalized keyword).
2. Collect scored candidates:
   - **Popular keyword verses** if the whole query is a curated key (`love`, `faith`, `hope`, `peace`, `joy`, `grace`, `salvation`, `anxiety`, `worry`, `strength`, `prayer`, `light`, `truth`, `sin`, `forgiveness`, `mercy`, `wisdom`, `trust`, `fear`, `comfort`, `healing`, `patience`, `blessed`, `holy`, `spirit`, `worship`, `righteous`, `eternal`, `repent`, `cross`, `resurrection`, `kindness`, `courage`, `bless`, `forgive`). Up to 5 verses (list order is the score).
   - **Topical index** if there is no popular-keyword list (`trinity`, `holy spirit`, `baptism`, `communion`, `sabbath`, `tithing`, `second coming`, `spiritual warfare`, `incarnation`, `atonement`, `justification`, `sanctification`, `providence`, `idolatry`). Same 5-verse cap. This-book scope filters these refs; named passages still bypass.
   - **Book openers** — only if the query is *not* a curated keyword or topical theme (so `love` does not surface Luke 1:1). Rank book titles; take 1 opener for an exact title match, otherwise up to 2. Each opener is chapter 1 verse 1 of that book.
   - If the query clearly looks like a book title and at least one opener exists, **stop** (no full keyword scan).
   - **Keyword hits** for remaining work: query length ≥ 3 uses the inverted index (whole-word first, then prefix); shorter queries linear-scan with substring match.
3. **Score, then cap:** sort by internal score; within a score band, interleave NT then OT (tie-break only). Then keep at most **1 hit per book** (or **3** for curated keywords / topical themes) and at most **20** total. A stronger same-book hit is not dropped to force testament mix. Public `SearchResult` rows have no score field.

If vague search returns nothing, the engine retries with the closest fuzzy book name (`jhn` → John) and may attach that as `bookSuggestion`.

### Branch C — specific (query contains a digit)

Used for `John 3:16`, `john 3 16`, `jn 3 16`, `Psalm 23`, `romans 8`.

1. Expand aliases (`expandReferenceQuery`): Roman/ordinal prefixes, `st. john`, book shorts (`jn`/`rom`/`ps`/`mt`/`1jn`/`1pe`, …), `prov`/`matt`/`rev`, `psalm 23` → `psalms 23`, `song of songs` → `song of solomon`, and space-separated chapter/verse (`john 3 16` → `john 3:16`). `mat` stays a prefix (not an alias) so it still completes to Matthew.
2. Scan the corpus (collect up to 500 candidates, return top **80**).
3. If alias expansion found nothing, retry the unexpanded query.
4. If still empty, try the closest book-name correction (`jhon 3:16` → `john 3:16`) and set `bookSuggestion`.

**Specific match scores** (lower is better):

| Score | Meaning |
| --- | --- |
| 0 | Exact `book chapter:verse`, or each verse in a `book chapter:verse-verse` range |
| 1 | Exact `book chapter` (every verse in that chapter can match) |
| 2 | Label prefix (`john 3` matches `john 3:…`) |
| 3 | Book name contains the query |
| 4 | Verse text contains the query as a substring |

Tie-break: book index, then chapter, then verse.

**Numeric overlay rules (Phase 1):**

| Query | Bible overlay |
| --- | --- |
| `John 3:16`, `john 3 16`, `jn 3 16`, `Psalm 23` | Book + digits (spaces allowed between chapter and verse; optional range). |
| `3:16`, `23:1`, `1:1-3` (digits + colon, optional range, **no book**) | Verses at that chapter:verse in books that have them. Cap 20. Last-read book first if it has the verse, then NT/OT interleave. **No** verse-text substring. |
| `316`, `23`, `16` (digits only, no colon) | **No** verse-text substring. **No** implied `C:VV` across the canon. Empty Bible results. If the last-read book uniquely parses the digits as `C:VV` / `CC:V` (or 2-digit `C:V` / 4-digit `CC:VV`) against that book’s shape, one “Did you mean” chip is shown; the search is **not** auto-run. |
| `3 16` (digits + space, **no book**) | **Not** rewritten as `3:16`. Does not collect every book’s 3:16. |

---

## 7. Book suggestions (“Did you mean”)

`collectClosestBookSuggestions` compares the **book token** (`jhon` in `jhon 3:16`, or the whole query when there is no chapter) to every book title with Damerau-Levenshtein distance plus typed-prefix matches (`mat` → Matthew at distance 0).

Distance budget scales with the book-token length: 4–5 chars → 1 edit, 6–8 → 2, 9–11 → 3, 12+ → 4. There is **no** extra `+1` slack (`jhon` still matches John at distance 1; `love` does **not** match Luke at 2).

A suggestion is shown only if `distance > 0` and the query is not already that book’s exact name.

**With results:** a banner *“Did you mean {Book · genre}?”* when the suggestion’s book is the first result’s book.

**With no results:** up to 3 nearby-book chips. Tapping a chip runs `suggestion.correctedQuery` immediately (and records history).

Chip labels use `formatBookSuggestionChipLabel` (e.g. `Romans · NT Epistle`).

---

## 8. Translation routing

`getSearchResultsForReaderTranslation`:

1. Empty id → KJV.
2. If the trimmed query has **no digits** and belongs to an English synonym cluster, search the **canonical key first**, then the original, and merge/dedupe (cap 20). Skipped for Tagalog/Cebuano ids (`ADB1905`, `tgl_*`, `ceb_*`, `fil_*`).
3. `yvp:{bibleId}` → `getSearchResultsForYvpTranslation`.
4. Bundled/core id (`KJV`, `WEB`, `ADB1905`, …) → `getSearchResultsForTranslation`.
5. Anything else (helloao ids like `eng_net`, `tgl_ulb`) → load that translation’s full text, then `searchLoadedTranslation`.

### YouVersion behavior (important)

YVP overlay search:

1. Run the full KJV search (references, keywords, named passages, suggestions).
2. **Native index:** if the query has no digits, is not a named passage / book-opener, and cached YVP postings cover the query tokens, return verse text from stored chapters (`yvpPassageToBibleChapter`). No YouVersion chapter fetches.
3. Otherwise group KJV hits by chapter, fetch those chapters from YouVersion (pool of 4), and replace verse text with YVP text. Hits whose chapter fetch fails are dropped and counted in `failedHydrationCount` (cancelled leftovers are not counted).
4. Overlay **query** does not call `getYvpSearchTranslationContext` (the RAM full-corpus builder).

Postings are merged after `putChapter` / `putChapters` when `source === 'yvp'` (helloao chapters are not indexed here). **Memory** keeps 60 hot chapters per translation; **SQLite postings stay** when memory evicts so a background fill can accumulate. Warm-up indexes Psalms / John / Romans **only if those chapters are already in the store**, then may schedule `scheduleYvpSearchCorpusJob` for the active YVP translation.

**Background corpus fill (Phase 4):** one chapter at a time via `fetchYvpChapter` (same store + index path as reading). Runs only on **Wi-Fi**, while the app is **active** (pauses in the background, resumes on foreground / Wi-Fi), after **idle** (`InteractionManager.runAfterInteractions`), with **storage budget** (pause below ~250 MB free disk when measurable; cap 2,000 stored YVP chapters across translations). Already-stored chapters are indexed before any network fetch. Rate-limit backoff is 5s on fetch failure. Overlay list UI is unchanged (`SectionList`).

Consequences:

- Without enough cached YVP chapters, keyword hits still follow **KJV** vocabulary, then hydrate.
- Once coverage exists (from reading, hydrates, or the background fill), overlay can match that translation’s wording (e.g. NIV “anxious”).
- Warm-up for YVP still warms the **KJV** keyword index, plus any already-cached Psalms / John / Romans chapters.

helloao / bundled translations search that translation’s own text, so keywords follow that wording. English synonym expansion still helps KJV/WEB (and YVP via the KJV path) for pairs like `anxious` / `anxiety`.

---

## 9. Keyword index

Built lazily per `searchKey` the first time a vague query of length ≥ 3 runs (or when `warmTranslationSearchCache` / `warmReaderTranslationSearchCache` runs).

- Token regex: `[a-z']+` on lowercased verse text.
- Each word maps to a list of `{ bookIndex, chapter, verse }`.
- Duplicate words in one verse are stored once.
- `lookupKeywordVerseRefs`: exact token first; if none and query length ≥ 3, include words that **start with** the query, in index iteration order.

YVP translations keep a separate incremental index (`lib/yvp-keyword-index.ts`) of stored `source === 'yvp'` chapters. Token regex is the same `[a-z']+`. Exact and prefix lookup can use SQLite after process death or memory eviction; the in-memory map is a 60-chapter hot cache.

Short queries (< 3 chars) skip the bundled/helloao index and scan verses with substring includes, then the same score-then-cap path (per-book cap, max 20, NT/OT mix on score ties).

---

## 10. Journal matching

`journalEntryMatchesSearchQuery` (shared by overlay and journal tab):

1. Optional overlay `favoritesOnly` gate (`is_favorite === true`).
2. Parse as a passage (`parsePassageReference`). If the entry’s book/chapter/verse range overlaps, match.
3. Whole query `favorite` / `favorites` → starred entries only (not a substring of `my favorite verse`).
4. Tag match: a user tag equals the full query or a whole-word token. Verse-tag HTML in the body is not a substitute.
5. Date match: `today`, `yesterday`, parsed ranges (`last week`, `2026-01`, `2026-01 ... 2026-03`, `jan 1 - jan 7`), or substring against locale date strings (`Aug 26, 2026`, `8/26/2026`, `2026-08-26`, year, etc.). `2026-01-15` is a full date (substring), not a month token.
6. Haystack substring: title, stripped HTML body, formatted passage, book slug, chapter number, translation display tokens.
7. Fuzzy title: query and title both length ≥ 4; Levenshtein against the full title or any title token.

**Relevance scores** (journal tab sort, and overlay `rankLocalJournalEntriesForOverlay`):

| Score | Match |
| --- | --- |
| 100 | Passage reference overlap |
| 95 | Exact `favorite` / `favorites` query |
| 85 | Tag equals the full query |
| 82 | Tag equals a whole-word query token |
| 80 | Title contains query |
| 70 | Fuzzy title |
| 60 | Date or date range |
| 50 | Formatted passage line |
| 40 | Body text |
| 30 | Other haystack (slug, chapter, translation) |
| 0 | No match |

Overlay journal results use `rankLocalJournalEntriesForOverlay` (filter, then score, then `created_at` desc). The journal tab still filters with `journalEntryMatchesSearchQuery` (then ranks with `journalEntrySearchRelevanceScore` plus the user’s sort). `filterLocalJournalEntriesByQuery` preserves cache order for callers that need it.

The overlay’s journal section can appear **before** Bible results finish, because journal filtering is synchronous. An empty query still returns no journal rows (Quick Picks), even if the Favorites chip is on.

---

## 11. Quick picks and history

**History** (`search_history` in AsyncStorage): prepend, dedupe, max 10. Overlay shows 3 with a remove control.

**Quick picks** (max 5, first-seen wins):

1. Up to 2 recent queries (length ≥ 2) labeled “Recent search”
2. Continue-reading card from last reader position (`{Book} {chapter}` / “Continue reading…”)
3. Time-of-day set:
   - 05:00–10:59 — morning psalms
   - 18:00–04:59 — evening psalms
   - otherwise — defaults (`Mark 11:22`, `John 3:16`, `Psalm 23`, `Romans 8`, `Philippians 4:13`)
4. Fill remaining slots from the default set

Tapping a pick runs that string as an immediate search (history recorded).

---

## 12. Result navigation

Bible rows link via `readerChapterHref(bookSlug, chapter, translationId, undefined, verseNumber)` so the reader can scroll to that verse. `onOpenVerseResult` writes last position (book, chapter, translation — not the verse number).

Journal rows link to `/journal/{id}`.

---

## 13. Caps and timing

| Constant | Value | Where |
| --- | --- | --- |
| Debounce | 280 ms | `useBibleSearch` (Bible) |
| Overlay journal debounce | 140 ms when cached entries ≥ 200; else sync | `useBibleSearch` |
| Vague result cap | 20 | `bible-translations.ts` |
| Vague book openers | 2 (1 if exact title) | same |
| Specific result cap | 80 | same |
| Specific collect cap | 500 | same |
| Popular verses prepended | 5 | `search-keyword-popular.ts` |
| Hits per book (vague) | 1, or 3 if curated keyword | same |
| History stored / shown | 10 / 3 | `search-history` / hook |
| Quick picks | 5 | `search-quick-picks` |
| Nearby books | 3 | search outcome |
| YVP hydrate concurrency | 4 | `yvp-translation-search` |
| YVP keyword chapters in memory | 60 (LRU) | `yvp-keyword-index` |
| YVP corpus fill delay | 200 ms / chapter | `yvp-corpus-job` |
| YVP corpus min free disk | 250 MB (when measurable) | `yvp-corpus-policy` |
| YVP stored chapter cap | 2,000 | `yvp-corpus-policy` |
| Overlay sheet height | Idle ~74% of screen, minus search bar; results extend to the top safe area | `TabBarSearchLayer` |
| FAB size | 64 px | `tabBarSearchFabChrome` |
| Overlay marks listing | 20 | `reader-marks-search.ts` |

---

## 14. Types

```ts
type SearchResult = {
  bookName: string;
  bookSlug: string;
  chapterNumber: number;
  verseNumber: number;
  verseText: string;
  neighborVerseText?: string; // next verse, or previous if at chapter end
  markKind?: "highlight" | "underline" | "favorite";
  markColorId?: string;
  alsoVerseText?: string;
  alsoTranslationLabel?: string;
  strongsLabel?: string;
};

type BookSuggestion = {
  bookName: string;
  bookSlug?: string;
  distance: number;
  correctedQuery: string; // e.g. "john 3:16" after fixing "jhon 3:16"
};

type TranslationSearchOutcome = {
  results: SearchResult[];
  bookSuggestion: BookSuggestion | null;
  nearbyBooks: BookSuggestion[];
  effectiveQuery: string; // after alias / typo correction
  failedHydrationCount?: number; // YVP hydrate: initiated chapter fetches that failed
};
```

UI sections are `{ title: "Journal" | "Bible"; data: (SearchResult | LocalJournalEntry)[] }`.

---

## 15. Worked examples

| User types | Path | Typical outcome |
| --- | --- | --- |
| `John 3:16` / `john 3 16` / `jn 3 16` | Specific reference | John 3:16 first (score 0), then other John 3 verses / text hits |
| `John 3 16-18` / `John 3:16-18` | Specific reference range | John 3:16–18 |
| `Psalm 23` | Alias → `psalms 23` | All of Psalm 23 (chapter match) |
| `love` | Vague + popular | John 15:13, 1 John 4:8, etc., then more whole-word “love” hits, ≤3 per book |
| `love` in this-book (John) | Vague, scoped | Love hits in John only (up to 20) |
| `John 3:16` while this-book is Genesis | Specific reference (bypasses scope) | John 3:16 still opens |
| `matthew` | Vague book title | Matthew 1:1 as opener; keyword scan skipped if title match is strong |
| `mat` | Vague prefix | Matthew opener (prefix score) |
| `lord's prayer` | Named passage | Matthew 6:9 only |
| `jhon 3:16` | Specific + fuzzy book | Results for John 3:16; “Did you mean John?” |
| `3:16` | Bare chapter:verse | Up to 20 verses at 3:16 across books (NT/OT mix; last-read book first if it has the verse) |
| `316` | Digit-only | Empty Bible section; optional last-read “Did you mean John 3:16?” chip; journal may still match |
| `today` | Journal only (Bible may miss) | Journal entries created today |
| `last week` | Journal only | Entries from the rolling 7 local days including today |
| `2026-01` / `jan 1 - jan 7` | Journal only | That calendar month or named day span (current year; wraps if end < start) |
| `gratitude` | Journal tag or Bible keyword | Journal entries tagged gratitude, plus Bible hits for the word |
| `favorites` | Journal only | Starred journal entries (overlay **Favorites** chip does the same for any keyword) |
| `in:highlights` / Highlights chip | Marks listing | Verses the user highlighted (cap 20). `love` + chip keeps only marked `love` hits |
| `in:favorites` / Saved verses | Marks listing | Carousel saved verses, not journal favorites |
| `color:yellow` | Marks (implies highlights) | Yellow highlights only |
| `anxious` on KJV | Synonym expand → `anxiety` + `anxious` | Philippians 4:6 (popular `anxiety` verses) plus any `anxious` hits |
| `faith` on NIV (`yvp:…`) | Native index if coverage; else KJV vague search, then hydrate | Popular KJV refs whose YVP chapters load, with NIV wording when hydrate succeeds |
| `trinity` | Topical index | Matthew 28:19 first (the word “trinity” need not appear). Not a `POPULAR_KEYWORD_VERSES` key |
| `love also:WEB` / Also in NIV | Keyword + also-in | Same `love` hits; muted second line with WEB/NIV wording when that text is local |
| `book:john love` | Keyword scoped to John | Same as this-book chip for John; typed `book:` wins over Whole Bible |
| `love tag:gratitude last week` | Bible keyword + journal AND | Bible searches `love`; journal requires love + tag + date window |
| `tag:gratitude` | Journal combinator | Tagged journal entries; no Bible keyword search |
| `G26` / `strong:g26` | Strong’s index | 1 John 4:8 first, caption `G26 · agape`. Digit-only `26` is still locked |
| `John 3:16` | Specific + Related | John 3:16 in Bible; Romans 5:8 etc. in a **Related** section |
| `love` | Vague + popular | No Related section (keyword hits are not a relation source) |

---

## 16. Other search-like surfaces

These are separate from the overlay but share helpers.

**Journal list** — `journalEntryMatchesSearchQuery` + `journalEntrySearchRelevanceScore`. Same tag / date-range / `favorites` token matcher as the overlay. Combinator tokens (`tag:`, `book:`, date phrases with a keyword) use AND on this page too. The tab’s Favorites filter and date pickers are unchanged. Placeholder: “Search entries, verses, dates, tags…”.

**Verse-tag mentions** — `searchVerseTagSuggestions`. Completes `book:chapter:verse` (and ranges), or offers up to 6 fuzzy book names to continue typing.

**Translation picker** — substring on label, abbreviation, and language. Unrelated to verse search.

---

## 17. Implementation notes

- **Two journal search UIs, one matcher.** Overlay vs journal tab differ in ranking, history, and whether Bible is included.
- **YVP keyword search is incremental.** Overlay uses native postings when cached chapters cover the query; otherwise KJV-then-hydrate. A background fill can grow that cache on Wi-Fi. `getYvpSearchTranslationContext` (RAM full download) stays diagnostic-only.
- **English synonyms expand the query**, not the popular-verse table. Tagalog/Cebuano ids skip that map.
- **Overlay journal order is relevance**, then newest `created_at`. The journal tab still filters in cache order, then ranks + user sort.
- **History is intentional-submit only**, so typing `john 3:1` then `john 3:16` does not store every prefix.
- **Closing search wipes the query**, the journal Favorites chip, the reader-marks chips, and the Also-in chip. Reopening always starts idle (quick picks + recents).
- **Reader marks are opt-in.** `love` still searches the whole Bible (within scope). Highlights / `in:highlights` / `color:yellow` are explicit gates. `in:favorites` ≠ journal `favorites`.
- **Also-in is a snippet, not columns.** No second keyword search. YVP also-in uses cached chapters only.
- **Combinators are AND-only.** `book:` is the book gate (`in:` is marks). Date phrases in leftover apply to journal. `favorites` without `in:` is still journal starring.
- **Related verses are a cross-ref table**, not other keyword hits. They only appear for a parsed reference or named passage.
- **Voice is optional.** Mic appears when `expo-speech-recognition` is installed and the OS recognizer is available. A new native build is required for the mic. Typing never depends on it.
- **Web tokens** in `packages/tokens/src/search-overlay.ts` document a web overlay; mobile chrome is `TabBarSearchLayer` + `bundle.search`.

---

## 18. Overlay rework — Phase 4

Phase 4 shipped the **background YVP corpus fill** (Wi-Fi, app-active/resume, idle start, disk/storage budget). Overlay query still uses the Phase 3 native index vs KJV-hydrate path. Journal-page search files were not edited. `text-utils.ts` was not edited. `kjv.ts` remains as a data/nav module.

**Still gated (not shipped):** FlashList (no profiled overlay jank; results stay on `SectionList`). Generic `SearchOutcome<T>` (no overlay UI rewrite).

| Overlay rule | Tests |
| --- | --- |
| Book-token fuzzy budget with no `+1` slack; Damerau so `jhon` → John at distance 1; `love` does not suggest Luke; prefix `mat` stays distance 0 | `lib/__tests__/overlay-book-suggestions.test.ts` |
| Bare `3:16` / `23:1` / `1:1-3`; digit-only `316` / `23` / `16` skip verse text; last-read-first and last-read Did-you-mean chip | `lib/__tests__/overlay-numeric-search.test.ts` |
| Overlay `rankLocalJournalEntriesForOverlay`; journal-page `filterLocalJournalEntriesByQuery` still preserves cache order | `lib/__tests__/journal-overlay-rank.test.ts` |
| Vague search scores candidates, then per-book cap (1, or 3 if curated) and max 20; NT/OT mix is a tie-break | `lib/__tests__/overlay-vague-ranking.test.ts` |
| English synonym expansion (`anxious` → `anxiety`); skipped for Tagalog/Cebuano | `lib/__tests__/search-query-synonyms.test.ts` |
| YVP keyword index coverage, prefix, 60-chapter **memory** eviction | `lib/__tests__/yvp-keyword-index.test.ts` |
| YVP native index vs hydrate; overlay abort does not start more fetches; `failedHydrationCount` ignores cancelled leftovers | `lib/yvp-translation-search.test.ts` |
| Corpus job gates: Wi-Fi, app-active, disk, storage cap; missing-chapter resume math | `lib/__tests__/yvp-corpus-policy.test.ts` |

---

## 19. Overlay rework — Phase 5

Phase 5 shipped **reference input** for the overlay (Bible + overlay journal linked-verse). Journal-page search files were not edited.

- Space-separated `john 3 16` / `jn 3 16` / `John 3 16-18` normalize to the same path as `John 3:16` / `John 3:16-18`.
- Digit-only `316` / `23` stay locked (no implied `C:VV`). Bookless `3 16` is not treated as canon-wide 3:16.
- Abbreviation table covers common shorts (`jn`, `rom`, `ps`/`psa`, `mt`/`mk`/`lk`, `act`, `gal`, `eph`, `col`, `heb`, `jas`, `1jn`/`2jn`/`3jn`, `1pe`/`2pe`, and similar NT/OT USFM-style shorts). Prefix `mat` is unchanged. Fuzzy budget is unchanged (`love` still does not suggest Luke).
- `parsePassageReference` uses the same expansion so overlay journal rows match those shapes.

| Overlay rule | Tests |
| --- | --- |
| Space-separated refs, abbreviation table, digit-only / bookless lock, overlay journal linked-verse | `lib/__tests__/overlay-reference-input.test.ts` |

---

## 20. Overlay rework — Phase 6

Phase 6 shipped **overlay result UX**. Journal-page search files were not edited in that phase.

- **Scope.** Default is Whole Bible. When last-read is set, a chip pair lets the user restrict Bible hits to that book. Keyword / book-title / bare `3:16` stay in-book. Book-qualified references (`John 3:16`) and named passages (`lord's prayer`) still return their verse so the row can navigate. Journal rows are not scoped. Closing the overlay resets to Whole Bible.
- **Preview.** Bible snippets highlight the matched span in `verseText` and append a one-verse neighbor (next verse, or previous at chapter end). Journal rows keep the ~160-character body preview; surrounding Bible verses are not loaded into journal snippets.

| Overlay rule | Tests |
| --- | --- |
| This-book scope; reference / named-passage bypass; neighbor verse; snippet highlight | `lib/__tests__/overlay-result-ux.test.ts` |

---

## 21. Overlay rework — Phase 7

Phase 7 shipped **journal search depth**. Overlay and Journal tab share the matcher and tag field. No `journal-search-service.ts`. Journal-tab ranking/sort and the tab Favorites filter are unchanged.

- **Tags.** Entries store `tags: string[]` (SQLite `tags` JSON, suggested set plus custom). Overlay and Journal tab match a tag that equals the query or a whole-word token. Verse-tag HTML in the body is not used as a category.
- **Date ranges.** Whole-query `last week` (rolling 7 local days including today), `YYYY-MM`, `YYYY-MM ... YYYY-MM`, and `jan 1 - jan 7` (current year; wraps if end < start). `today` / `yesterday` / locale substring stay. `2026-01-15` is not a month token.
- **Overlay favorites.** Exact query `favorite` / `favorites`, or the **Favorites** chip next to Whole Bible / this-book. Chip re-ranks journal only. Empty query still shows Quick Picks. Journal tab Favorites filter remains.

| Overlay / journal rule | Tests |
| --- | --- |
| Tag match; date ranges with injected `now`; favorites token vs substring; overlay `favoritesOnly`; journal-page cache order | `lib/__tests__/journal-search-depth.test.ts` |

---

## 22. Overlay rework — Phase 8

Phase 8 shipped **personal marks** search.

- **Opt-in gate.** Ordinary keyword / reference search is unchanged. Marks apply only with chips (**Marks**, **Highlights**, **Underlines**, **Saved verses**) or query tokens (`in:highlights`, `in:underline(s)`, `in:favorite(s)`, `in:marks`, `color:yellow|blue|pink|green|purple`). `color:*` with no `in:` implies highlights. Typed tokens win over chips when both are present.
- **Empty query + chip.** Lists matching marks (cap 20) under a **Marks** section. Journal Favorites with an empty query still stays on Quick Picks.
- **Keyword + gate.** Bible search runs on the remainder, then results are intersected with marks. Journal search also uses the remainder, so `in:highlights love` can still match journal entries for `love`.
- **Data.** Highlights/underlines from `sb:reader:highlights:…` (`listReaderAnnotationChapters`). Saved verses from the journal carousel (`loadCarouselFavorites`). Not journal `is_favorite`. `in:favorites` ≠ `favorites`.
- **Color.** Pastel highlight chips filter `colorId`. Saved verses have no color and drop out of a color filter.
- **This-book scope** applies to mark listing as well as keyword hits.

| Overlay rule | Tests |
| --- | --- |
| `in:` / `color:` parse; unmarked `love` unchanged; filter by kind/color/scope; carousel ranges; list rows | `lib/__tests__/overlay-marks-search.test.ts` |

---

## 23. Overlay rework — Phase 9

Phase 9 shipped **power search**.

- **Also-in.** Default off. Chip **Also in {abbr}** uses the first pinned translation that is not the current reader translation. Query token `also:WEB` / `also:niv` / `also:kjv` / `also:yvp:111` (typed token wins). After primary results (cap 20), each row may get a muted second line (`NIV · …`). Bundled ids use `getVersePreviewForTranslation`. YVP uses **cached chapters only** — no overlay network fetch. Missing text skips that row. Not a dual-column list and not a second keyword search.
- **Topical index.** `packages/core/src/search-topical-index.ts` is separate from `POPULAR_KEYWORD_VERSES`. Named passages still win on a full-query match. This-book scope filters topical refs. Do not stuff these keys into the popular table.
- **AND combinators.** Parser in `lib/search-power-query.ts` runs on the marks remainder so `in:highlights` stays marks. `book:john` / `book:jn` is the book gate (`in:` is not). `tag:gratitude` (multiple tags AND). Date phrases in leftover (`last week`, `today`, `YYYY-MM`, `jan 1 - jan 7`). Remainder is the Bible/journal keyword. No OR / NOT / parentheses. Journal uses AND only when a combinator field is set; unmarked `love` is unchanged. `also:` does not affect journal.

| Overlay rule | Tests |
| --- | --- |
| Combinator parse; topical trinity; also-in WEB snippet; journal tag+keyword AND | `lib/__tests__/overlay-power-search.test.ts` |

---

## 24. Overlay rework — Phase 10

Phase 10 shipped **differentiating** search, gated so the overlay still works without each extra.

- **Voice.** Hands-free fill of the overlay input. Mic is hidden when the native module or OS recognizer is missing. Permission copy lives in `app.json` / `app.config.js`. Android `RECORD_AUDIO` is no longer force-blocked (camera still is). The input stays usable if the user declines. Interim transcripts do not search; the final phrase does.
- **Strong’s.** Study-audience slice: a small number index (`G26`, `H7225`, `strong:g26`), not a Greek/Hebrew corpus or lemma tokenizer. Unknown numbers return no hits (they do not fall through to `316`-style digit search). This-book scope filters the list. Named passages still win if the whole query is a passage name.
- **Related.** Separate **Related** section after Bible results. Source is `search-related-verses.ts` (explicit cross-refs). Shown only for a book-qualified reference or named passage. `love` / topical keywords / Strong’s queries do not get Related. Not Quick Picks and not book “Did you mean”.

| Overlay rule | Tests |
| --- | --- |
| Voice facade without native module; Strong’s parse + G26; related for John 3:16 not for `love` | `lib/__tests__/overlay-differentiating.test.ts` |


