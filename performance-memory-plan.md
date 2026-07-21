# Performance & Memory — Phased Work Plan

Sinag Bible mobile · Expo 57 · React Native 0.86 · Reanimated 4.5 · expo-router 57

**Status:** Audit complete — work in phases, not one big run.

**How to use:** Run each phase in a **focused session** (fresh chat if helpful). Attach only
the files listed under "Context to attach" using `@file`. Do not start later phases until
earlier exit criteria are met. Commit after each phase so you can diff/revert per batch.

**Source audit:** Findings from a full-project review (hooks, lists, caches, animations,
context providers). Most timer/subscription patterns are already correct; this plan targets
the highest-impact gaps only.

---

## Summary

| Phase | Theme | Effort | User-visible impact |
|-------|-------|--------|---------------------|
| 0 | Safe cleanup & small leaks | Small | Low (stability) |
| 1 | Reader note-draft re-renders | Medium | **High** (note typing) |
| 2 | Tab bar context re-renders | Medium | **High** (settings slide) |
| 3 | Reader carousel hook split | Small | Medium (reader idle CPU) |
| 4 | Search corpus cache bounds | Large | **High** (memory on search) |
| 5 | Async & animation hygiene | Medium | Low–medium (edge cases) |
| 6 | Optional polish & monitoring | Small | Low |

Phases 0–3 are the best ROI for incremental work. Phase 4 is the largest architectural
change — schedule it when search memory is a real user complaint or before adding more
translation search sources.

---

## App constraints (read before any phase)

| Area | Reality | Plan implication |
|------|---------|------------------|
| **Reader chapter screen** | `app/(tabs)/reader/[book]/[chapter]/index.tsx` is ~1,900 lines with many hooks | Phase 1 must not refactor the whole screen — only narrow the selection-activity bridge |
| **Tab bar chrome** | `lib/reader-tab-bar-visibility-context.tsx` mixes RN `Animated.Value` and Reanimated `SharedValue` | Phase 2 may keep hybrid APIs; goal is fewer React re-renders, not a full Reanimated migration |
| **Search backends** | YVP (YouVersion) and HelloAO (`complete.json`) power keyword search | Phase 4 must preserve search correctness; eviction is additive, not a rewrite |
| **Chapter cache** | `lib/chapter-store.ts` already has LRU (60 entries) | Do not duplicate LRU logic in Phase 4 — only fix unbounded *search* caches |
| **FlashList** | Reader and journal lists are already well tuned | No list virtualization phase unless profiling shows a regression |

### Explicitly out of scope (unless asked)

- Splitting the monolithic reader chapter screen into smaller components
- Migrating all legacy `Animated` surfaces to Reanimated
- SQLite connection lifecycle changes (singleton pattern is intentional)
- `removeClippedSubviews: false` in picker sheets (intentional tradeoff)
- Journal carousel horizontal `FlatList` tuning (small list, low priority)

---

## Phase 0 — Safe cleanup & small leaks

**Goal:** Fix low-risk patterns that can cause `setState` after unmount or slow ref-map growth.
No behavior changes for happy-path users.

**Context to attach:**
- `app/(tabs)/reader/[book]/[chapter]/index.tsx`
- `src/features/reader/ReaderSettingsFollowUpLayer.tsx`
- `app/(tabs)/journal/index.tsx`

**Tasks:**

1. **Reader menu `setTimeout` cleanup**
   - Store timeout IDs in refs for bare `setTimeout(..., 0)` chains (credits, changelogs, data backup, etc.).
   - Clear on unmount in `index.tsx` (some refs already exist — extend the pattern).
   - Mirror in `ReaderSettingsFollowUpLayer.tsx`.

2. **Journal `entryRowRefs` pruning**
   - In `app/(tabs)/journal/index.tsx`, remove map entries when an entry is deleted.
   - Optionally prune on list refresh if IDs are no longer in `entries`.

3. **Short-lived form timers** (optional in this phase)
   - `components/journal-new-entry-form.tsx`: cancel `releaseActiveFormField` / fullscreen focus timeouts on unmount if still trivial to do.

