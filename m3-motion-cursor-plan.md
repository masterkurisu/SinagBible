# M3 Motion Migration — Phased Cursor Plan

Bible journal app · Expo 57 · React Native 0.86 · Reanimated 4.5 · expo-router 57

**How to use:** Run each phase in a **fresh Cursor chat** (Cmd/Ctrl+N). Attach only the
files listed under "Context to attach" using `@file`. Paste the prompt block verbatim.
Each phase is self-contained — corrected M3 values are baked into the prompts so Cursor
never needs the full spec (or this doc) in context. Commit after every phase so you can
diff/revert per batch.

**Do not start phases until this plan is reviewed.** Phases are ordered; later phases
assume earlier commits landed.

---

## App constraints (read before any phase)

These are fixed facts about the current codebase — prompts assume them.

| Area | Reality | Plan implication |
|------|---------|------------------|
| **Navigation** | Root `Stack` in `app/_layout.tsx` pushes `journal/[id]` **outside** the tabs group. Default animation: Android `fade_from_bottom` (200 ms), iOS `ios_from_right` (340 ms). | Cross-screen morphs need per-push `animation: 'none'` (see `lib/reader-hub-navigation.ts` for the existing `__internal_expo_router_no_animation` pattern). |
| **Modal shells** | All sheets/dialogs use `Modal` + `animationType="none"`. `DismissibleModal` and `DismissibleSideSheet` accept **`Animated.Value` scrim opacity** — not Reanimated `SharedValue`. | Any Reanimated migration of sheet motion must update these shells **or** keep RN `Animated` for the shell layer until a dedicated shell phase. |
| **Dual animation APIs** | ~40 surfaces still use RN `Animated`; ~16 use Reanimated (scroll, search layer, switches, onboarding morph). | This plan does **not** aim to eliminate all `Animated` usage. Scope is M3-aligned motion on targeted surfaces only. |
| **Device motion budget** | `lib/device-capability.ts` exports `motionTier` (`reduced` on low-RAM Android) with shorter sheet durations and `SHEET_OPEN_USE_SPRING` gated to iOS standard tier. | M3 springs on low-end Android may need a `motionTier === 'reduced'` fallback to `withTiming` — integrate in Phase 6, do not fight `motionTier` in Phases 2–3. |
| **No portal library** | No `@gorhom/portal` or similar in dependencies. | `ContainerTransformHost` mounts as an absolute overlay in `app/_layout.tsx` (same pattern as `TabBarSearchLayer` in `app/(tabs)/_layout.tsx`). |
| **Shared elements** | No `sharedTransitionTag` / `ENABLE_SHARED_ELEMENT_TRANSITIONS`. Managed Expo workflow, no committed `android/`/`ios/`. | Manual overlay morph + invisible stack swap is the correct approach (Phase 5). |
| **Journal data bridge** | `lib/journal-edit-bridge.ts` already has `setPendingJournalDetailEntry` / `peekPendingJournalDetailEntryFor` — detail screen skips async load when bridged. | Phase 5 must call `setPendingJournalDetailEntry` before `router.push`, not invent a new bridge. |
| **Easing API split** | `m3-motion.ts` exports `Easing` from `react-native`. Reanimated call sites import `Easing` from `react-native-reanimated`. | Phase 0 adds parallel Reanimated easing exports (same bezier control points). |

### Explicitly out of scope (do not pull into phases unless asked)

- `BookPickerSheet`, `TranslationPickerSheet` — use `device-capability` durations + inline springs
- Reader chapter stack fade (120 ms in `app/(tabs)/reader/_layout.tsx`)
- `reader-tab-bar-visibility-context.tsx` hybrid `Animated.Value` + `SharedValue` bridge
- Migrating all ~40 legacy `Animated` surfaces (Phase 6 audits only; does not migrate)
- Reanimated Shared Element Transitions (experimental, feature-flagged)
- `@gorhom/bottom-sheet` (not used; all sheets are custom)

---

## Phase 0 — Motion tokens (foundation)

Smallest phase, biggest leverage. Everything later imports from this file.

**Context to attach:** `src/components/m3/m3-motion.ts`

