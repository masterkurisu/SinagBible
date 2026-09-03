# Reflection notes surface — Phase 0 / 0a / 0b findings

Status: **Phase 0 / 0a / 0b code is implemented.** Later phases (note surface, Enriched default path) also landed in-app. Device measurements below were never filled in this file.

## Implementation audit (2026-09-04)

### Phase 0 — census tooling: done; live counts: still blank

- `censusJournalReflectionRows` uses the same nested-list router as runtime.
- Dev route `/dev/journal-census` queries `dbSelectAll()`.
- Extra HTML shapes (`table`, `iframe`, `video`, `blockquote`, `pre`) are reported and are **not** in the router.
- The two production-DB counts in the table below were never pasted. Tooling is correct; the risk read of “are shadow table / router load-bearing?” is still unknown until someone runs the screen.

### Phase 0a — code: done; device pass/fail: still open

1. Pin `react-native-enriched-html@1.1.1` exact (CI asserts no `^`/`~`).
2. Spike `/dev/enriched-html-spike`: WYSIWYG toolbar, `setValue`+`focus()` with no 120ms timer, `getHTML` on demand, **no `onChangeHtml`**. Production `ReflectionEnrichedEditor` matches that.
3. Cheap text-change event named: **`onChangeText`** (plain text). Optional 2s `getHTML` poll is spike-only for the jank re-run.
4. Long-fixture seed exists (`long-document`). Framestats numbers were not recorded.
5. KAV-in-Modal probe exists. `react-native-keyboard-controller` was not installed (probe never signed off).
6. Paste / IME copy is on the spike screen. Not signed off on device.
7. Backup-path finding is written in this file.

### Phase 0b — fixtures + CI: done (strengthened 2026-09-04); native hops: spike-only

1. Converter goldens in `lib/__tests__/journal-reflection-enriched-fixtures.test.ts`. Accepted-loss markdown is now the **indented nested** lossless form, so dual-assert cannot pass against flattened siblings by accident. Native `setValue → getHTML` still runs from the spike **0b fixtures** button.
2. Mention attribute helper `mentionDoubleRoundTripAttrsSurvive`; spike **0b mentions** still required for native hops.
3. Undo decision: no undo button (library has no undo API).

---

## Phase 0 census

No Android device or booted iOS simulator was attached when this ran, and no
`sinag-journal.db` was on the CoreSimulator disk. Counts below are **not yet
filled from the live journal**. Open `/dev/journal-census` on the development
client and paste the two numbers here.

| Metric | Count |
| --- | --- |
| `content_markdown` null or empty | *run `/dev/journal-census`* |
| nested-list HTML (`reflectionHtmlNeedsLegacyEditor`) | *run `/dev/journal-census`* |

How it is counted (same as the census screen):

- Null/empty markdown: `content_markdown == null` or `trim() === ""`
- Nested lists: cheap HTML scan — a `<ul>`/`<ol>` that opens while another list
  is still open. Sibling `<ul>…</ul><ol>…</ol>` does **not** count.

**How to read the numbers (once filled):**

- Both zero → shadow table, per-row router, and half the data-integrity section
  are smaller risk than the plan assumes. Still keep the precheck (fixtures
  include nested lists). Do not treat migration theater as load-bearing.
- Either count high → those sections stay load-bearing.

Other HTML nasties (`table`, `iframe`, `video`, `blockquote`, `pre`) are
reported by the census screen but are **not** in the router until a fixture
class is added.

## Phase 0a — Fast kill

### 1. Install + prebuild

- Pin: `react-native-enriched-html` **1.1.1** (exact, no `^` / `~`) in
  `package.json`. Constant: `ENRICHED_HTML_LIBRARY_PIN`.
- Install: `APP_VARIANT=development pnpm exec expo install react-native-enriched-html@1.1.1`
- Native projects are CNG (`/android`, `/ios` gitignored). Prebuild completed:
  `APP_VARIANT=development pnpm exec expo prebuild` (cleared + regenerated both
  platforms; CocoaPods installed `ReactNativeEnrichedHtml` 1.1.1).
- **Rebuild the dev client** (`APP_VARIANT=development pnpm android` / `pnpm ios`).
  The currently installed binary will not load the new native module.

### 2. Spike

Route: `/dev/enriched-html-spike` (dev-only). Covers:

- WYSIWYG toolbar (bold/italic/lists/checkbox/link/`setImage`/`@`)
- `setValue` then `focus()` with no 120ms timer (`autoFocus` is off on the
  main editor)
- `getHTML` on demand — **`onChangeHtml` is not attached**
- Mode switch: Enriched vs today's `MarkdownTextInput` (jank baseline)
- 2s `getHTML()` poll toggle (re-run jank with this **on** if 0a lands on poll)
- KAV-in-Modal probe
- 0b fixture runner + mention double round-trip

Device pass/fail for WYSIWYG, paste, IME, jank, and KAV is still **open**.

### 3. Cheap text-change event — named

**`onChangeText`** (`NativeSyntheticEvent<{ value: string }>`).

It is forwarded on 1.1.1, fires on text edits, and returns **plain text**, not
HTML. That is the draft-timer signal. `onChangeState` stays style/selection
only. No poll unless `onChangeText` proves unreliable on device; if a poll is
required, re-run the long-fixture jank gate with the poll running.

### 4. Long-entry jank (device)

Same handset (oldest Android, named), same long fixture (`long-document` in
`lib/journal-reflection-enriched-fixtures.ts`):

