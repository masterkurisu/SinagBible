# Journal Reflection Editor — Live Markdown Rendering Plan

Sinag Bible mobile · Expo 57 · React Native 0.86 · expo-router 57

**Status:** Approved direction — refer to this doc before touching the journal reflection editor
again. Supersedes the per-block live-preview design in `components/journal-new-entry-form.tsx`.

**How to use:** Run each phase in a focused session. Do not start a later phase until the
previous phase's exit criteria are met. Commit after each phase. If a phase reveals a blocker,
stop, update this doc's "Spike findings" section with what you learned, and re-evaluate before
continuing (see "Fallback plan" at the bottom).

---

## Why this doc exists

The reflection editor has gone through several iterations chasing the same requirement: *format
text (bold/italic/headings/lists/checklists/links) without showing raw `**markdown**` syntax to
casual users, and without needing an explicit "preview" step.*

Two designs were tried and both cause real UX pain, for the same underlying reason:

1. **Whole-document raw-while-focused, formatted-on-blur** (original toolbar rework). Pain:
   *"I need to close the keyboard to see formatting."*
2. **Per-block swapping** — tapped block shows raw markdown in a real `TextInput`; every other
   block renders formatted; swap on focus/blur (current code as of this doc). Pain: *"text
   disappears while I'm editing," "tapping another line makes others disappear," and formatting
   still doesn't render live while typing.*

**Root cause:** plain React Native `TextInput` can only render one uniform style for its entire
value — it cannot show `**bold**` as literally bold while still being an editable, native,
cursor-aware field. Every design that tries to hide markdown syntax while typing is forced to
fake it by swapping between a raw-text input and a rendered preview. Swapping is inherently
disruptive (layout reflow, focus loss, flicker) no matter how it's scoped (whole-doc vs. per-block).

**The fix is to stop swapping and render formatting *inside* the live input itself.**

---

## Locked decisions

| # | Decision |
|---|----------|
| 1 | Adopt [`@expensify/react-native-live-markdown`](https://github.com/Expensify/react-native-live-markdown)'s `MarkdownTextInput` as the reflection editor's single input — real native `TextInput` under the hood, with live bold/italic/heading/list character styling applied as you type. No more block-swapping, no more raw-vs-preview toggling. |
| 2 | `reflectionMarkdown` (plain markdown string) stays the source of truth and save format — unchanged. `MarkdownTextInput` is a drop-in replacement for the input layer only, not a data-model change. |
| 3 | Do this spike-first: verify the library builds and renders correctly in this app's dev client **before** ripping out the per-block system. Don't leave the editor broken mid-migration across chat sessions. |
| 4 | Custom syntax not in the library's default parser (`- [ ] ` checklists, `[image:id]` tokens) is **not required** to live-render inline — decide their handling in Phase 2 based on spike findings (see Phase 2). |
| 5 | If the spike fails or surfaces a blocker (New Architecture/worklets conflict, unacceptable platform bug, checklist/image support too awkward), stop and execute the **Fallback plan** at the bottom instead — do not keep iterating on block-swapping. |

---

## Confirmed feasibility (checked before writing this plan)

- Expo SDK 57 / React Native 0.86 — defaults to the New Architecture (library requires New Arch). ✅
- `react-native-reanimated` and `react-native-worklets` already in `package.json`. Must confirm
  installed `react-native-worklets` version against the library's compatibility table (may need a
  bump). ⚠️ verify in Phase 0.
- App already uses `expo-dev-client` + `expo run:ios` / `expo run:android` (`package.json` scripts:
  `dev:usb`, `android`, `ios`) — **not** Expo Go. The library's "no Expo Go" caveat is a non-issue
  here. ✅

---

## Current architecture (for context — this is what Phase 2+ removes)