**Exit criteria:**
- [ ] No new lint/type errors
- [ ] Navigate away from reader mid-settings-menu chain — no console warnings
- [ ] Delete several journal entries — `entryRowRefs` map size does not grow unbounded (dev log or quick inspect)

**Risk:** Low

---

## Phase 1 — Stop lifting `noteDraft` to the chapter screen

**Goal:** Typing in the verse note modal must not re-render the entire reader chapter screen.

**Problem:** `ReaderSelectionLayer` pushes `noteDraft` to the parent on every keystroke via
`onSelectionActivityChange`. The parent stores it in `selectionActivity` state.

**Context to attach:**
- `src/features/reader/ReaderSelectionLayer.tsx`
- `app/(tabs)/reader/[book]/[chapter]/index.tsx`
- `src/features/reader/ReaderVerseNoteDialog.tsx` (if note UI lives here)
- Any `ReaderSelectionActivity` type definition

**Approach (preferred):**

1. **Narrow the lifted activity type** — remove `noteDraft`, `setNoteDraft`, and any other
   note-modal-only fields from what crosses the parent boundary.
2. **Keep note modal state local** to `ReaderSelectionLayer` (or `ReaderVerseNoteDialog`).
3. **Parent only receives** what it truly needs:
   - `selectedVerses`
   - `noteModalVisible` (if parent renders the dialog or needs tab-bar behavior)
   - Stable callbacks: `saveNoteFromModal`, `setNoteModalVisible`, `setNoteTargetVerse`
4. **If the parent renders `ReaderVerseNoteDialog`**, pass note draft via ref/imperative handle
   or move the dialog fully inside `ReaderSelectionLayer`.

**Do not:** Refactor unrelated reader state, split the chapter screen, or change note persistence logic.

**Exit criteria:**
- [ ] Typing in the note modal does not trigger a full re-render of `index.tsx` (React DevTools or a temporary `console.log` in the chapter screen body)
- [ ] Note save, cancel, and verse targeting still work
- [ ] Selection toolbar and onboarding flows unchanged

**Risk:** Medium — touches a central reader data path; test note create/edit/cancel thoroughly.

---

## Phase 2 — Tab bar context: stop 60fps React re-renders

**Goal:** Settings menu slide must not call `setState` every animation frame for all context consumers.

**Problem:** `settingsSlideProgress.addListener` → `setSettingsTabBarTint` → Provider `value`
changes → every `useReaderTabBarVisibilityContext` consumer re-renders during the slide.

**Context to attach:**
- `lib/reader-tab-bar-visibility-context.tsx`
- `lib/reader-tab-bar-scroll-worklet.ts` (if relevant)
- Consumers: `app/(tabs)/_layout.tsx`, `app/(tabs)/reader/[book]/[chapter]/index.tsx`

**Approach (pick one — document choice in commit):**

**Option A — Split contexts (lower risk)**
- `ReaderTabBarScrollContext` — `scrollHidden`, `setScrollHidden`, `snapScrollHidden`, etc.
- `ReaderTabBarSettingsChromeContext` — `settingsTabBarTint`, `settingsSlideProgress`, `registerReaderSettingsSlideProgress`
- Scroll-only consumers (e.g. scroll-hide driver) no longer re-render on tint updates.

**Option B — UI-thread tint (higher payoff, more work)**
- Drive tab bar tint from Reanimated `useAnimatedStyle` / interpolated opacity on the chrome layer.
- Remove `settingsTabBarTint` React state entirely; keep `Animated.Value` listener only if needed for legacy chrome.

**Option C — Throttle tint state**
- Minimum viable: throttle `setSettingsTabBarTint` to ~8–12 updates/sec.
- Use only if A/B are blocked; document as temporary.

**Exit criteria:**
- [ ] Opening/closing reader settings menu: scroll-hide consumers do not re-render every frame
- [ ] Tab bar tint still animates smoothly during settings slide
- [ ] Reader scroll-hide on chapter scroll still works

**Risk:** Medium — tab bar is visible on every reader session; test iOS and Android.

---

## Phase 3 — Lightweight carousel favorites for the reader

**Goal:** Reader verse favorite toggle must not mount full journal carousel machinery.

