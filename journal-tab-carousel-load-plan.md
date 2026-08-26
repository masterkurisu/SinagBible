# Journal Tab Appear + Carousel Image Load — Phased Fix Plan

Sinag Bible mobile · Expo 57 · React Native 0.86 · expo-router NativeTabs · Android (reproduced)

**Status:** Phases 1–4 implemented. Verify Phase 4 on device (first-paint verse/URL identity).

**How to use:** Run each phase in a **focused session** (fresh chat is fine). Attach this file
plus the "Context to attach" list for that phase. Do not start a later phase until the previous
phase's exit criteria are met. Commit after each phase. If a phase reveals a blocker, stop,
update **Spike findings**, and re-evaluate before continuing.

**Source:** Screen recording `Screen_Recording_20260826_075452_Sinag Bible (Dev).mp4`
(2026-08-26, Android, ~13.8s). User report: switching to Journal from Reader or Home has a
visible delay; verse carousel cards show the wrong photo, then a blank thumbnail, then the
correct photo.

**Related docs:**
- `performance-memory-plan.md` — the journal unmount-on-blur was added for 4GB RAM devices
  (`1186057e`). Phase 1 must preserve that intent without restoring the blank-page flash.
- Do **not** treat this as a Pexels API bug. URLs are already cached; the flash is mount +
  image-view lifecycle.

---

## Summary

| Phase | Theme | Effort | User-visible impact |
|-------|-------|--------|---------------------|
| 1 | Keep journal painted after first visit | Medium | **High** (blank page delay) |
| 2 | Stop wrong-then-right carousel photos | Small | **High** (alternate images) |
| 3 | Show cached photos immediately | Medium | **High** (blank thumbnails) |
| 4 | Stable verse/URL identity on mount | Small | Medium (remaining shuffle) |

Phase 1 alone should make Journal appear as fast as Home. Phases 2–3 are required so the
carousel still looks correct if it remounts (dev reload, memory trim, first visit in a session).
Phase 4 is polish for the first-paint race between default verses and loaded favorites/settings.

---

## What the recording shows

On every Reader → Journal and Home → Journal switch:

1. **Tab highlight changes immediately**, but the screen stays an empty journal-colored page
   (no title, carousel, list, or FAB) for several hundred ms.
2. **Chrome pops in:** title, gradient carousel cards, skeleton list rows, then the real entry.
3. **Carousel photos arrive later:** cards sit on dark gradients, then photos fade in.
4. Leaving and coming back **repeats the same cold start**, even though Home’s daily-verse
   photo was already on screen.

Home does not do this. It stays mounted.

---

## Root causes (do not re-diagnose unless evidence changes)

Three stacked issues. Fixing only images will not remove the blank page; fixing only the
unmount will not remove wrong/blank photos on a true remount.

### Cause 1 — Journal unmounts whenever it is not focused

`app/(tabs)/journal/index.tsx` replaces the entire tree with an empty `View` while unfocused:

```tsx
if (!isFocused || !hasVisitedJournalTab) {
  return (
    <View style={{ flex: 1, backgroundColor: bundle.journal.listPageBackground }} />
  );
}
```

Introduced in `1186057e` (“Ram management improvements for 4gb android devices”). Off-screen,
this wipes list entries, loading flags, carousel verses, image URLs, `expo-image` views, app
bar, FAB, and sheets.

Coming back is a first paint: `isFocused` must become true, then everything mounts from scratch.
That empty frame is the blank page in the video.

On every focus, `useFocusEffect` also does:

- `setLoading(true)` even when entries were already loaded
- `InteractionManager.runAfterInteractions(() => load())`

Because the tree remounted, `entries` is `[]` again → skeleton rows, then a deferred storage
read. That is the second beat: blank page → skeleton/chrome → real list.

Home (`app/(tabs)/index.tsx`) does **not** unmount on blur.

### Cause 2 — Carousel photos always start blank

`lib/carousel-background-image.tsx` keeps the photo layer at opacity `0` until `expo-image`
fires `onDisplay`, then fades in over `CAROUSEL_PHOTO_CROSSFADE_MS` (200ms). `cachePolicy` is
`"disk"` only.

After a journal remount:

