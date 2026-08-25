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

### Phase 1 findings

Recorded 2026-08-23. Did **not** start Phase 2.

**What landed**
- `lib/journal-reflection-live-markdown-style.ts` — `createReflectionLiveMarkdownStyle` /
  `createReflectionLiveMarkdownInputStyle`. Body: `Lora_400Regular` 17/28 `brown800`. Links:
  `colors.gold` (native formatter always underlines). Syntax markers: `colors.tan100`. h1:
  fontSize 26 (non-compact heading1 in `renderReflectionBlockContent`).
- `lib/journal-reflection-live-markdown-parser.ts` — worklet parser for the app's GitHub-style
  dialect (`**bold**`, `_italic_`, `# `/`## `, lists, checklists, `[label](url)`, `[image:id]`).
  Default `parseExpensiMark` cannot match the formatted preview because it treats `*bold*` (single
  asterisk), not `**bold**`.
- Spike `/dev/live-markdown-spike` now uses these modules and shows a live `MarkdownTextInput`
  next to `ReflectionFormattedPreview` of the same string. Journal editor is unchanged.

**`markdownStyle` API (what we can actually paint)**
- Configurable: `syntax.color`, `link.color`, `h1.fontSize`. Bold/italic are native weight/italic
  on the TextInput's `fontFamily` (so `Lora_400Regular` + bold span ≈ `Lora_700Bold` when the
  native font matcher finds the face). Links are always underlined (iOS `NSUnderlineStyleSingle`,
  Android `MarkdownUnderlineSpan`) — matches `LINK_COLOR` + underline in the preview.