**Problem:** `ReaderSelectionLayer` calls `useJournalCarouselVerses()`, which subscribes to
carousel settings, card sizes, favorites, and starts a rotation `setInterval`.

**Context to attach:**
- `lib/use-journal-carousel-verses.ts`
- `lib/journal-carousel-verses.ts`
- `src/features/reader/ReaderSelectionLayer.tsx`
- `src/features/journal/JournalInspirationCarousel.tsx` (ensure journal path still uses full hook)

**Approach:**

1. Add `useCarouselFavorites()` (or `useJournalCarouselFavorites()`) that only:
   - Loads favorites once + `subscribeCarouselFavorites`
   - Exposes `favorites`, `toggleFavorite`, `removeFavorite` (as needed)
2. Keep `useJournalCarouselVerses()` for the journal carousel (rotation, settings, display verses).
3. Switch `ReaderSelectionLayer` to the lightweight hook.

**Exit criteria:**
- [ ] Reader: favorite toggle from selection still works; toast still shows
- [ ] Journal carousel: rotation, settings, and favorites unchanged
- [ ] No `setInterval` from carousel rotation while on reader chapter screen

**Risk:** Low — isolated extraction if journal hook behavior is unchanged.

---

## Phase 4 — Bound search corpus memory (YVP + HelloAO)

**Goal:** Searching translations must not retain full Bible text in RAM forever per translation id.

**Problem:**
- `lib/yvp-search-corpus.ts` — `yvpSearchContextCache` loads all YVP chapters, never evicts
- `packages/core/src/bible-translations.ts` — `helloaoCompleteDataCache` retains full `TranslationData` forever
- `packages/core/src/vague-keyword-index.ts` — `indexByTranslation` grows per searched translation

**Context to attach:**
- `lib/yvp-search-corpus.ts`
- `packages/core/src/bible-translations.ts`
- `packages/core/src/vague-keyword-index.ts`
- `src/features/search/useBibleSearch.ts`
- `lib/yvp-search-corpus` consumers / warm-up call sites

**Sub-phases (can ship separately):**

### 4a — HelloAO cache LRU/TTL
- Cap `helloaoCompleteDataCache` (e.g. 2–3 entries) or TTL (e.g. 30 min idle).
- Reuse LRU pattern from `lib/chapter-store.ts` if practical.
- Ensure in-flight promises are not orphaned on eviction.

### 4b — Vague keyword index eviction
- Tie index lifetime to translation cache eviction, or cap `indexByTranslation` size.

### 4c — YVP corpus strategy (largest piece)
- **Minimum:** LRU cap on `yvpSearchContextCache` (e.g. 1–2 bible ids).
- **Better:** Lazy chapter fetch at search time instead of bulk preload.
- **Best:** Disk-backed or SQLite search index (separate initiative — do not block 4a/4b).

**Exit criteria:**
- [ ] Search same translation twice — second open uses cache (fast)
- [ ] Search 3+ large API translations in one session — memory does not grow linearly without bound
- [ ] YVP rate limiting (429) behavior unchanged or improved
- [ ] Existing search tests pass; add unit test for cache eviction if easy

**Risk:** High — search correctness and offline behavior; profile before/after on a mid-range Android device.

---

## Phase 5 — Async & animation hygiene

**Goal:** Reduce wasted work and edge-case warnings without user-facing feature changes.

**Status:** Done (2026-07-22).

**Context to attach:**
- `src/features/reader/ReaderStudyNotesSheet.tsx`
- `src/features/reader/useReaderGestures.ts`
- `lib/carousel-background-image.tsx`
- `components/m3-contained-loading-indicator.tsx`

**Tasks:**

1. **Study notes fetch abort**
   - Wire `AbortController` into `fetchWithTimeout` (or equivalent) so cancelled effects abort network + JSON parse.

2. **`useReaderGestures` animation cleanup**
   - Call `stopAnimation()` / cancel in-flight `Animated` sequences on effect cleanup and dependency change.

3. **`carousel-background-image.tsx`**
   - Cancel `Animated.timing` on unmount or `uri` change.

4. **`m3-contained-loading-indicator.tsx`**
   - `cancelAnimation` on Reanimated shared values on unmount.

**Implemented:**