1. Spike → **Baseline MD** → Seed long → type 60s
2. `adb shell dumpsys gfxinfo com.sinagbible.app.dev reset` before the run,
   then `framestats` after
3. Repeat on **Enriched** (poll off first)

Gate: Enriched janky-frame rate ≤ **5% absolute** and ≤ **baseline + 1pp**.
If the poll is needed, repeat step 3 with Poll on.

*Not measured in this session (no device).*

### 5. KAV-in-Modal

Spike button **KAV modal**. Fail if the caret sits under the keyboard.
If it fails, Phase 1 should install `react-native-keyboard-controller` by
default (already the plan's default). Today's fullscreen reflection already
uses `KeyboardAvoidingView` inside a `Modal`.

*Not signed off in this session.*

### 6. Paste — hard fail

Paste into the spike editor from **Notes, Docs, and a browser**. Mangled
structure, stuck styles, or Android/iOS-divergent links **fail 0a**. No 0b
sign-off escape hatch.

*Not signed off in this session.*

### 7. IME

Tagalog Gboard; Korean or Spanish if present. Fail on swallowed characters or
broken list continuation.

*Not signed off in this session.*

### 8. Backup-path finding

**Journal DB is not keyed.** `lib/journal-db.ts` opens `sinag-journal.db` with
`SQLite.openDatabaseAsync` and never runs `PRAGMA key`. The chapter store
(`lib/chapter-db.ts`) is the SQLCipher-keyed database. The expo-sqlite plugin
sets `useSQLCipher: true` for the native library, but without a key the journal
file is a normal SQLite database.

**Android Auto Backup:** `android:allowBackup="true"`, but expo-secure-store
sets `fullBackupContent` / `dataExtractionRules` to **only** SharedPreferences
(minus the `SecureStore` prefs file). Journal SQLite lives under `files/SQLite/`
(`file` domain), which is **not** in that include list. Auto Backup will **not**
restore `sinag-journal.db`. Ciphertext is irrelevant here: the file is
unencrypted, but it is also not in the backup set.

**iOS backup / iCloud:** no `NSURLIsExcludedFromBackupKey` usage in the repo.
Default expo-sqlite directory is under the app container Documents/SQLite
tree, which iCloud/device backup includes. OS restore **can** bring back a
journal file on iOS, including a mid-migration copy.

**Real restore path:** manual JSON via `lib/user-data-backup.ts`. That is the
supported backup on both platforms. Android Auto Backup is not a journal
restore path; iOS device/iCloud backup of the sqlite file still is.

**If OS backup restores a mid-migration DB:** Android no; iOS yes. Size
shadow-table and legacy call sites for the iOS case.

## Phase 0b — Data gate

### 1. Fixture round-trip + CI golden

Checked-in set: `lib/journal-reflection-enriched-fixtures.ts`.

Vitest job (`pnpm test`, files under `lib/__tests__/journal-reflection-enriched-fixtures.test.ts`):

- Converter-branch coverage (empty, p, ul, ol, h1/h2, checklist, img, link,
  verse tags, null-markdown HTML, long, nested-list)
- Round-trip: `htmlToReflectionMarkdown` vs expected after
  `normalizeReflectionMarkdownForCompare`
- Owned markdown→HTML shapes via `reflectionMarkdownToContent`
- Pin check: `package.json` equals `ENRICHED_HTML_LIBRARY_PIN` with no `^`/`~`
- **Every accepted-loss fixture:** `reflectionHtmlNeedsLegacyEditor` is true
  **and** JS converter output is **not** equal to the lossless expected
  markdown (indented nested lists). Native Enriched inequality is the spike
  **0b fixtures** button (`setValue → getHTML → convert` must also fail
  equality, and nesting should be gone from `getHTML`).

There is no GitHub Actions workflow in this repo. The golden job is `pnpm test`
(vitest), the same as the rest of the unit suite. Run it on every
`react-native-enriched-html` pin bump and every converter revision bump
(`REFLECTION_MARKDOWN_CONVERTER_REVISION`).

### 2. Mention attributes — double round-trip

Spike **0b mentions**: `setMention` with `data-verse-ref` + `data-translation`,
then `getHTML → setValue` twice. Pass if both attributes survive all three
HTML snapshots.

*Not signed off in this session (needs native rebuild).*

### 3. Undo decision (written)

**No undo button.** `EnrichedTextInputInstance` in 1.1.1 has no `undo` / `redo`
API. A JS checkpoint stack would fight native document state and would not
keep caret/keyboard reliably. Do not add an undo control in the ribbon unless
a later library pin exposes native undo that keeps caret and keyboard.
OS-level undo (keyboard bar / shake) is out of our hands and is not a product
guarantee.

## Router / normalizer (landed, used later)

- `lib/journal-reflection-legacy-route.ts` —
  `reflectionHtmlNeedsLegacyEditor`, `normalizeReflectionMarkdownForCompare`
- `lib/journal-reflection-census.ts` — Phase 0 counts

Phase 1–4 note-surface chrome **did** ship after this session (`JOURNAL_NOTES_SURFACE_ENABLED = true`). This file only tracks 0 / 0a / 0b.

## Remaining device-only items

1. `/dev/journal-census` → fill the two counts above
2. Device pass on `/dev/enriched-html-spike`: WYSIWYG, `focus()`, paste, IME,
   KAV modal, jank vs baseline, poll-off (and poll-on only if needed)
3. Spike **0b fixtures** + **0b mentions** (native `setValue → getHTML`)
4. If 0a or native 0b fails on device → that is a product risk against the already-shipped note surface, not a reason to delete the fixtures
