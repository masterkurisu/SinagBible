# Overlay search rework plan

Plan for applying the search rework proposal to the **tab-bar search overlay** (Bible + overlay journal section).

**Out of scope (Phases 0–6):** Journal page list search (`app/(tabs)/journal/index.tsx`, `JournalListSearchBar`, `JournalListAndroidAppBar`). Do not change how that surface filters, ranks, or sorts until **Phase 7** (tags, date ranges, favorites consistency only).

Phases 0–4: original overlay rework (shipped except remaining Phase 4 gates). Phases 5+: capability-gap follow-on.

Current behavior: `search-feature.md`.

---

## Verdict

The original overlay rework (Phases 0–3, Phase 4 corpus fill) is implementable with the project-specific designs below. Journal-page search stays frozen through Phase 6. `kjv.ts` is not deleted. Phases 5–10 are a separate capability-gap track, not a reopen of Phases 0–4.

---

## Resolved mismatches

Each item is the **fix to implement**, not a leftover question.

### 1a / 1c — Journal service for two consumers

**Proposal:** `searchLocalJournalEntries` + `journal-search-service.ts` used by overlay and journal tab (`rank: false` on the tab).

**Why it doesn’t fit:** The journal tab already ranks by `journalEntrySearchRelevanceScore` then applies the user’s sort. Wiring `{ rank: false }` would change that page. A dual-consumer service is journal-page work.

**Fix:** Overlay-only helper in `journal-local-search.ts`, e.g. `rankLocalJournalEntriesForOverlay(entries, query)` (filter + score sort, stable tie-break by `created_at` desc). Call it only from `useBibleSearch`. Do **not** add `journal-search-service.ts`. Do **not** change journal-tab imports.

---

### 1b — Dead `kjv.ts`

**Proposal:** Delete `packages/core/src/kjv.ts` if overlay doesn’t call it.

**Why it doesn’t fit:** Overlay search loads KJV via `bible-translations.ts` (`import("../data/kjv.json")`). `kjv.ts` is the documented 4.5 MB KJV module (`kjvData`, `getChapterBySlug`, `bookNav`) and is **not** re-exported from `packages/core/src/index.ts` so the client bundle doesn’t pull it in. Deleting the file is unrelated to overlay quality.

**Fix:** Keep the file. In Phase 2, remove only the unused duplicate search APIs `getSearchResults` and `getClosestBookSuggestion` (no production callers in this repo). Leave chapter/nav/data exports and the index.ts comment pointing at `@sinag-bible/core/kjv` for non-client use. Update that comment if those two functions go away.

---

### 1b — `getTextMentionsForTranslation`

**Proposal:** Remove or fold into the keyword index.

**Why it doesn’t fit:** Substring “mentions” ≠ the whole-word/prefix index. No callers.

**Fix:** Delete the function in Phase 2. Do not merge it into `vague-keyword-index.ts`.

---

### 1b / 3A — `yvp-search-corpus.ts` as native-search backbone

**Proposal:** Repurpose the full-corpus downloader as Option A indexing.

**Why it doesn’t fit:** That file fetches ~1,189 chapters (rate-limited). The inverted index is `vague-keyword-index.ts`. Chapters already persist through `putChapter` when the user reads or when search hydrates a hit.

**Fix:** Incremental native index on ingest:

1. After a chapter is stored (`putChapter` / `putChapters`), parse verse text (YVP payload → `yvpPassageToBibleChapter`, not raw HTML) and merge tokens into a per-`translationId` posting list.
2. Cap postings / chapters per translation (LRU aligned with chapter-store’s existing 60-entry memory LRU as a starting bound; persist postings in SQLite so they survive process death).
3. Vague/keyword search on YVP: if coverage for the query tokens is sufficient, use native postings; otherwise keep KJV-then-hydrate.
4. Leave `yvp-search-corpus.ts` in place for perf snapshot + possible Phase 4 bulk job. Do not call it from overlay search.

---

### 1d — Generic `SearchOutcome<T>`

**Proposal:** One outcome type for Bible and journal so `SearchResultsBody` shares a contract.