| Task | Change |
|------|--------|
| Study notes | `fetchWithTimeout` uses `AbortController`; list/chapter effects abort on cleanup |
| Reader gestures | `anim.stop()` + `stopAnimatedValues()` on dropdown, settings, font, and verse fade effects |
| Carousel image | `fadeAnimRef` stops in-flight crossfade on `uri` change and unmount |
| Loading indicator | `cancelAnimation(rotation)` on unmount |

**Exit criteria:**
- [x] Open study notes sheet, close quickly — no post-unmount state updates (dev mode)
- [x] Reader gestures: chapter swipe and back handling unchanged
- [x] Carousel images still fade in correctly

**Risk:** Low–medium

---

## Phase 6 — Optional polish & monitoring

**Goal:** Address remaining low-priority items and add guardrails for regressions.

**Status:** Done (2026-07-22).

**Tasks (pick as needed):**

1. **Pexels session cache cap** — `lib/pexels-repository.ts` `sessionCardUrlByVerseId` / `sessionResolvedByVersesKey` max size or clear on app background.
2. **`use-reader-storage` chapter cache** — document or add soft cap if profiling shows growth during long reading sessions.
3. **Container transform context** — audit `src/components/m3/ContainerTransform.tsx` re-renders during journal morph; split only if profiling warrants it.
4. **Dev-only memory helpers** — optional `__DEV__` log for cache sizes (search, pexels, chapter storage) behind a flag.

**Implemented:**

| Task | Decision |
|------|----------|
| Pexels | LRU caps (128 card URLs, 24 resolved keys) + `clearPexelsSessionCaches()` on app background |
| Reader chapter storage | LRU cap of 80 entries in `use-reader-storage.ts` |
| Container transform | **Deferred** — single context kept; comment added; split only if morph profiling shows issues |
| Dev helpers | `lib/perf-cache-snapshot.ts` — `getPerfCacheSnapshot()`, `logPerfCacheSnapshot()`; opt-in log on background via `global.__SINAG_LOG_PERF_CACHES__ = true` |

**Exit criteria:**
- [x] Documented decisions for anything deferred
- [x] No mandatory user-facing changes

---

## Testing checklist (run after Phases 1–3)

Use this quick pass before moving to Phase 4.

| Flow | What to verify |
|------|----------------|
| Reader scroll | Tab bar hides/shows on scroll; no flicker |
| Reader settings | Open settings side sheet; tab bar tint animates; close with back |
| Verse selection | Select verses, open note modal, type several sentences, save/cancel |
| Verse favorite | Toggle favorite from selection on reader |
| Journal list | Scroll long list, delete entries, search |
| Bible search | Search KJV + one API translation; open/close search layer |
| App background | Background app during reader settings slide; resume — no crash |

---

## Suggested commit messages (per phase)

```
fix(reader): cancel menu follow-up timeouts on unmount (perf phase 0)
fix(journal): prune entry row refs on entry delete (perf phase 0)
perf(reader): keep note draft local to selection layer (perf phase 1)
perf(reader): split tab bar scroll vs settings chrome context (perf phase 2)
perf(reader): use lightweight carousel favorites hook (perf phase 3)
perf(search): cap helloao translation search cache (perf phase 4a)
perf(search): evict YVP search corpus with LRU (perf phase 4c)
fix(reader): abort study notes fetch on unmount (perf phase 5)
```

---

## What's already in good shape (no phase needed)

- FlashList config in `ReaderVerseList.tsx` and journal index
- `useReaderChapter` cancellation and `useBibleSearch` stale-request guards
- Chapter SQLite LRU in `lib/chapter-store.ts`
- Network `AbortController` in core API modules
- `AppState`, `NetInfo`, `BackHandler`, `Keyboard` listener cleanup in most paths
- Carousel interval cleanup in `use-carousel-background-urls.ts` and `use-journal-carousel-verses.ts`
- Capped `search-history` and `app-logs` buffers

---

## Revision log

| Date | Change |
|------|--------|
| 2026-07-22 | Phase 5 complete — study notes abort, gesture/carousel/loading animation cleanup |
| 2026-07-22 | Phase 6 complete — Pexels LRU + background clear, reader storage LRU, perf cache snapshot helpers |