1. Cards render immediately with verse text + gradient (no photo).
2. URLs may already be in the in-memory session cache
   (`getCarouselBackgroundUrlSession` in `lib/pexels-repository.ts` — comment: “avoids URL flash
   when revisiting the journal tab”).
3. Bytes are on disk, but **not in memory**, and **opacity starts at 0 anyway**.
4. Decode + `onDisplay` + 200ms fade → blank thumbnails, then pop-in.

Home’s daily-verse card (`src/features/home/HomeM3DailyVerseCard.tsx`) uses the same image
component, but it never unmounts, so this path is invisible there.

A second blank window happens if session lookup misses on the first paint.
`useCarouselBackgroundUrls` initializes from `DEFAULT_CAROUSEL_IMAGE_THEME` and the current
`displayVerses`. Favorites/settings load async. If the verse set or theme does not match the
cached session key, URLs are empty until `resolveCarouselBackgroundUrls` finishes.

### Cause 3 — Wrong image, then the right one

Two mechanisms:

**A. Opacity is reset in `useEffect`, after paint.** When a recycled carousel cell gets a new
`uri`, the wrapper can still be opacity `1` from the previous photo. One or more frames of the
old bitmap paint, then the effect sets opacity to `0` (blank), then `onDisplay` fades in the
new photo. Sequence: alternate image → blank → correct image.

**B. `expo-image` recycling across Home and Journal.** `recyclingKey` is the URI. Home and
Journal share the daily-verse URL. On Android, native image views are pooled. `onDisplay` can
fire for a recycled bitmap (e.g. Home’s yellow flowers) before the card’s real decode finishes.
Fade-in is tied to `onDisplay`, so the wrong photo can appear, then swap to the right one
without resetting opacity.

The nested horizontal `FlatList` in `JournalInspirationCarousel` sits inside a parent list with
`removeClippedSubviews` on Android, which makes cell reuse more likely.

### Chain on a tab switch

```
tap Journal
  → native tab selected
  → isFocused still false → empty colored View          // delay
  → isFocused true → full remount
  → InteractionManager + setLoading(true)               // skeleton
  → carousel mounts, opacity 0, maybe no URLs yet       // blank thumbs
  → session/disk decode, onDisplay, 200ms fade
  → recycled native view may show another card’s photo  // wrong image
  → correct photo
```

---

## Locked decisions (do not change without updating this doc)

| # | Decision |
|---|----------|
| 1 | **Do not** re-fetch Pexels on tab focus. Session + disk cache already exist. |
| 2 | **Do not** wrap `expo-image` with `Animated.createAnimatedComponent` (Hermes/Android crash). Keep opacity on a wrapper `View`. |
| 3 | Phase 1 must not undo 4GB RAM intent: if the full tree cannot stay mounted, unmount **sheets/overlays only**, never the list header/carousel snapshot. |
| 4 | Close new-entry sheet and settings menu on blur — that `useFocusEffect` cleanup stays. |
| 5 | Home and Journal keep sharing the same daily-verse id + URL assignment. Fix recycling keys; do not duplicate image pipelines. |
| 6 | Fade-in is for **uncached** first decode only. Cached session hits should paint opaque. |
| 7 | No carousel layout redesign in this work (card sizes, gradients, copy stay as-is). |

---

## App constraints

| Area | Reality | Plan implication |
|------|---------|------------------|
| Native tabs | `app/(tabs)/_layout.tsx` uses `expo-router/unstable-native-tabs` | Inactive screens are already offscreen; full JS unmount is extra |
| Journal screen | `app/(tabs)/journal/index.tsx` is large (~1,500 lines) | Phase 1: smallest possible change to the focus gate + load-on-focus |
| Carousel | Nested horizontal `FlatList` in `ListHeaderComponent` | Do not flatten into the main list in this work |
| Image cache | `lib/pexels-repository.ts` session LRU + AsyncStorage + `Image.prefetch` | Reuse; do not add a third cache |
| RAM history | Unmount was for 4GB Android | Phase 1 needs a device-conscious fallback, not “always mount everything” |

### Explicitly out of scope (unless asked)

- Changing Pexels search, theme options, or refresh intervals
- Rewriting `JournalInspirationCarousel` as FlashList / pager
- Prefetching every pool URL at app start (only visible cards)
- iOS-only work — bug was recorded on Android; keep iOS from regressing
- Reader tab hide-on-scroll / tab-bar work