**Prompt:**

```
Extend @m3-motion.ts with the M3 motion physics tokens and missing duration tokens.
Do not modify or rename existing exports. Use these EXACT values (verified against the M3 spec
and MDC-Android Motion.md — do not substitute values from memory):

DURATIONS — add only tokens that do not already exist:
- M3_MOTION_DURATION_MEDIUM1_MS = 250
  (M3_MOTION_DURATION_MEDIUM2_MS = 300 already exists — do NOT re-export or change it)
- M3_MOTION_DURATION_LONG1_MS = 450
- M3_MOTION_DURATION_LONG2_MS = 500   // container transform enter default in MDC theme table

CONTAINER TRANSFORM DEFAULTS (MDC MaterialContainerTransform library defaults —
these intentionally differ from the generic LONG1/MEDIUM2 token names):
- M3_CONTAINER_TRANSFORM_ENTER_MS = 300
- M3_CONTAINER_TRANSFORM_RETURN_MS = 250

SPRINGS — export as Reanimated withSpring config objects. M3 specifies damping as a
RATIO (0–1); Reanimated damping is ABSOLUTE. Conversion: damping = ratio * 2 * sqrt(mass * stiffness).
These are pre-converted for mass 1 — use them as-is:

- M3_SPRING_FAST_SPATIAL    = { damping: 67.3, stiffness: 1400, mass: 1 }  // ratio 0.9 — switches, buttons, chips
- M3_SPRING_DEFAULT_SPATIAL = { damping: 47.6, stiffness: 700,  mass: 1 }  // ratio 0.9 — bottom sheets, drawers, search pill
- M3_SPRING_SLOW_SPATIAL    = { damping: 31.2, stiffness: 300,  mass: 1 }  // ratio 0.9 — full-screen transitions

Effects (opacity/color — critically damped, ratio 1.0, must never overshoot):
- M3_SPRING_FAST_EFFECTS    = { damping: 123.3, stiffness: 3800, mass: 1 }
- M3_SPRING_DEFAULT_EFFECTS = { damping: 80.0,  stiffness: 1600, mass: 1 }
- M3_SPRING_SLOW_EFFECTS    = { damping: 56.6,  stiffness: 800,  mass: 1 }

REANIMATED EASINGS — duplicate the four existing bezier curves using Easing from
'react-native-reanimated' (same control points as the RN Easing exports):
- M3_EMPHASIZED_DECELERATE_REANIMATED
- M3_EMPHASIZED_ACCELERATE_REANIMATED
- M3_STANDARD_DECELERATE_REANIMATED
(Add _REANIMATED suffix only; keep original RN Easing exports unchanged for legacy Animated call sites.)

Add a doc comment on each spring: what it's for, and the rule "spatial = spring,
opacity/color = effects spring or timing with emphasized easing."
Export type M3SpringConfig for the shape of the spring objects.

No other files should change in this phase.
```

**Verify:** `pnpm typecheck` passes; nothing else touched. Commit: `feat(motion): add M3 spring + duration tokens`.

---

## Phase 1 — Settings menu springs → M3 tokens (keep RN Animated for now)

**Renamed from "Kill the legacy Animated API"** — scope is narrow and avoids breaking modal shells.

Migrates the three `reader-settings-menu-motion` call sites to M3 values without yet
switching `DismissibleSideSheet` / chapter screen to Reanimated. That keeps `Animated.Value`
interpolate chains working.

**Context to attach:**
- `lib/reader-settings-menu-motion.ts`
- `src/features/reader/ReaderSettingsSideSheet.tsx`
- `src/features/journal/JournalFilterSideSheet.tsx`
- `app/(tabs)/reader/[book]/[chapter]/index.tsx` (tablet settings strip only — search for `READER_SETTINGS_MENU_SPRING`)
- `src/components/m3/m3-motion.ts`

**Do NOT attach:** `ReaderM3BottomSheet` — it does not use `reader-settings-menu-motion`.

**Prompt:**