**Why it doesn’t fit:** Overlay already merges sources in `searchSections`. Bible-only fields (`bookSuggestion`, `nearbyBooks`) don’t apply to journal. Journal page is out of scope.

**Fix:** Skip. If overlay UI is rewritten later, revisit then.

---

### 2d — “Did you mean” ratio in `text-utils.ts`

**Proposal:** `distance > ceil(query.length / 3)` in `text-utils.ts`.

**Why it doesn’t fit:** `text-utils.ts` drives **journal title** fuzzy match (journal page). Overlay suggestions use `collectClosestBookSuggestions` / `shouldRecommendBookSuggestion` in `bible-translations.ts`. A second ratio formula also fails `love` vs `Luke` (distance 2, `ceil(4/3) = 2` still allows it).

**Fix:** The collector already has a length-scaled budget (`maxFuzzyBookDistanceForQuery`) and then adds **`+ 1` slack**. That slack is the noise.

- Remove the `+ 1` so max distance is exactly `maxFuzzyBookDistanceForQuery(bookToken)` (`jhon` → 1, still matches John; `love` → 1, does **not** match Luke at 2).
- Apply the budget to the **book token** (`jhon` in `jhon 3:16`), not the full string.
- Keep prefix matches at distance 0 (`mat` → Matthew). `shouldRecommendBookSuggestion` still requires `distance > 0`, so prefixes never become “Did you mean” chips.
- Verse-tag suggestions share `getClosestBookSuggestionsForTranslation`; tightening the slack also reduces junk there, which is desirable. Prefix completion is unchanged.

Do not edit `text-utils.ts`.

---

### 2e — Pure numeric queries as chapter:verse

**Proposal:** Prefer chapter:verse “exclusively”; `316` might mean 3:16 across the canon.

**Why it doesn’t fit:** Overlay has no current-book context except last-read (already used by Quick Picks). Auto-splitting `316` into every book’s 3:16 floods ~60 rows and fights journal matches (dates, numbers). Today `3:16` **without a book** also fails reference scoring (`exactRef` is `"john 3:16"`) and falls through to verse-text substring — that is the real bug. Short digit strings (`23`, `16`) as text substring are the noise; `316` in KJV bodies is rare.

**Fix (locked):**

| Query | Bible overlay |
| --- | --- |
| `John 3:16`, `Psalm 23` | Unchanged (book + digits). |
| `3:16`, `23:1`, `1:1-3` (digits + colon, optional range, **no book**) | New path: verses at that chapter:verse in books that have them. Cap 20. Last-reader book first if it has the verse, then NT/OT interleave. **No** verse-text substring. |
| `316`, `23`, `16` (digits only, no colon) | **No** verse-text substring. **No** implied `C:VV` across the canon. Bible section empty unless journal isn’t the only story. |
| Optional chip | If last-reader book can uniquely parse digits as `C:VV` or `CC:V` against that book’s shape, show one “Did you mean {Book} C:VV?” chip (same UX as book typos). Do not auto-run that search. |

Journal overlay matching is unchanged (`today`, dates, body text containing `316`).

---

### 3C — Synonyms only in `search-keyword-popular.ts`

**Proposal:** Add translation-aware synonyms on the popular-verse table.

**Why it doesn’t fit:** That table maps English keys → **KJV refs**. NIV “anxious” still misses unless the **query** is expanded before KJV search and hydration.

**Fix:** New `lib/search-query-synonyms.ts` (or under `packages/core`) with small English clusters (`worry` / `anxiety` / `anxious`, etc.). In `getSearchResultsForReaderTranslation`, if the trimmed query (no digits) is in a cluster, run search for the canonical key **and** merge/dedupe popular + keyword hits (existing caps). Apply for all English-capable translations, not YVP-only — bundled KJV/WEB benefit too. Tagalog/Cebuano recall still depends on Phase 3 native index, not this map.

Do not stuff synonyms as extra rows in `POPULAR_KEYWORD_VERSES` unless they are real KJV whole-word verses for that extra token.

---

### 4b — Virtualize the results sheet

**Proposal:** Replace the sheet list with FlatList/FlashList.

**Why it doesn’t fit:** Results already use `SectionList` (windowed). Idle state is five Quick Pick cards.