---

## Phase 1 — Stop the blank page

**Goal:** After the user has visited Journal once this session, switching back must show the
last painted journal UI immediately (title, carousel chrome, list, FAB). No empty colored
flash. No skeleton if entries are already in memory.

**Context to attach:**
- `journal-tab-carousel-load-plan.md` (this file)
- `app/(tabs)/journal/index.tsx`
- `app/(tabs)/index.tsx` (Home stays mounted — reference behavior)
- `performance-memory-plan.md` (RAM intent)

**Tasks:**

1. **Keep the journal tree mounted after first visit.**
   - `hasVisitedJournalTab` can still gate *first* visit (lazy mount is fine).
   - After that, **do not** `return <View />` when `!isFocused`.
   - If RAM still requires hiding work: `pointerEvents="none"` / opacity / freeze overlays,
     but leave the last painted list + carousel in the native hierarchy.

2. **Do not force a loading skeleton on revisit.**
   - In `useFocusEffect`, skip `setLoading(true)` when `entries.length > 0` (use a ref so the
     effect does not depend on `entries`).
   - Reload in the background so new/edited entries still appear.

3. **Do not defer revisit reload behind `InteractionManager`.**
   - Keep `runAfterInteractions` for the **true first visit** if first-paint jank is real.
   - On revisit, call `load()` immediately (or after a single `requestAnimationFrame`).

4. **Keep blur cleanup.**
   - Still close new-entry sheet and settings menu when leaving the tab.

**Exit criteria:**
- [x] First visit in a process may still be empty until first focus (lazy mount OK)
- [x] Second+ visit from Reader or Home: journal chrome visible on the same frame as the
      tab highlight (no empty colored page) — *code: tree stays mounted; confirm on device*
- [x] No skeleton flash when entries were already loaded — *code: skip `setLoading(true)` when
      `entriesCountRef > 0`; confirm on device*
- [x] New-entry sheet still dismisses when leaving the tab
- [x] No new lint/type errors
- [x] Low-RAM note: full tree stays mounted after first visit (NativeTabs already keeps the
      screen offscreen). No empty-`View` fallback. If 4GB devices struggle, use the fallback
      plan at the bottom — do not restore the unfocus unmount.

**Manual test:**
- Cold start → Reader → Journal (first visit; delay OK)
- Journal → Reader → Journal (must be instant)
- Journal → Home → Journal (must be instant)
- Open new-entry sheet → switch tab → return (sheet closed, list still painted)
- Create/edit an entry on another route, return to Journal (list updates without skeleton)

---

## Phase 2 — Stop wrong-then-right photos

**Goal:** A carousel cell must never paint another card’s (or Home’s) bitmap. If the URI
changes, the previous photo must not be visible for even one frame.

**Depends on:** Phase 1 done (or explicitly skipped with the unmount still in place — then
this phase still matters on remount).

**Context to attach:**
- `journal-tab-carousel-load-plan.md`
- `lib/carousel-background-image.tsx`
- `src/features/journal/JournalInspirationCarousel.tsx`
- `src/features/home/HomeM3VerseCard.tsx`

**Tasks:**

1. **Synchronous hide on URI change.**
   - Do not wait for `useEffect` to `opacity.setValue(0)`.
   - Options (pick one, keep it simple):
     - Key the `Image` on `uri` so the wrapper remounts at opacity 0, **or**
     - Track `displayedUri` in a ref and set opacity 0 during render when `uri` !== last
       displayed uri (no `Animated.createAnimatedComponent` on `Image`).

2. **Stable recycling identity.**
   - Pass `recyclingKey={verseId}` or `` `${verseId}:${uri}` `` from the card, not URI alone.
   - Home daily-verse card should use the daily-verse id (`daily-verse:<dayKey>`), not the URL.

3. **Do not fade in on a recycled `onDisplay` for the wrong bitmap.**
   - Ignore `onDisplay` unless it corresponds to the current `uri` (compare against a ref
     updated when `uri` changes).

**Exit criteria:**
- [x] Switching Home ↔ Journal never shows Home’s photo on a non-daily journal card — *code:
      recyclingKey is `verseId:uri`; confirm on device*