```
Align @reader-settings-menu-motion.ts and its three call sites with M3 motion tokens
from @m3-motion.ts. Keep React Native's Animated API (Animated.spring / Animated.Value)
for this phase — do NOT migrate to Reanimated yet.

Call sites (all import READER_SETTINGS_MENU_SPRING_OPEN/CLOSE):
1. @ReaderSettingsSideSheet.tsx — side drawer slide + scrim interpolate
2. @JournalFilterSideSheet.tsx — same pattern
3. @index.tsx (reader chapter) — tablet layout settings strip slide only

Rules:
- Replace friction/tension literals with spring configs derived from M3_SPRING_DEFAULT_SPATIAL.
  RN Animated.spring does not accept damping/stiffness — map M3 values to the closest
  friction/tension pair, OR switch these springs to Animated.timing with
  M3_EMPHASIZED_DECELERATE_EASING (open) / M3_EMPHASIZED_ACCELERATE_EASING (close) and
  M3_CONTAINER_TRANSFORM_ENTER_MS / M3_CONTAINER_TRANSFORM_RETURN_MS durations.
  Prefer timing mapping for predictable parity with M3 emphasized curves.
- Scrim opacity target stays 0.32 (already correct in ReaderSettingsSideSheet).
- Preserve exported names READER_SETTINGS_MENU_SPRING_OPEN/CLOSE so signatures stay stable,
  even if values become duration/easing configs instead of friction/tension.
- Do not restyle components. Behavior parity first.
- List every file changed.
```

**Verify:** Open/close reader settings side sheet, journal filter sheet, and tablet reader
settings strip — no visual regression. Commit: `refactor(motion): M3 tokens for settings menu springs`.

---

## Phase 1b — Modal shell Reanimated readiness (optional spine)

**Run this before Phase 2 if Phase 2 will migrate `ReaderM3BottomSheet` to Reanimated.**
Skip if Phase 2 is deferred.

**Context to attach:** `src/components/m3/DismissibleModal.tsx`, `src/components/m3/DismissibleSideSheet.tsx`

**Prompt:**

```
Update DismissibleModal and DismissibleSideSheet so scrimOpacity accepts EITHER
Animated.Value | Animated.AnimatedInterpolation<number> (existing) OR a Reanimated
SharedValue<number> (new). Use a type guard or union prop; render Reanimated.View for
SharedValue, Animated.View for legacy. No visual change — same default scrim behavior.
Do not migrate any call sites in this phase.
```

**Verify:** Existing sheets still open/close. Commit: `refactor(motion): dual scrim API for modal shells`.

---

## Phase 2 — Bottom sheets on M3 springs

**Context to attach:**
- `src/components/m3/ReaderM3BottomSheet.tsx`
- `src/features/journal/JournalCarouselSettingsSheet.tsx`
- `src/components/m3/m3-motion.ts`
- `lib/device-capability.ts` (read only — respect `motionTier`)
- If Phase 1b landed: `src/components/m3/DismissibleModal.tsx`

**Do NOT include in this phase:** `BookPickerSheet`, `TranslationPickerSheet`, `changelogs-sheet`,
`privacy-policy-sheet` — separate follow-up.

**Prompt:**

```
Align enter/exit motion of @ReaderM3BottomSheet and @JournalCarouselSettingsSheet
with M3 motion physics, using tokens from @m3-motion.ts only:

ReaderM3BottomSheet (currently RN Animated.timing + M3_EMPHASIZED_DECELERATE):
- Migrate to Reanimated (useSharedValue, withSpring, withTiming, useAnimatedStyle)
  IF DismissibleModal supports SharedValue scrim; otherwise keep Animated but swap
  to M3 duration tokens (M3_MOTION_DURATION_LONG2_MS for slide, M3_MOTION_DURATION_SHORT4_MS
  for opacity — replace the current SHORT4+80 hack).
- Sheet translateY: withSpring(M3_SPRING_DEFAULT_SPATIAL) on standard tier;
  on motionTier === 'reduced' (from @device-capability.ts), use withTiming +
  M3_EMPHASIZED_DECELERATE_EASING instead — no spring on low-RAM Android.
- Scrim: withTiming, emphasized easing, target alpha 0.32 (verify menuScrim color allows this).

JournalCarouselSettingsSheet (already Reanimated):
- Replace inline damping/stiffness literals with M3_SPRING_DEFAULT_SPATIAL (scale) and
  M3_SPRING_DEFAULT_EFFECTS or emphasized timing for opacity/scrim.
- Same motionTier reduced fallback as above.

Rules:
- Keep gesture-driven dragging logic untouched; only settle/dismiss animations change.
- Do not add new dependencies.
- Do not change sheet layout or chrome colors.
```