- `components/journal-new-entry-form.tsx` — main editor. Holds `reflectionMarkdown` state plus
  per-block editing state (`activeBlockPrefix`/`activeBlockSuffix`/`activeBlockText`/
  `activeBlockSelection` and refs), block activation/deactivation handlers, and
  `renderReflectionSurface`/`renderActiveReflectionBlockInput` which swap between a raw `TextInput`
  (active block) and `ReflectionFormattedPreview`-rendered blocks (inactive).
- `lib/journal-reflection-blocks.ts` — pure block splitter (`computeReflectionBlocks`,
  `findReflectionBlockIndexForOffset`, `classifyReflectionLineKind`). Used by both the live editor
  and (indirectly) `reflection-formatted-preview.tsx`.
- `lib/journal-reflection-markdown-edit.ts` — pure text-editing helpers (`wrapMarkdownMarker`,
  `toggleLinePrefix`, `insertMarkdownLink`, `insertTextAtSelection`, `continueListOnNewline`)
  used by the formatting toolbar. **These stay** — they operate on `(text, selection) → text` and
  are independent of which `TextInput` implementation renders the result.
- `components/reflection-formatted-preview.tsx` — `ReflectionFormattedPreview` (whole-doc preview)
  and `renderReflectionBlockContent` (single-block renderer, used by the per-block editor). Check
  other call sites before deleting (e.g. journal list entry previews may reuse pieces of this).
- `lib/journal-local.ts` — `splitReflectionMarkdownIntoChunks` etc., markdown → HTML conversion on
  save. **Unaffected** — save format doesn't change.
- Tests: `lib/__tests__/journal-reflection-blocks.test.ts`,
  `lib/__tests__/journal-reflection-html.test.ts`, `lib/__tests__/journal-local-reflection.test.ts`.

---

## Phase 0 — Spike & compatibility check

**Goal:** Prove the library works in this app's dev client before touching the real editor.

1. Install deps:
   ```
   npx expo install @expensify/react-native-live-markdown react-native-worklets expensify-common html-entities@2.5.3
   ```
2. Check `react-native-worklets` installed version against the library's README compatibility
   table (RN 0.86 line). Bump if needed; re-check `react-native-reanimated` compatibility with
   whatever `react-native-worklets` version is required.
3. Run a dev-client rebuild (`pnpm ios` / `pnpm android` equivalents — check `package.json`
   scripts: `ios`, `android`, `android:usb`, `dev:usb`) to pick up the new native module.
4. Drop a bare `MarkdownTextInput` into a throwaway test screen (or a temporary route) with a
   short sample containing `**bold**`, `_italic_`, `# heading`, `- bullet`. Confirm:
   - It builds and runs on iOS and Android (or at least whichever platform is available for
     testing right now — flag the other for later verification).
   - Typing shows live bold/italic/heading styling without needing to blur.
   - Cursor, selection, backspace, autocorrect/spellcheck feel native (no jank vs. plain
     `TextInput`).
5. Record findings in the **Spike findings** section below before proceeding. If blocked, jump to
   **Fallback plan**.

**Exit criteria:** `MarkdownTextInput` builds and live-renders basic markdown correctly on at
least one platform in this app's dev client.

### Spike findings

Recorded 2026-08-23.

**Installed versions**
- `@expensify/react-native-live-markdown` `0.1.335` (needs `0.1.331+` for RN 0.86)
- `react-native-worklets` `0.10.0` → `0.10.4` (library 0.1.333+ wants `0.10.2+`; Reanimated 4.5.0 peers `0.10.x`)
- `expensify-common` `2.0.199`
- `html-entities` `2.5.3` (exact, as required by the default parser)

**Install issues (resolved)**
- `npx expo install` wanted `react-native-worklets@0.10.1`. That is below the library’s `0.10.2+` column, so we pinned `0.10.4` instead. Reanimated 4.5.0 still accepts the 0.10 line.
- pnpm 11 `blockExoticSubdeps` blocked `expensify-common`’s git subdependency `simply-deferred`. Added a workspace override to registry `simply-deferred@3.0.0` (ExpensiMark does not import it).
- Default ExpensiMark parser requires `html-entities/lib/index.js` to start with `"worklet";`. Applied as `pnpm.patchedDependencies` (`patches/html-entities@2.5.3.patch`), matching the library’s own patch.