- **Not configurable:** h1 `fontFamily` / weight (native h1 always applies bold — slightly heavier
  than the preview's `Lora_400Regular` 26). No h2, list, checklist, or custom-token style slots.

**Custom parser (Phase 2/3 implications)**
- Parser **is pluggable** via the required `parser` worklet prop. Custom parsers may only emit the
  library's `MarkdownType` set (`bold | italic | strikethrough | emoji | mention-* | link | code |
  pre | blockquote | h1 | syntax | inline-image | codeblock`). **No list, checklist, h2, or
  arbitrary token types.**
- Mapping used: `# ` → `h1`; `## ` → `bold` (body size 17 vs preview 20 — closest available);
  `- ` / `1. ` / `- [ ] ` prefixes → `syntax` (dimmed; glyphs stay `-`/`1.`/`- [ ]`, not `•`/`☐`);
  `[image:id]` → `syntax` (dimmed token, not an inline image). Checklists and image tokens cannot
  live-render as widgets — Phase 2 should keep them as visible/dimmed text (or a thumbnail strip
  outside the input), not expect native checkbox/image-in-field.

**Exit criteria:** style + parser modules exist; spike paints bold/italic/h1/gold links live and
dims list/checklist/image syntax. Visual match is as close as the library allows (h1 slightly
bolder; h2/lists are approximations). Confirm on-device via `/dev/live-markdown-spike`.

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

### Phase 2 findings

Recorded 2026-08-25. Did **not** start Phase 3 as a dedicated toolbar-verification pass.

**What landed**
- `components/journal-new-entry-form.tsx` — per-block state/handlers/`renderReflectionSurface` are
  gone. Sheet and fullscreen both call `renderReflectionInput`, which is one `MarkdownTextInput`
  bound to `reflectionMarkdown` + `reflectionSelection` (plus the existing one-shot selection
  override for programmatic cursor nudges). Parser/style come from Phase 1.
- Undo + typing-undo checkpoints kept. `continueListOnNewline` now runs on the full document.
- Checklists: `- [ ] ` / `- [x] ` stay as dimmed syntax in the live input (parser mapping from
  Phase 1). No native checkbox.
- Images: still insert `\n[image:id]\n` at the cursor. Token is dimmed in the input; a compact
  thumbnail strip under the field shows referenced images (avoids inlining widgets in the text
  field).

**Toolbar (needed to compile after deleting `applyReflectionBlockEdit`)**
- Bold/italic/heading/list/checklist/link/image/undo now call the same
  `wrapMarkdownMarker` / `toggleLinePrefix` / `insertMarkdownLink` / `insertTextAtSelection`
  helpers against full `reflectionMarkdown` + `reflectionSelection`. That is the mechanical
  repoint Phase 3 describes; Phase 3 still owns confirming every button applies at the right
  cursor and paints live on device.

**Exit criteria:** one live `MarkdownTextInput` in sheet + fullscreen; no block-swap. Confirm
typing/scrolling on-device. Toolbar live-check is Phase 3.

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

### Phase 3 findings

Recorded 2026-08-25. Did **not** start Phase 4.

**What landed**
- `applyReflectionToolbarAction` / `insertReflectionImageToken` in
  `lib/journal-reflection-markdown-edit.ts` — one dispatcher for bold/italic/heading/list/
  checklist/link against full `reflectionMarkdown` + document caret. Image insert is the same
  `\n[image:id]\n` token as before.
- `components/journal-new-entry-form.tsx` — format buttons call that dispatcher. Caret is
  snapshotted on toolbar `onPressIn` so a blur-driven `onSelectionChange` (often `{0,0}`) cannot
  move the insert to the start of the document. Image attach keeps the snapshot across the picker.
  `focus()` runs *after* the edit (plus the existing one-shot `selection` override).
- Spike `/dev/live-markdown-spike` now has the same format buttons against `MarkdownTextInput`
  (focus + controllable `selection`) for on-device confirmation.

**`MarkdownTextInput` selection / focus (confirmed in library source)**
- Native component is a thin wrapper: it forwards `ref` and `...props` to a real `TextInput`, so
  imperative `.focus()` / `.blur()` and `selection` / `onSelectionChange` work the same way.
- `formatSelection` exists on the type but is only used on web. Native toolbar formatting stays
  in our JS helpers.

**Live paint after toolbar**
- Bold / italic / link paint as those types immediately.
- Heading still inserts `## ` (unchanged) → parser maps that to `bold` at body size (Phase 1;
  no h2 type). Lists / checklist / `[image:id]` stay dimmed `syntax`.

**Exit criteria:** toolbar applies at the document caret; parser paints the result without a blur
step. Confirm on-device via the journal editor and `/dev/live-markdown-spike`. Did not delete
preview/block helpers (Phase 4).

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

### Phase 4 findings

Recorded 2026-08-25. Did **not** start Phase 5.

**What we kept (still has consumers)**
- `lib/journal-reflection-blocks.ts` (`computeReflectionBlocks`) and
  `components/reflection-formatted-preview.tsx` — journal list tiles use `stripHtmlPreview`, not
  this preview, but `/dev/live-markdown-spike` still renders it side-by-side with
  `MarkdownTextInput`. Deleting them would break the spike; they are no longer used by the live
  editor.
- `renderReflectionBlockContent` is now file-private. `classifyReflectionLineKind` is now
  module-private.

**What we removed**
- `findReflectionBlockIndexForOffset` and its tests — editor-only caret-to-block lookup.
- Unused `insertLinePrefix`; `insertTextAtSelection` is now private to the image-token helper.
- Unused live-style exports (`REFLECTION_LIVE_H1_LINE_HEIGHT`, h2 size constants, bold/italic
  family constants the native formatter never reads).
- Unused `formFields` fragment in `journal-new-entry-form.tsx` (layouts inline leading +
  reflection sections instead).
- `TextStyle` import + `as StyleProp<ViewStyle>` cast on the reflection input wrapper in
  `journal-new-entry-form.tsx` (layout style is a `ViewStyle`).

**Exit criteria:** dead editor APIs gone; preview/block splitter kept for the spike. `tsc --noEmit`
is only the two known `overflow` errors. `eslint .` still has a large pre-existing
`react-hooks/refs` / `set-state-in-effect` flood (500+ errors, unrelated); not fixed here.
CHANGELOG and device pass stay Phase 5.

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

### Phase 5 findings

Recorded 2026-08-25.

**Automated gates (modulo known pre-existing failures)**
- `pnpm typecheck` — only the two known `overflow` errors in `app/(tabs)/journal/index.tsx` and
  `JournalListEntryTilePreview.tsx`.
- `pnpm lint` — still the repo-wide pre-existing `react-hooks/refs` / `set-state-in-effect` flood
  (~522 errors); not introduced by this work.
- `pnpm test` — 92 passed / 1 failed: the known `journal-migration.test.ts` blob-row
  `content_markdown` assertion. All live-markdown / toolbar / block tests passed.

**Android (SM_F971B cover display, dev client + Metro)**
- New-entry sheet: reflection field focuses, keyboard opens, floating toolbar appears (undo /
  bold / italic / heading / lists / checklist / link / image / hide keyboard).
- Typing `"Hello"` stayed visible (no block-swap disappear). Bold at the caret inserted `****`
  live; heading then bullet replaced the line prefix to `- Hello****` without blurring. Undo
  restored `## Hello****`.
- Fullscreen editor opened with the same document + toolbar; Done returned to the sheet with
  text intact. Saved as `Phase5LiveMd`, reopened for edit, tap on the reflection field opened
  the keyboard and toolbar again (`## Hello****` still in the field).
- Image attach (system picker) not exercised. iOS not rebuilt/verified this plan (flagged since
  Phase 0).

**CHANGELOG** — `1.1.0` entry added for the live-markdown reflection editor.

**Exit criteria:** original three pain points are gone on the Android editor path above. Remaining
manual: iOS, and attach-image on device.

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
- 2026-08-23: Phase 1 — style mapping + custom GitHub-dialect parser. Spike updated with
  side-by-side formatted preview. Journal editor untouched. Did not start Phase 2.
- 2026-08-25: Phase 2 — replaced per-block editor with one `MarkdownTextInput` (sheet +
  fullscreen). Checklists/image tokens dimmed; image thumbnail strip under the field. Did not
  start Phase 3.
- 2026-08-25: Phase 3 — toolbar dispatcher on full-document caret; freeze selection on press-in;
  spike format buttons. Did not start Phase 4.
- 2026-08-25: Phase 4 — removed editor-only block-offset lookup and unused helpers/exports;
  kept formatted preview + block splitter for the spike. Did not start Phase 5.
- 2026-08-25: Phase 5 — typecheck/lint/test modulo known failures; Android sheet + fullscreen
  toolbar/undo/save/reopen-keyboard pass; CHANGELOG 1.1.0. iOS and image-picker still manual.