**Verify:** Open reader font/more settings sheet and journal carousel settings on a real
Android device (standard + if possible low-RAM). Scrim fades without bounce. Commit:
`feat(motion): M3 springs for bottom sheets`.

---

## Phase 3 — Search pill → M3 container-transform choreography

**Context to attach:**
- `src/features/search/TabBarSearchLayer.tsx`
- `src/features/search/TabBarSearchFab.tsx` (read only — coordinate lifecycle)
- `app/(tabs)/_layout.tsx` (read only — layer mount point)
- `m3-motion.ts`

**Prompt:**

```
Refine @TabBarSearchLayer.tsx to match M3 container-transform choreography
("search bar → expanded search"). Tokens from @m3-motion.ts only.

Drive spatial + fade channels from ONE progress shared value (0→1):

1. SPATIAL (pill width, and height/radius if applicable): progress driven by
   withSpring(M3_SPRING_DEFAULT_SPATIAL) — or withTiming on motionTier reduced.
2. OUTGOING content (collapsed pill icon): fade OUT over progress [0.0, 0.25].
3. INCOMING content (expanded search field + results chrome): fade IN over [0.25, 1.0]
   (FADE_MODE_THROUGH).
4. SCRIM: 0 → 0.32 opacity (currently ~0.22 — align to M3), timing-based, no overshoot.
5. Results sheet translateY: keep staggered reveal but tie to same progress channel.

On CLOSE, reverse with return pacing (M3_CONTAINER_TRANSFORM_RETURN_MS for timing channels).

Replace the mixed withTiming(220ms)/withSpring(EXPAND_SPRING) setup.

Lifecycle constraints (do not break):
- @TabBarSearchFab returns null when isOpen — collapsed FAB is hidden while layer is open;
  the layer's pill is the morph source. Do not try to shared-element link FAB ↔ layer.
- Keep setLayerMounted / unmount delay pattern intact.
- Respect motionTier from device-capability on low-RAM Android.
```

**Verify:** Slow progress ×5 temporarily; content never double-exposes mid-morph. Test with
Android hardware back (existing BackHandler). Commit: `feat(search): M3 container transform choreography`.

---

## Phase 4 — Reusable morph overlay (`ContainerTransform`)

Generic building block for card → detail morphs. **No navigation coupling.**

**Context to attach:**
- `src/components/feature-onboarding/SpotlightOverlay.tsx` (measure + rect morph reference only)
- `m3-motion.ts`
- `app/_layout.tsx` (read only — host mount point)

**Prompt:**

```
Create src/components/m3/ContainerTransform.tsx and src/components/m3/ContainerTransformHost.tsx
— a reusable within-app container transform overlay. Reference @SpotlightOverlay for
measure + rect interpolation patterns, but do NOT copy onboarding-specific SVG hole logic.

Tokens from @m3-motion.ts only. No new dependencies. No portal library — host renders
a full-screen absolute Modal (animationType="none") similar to DismissibleModal.

API:
  ContainerTransformProvider — context wrapping app root (mount in @app/_layout.tsx
  inside GestureHandlerRootView, sibling to ThemedStack).
  useContainerTransform() → { openFrom(sourceRef, { renderExpanded, targetBounds? }), close(), isOpen }
  <ContainerTransformHost /> — renders overlay; provider supplies state.

Behavior on openFrom():
1. measureInWindow on source ref → start bounds + borderRadius from source style.
2. Animate overlay clone x/y/width/height/borderRadius to target bounds
   (default: full screen minus safe area insets) via withSpring:
   M3_SPRING_SLOW_SPATIAL for full-screen targets, M3_SPRING_DEFAULT_SPATIAL if
   target area < ~70% of screen.
3. Content fade-through: source fades out [0, 0.25]; expanded render fades in [0.25, 1].
4. Scrim: 0 → 0.32, timing only.
5. Optional background dim: scale root content to 0.95 + opacity 0.9 ONLY if a
   backgroundRef is passed — do not attempt to scale the entire app root by default
   (conflicts with native tabs / reader scroll chrome).
6. close() reverses; use M3_CONTAINER_TRANSFORM_RETURN_MS for timing channels.

Edge cases (required):
- Source unmounts mid-transition → abort to fade-out, call onClose callback.
- Android BackHandler while open → close().
- Interrupt (open→close before settle) → retarget spring, do not reset to 0.
- motionTier reduced → cross-fade fallback (150ms timing), skip morph.

Include a commented minimal usage example. Wire ContainerTransformProvider + Host in
app/_layout.tsx only — no feature wiring yet.

Do not couple to expo-router in this phase.
```