**Native rebuild**
- Android debug client rebuilt and installed (`:expensify_react-native-live-markdown` CMake + Java compiled; APK installed on SM_F971B). Worklets JS/native mismatch (`0.10.4` vs `0.10.0`) gone after rebuild.
- iOS not rebuilt this session — flag for later verification.

**Spike screen**
- Throwaway route: `/dev/live-markdown-spike` (`app/dev/live-markdown-spike.tsx`), `__DEV__`-gated.
- Metro bundled it for Android (`app/dev/live-markdown-spike.tsx`, 1877 modules). `parseExpensiMark` is a worklet (`__workletHash` present). Rest of the app launched on the new client without a worklets crash.
- Live styling while typing was not captured on-device this session (could not keep the spike route in the foreground). Open `/dev/live-markdown-spike` on the rebuilt Android client to confirm bold/italic/heading paint as you type, plus cursor/selection/backspace feel.

**Parser / Phase 2 implications**
- Default parser is ExpensiMark, **pluggable** via the required `parser` worklet prop. Custom parsers may only emit the library’s `MarkdownType` set: `bold | italic | strikethrough | emoji | mention-* | link | code | pre | blockquote | h1 | syntax | inline-image | codeblock`. **No list, checklist, h2, or arbitrary token types.**
- ExpensiMark live-styles `*bold*` (single asterisk), `_italic_`, `# heading`, links, code, strikethrough. GitHub `**bold**` and `- bullet` / `- [ ]` / `[image:id]` are not first-class. Phase 2 should treat checklists and `[image:id]` as plain text (or a custom parser mapped onto existing types), not expect native checkbox/image-in-input.
- `markdownStyle` exists for Phase 1. Component wraps a real `TextInput` (ref/`focus`/`onSelectionChange` work).

**Exit criteria:** native module + spike JS build on Android in this app’s dev client. Visual live-render confirmation still a quick manual open of `/dev/live-markdown-spike`. Not a New-Arch/worklets blocker — do not jump to Fallback.

---

## Phase 1 — Style mapping

**Goal:** Make `MarkdownTextInput`'s live styling match the app's existing visual language before
wiring it into the real editor.

1. Configure the library's markdown style config (check its API — typically a `markdownStyle`
   prop) for:
   - Headings: `Lora_400Regular` (h1-equivalent) / `Lora_700Bold` (h2-equivalent), sizes matching
     `renderReflectionBlockContent`'s current heading1/heading2 styles in
     `components/reflection-formatted-preview.tsx`.
   - Bold → `Lora_700Bold`, italic → italic style, body → `Lora_400Regular` at
     `REFLECTION_FIELD_FONT_SIZE`/`REFLECTION_FIELD_LINE_HEIGHT` (see
     `components/journal-new-entry-form.tsx`).
   - Bullet/ordered lists.
   - Links → `colors.gold`, underlined (match `LINK_COLOR` in `reflection-formatted-preview.tsx`).
   - Syntax markers (`**`, `_`, `#`, `- `) — de-emphasized (dimmed/lighter color) rather than
     hidden, per the library's model.
2. Confirm whether the library exposes a way to plug in custom token recognition (for `- [ ] `
   checklists and `[image:id]`) or whether those must be handled outside the live-rendered parser
   (see Phase 3 decision).

**Exit criteria:** A `MarkdownTextInput` visually matches the app's current formatted-preview look
for bold/italic/headings/lists/links.

---

## Phase 2 — Replace the per-block editor with a single `MarkdownTextInput`

**Goal:** Rip out block-swapping; wire `MarkdownTextInput` as the one and only reflection input.