- [x] Horizontal carousel scroll does not flash the previous card’s photo on the next cell —
      *code: opacity reset during render + onDisplay URI guard; confirm on device*
- [x] Home daily-verse card still looks correct (shared component) — *passes `dailyVerse.id`*
- [x] No Hermes crash from animating `expo-image` directly

**Manual test:**
- Home (daily verse photo visible) → Journal: daily card may share the photo; neighbor cards
  must not briefly show that photo
- Journal → Home → Journal, repeat 5 times
- Fling the carousel left/right several times; no stale photo on newly visible cards

---

## Phase 3 — Show cached photos immediately

**Goal:** If the URL is already in the session map (or memory cache), the photo paints opaque
on first frame. Gradient-only cards are only for a true first decode / missing URL.

**Depends on:** Phase 2 (wrong-image guards must exist before skipping the fade).

**Context to attach:**
- `journal-tab-carousel-load-plan.md`
- `lib/carousel-background-image.tsx`
- `lib/use-carousel-background-urls.ts`
- `lib/pexels-repository.ts`
- `src/features/home/HomeM3DailyVerseCard.tsx`

**Tasks:**

1. **Skip fade for cache hits.**
   - If `getCarouselBackgroundUrlSession` already has the URL for this verse, start opacity at
     `1` (or skip the 200ms timing).
   - Keep the fade for first network/disk decode when there was no session URL.

2. **Use memory+disk cache.**
   - Change `cachePolicy` from `"disk"` to `"memory-disk"` on carousel/home verse photos so a
     remount does not re-decode from disk only.

3. **Hydrate URLs before first paint.**
   - `useCarouselBackgroundUrls` initial state must use the **current** theme, not only
     `DEFAULT_CAROUSEL_IMAGE_THEME`, if a module-level last-known theme exists.
   - Optional: persist last-known settings in module scope (same pattern as reader last
     position peek) so the initializer is not a frame behind AsyncStorage.

4. **Warm visible journal URLs from Home (optional but recommended).**
   - Home already resolves the daily verse. Prefetch the current carousel set’s assigned URLs
     (`Image.prefetch` is already used inside `resolveCarouselBackgroundUrls`) so Journal’s
     first decode is warm. Do **not** warm the entire keyword pool on the home screen.

**Exit criteria:**
- [x] Revisit Journal: visible carousel cards show photos without a gradient hold, when those
      URLs were already assigned this session — *code: `cached` + displayed-URI set +
      `memory-disk`; confirm on device*
- [x] First process launch / empty cache: gradient then fade is still acceptable
- [x] Home daily-verse card does not regress (no flicker, no missing photo)
- [x] No extra Pexels network calls on tab focus — *session hit returns without
      `resolveCarouselBackgroundUrls`; Home warms assigned URLs via prefetch only*

**Manual test:**
- Warm session: Home → Journal → Reader → Journal; photos already there
- Kill app, cold start, open Journal first; fade-in OK
- Airplane mode after a warm session: cached photos still appear

---

## Phase 4 — Stable verse/URL identity on mount

**Goal:** The carousel must not emit default verses, then swap to favorites/settings, then
re-resolve URLs. First painted set should be the set the user will keep.

**Depends on:** Phases 1–3. Skip if after Phase 3 there is no remaining shuffle on first visit.

**Context to attach:**
- `journal-tab-carousel-load-plan.md`
- `lib/use-journal-carousel-verses.ts`
- `lib/use-carousel-background-urls.ts`
- `lib/journal-carousel-verses.ts`
- `src/features/journal/JournalInspirationCarousel.tsx`

**Tasks:**

1. **Gate or reuse last snapshot.**
   - Either do not render `JournalInspirationCarousel` cards until
     `useJournalCarouselVerses().loaded` is true, **or**
   - Keep module-level last `displayVerses` + `urlByVerseId` and use that as `useState`
     initial state on remount (preferred if Phase 1 still remounts on low-RAM fallback).

2. **Do not clear URLs on an empty blip.**
   - In `useCarouselBackgroundUrls`, avoid `setUrlByVerseId({})` when `displayVerses.length
     === 0` during a reload. Keep previous map until a non-empty resolve arrives.