**Verify:** Temporary test button on any screen morphs a card to full screen; test interrupt
and back button. Commit: `feat(motion): reusable ContainerTransform overlay`.

---

## Phase 5 — Journal list → entry detail

**Context to attach:**
- `app/(tabs)/journal/index.tsx`
- `app/journal/[id].tsx`
- `src/components/m3/ContainerTransform.tsx` (+ Host/Provider)
- `lib/journal-edit-bridge.ts`
- `lib/reader-hub-navigation.ts` (pattern for animation: 'none')
- `app/_layout.tsx` (Stack screen options)

**Prompt:**

```
Wire container transform from journal list rows to entry detail using @ContainerTransform.tsx.
Manual overlay approach — NOT Reanimated sharedTransitionTag.

Navigation facts:
- List lives in tabs: app/(tabs)/journal/index.tsx
- Detail is root stack: app/journal/[id].tsx (pushed outside tabs group)
- Root stack default animation is fade_from_bottom / ios_from_right — must disable for handoff

Flow:
1. On row press (handleEntryPress): call setPendingJournalDetailEntry(item) from
   @journal-edit-bridge.ts BEFORE morph starts so detail can render from list data.
2. openFrom(rowRef, { renderExpanded: <JournalDetailPreview entry={item} /> }) — extract
   a minimal preview component from detail layout (title, date, passage, body preview)
   that matches detail screen's initial paint. No ActivityIndicator in preview.
3. When morph settles: router.push({ pathname: '/journal/[id]', params: { id,
   __internal_expo_router_no_animation: '1' } }) — mirror @reader-hub-navigation.ts pattern.
   Set journal/[id] Stack.Screen options animation: 'none' when no-animation param present
   (or always for journal detail if simpler).
4. On next frame after navigation: close() overlay without reverse animation (instant unmount)
   — real detail must be pixel-aligned with preview.
5. On back: router.back() with animation none; if originating row is still visible,
   re-open overlay expanded and close() into re-measured row. If row scrolled off-screen,
   fall back to plain overlay fade-out (no reverse morph).

Row requirements:
- Stable ref on JournalSwipeableListRow / tile press target (FlashList — use ref callback per id).
- Swipe-open rows: close swipe before morph or ignore press while swiped.

Detail screen:
- peekPendingJournalDetailEntryFor already skips loadJournalEntryById — ensure bridge is
  consumed. Do not show full-screen loading spinner when bridged entry exists.
- Disable or defer detail-only entrance animations on first paint after morph handoff.

Keep diff limited to listed files + minimal preview extraction (new file ok:
src/features/journal/JournalEntryDetailPreview.tsx).
```

**Verify:** Morph from top row, scrolled row, and after fast scroll; back gesture; slow device.
Row off-screen → fade fallback. Commit: `feat(journal): container transform to entry detail`.

---

## Phase 6 — Consistency audit + reduced motion

**Context to attach:** `src/components/m3/m3-motion.ts`, `lib/device-capability.ts`

**Prompt:**