**Fix:** No change in Phases 1–3. Phase 4 only if profiling shows jank with large overlay sections.

---

### 4e — Stale hydration clobbers newer results

**Proposal:** Monotonic request ids on hydration workers so a late pool can’t clobber.

**Why it doesn’t fit:** `useBibleSearch` already ignores stale Bible outcomes. `fetchYvpChapter` **dedupes inflight** with the reader (`yvpChapterInflight`). Aborting that HTTP from search can cancel a chapter the reader is loading.

**Fix:** Cooperative cancel **inside** `hydrateSearchResultsForYvp` only:

- Pass the overlay request id (or an `AbortSignal` owned by the search call, not by `yvpFetch` globally).
- Before starting each pool chapter, if cancelled, stop queueing more work.
- Let an already-shared inflight `fetchYvpChapter` finish (reader-safe); just don’t apply it if the search was superseded.
- Do not abort the timeout `AbortController` inside `yvpFetch`.

UI already drops stale results; this stops extra YouVersion requests from a superseded query.

---

## In-scope proposal items (unchanged intent)

| Item | Overlay fix |
| --- | --- |
| **2a** Rank overlay journal | `rankLocalJournalEntriesForOverlay` in `useBibleSearch` |
| **2b / 2c** Score then cap | Internal scores in `vagueSearchTranslation`; sort; then per-book cap (1, or 3 if curated) and max 20. NT/OT mix is a tie-break, not a reason to drop a clearly better same-book hit. `SearchResult` public shape unchanged. |
| **4a** Journal debounce at scale | Only in `useBibleSearch`: if cached entries ≥ 200, debounce journal filter 120–150 ms; below that stay synchronous. Journal **page** untouched. |
| **4c** Warm-up | After native index exists: index chapters already in chapter-store (Psalms / John / Romans if present). Do not prefetch those books only to warm search. |
| **4d** Partial YVP hydration | `failedHydrationCount` on `TranslationSearchOutcome`; overlay footer retry. Count only chapters this search **initiated** that failed, not cancelled leftovers. |

---

## Phased plan

### Phase 0 — Guardrails

- No edits to journal page search files.
- Tests first for: book-token fuzzy slack (`jhon` vs `love`/`luke`), bare `3:16` vs `316`, overlay journal rank helper.
- Update `search-feature.md` at the end of each phase.

### Phase 1 — Overlay quality

1. Overlay journal rank (`rankLocalJournalEntriesForOverlay`).
2. Remove `+ 1` suggestion slack; budget on book token only.
3. Numeric rules in the table above (bare `chapter:verse` collector; no text match on digit-only queries; optional last-book Did-you-mean chip).
4. Overlay journal debounce at ≥ 200 entries.

### Phase 2 — Bible ranking + safe cleanup

1. Vague search: collect scored candidates → sort → per-book cap → max 20.
2. Delete `getTextMentionsForTranslation`.
3. Delete `getSearchResults` / `getClosestBookSuggestion` from `kjv.ts` only.

### Phase 3 — YVP wording

1. English synonym query expansion (all English translations).
2. Incremental keyword index on `putChapter` (parse verses, SQLite postings, LRU cap).
3. Overlay: native index when coverage is enough, else KJV hydrate.
4. Warm-up from already-cached chapters only.
5. Cooperative hydration cancel + failed-count retry row.

### Phase 4 — Gated (original rework)

Phases 0–3 are shipped. Phase 4 corpus fill is shipped; these remain gated:

| Item | Gate |
| --- | --- |
| Background full YVP corpus | Shipped (Wi-Fi / idle / resume / storage budget) |
| FlashList | Profiled overlay jank |
| Generic `SearchOutcome<T>` | Overlay UI rewrite |

---

### Follow-on (capability gaps)

Cross-check against a full search-capability list. Phases 5–6 stay **overlay Bible + overlay journal** (journal **page** still frozen). Phase 7 lifts that freeze only for the journal items listed. Phases 8–10 are new product surfaces, not polish on the current overlay.

### Phase 5 — Reference input

Highest leverage: users type references the way they speak.

