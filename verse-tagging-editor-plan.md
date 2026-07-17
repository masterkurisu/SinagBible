# Verse Tagging + Journal Editor Unification — Implementation Plan

Sinag Bible mobile · Expo 57 · React Native 0.86 · expo-router 57

**Status:** Approved spec — refer to this doc before implementing verse tags or journal editor changes.

**How to use:** Run each phase in a focused session. Do not start later phases until earlier
phase exit criteria are met. Commit after each phase.

---

## Summary

Two related initiatives share one editor foundation:

1. **Editor unification** — Replace `react-native-pell-rich-editor` (WebView) with a single native
   markdown `TextInput` for new and edit journal entries. Persist markdown source alongside HTML.
2. **Verse tagging (@ mentions)** — Users type `@` or use an "Insert verse" toolbar action to
   embed `[@book:ch:v]` tokens in inline notes and journal reflections. Tags render as tappable
   chips with tooltip preview and reader navigation.

**Critical guardrail:** Do **not** build RichEditor/WebView integration for verse tags. The WebView
editor is deprecated. Verse tagging lands on the unified native markdown `TextInput` only.

---

## Locked decisions (do not change after ship)

| # | Decision |
|---|----------|
| 1 | **Token grammar:** `[@book:ch:v[-end][@translation]]` — translation suffix at end, e.g. `[@john:3:16@KJV]` |
| 2 | **Interaction:** tap → tooltip + "Open in Reader"; long-press → navigate — **all surfaces** (notes + journal) |
| 3 | **Editor:** single native markdown `TextInput`; RichEditor deprecated |
| 4 | **Invalid tokens:** core = syntax only; renderer = resolution + fallback |
| 5 | **Search:** write derived label as span inner text at save; ignore inner text at render |
| 6 | **Dual-write:** persist `content_markdown` alongside HTML `content` after Phase 0 |
| 7 | **Structured passage field** stays separate from inline verse tags — do not merge |

---

## Token grammar (v1)

### Plain-text token

```
[@<book>:<chapter>:<verse>[@<translation>]]
```

| Form | Example | Meaning |
|------|---------|---------|
| Minimal | `[@john:3:16]` | Book slug, chapter, verse; translation inherited from context |
| With translation | `[@john:3:16@KJV]` | Explicit translation when it differs from context |
| Same-chapter range | `[@john:3:16-18]` | Contiguous verses within one chapter |

**Regex (v1):**

```
\[@([a-z0-9-]+):(\d+):(\d+)(?:-(\d+))?(?:@([A-Za-z0-9_]+))?\]
```

### Explicitly unsupported in v1

- Cross-chapter ranges (`John 3:16–4:2`)
- Verse-less references (`Romans 8`) — use the structured passage field instead
- Multiple translations in one token

### HTML encoding (journal `content`)

```html
<span data-verse-ref="john:3:16" data-translation="KJV">John 3:16</span>
```

- `data-verse-ref` = `{book}:{chapter}:{verse}` or `{book}:{chapter}:{start}-{end}`
- `data-translation` = optional; omit when inheriting from entry context
- **Inner text** = derived label written at save (search + export + portability)
- **At render:** ignore inner text; regenerate label from `data-verse-ref`

---

## Invalid-token contract (split by layer)

### Core (`packages/core/src/verse-tags.ts`)

**Responsibility:** syntax only. No book metadata.

| Input | Output |
|-------|--------|
| Well-formed `[@book:ch:v]` | `{ kind: "tag", raw, ref: VerseTagRef }` |
| Malformed token | `{ kind: "tag", raw, ref: null }` |
| Plain text | `{ kind: "text", value }` |

**Guarantees:** never throws; never drops content; never resolves slugs.

### Renderer (`VerseTaggedText`, `VerseTagChip`)

**Responsibility:** resolution + presentation.

| Condition | Behavior |
|-----------|----------|
| `ref: null` (malformed) | Render `raw` literal unchanged |
| Valid ref, slug unresolvable | Render `raw` literal unchanged |
| Valid ref, resolved | Chip with `formatVerseTagLabel(ref, resolvedBookLabel)` |
| Tooltip: `getJournalVersePreview` empty | "Verse not found"; disable "Open in Reader" (and long-press navigate) |

No per-chapter verse-count lookup at render time. Chip renders optimistically; not-found state
is determined at tooltip fetch time.

---

## Interaction model