```
Audit motion consistency across the codebase:

1. Search for withSpring/withTiming/Animated.spring/Animated.timing with inline
   damping/stiffness/duration/easing literals outside m3-motion.ts. List each file:line.
   Replace only in files already touched by Phases 1–5 plus:
   - src/features/reader/useReaderTabBarScrollDriver.ts (duplicated M3 beziers → import tokens)
   - components/M3Switch.tsx
   - src/features/search/TabBarSearchFab.tsx (press scale spring)
   Do NOT migrate BookPickerSheet / TranslationPickerSheet in this pass.

2. Search for remaining 'react-native' Animated imports used purely for motion.
   Output a report grouped by: (a) modal/sheet shells, (b) press-scale micro-interactions,
   (c) scroll-coupled chrome. Do not migrate items outside group (a) unless listed above.

3. Add lib/use-m3-motion-profile.ts (or extend m3-motion.ts) exporting:
   - useM3MotionProfile() → { tier: 'full' | 'reduced', prefersReducedMotion: boolean }
   - Combines motionTier from @device-capability.ts with AccessibilityInfo.isReduceMotionEnabled()
     (subscribe to reduceMotionChanged). Reanimated does not ship useReducedMotion in 4.5 —
     do not import it.
   - When tier is 'reduced' OR prefersReducedMotion: springs → 150ms cross-fade timing;
     apply in ContainerTransform, TabBarSearchLayer, ReaderM3BottomSheet, JournalCarouselSettingsSheet.

4. Output a summary table: animated surface → M3 token used → reduced-motion fallback.
```

Commit: `chore(motion): token audit + reduced-motion support`.

---

## Phase map & dependencies

```
Phase 0 (tokens)
    ↓
Phase 1 (settings menu → M3 values, keep Animated)
    ↓
Phase 1b (modal shell dual API) ──optional──┐
    ↓                                        ↓
Phase 2 (bottom sheets) ←────────────────────┘
    ↓
Phase 3 (search choreography)     Phase 4 (ContainerTransform)
         \                           /
          \                         /
           ↓                       ↓
              Phase 5 (journal morph)
                      ↓
                 Phase 6 (audit)
```

Phases 3 and 4 are independent after Phase 2. Phase 5 requires Phase 4. Phase 6 is always last.

---

## Cursor workflow tips

- **One phase = one chat.** Old context can leak wrong damping values — start clean.
- **Plan-then-apply:** for Phases 3–5, append *"First give me a short plan and the list of
  files you'll touch. Wait for my OK before editing."*
- **Pin the numbers.** Prompts embed corrected values because Cursor previously produced
  `damping: 18` (~0.34 ratio — too bouncy) and conflated LONG1/MEDIUM2. Reject "corrections."
- **Feel-check on a real Android device** after Phases 2, 3, and 5 — springs read differently
  on-device vs simulator. Test low-RAM behavior if possible (`motionTier === 'reduced'`).
- **Do not expand scope mid-phase.** Picker sheets, reader tab-bar bridge, and full Animated
  elimination are follow-up work documented in "Out of scope."

---

## Known risks & mitigations

| Risk | Mitigation in plan |
|------|-------------------|
| `DismissibleModal`/`DismissibleSideSheet` require `Animated.Value` | Phase 1 keeps Animated; Phase 1b optional dual API before Phase 2 Reanimated migration |
| `motionTier` shortens durations on low-RAM Android | Phases 2–3 check `motionTier`; Phase 6 unifies with OS reduce motion |
| Journal detail full-screen `ActivityIndicator` breaks invisible handoff | Phase 5 mandates `setPendingJournalDetailEntry` + preview component without spinner |
| Root stack push anim fights morph | `__internal_expo_router_no_animation` param + `animation: 'none'` on detail |
| `TabBarSearchFab` hides when open | Phase 3 documents layer-owned pill as morph source |
| FlashList row refs scroll off-screen on back | Phase 5 fade fallback when row not measurable |
| No portal package | `ContainerTransformHost` uses root-level `Modal` overlay |
| Easing imported from wrong package in Reanimated files | Phase 0 adds `_REANIMATED` easing exports |
| `M3_MOTION_DURATION_MEDIUM2_MS` already exists at 300 | Phase 0 prompt says do not re-export |