1. **Space-separated chapter/verse.** Normalize `john 3 16`, `jn 3 16`, `John 3 16-18` to the same path as `John 3:16` / `John 3:16-18` (book + chapter + verse, optional range). Do **not** treat digit-only `316` / `23` as this — Phase 1 numeric table stays locked.
2. **Abbreviation table.** Extend `expandReferenceQuery` (and tests) for common short forms that are missing today: `jn`, `rom`, `ps` / `psa`, `mt` / `mk` / `lk`, `act`, `gal`, `eph`, `col`, `heb`, `jas`, `1jn` / `2jn` / `3jn`, `1pe` / `2pe`, and similar NT/OT shorts. Keep prefix completion (`mat` → Matthew). Do not loosen fuzzy budget (`love` must still not suggest Luke).

Likely files: `packages/core/src/reference-aliases.ts`, `packages/core/src/bible-translations.ts` (normalize query), `packages/core/src/journal.ts` (`parsePassageReference` if overlay journal linked-verse should accept the same shapes), tests next to existing overlay numeric/book suites.

### Phase 6 — Overlay result UX

1. **Scope.** Explicit overlay control: whole Bible (default) vs **this book** (last-read / current reader book). Optional: “this book” as a chip when last-read is set — do not invent a reading-plan scope (the app has no plan object). Keyword `love` in “this book” stays inside that book; `John 3:16` still navigates even if scope is another book (or document the chosen rule in `search-feature.md`).
2. **Preview.** Show enough context that users need fewer taps: highlight the matched span in `verseText`; optionally append a one-verse neighbor in the snippet. Journal rows already use a ~160-character body preview — keep that; do not load surrounding Bible verses into journal snippets.

Likely files: `src/features/search/useBibleSearch.ts`, `src/features/search/SearchResultsBody.tsx`, `packages/core/src/bible-translations.ts` (scope filter after collect/cap).

### Phase 7 — Journal search depth

**Lifts the journal-page freeze** for these items only. Overlay and Journal tab should share matcher/data; do **not** add `journal-search-service.ts` unless a dual-consumer API is clearly needed after the data model exists. Ranking/sort on the Journal tab stays the tab’s (relevance + user sort).

1. **Tags / categories** (e.g. gratitude, forgiveness). Requires a journal entry field (none today). Add overlay + Journal-tab match on tag tokens. Do not overload verse-tag HTML in the body as a substitute.
2. **Date ranges.** Beyond `today` / `yesterday` / date substring: parse simple ranges (`last week`, `2026-01` … `2026-03`, `jan 1 - jan 7`) in `journal-local-search.ts` and use them on both overlay and Journal tab.
3. **Overlay favorites.** `is_favorite` already exists. Overlay should be able to restrict journal hits to favorites (query token or a control). Journal tab already has a Favorites filter — do not replace that; keep both consistent.

Likely files: `packages/types/src/journal.ts`, `lib/journal-db.ts` / `lib/journal-local.ts`, `lib/journal-local-search.ts`, `app/(tabs)/journal/index.tsx`, journal list search bars, overlay `useBibleSearch` / `SearchResultsBody`.

### Phase 8 — Personal marks

Search the user’s **reader** marks, not only scripture + journal text.

1. Filter overlay (or a dedicated section) to verses the user has **highlighted, underlined, or favorited**.
2. If color-coded highlights are in scope, allow filter-by-color.

Data already lives in reader annotation storage (`lib/use-reader-storage.ts`). No overlay index today. Gate on a small query language or chips (`in:highlights`, color chip) so Bible keyword search does not silently shrink to marked verses only.

### Phase 9 — Power search

New product, not a small overlay tweak. Design before coding.

1. **Multi-translation results** — “also in NIV” / columns. Overlay today is **one** active reader translation.
2. **True topical index** — beyond ~30 `POPULAR_KEYWORD_VERSES` keys, named passages, and English synonym clusters. Do not stuff extras into the popular table unless they are real whole-word verses for that token.
3. **Boolean / combined filters** — keyword + book + date range + tag in one query. Needs a parser and UI; journal tags (Phase 7) should exist first if tags are in the combinator.

### Phase 10 — Differentiating (gated)