| Gesture | Behavior |
|---------|----------|
| **Tap** | `M3RichTooltipOverlay` — verse preview + **"Open in Reader"** action |
| **Long press** | Direct navigation via `readerChapterHref` + `saveReaderLastPosition` |

**Accessibility:** `accessibilityLabel="John 3:16, opens verse preview"` on every chip.

**Export (image/PDF):** render tags as plain text labels (`John 3:16`) — derived from
`data-verse-ref` at export time.

**Navigation reuse:**

- `readerChapterHref(bookSlug, chapter, translationId, undefined, verseNumber)`
- `saveReaderLastPosition({ bookSlug, chapter, translationId })`
- `getJournalVersePreview` for tooltip content

---

## @ mention composer

### Bottom sheet (not cursor popup)

`VerseTagMentionSheet` — search field, fuzzy suggestions (`expandReferenceQuery`,
`resolveJournalPassageBookSlug`), pick → insert token.

### Selection-aware detection

`useVerseTagMention` tracks **both** `onChangeText` and `onSelectionChange`.

Active `@` segment rules:

- `@` at position 0, or preceded by whitespace/newline
- Segment contains no whitespace (dismiss on space/newline)
- Not inside an existing `[@...]` token

**Race handling:** coalesce via refs — `onChangeText` reads `selectionRef.current`;
`onSelectionChange` re-evaluates from `textRef.current`.

### Journal toolbar

"Insert verse" button on the native reflection toolbar → same mention sheet → inserts `[@...]`
token into `TextInput`. No WebView @ detection.

---

## Editor unification (Phase 0)

### Problem today

| Mode | Editor | Save | Formatting on edit |
|------|--------|------|-------------------|
| New entry | `RichEditor` (WebView) | Rich HTML | N/A |
| Edit entry | Plain `TextInput` | `plainReflectionToContent()` | **Lost** — bold/italic/lists/images stripped |

`react-native-pell-rich-editor` wraps a WebView `contenteditable` editor. It is already offline
(bundled HTML/JS) but adds memory, keyboard/scroll hacks, RN↔WebView bridge latency, and blocks
clean @ mention integration.

### Target state

- One native markdown `TextInput` for new + edit
- Floating toolbar: bold, italic, lists, image, insert verse (Phase 3), undo as applicable
- Save via `reflectionMarkdownToContent` → HTML in `content`
- **Dual-write** markdown source in `content_markdown`

### Schema migration

```sql
ALTER TABLE journal_entries ADD COLUMN content_markdown TEXT;
```

Add `content_markdown?: string | null` to `LocalJournalEntry` in `packages/types/src/journal.ts`.

### Save path (post–Phase 0)

```
TextInput markdown
  → reflectionMarkdownToContent(markdown) → content (HTML: display, print, search)
  → content_markdown = markdown (source of truth for editing)
```

### Edit-open path

| Entry type | Behavior |
|------------|----------|
| `content_markdown` present | Read directly — zero conversion |
| Legacy RichEditor (`content_markdown` NULL) | `htmlToReflectionMarkdown(content)` once on open |
| On save (either type) | Dual-write both columns |

Phase 4 bulk migration = backfill `content_markdown` for rows where NULL.

### Legacy HTML → markdown (`htmlToReflectionMarkdown`)

**Scope:** legacy Pell/RichEditor HTML only — entries where `content_markdown IS NULL`.

| HTML input | Markdown output |
|------------|-----------------|
| `<strong>`, `<b>` | `**text**` |
| `<em>`, `<i>` | `_text_` |
| `<ul><li>…</li></ul>` | `- item` lines |
| `<ol><li>…</li></ol>` | `1. item` lines |
| `<p>`, `<div>` | paragraph breaks (`\n\n`) |
| `<br>` | `\n` |
| `<img src="…">` | `[image:id]` if mappable to journal image store; else omit or placeholder |
| `<span style="font-weight: bold">` etc. | Normalize via `normalizeStyleSpansForInline` logic before mapping |
| Unknown / nested markup | Best-effort plain text via tag strip; **never** emit raw HTML into editor |

**Non-goals for v1 conversion:** perfect fidelity, tables, Pell todo blocks, exotic nesting.

### RichEditor removal

Delete usage from `components/journal-new-entry-form.tsx`, remount/memory workarounds in
`app/(tabs)/journal/index.tsx`, fullscreen WebView modal. Remove `react-native-pell-rich-editor`
dependency when fully unused.

### Key files (editor)