3. **Register the verse consumer with current verses.**
   - The `registerCarouselVerseConsumer` effect currently has `[]` deps and only the initial
     array. Confirm `update(displayVerses)` covers later changes (it should); do not leave a
     stale consumer if the hook remounts mid-reload.

**Exit criteria:**
- [x] First Journal visit in a session: no visible swap of verse text or background between
      defaults and the loaded set (or a single held frame with no content until loaded — no
      wrong verses) — *hold empty until hydrated; remount uses peeked state + last snapshot*
- [x] Favorites add/remove still updates the carousel live
- [x] Theme / card-size settings still apply without a double image fetch — *empty verse
      blip no longer clears URLs; consumer `update()` keeps the registration current*

**Manual test:**
- Fresh install / cleared carousel favorites: daily verse + defaults, no shuffle after load
- With favorites saved: first paint matches saved set
- Add a favorite from Reader, return to Journal: new card appears without wiping others

---

## Suggested session prompts

Copy one of these into a new chat with `@journal-tab-carousel-load-plan.md` attached.

**Phase 1**
> Implement Phase 1 from `@journal-tab-carousel-load-plan.md`. Do not start Phase 2. Keep
> journal painted after first visit; skip skeleton on revisit; keep blur cleanup for sheets.

**Phase 2**
> Implement Phase 2 from `@journal-tab-carousel-load-plan.md`. Sync opacity reset and
> verse-id recyclingKey. Do not change cache policy or the journal focus gate.

**Phase 3**
> Implement Phase 3 from `@journal-tab-carousel-load-plan.md`. Cached carousel photos must
> paint opaque; fade only for first decode. No extra Pexels fetches on tab focus.

**Phase 4**
> Implement Phase 4 from `@journal-tab-carousel-load-plan.md`. Stabilize first-paint verse
> and URL identity. Do not redesign the carousel.

---

## Spike findings

_Fill this in if a phase is blocked. Date + what you tried + what to do instead._

| Date | Phase | Finding |
|------|-------|---------|
| 2026-08-26 | — | Diagnosis from Android recording. Unmount-on-blur + opacity-0-until-onDisplay + URI recyclingKey. |
| 2026-08-26 | 1 | Kept journal tree mounted after first visit. `hasVisitedJournalTab` still lazy-mounts. Load-on-focus no longer sets `loading` or waits on `InteractionManager` when entries are already in memory. Blur still closes the new-entry sheet and settings menu. Image flicker is unchanged (Phases 2–3). |
| 2026-08-26 | 2 | Sync opacity reset on URI change (render, not `useEffect`). `onDisplay` ignored unless it matches the current URI. Recycling key is `verseId:uri` for journal cards and the home daily-verse card. `cachePolicy` still `"disk"`; fade-in still 200ms (Phase 3). |
| 2026-08-26 | 3 | Cached photos paint opaque (`cached` from session + process-level displayed URI set). `cachePolicy` is `"memory-disk"`. Theme/settings peeked in memory. Assigned URLs prefetch `memory-disk`; pool URLs stay disk. Home warms the loaded carousel set after `useJournalCarouselVerses().loaded`. Fade remains for first decode / refreshed URLs. |
| 2026-08-26 | 4 | Do not paint default verses before hydration. Peek favorites/settings/card-sizes in memory; last `displayVerses` + URL map reused on remount. Empty verse list no longer clears URLs. Consumer registers from the current ref and `update()`s on verse changes. Tab layout warms favorites and card sizes with settings. |

---

## Fallback plan

If Phase 1 cannot keep the full journal tree mounted on 4GB devices:

1. Keep a **lightweight snapshot** mounted: list header (title + carousel) + last `entries`
   state in module/context, even if the rest of the screen unmounts.
2. Do **not** go back to the empty colored `View` as the unfocused representation.
3. Prefer lifting `useJournalCarouselVerses` + `useCarouselBackgroundUrls` state out of the
   screen (module cache or a provider above the tab) so remounting the screen does not reset
   URLs or verses.

If `expo-image` still flashes recycled bitmaps after Phase 2:

1. Set `recyclingKey` to verse id only and `transition={0}` (already 0).
2. Last resort: hide the `Image` with `opacity: 0` until `onLoad` reports the **requested**
   `source.uri`, not `onDisplay`.
3. Do not introduce a second image library.