| Item | Gate |
| --- | --- |
| Voice search | Hands-free UX + OS speech permissions designed; overlay input still works without it |
| Strong’s / original-language search | Study-audience decision; corpus and UI for numbers/lemmas |
| Related verses / “you might also like” | Separate from Quick Picks and book “Did you mean”; needs a relation source (not ad-hoc from `love` hits) |

---

## File map

| File | Phase | Change |
| --- | --- | --- |
| `src/features/search/useBibleSearch.ts` | 1, 3, 6 | Rank + debounce overlay journal; YVP cancel; scope |
| `lib/journal-local-search.ts` | 1, 7 | Overlay rank helper; date ranges; tags; overlay favorites |
| `packages/core/src/bible-translations.ts` | 1–2, 5–6 | Suggestion slack; numeric rules; score-then-cap; space-separated refs; book scope |
| `packages/core/src/kjv.ts` | 2 | Remove unused search functions only |
| `lib/search-query-synonyms.ts` | 3 | New English clusters |
| `lib/bible-search-service.ts` | 3 | Synonym expand; native YVP index vs hydrate |
| `lib/yvp-keyword-index.ts` | 3 | New postings + coverage |
| `lib/chapter-store.ts` | 3 | Hook index merge after successful put (or a thin wrapper used by put paths) |
| `lib/yvp-translation-search.ts` | 3 | Cooperative cancel; `failedHydrationCount` |
| `packages/types/src/bible.ts` | 3 | Optional `failedHydrationCount` |
| `src/features/search/SearchResultsBody.tsx` | 3, 6 | Retry footer; last-book numeric chip; match highlight / neighbor preview; scope control |
| `lib/yvp-search-corpus.ts` | 4 | Background fill job + perf snapshot RAM builder (not overlay query) |
| `packages/core/src/reference-aliases.ts` | 5 | Space-separated refs; more abbreviations |
| `packages/types/src/journal.ts` / journal db | 7 | Tag field if tags ship |
| `lib/use-reader-storage.ts` + overlay | 8 | Search highlights / underlines / favorite verses |
| `search-feature.md` | each | Keep in sync |

**Do not edit (Phases 0–6):** `app/(tabs)/journal/index.tsx`, journal list search bars.

**Phase 7+:** those journal-page files may change **only** for tags, date ranges, and favorites consistency listed above.

**Do not add (Phases 0–6):** `journal-search-service.ts`. Revisit in Phase 7 only if overlay and Journal tab need a shared tagged/range API.

**Do not delete:** `packages/core/src/kjv.ts` as a file; `lib/yvp-search-corpus.ts`.

**Do not edit:** `packages/core/src/text-utils.ts` for Phases 0–6 (journal title fuzzy). Phase 7 date/tag matching stays in `journal-local-search.ts`.

---

## Risks

- Overlay journal order becomes relevance instead of cache order; journal **page** stays as today.
- Score-then-cap can reduce spread on `love` if the cap is too aggressive — keep the cap, apply after sort.
- Bare `3:16` can still return many books; cap 20 + last-reader-first keeps it usable.
- Native YVP index needs an eviction policy before release.
- English synonyms won’t help Tagalog/Cebuano; that’s the incremental index.
- Phase 5 space-separated refs must not reopen digit-only `316` as every book’s 3:16.
- Phase 6 “this book” scope can hide good whole-Bible keyword hits — default remains whole Bible.
- Phase 7 tags are a data-model change (migrations, backup/export).
- Phase 9 combinators and multi-translation UI can explode overlay complexity; design first.

---

## Not doing

**Phases 0–4 (locked):**

- Journal-page search behavior, ranking flags, or debounce (until Phase 7 items above).
- Dual-consumer journal search service (until Phase 7 explicitly needs it).
- Deleting `kjv.ts` or using `yvp-search-corpus.ts` as the first native-search path.
- Changing `text-utils.ts` fuzzy distance.
- Replacing overlay `SectionList` without a performance gate.
- Aborting shared `fetchYvpChapter` / `yvpFetch` from search.
- Auto-running `316` as every book’s 3:16.

**Not in Phases 5–6:** journal tags, date ranges, overlay favorites, highlights search, multi-translation columns, Strong’s, voice, related-verse recommendations (those are 7–10).