| File | Role |
|------|------|
| `components/journal-new-entry-form.tsx` | Editor UI, toolbar, save |
| `lib/journal-local.ts` | `reflectionMarkdownToContent`, save/update |
| `lib/journal-db.ts` | Schema, migration |
| `packages/types/src/journal.ts` | `LocalJournalEntry` type |
| `components/reflection-formatted-preview.tsx` | Live preview (Phase 2b) |
| `app/journal/[id].tsx` | Display (`renderSavedReflection`) — unchanged HTML reader |

---

## Phased plan

```
Phase 0   Editor unification + content_markdown dual-write + legacy htmlToReflectionMarkdown
Phase 1   verse-tags.ts + unit tests (parallel with Phase 0)
Phase 2   Mention UI + inline notes
Phase 2b  Live formatted preview (ReflectionFormattedPreview)
Phase 3   Journal tags (save / display / toolbar insert)
Phase 4   Bulk backfill + optional search hardening (deferred)
```

### Phase 0 — Editor unification

**Exit criteria:**

- [x] `content_markdown` column migrated
- [x] New + edit use same markdown `TextInput` + toolbar
- [x] Save dual-writes `content` (HTML) + `content_markdown`
- [x] Edit-open reads `content_markdown` or converts legacy HTML once
- [x] RichEditor removed from journal form
- [x] Draft hydration uses markdown, not WebView HTML
- [ ] `htmlToReflectionMarkdown` mapping table implemented and tested *(basic coverage — extend as needed)*

### Phase 1 — `verse-tags` core (parallel with Phase 0)

**Location:** `packages/core/src/verse-tags.ts`, `packages/types/src/verse-tag.ts`

**Required tests before any UI:**

- `[@1-john:3:16]`, `[@song-of-solomon:2:1]`
- `[@john:3:16@KJV]` vs `[@john:3:16]`
- Malformed: `[@john:3]`, `[@:3:16]`, unclosed `[@john:3:16`
- Range: `[@john:3:16-18]` valid; `[@john:3:18-16]` rejected
- Cross-chapter explicitly rejected
- `@` inside existing token does not trigger mention
- `splitTextWithVerseTags` never throws

**Exit criteria:**

- [x] All grammar tests pass
- [x] API exported from `@sinag-bible/core`

### Phase 2 — Mention UI + inline notes

**Location:** `src/features/verse-tags/`

| Component / module | Role |
|--------------------|------|
| `VerseTagMentionSheet` | Bottom sheet autocomplete |
| `useVerseTagMention` | @ detection with selection tracking |
| `VerseTagChip` | Pill UI |
| `VerseTaggedText` | Plain-text segment renderer |
| `VerseTagPreviewTooltip` | Extends `M3RichTooltipOverlay` + action |
| `openVerseTagInReader.ts` | Navigation wrapper |

**Wire first:**

- `src/features/reader/ReaderVerseNoteDialog.tsx`
- `components/reader-verse-row.tsx`

### Phase 2b — Live formatted preview

Raw markdown (`**bold**`, `[@john:3:16]`) in the editor requires a formatted preview nearby.

- Wire `ReflectionFormattedPreview` into journal form (sheet + fullscreen layouts)
- Support `**bold**`, `_italic_`, lists, `[image:id]`
- Add `[@...]` chip preview when Phase 3 lands
- Does not block Phase 0 or Phase 1

**Exit criteria:**

- [ ] Preview updates as user types
- [ ] Acceptable UX without RichEditor WYSIWYG

### Phase 3 — Journal tags

- Extend `reflectionMarkdownToContent` / `paragraphBlock`: `[@...]` → HTML span
- Extend `renderSavedReflection` / `renderInlineHtml` for `data-verse-ref` spans → chips
- "Insert verse" on native toolbar → mention sheet → token insert
- Search: inner text at save indexes "John 3:16" for free via existing HTML strip

### Phase 4 — Deferred

- Bulk backfill `content_markdown` for never-re-edited legacy entries
- Belt-and-suspenders search extractor for drifted legacy span labels
- Any live `@` typing enhancements beyond word-boundary gating

---

## Public API (`verse-tags.ts`)