1. In `components/journal-new-entry-form.tsx`:
   - Remove `activeBlockPrefix`/`activeBlockSuffix`/`activeBlockText`/`activeBlockSelection` state
     and their refs, `syncActiveBlockIntoFullMarkdown`, `setActiveBlockState`,
     `applyReflectionBlockEdit`, `activateReflectionBlockAtOffset`, `activateTrailingNewBlock`,
     `ensureActiveReflectionBlock`, `deactivateReflectionBlock`, `onActiveBlockKeyPress`,
     `onActiveBlockChangeText`, `renderActiveReflectionBlockInput`, `renderReflectionSurface`'s
     block-rendering branches.
   - Reintroduce a single `reflectionSelection` state (this existed before the per-block rework;
     check git history / the "Verse Tagging + Journal Editor Unification" plan doc for the
     original shape if needed) bound to one `MarkdownTextInput` whose `value`/`onChangeText` map
     directly to `reflectionMarkdown`/`setReflectionMarkdown` (same pattern as
     `onReflectionMarkdownChange` before the per-block rework).
   - Keep `pushReflectionUndo` / typing-undo-checkpoint logic (`flushTypingUndoCheckpoint`,
     `scheduleReflectionUndoCheckpoint`) — these are independent of the input implementation.
2. Both the sheet layout and fullscreen layout render sites (search for
   `renderReflectionSurface(reflectionInputRef, ...)` and
   `renderReflectionSurface(fullscreenReflectionInputRef, ...)`) become a single
   `renderReflectionInput(inputRef, layoutStyle)` helper rendering one `MarkdownTextInput`, styled
   with the existing `reflectionInputStyle` + `layoutStyle` (same sizing approach as today).
3. Decide and implement checklist/image handling based on Phase 0 findings:
   - **Checklists:** if the parser isn't pluggable, keep `- [ ] ` as plain visible text within the
     live input (acceptable — no worse than any other unstyled line) rather than trying to force
     checkbox rendering inline.
   - **Images:** keep inserting `[image:id]` as plain text at the cursor (as today). Either leave
     it visible as a compact text token, or render a small strip of image thumbnails for images
     currently referenced in the entry, separate from the text input (simpler, avoids trying to
     inline non-text content inside a text field).

**Exit criteria:** Reflection editing (sheet + fullscreen) uses one `MarkdownTextInput`; typing
`**bold**`/`_italic_`/`# heading`/`- bullet` renders live; no block-swap flicker; scrolling long
entries works using the input's native scroll (no nested `ScrollView` conflicts).

---

## Phase 3 — Rewire the formatting toolbar

**Goal:** Bold/italic/heading/list/checklist/link/image toolbar buttons keep working against the
new single input.

1. Toolbar handlers (`applyReflectionBold`, `applyReflectionItalic`, `applyReflectionHeading`,
   `applyReflectionBulletList`, `applyReflectionNumberedList`, `applyReflectionChecklist`,
   `applyReflectionLink`, `attachReflectionImage`, `undoReflection`) currently operate on
   `activeBlockText`/`activeBlockSelection`. Repoint them to operate on the full
   `reflectionMarkdown`/`reflectionSelection` (this is exactly how they worked before the
   per-block rework — same `wrapMarkdownMarker`/`toggleLinePrefix`/`insertMarkdownLink`/
   `insertTextAtSelection` helpers from `lib/journal-reflection-markdown-edit.ts`, unchanged).
2. Confirm `MarkdownTextInput` supports imperative `.focus()` and a controllable/observable
   `selection` the same way plain `TextInput` does (needed for toolbar actions to know where to
   insert markers and to nudge the cursor afterward) — verify during Phase 0/1 spike if not
   already confirmed.

**Exit criteria:** All toolbar buttons apply formatting at the correct cursor position/selection
and the result renders live immediately (no blur required).

---

## Phase 4 — Cleanup dead code

1. Delete `lib/journal-reflection-blocks.ts` and `lib/__tests__/journal-reflection-blocks.test.ts`
   if nothing else references them after Phase 2/3 (check `reflection-formatted-preview.tsx` and
   any journal list/preview components first — `renderReflectionBlockContent` /
   `computeReflectionBlocks` may still be used for read-only previews elsewhere, e.g. journal list
   tiles; keep those call sites working, only remove the *editor's* per-block usage).
2. Simplify or remove `components/reflection-formatted-preview.tsx` if it's no longer used by the
   editor itself — check `app/(tabs)/journal/index.tsx` and
   `src/features/journal/JournalListEntryTilePreview.tsx` for other consumers before deleting.
3. Remove now-unused imports/types in `journal-new-entry-form.tsx`
   (`ReflectionTextSelection`-related leftovers, `StyleProp`/`TextStyle`/`ViewStyle` imports added
   for the per-block renderer if no longer needed, etc.).

**Exit criteria:** No dead code/imports; `eslint .` and `tsc --noEmit` clean (aside from the two
known pre-existing, unrelated `overflow` type errors in
`app/(tabs)/journal/index.tsx`/`JournalListEntryTilePreview.tsx` and the known pre-existing
`journal-migration.test.ts` failure — do not attempt to fix those as part of this work unless
asked).

---

## Phase 5 — Verification

1. `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass (modulo the pre-existing unrelated failures
   noted above).
2. Manual device testing (both iOS and Android if possible) covering:
   - Typing long entries — scrolling works, no disappearing text.
   - Bold/italic/heading/list/checklist/link toolbar actions mid-sentence and at cursor.
   - Undo.
   - Attaching an image.
   - Creating a new entry, saving, then re-opening it for edit — keyboard opens correctly on tap
     (this was a regression fixed once already during the per-block era; re-verify it doesn't
     regress with the new input).
   - Keyboard show/hide behavior in both the bottom-sheet form and the fullscreen editor.
3. Update `CHANGELOG.md` with a short entry describing the new live-markdown editor.

**Exit criteria:** All of the above pass; original three user-reported pain points
("text disappears while editing," "formatting only shows after closing keyboard," "cumbersome to
edit") are gone.

---

## Fallback plan (no new native dependency)

Use this only if Phase 0's spike surfaces a real blocker (New Architecture/worklets version
conflict that can't be resolved, unacceptable platform-specific bugs, or checklist/image support
too awkward to be worth it).

1. Remove the per-block system entirely (same as Phase 2/4 above), going back to **one continuous
   plain `TextInput`** for the whole document — this alone fixes "text disappears while editing"
   and the earlier scrolling regression, since it's a single native self-scrolling input again.
2. Keep the formatting toolbar exactly as it works today (Phase 3 above, minus the
   `MarkdownTextInput`-specific parts — just plain `TextInput` selection handling).
3. Accept that the input itself shows raw markdown while typing, but eliminate the "must blur to
   see it" pain point by rendering `ReflectionFormattedPreview` as a **live, auto-updating,
   non-interactive strip directly below the input**, updating on every keystroke via
   `reflectionMarkdown` — so the rendered result is visible simultaneously, with no tap/blur step.
4. This is a same-day, pure-JS change with no dev-client rebuild and no native-module risk, at the
   cost of raw markdown still being visible in the edit field itself (closer to the "split
   view"/"live preview pane" pattern many markdown editors use).

---

## Session log

_(Append a dated one-line note here at the end of each session that touches this plan, e.g. "2026-08-23: wrote this plan, no code changes yet.")_

- 2026-08-23: Plan written after per-block editor caused text-disappearing/flicker regressions and
  failed to satisfy "no raw markdown while typing" requirement. No code changes made yet — start
  at Phase 0 next session.
- 2026-08-23: Phase 0 — installed live-markdown 0.1.335 + worklets 0.10.4, html-entities worklet
  patch, Android native rebuild. Spike route `/dev/live-markdown-spike`. Did not start Phase 1.