```ts
// packages/types/src/verse-tag.ts
export type VerseTagRef = {
  book: string;           // canonical slug, e.g. "john"
  chapter: number;
  verseStart: number;
  verseEnd?: number;      // same chapter only; verseEnd > verseStart
  translation?: string;   // internal id, e.g. "KJV"
};

export type VerseTagTextSegment =
  | { kind: "text"; value: string }
  | { kind: "tag"; raw: string; ref: VerseTagRef | null };

// packages/core/src/verse-tags.ts — syntax only, no book lookups

/** Encode plain-text token. Omits translation suffix when matches contextTranslation. */
export function encodeVerseTag(ref: VerseTagRef, contextTranslation?: string): string;

/** Parse a single token (with or without [@...] wrapper). Null if malformed. */
export function parseVerseTagToken(token: string): VerseTagRef | null;

/** Split text into segments. Never throws. Malformed → ref: null. */
export function splitTextWithVerseTags(text: string): VerseTagTextSegment[];

/** Human label — caller supplies resolved bookDisplayLabel. */
export function formatVerseTagLabel(ref: VerseTagRef, bookDisplayLabel?: string): string;

/** Journal HTML storage. Writes data-* attrs + inner text = derived label. */
export function verseTagToHtml(ref: VerseTagRef, contextTranslation?: string): string;

/** Parse ref from journal HTML span attributes. */
export function parseVerseTagFromHtmlAttrs(
  dataVerseRef: string,
  dataTranslation?: string | null,
): VerseTagRef | null;

/** Partial query after @ for mention sheet. */
export function parseVerseTagQuery(query: string): Partial<VerseTagRef> | null;

/** Whether @ at cursor should open mention sheet (word-boundary gating). */
export function isVerseTagMentionTrigger(text: string, cursorIndex: number): boolean;

/** Active mention query between @ and cursor, or null. */
export function extractActiveVerseTagMention(text: string, cursorIndex: number): string | null;

/** Replace active @mention with encoded token. */
export function insertVerseTagAtMention(
  text: string,
  cursorIndex: number,
  ref: VerseTagRef,
  contextTranslation?: string,
): { text: string; cursorIndex: number };
```

---

## What to avoid

- Storing only display text (`"John 3:16"`) without structured ref
- Three separate @ implementations (one hook, one sheet, one renderer)
- RichEditor/WebView verse-tag integration
- Replacing or merging the structured journal passage field with inline tags
- Cursor-anchored autocomplete on v1
- Pre-validating verse ranges at chip render time
- Round-tripping HTML → markdown for entries that already have `content_markdown`

---

## Pre-implementation checklist

- [x] Token grammar
- [x] Interaction model (tap / long-press)
- [x] Core vs renderer invalid-token contracts
- [x] RichEditor deprecated — no verse-tag WebView work
- [x] `content_markdown` dual-write decision
- [x] Phase 2b live preview on roadmap
- [x] Out-of-range = tooltip-time, not render-time
- [x] Search posture (write label at save, ignore at render)
- [x] Export posture (plain text labels)
- [x] `htmlToReflectionMarkdown` mapping table implemented and tested *(basic coverage — extend as needed)*
- [x] `verse-tags.ts` unit tests passing *(Phase 1)*

---

## Draft / implementation order

| Priority | Artifact | Notes |
|----------|----------|-------|
| 1 | `content_markdown` migration + types | Shapes edit-open and save |
| 2 | `htmlToReflectionMarkdown` (legacy Pell only) | Highest user-data risk |
| Parallel | `verse-tags.ts` + tests | Grammar signed off; no Phase 0 blocker |
| 3 | Phase 0 editor UI unification | After migration shape settled |
| 4 | Phase 2b preview | Before or alongside Phase 3 |
| 5 | Phase 2 + 3 verse tag UI | After core tests pass |

---

## Related codebase references

| Area | Path |
|------|------|
| Journal form (editor) | `components/journal-new-entry-form.tsx` |
| Markdown → HTML | `lib/journal-local.ts` (`reflectionMarkdownToContent`) |
| HTML display | `app/journal/[id].tsx` (`renderSavedReflection`) |
| Live preview | `components/reflection-formatted-preview.tsx` |
| Journal DB | `lib/journal-db.ts` |
| Inline notes | `src/features/reader/ReaderVerseNoteDialog.tsx`, `components/reader-verse-row.tsx` |
| Reader navigation | `lib/reader-navigation.ts` |
| Verse preview | `lib/journal-verse-preview.ts` |
| Reference parsing | `packages/core/src/journal.ts` |
| Tooltip shell | `src/components/m3/M3RichTooltipOverlay.tsx` |
| Search navigation pattern | `src/features/search/useBibleSearch.ts` |

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-17 | Initial approved spec: suffix translation grammar, unified interaction, editor unification first, `content_markdown` dual-write, Phase 2b preview, split invalid-token contract, optimistic chip rendering |
