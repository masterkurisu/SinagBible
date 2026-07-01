# Offline Chapter Store — Phase Reference

> **Temporary handoff doc** for multi-chat implementation. Consolidates the
> approved plan, repo audit findings, and review amendments. Delete or archive
> when Phases 1–7 are merged.
>
> **Do not implement from memory** — `@` this file at the start of each chat.

---

## Quick handoff (paste into a new chat)

```text
Implement Phase N only per @docs/reader_rendering_fix.md.
Do not start Phase N+1. Flag any deviation from Phase 0 decisions.
```

---

## Phase 0 — Locked decisions (decide once)

### Storage engine

- **`expo-sqlite` with SQLCipher** via config plugin in `app.json`:
  ```json
  ["expo-sqlite", { "useSQLCipher": true }]
  ```
- Rebuild dev client after adding plugin (**not supported in Expo Go**).
- Modern sync API: `openDatabaseSync`, `getFirstSync`, `runSync`.
- First statement after open: `PRAGMA key = '<hex>';` then WAL / `synchronous = NORMAL`.

### Key management

- **`expo-secure-store` + `expo-crypto`**: generate 256-bit key once
  (`Crypto.getRandomBytesAsync(32)`), hex-encode, store in SecureStore.
- Key never in AsyncStorage or source constants.

### Canonical translation id

- **Prefer internal ids** (`ENG_ASV`, `BSB`, `yvp:111`) — reader, pins, routes,
  and highlights already use these.
- **Shared helper** (use at every read/write boundary):
  ```typescript
  function canonicalTranslationId(apiOrInternalId: string): string {
    return getInternalIdFromApiId(apiOrInternalId) ?? apiOrInternalId;
  }
  ```
- **Migration only**: if legacy key maps to null *and* USFM slug is invalid →
  delete key (includes orphan `eng_kjv` inline-enrichment cache — safe, KJV is bundled).
- **Live writes**: never treat null mapper as fatal — fall back to raw API id.

Convert API → internal at:

1. Migration parser (legacy AsyncStorage keys use API ids + USFM book ids)
2. `fetchChapter` write boundary

### Payload policy (by `source` column)

| Source | Stored in `payload` | Notes |
|---|---|---|
| `helloao` | Parsed `ApiChapter` (as today) | Convert at read via `apiChapterToBibleChapter` |
| `yvp` | **Verbatim raw API JSON** | Footnotes + copyright metatext intact; transform at render only |
| `bundled` | Not stored | KJV / ADB1905 etc. read from bundled assets |

`source` doubles as payload-format discriminator on the read path.

### Scope

- **Full-Bible download**: HelloAO + bundled only.
- **Biblica (NIV, ASD)**: cache-as-you-read + ±2 prefetch only until written approval.
- Default pins: `KJV`, `yvp:111`, `ADB1905`, `yvp:1264` (`lib/default-pinned-translations.ts`).

### Dependencies to add

- `expo-sqlite` (SQLCipher plugin)
- `expo-secure-store`
- `expo-crypto`
- `@react-native-community/netinfo`

### Build / compliance checklist

- [ ] Add plugin to `app.json` (or via `app.config.js` merge)
- [ ] Rebuild iOS + Android dev clients
- [ ] Verify `.db` file is ciphertext off-device
- [ ] Update `ITSAppUsesNonExemptEncryption` in `app.json` if required for App Store
- [ ] Watch for Android `libcrypto.so` conflicts with other native modules

### Repo facts (legacy AsyncStorage)

- Chapter prefix: **`sb:bible-api:chapter:`** (not `@reader_chapter:`)
- Key shape: `sb:bible-api:chapter:{apiTranslationId}:{usfmBookId}:{chapterNumber}`
- Legacy value: **`ApiChapter` JSON directly** — no unwrap
- Books prefix: `sb:bible-api:books:{apiId}`
- YVP today: **memory-only** — nothing to migrate for YVP until Phase 4

### Key files (touch map)

| Area | Files |
|---|---|
| Store | `lib/chapter-db.ts`, `lib/chapter-store.ts`, `lib/canonical-translation-id.ts` (optional) |
| Fetch | `lib/bible-api-service.ts` |
| Reader load | `src/features/reader/useReaderChapter.ts`, `lib/reader-chapter-load.ts` |
| Legacy cache | `lib/reader-chapter-cache.ts` (remove after Phase 2/7) |
| YVP | `lib/youversion-api.ts` |
| Bootstrap | `app/_layout.tsx` |
| Migration | `lib/migrate-async-storage.ts` |
| Cleanup | `lib/delete-my-data.ts` |
| Pins / prefetch | `lib/use-favorite-translations.ts`, `app/(tabs)/_layout.tsx` |

---

## Phase 1 — Encrypted store modules

**Goal:** DB opens encrypted; sync read/write works after cold restart.

### Tasks

1. **`lib/chapter-db.ts`**
   - `openChapterDb()` — SecureStore key load, `openDatabaseSync`, `PRAGMA key`
   - Schema: `chapters` (composite PK, `WITHOUT ROWID`), `translation_meta`, `store_flags`
   - WAL + `synchronous = NORMAL`
   - `getDb()` sync accessor; throws if called pre-bootstrap

2. **`lib/chapter-store.ts`**
   - Two-tier read: LRU (~60 entries) over `getFirstSync`
   - `putChapter` / `putChapters` (batch, transactional)
   - `getChapterSync`, `hasChapterSync`
   - `upsertTranslationMeta` / `getTranslationMetaSync`
   - `purgeTranslation`
   - `reconcileWithRemoteConfig({ revoked, versions })` — stub OK in Phase 1

3. **Verify sync `runSync` + `PRAGMA key` ordering** (Expo docs mostly show async examples).

4. **Test** — on-device smoke screen or jest + better-sqlite3 shim (cheapest for this repo).

### Done when

- [ ] DB opens encrypted on iOS + Android dev build
- [ ] `putChapter` → kill app → `getChapterSync` returns data
- [ ] Off-device `.db` file shows ciphertext

### Do not start

- Rerouting fetch path (Phase 2)
- Migration (Phase 3)

---

## Phase 2 — Reroute fetch path (before migration)

**Goal:** No new plaintext chapter writes; helloao offline after cold start.

### Tasks

1. **`lib/bible-api-service.ts` — `fetchChapter()`**
   - Check `getChapterSync(canonicalTranslationId(...), bookSlug, chapter)` first
   - On network success: `putChapter()` with `source: 'helloao'`, parsed `ApiChapter`
   - **Delete `AsyncStorage.setItem` for chapters**
   - Use `getExternalApiId()` for network URL; canonical id for store keys

2. **Reroute helpers**
   - `isChapterCached()` → `hasChapterSync()`
   - `clearChapterCache()` → SQLite deletes (decide: all sources vs API-only)

3. **`src/features/reader/useReaderChapter.ts`**
   - Warm-start: `getChapterSync()` instead of `getCachedReaderChapter()`
   - On sync hit: `apiChapterToBibleChapter(bookSlug, apiChapter)` — **do not block
     verses on books**; load books via `resolveReaderBooksForTranslation()` in parallel
   - Store LRU replaces session memory cache for chapter **text**

4. **`lib/reader-chapter-load.ts`** *(required — not optional)*
   - Update `primeReaderChapterFetch` to use store, not `reader-chapter-cache.ts`
   - Otherwise prefetch bypasses SQLite and repopulates legacy memory cache

5. **Books cache** (`sb:bible-api:books:*`) — optional in this phase
   - Move to `books_nav` table in same DB
   - Can trail release; if deferred, note plaintext book-nav keys remain temporarily

6. **Session dedup maps** (`chapterFetchCache`, etc.) — keep or replace; document choice.

### Done when

- [ ] Airplane mode: previously read HelloAO chapters work after cold start
- [ ] `grep` shows **no writes** to `CHAPTER_CACHE_KEY_PREFIX` / `sb:bible-api:chapter:`
- [ ] `reader-chapter-load.ts` no longer writes to `reader-chapter-cache.ts`

### Do not start

- AsyncStorage migration (Phase 3)
- YVP persistence (Phase 4)

---

## Phase 3 — Migration + bootstrap

**Goal:** Upgrade users lose plaintext chapter cache; fresh installs no-op quickly.

**Prerequisite:** Phase 2 merged (no new AsyncStorage chapter writes).

### Tasks

1. **`lib/migrate-async-storage.ts`**
   - `LEGACY_PREFIX = "sb:bible-api:chapter:"`
   - Parse USFM book id from key; map to slug via `getBookSlugFromUsfm`
   - Map API id → `canonicalTranslationId()` for store row
   - No payload unwrap — legacy values are `ApiChapter` JSON
   - `inferSource` = constant `'helloao'`
   - Batch size 50; `putChapters` then `multiRemove` per batch
   - Drop unmapped keys with invalid USFM (incl. `eng_kjv` orphans)

2. **Flag belt-and-braces**
   - After last batch, re-run `getAllKeys().filter(prefix)`
   - Set `MIGRATION_FLAG` (`@chapter_store_migrated_v1`) only if empty

3. **`app/_layout.tsx` bootstrap**
   - **`openChapterDb()` blocks** reader/app mount behind splash (tens of ms)
   - `void migrateAsyncStorageChapters().catch(log)` after first frame /
     `InteractionManager.runAfterInteractions`
   - Mid-migration: sync misses fall through to fetch (now SQLite-backed)

### Done when

- [ ] Upgrade from build with warm AsyncStorage cache → chapters in SQLite, plaintext keys gone
- [ ] Second launch returns `'already-done'`
- [ ] Fresh install sets flag immediately (zero legacy keys)

### Do not start

- YVP store writes (Phase 4)

---

## Phase 4 — YVP persistence (compliance-critical)

**Goal:** Licensed YVP text encrypted at rest with copyright, Biblica link, footnotes.

**Prerequisites:** Phases 1–2 complete. Phase 3 recommended before users accumulate
new patterns.

### Tasks

1. **`lib/youversion-api.ts` — `fetchYvpChapter()`**
   - Check store first (`source: 'yvp'`, id `yvp:{bibleId}`)
   - On fetch: `putChapter()` with **full unmodified JSON** from API
   - Today only stores parsed `BibleChapter` in memory — change to store raw first
   - Session memory cache optional (store LRU may replace it)

2. **Define payload schema explicitly**
   - Minimum: full JSON from passage endpoint (`/bibles/{id}/passages/{passage_id}`)
   - Copyright / trademark: from `/bibles/{id}` (or equivalent) → `translation_meta`
   - Confirm where footnotes live (passage HTML vs separate endpoint) before UI work

3. **`translation_meta` on fetch**
   - `copyright_notice`, `trademark_notice`, `content_version`

4. **Reader UI obligations**
   - Copyright/trademark displayed with content (including cached chapters)
   - Biblica translations: one-step link containing the word "Biblica"
   - Footnotes accessible for YVP translations
   - Transform raw → display at render time only

5. **`reconcileWithRemoteConfig()`**
   - Wire to app start/foreground
   - Remote payload: `revoked[]`, `versions{}`
   - 72-hour destruction + revision update path
   - **Infra prerequisite:** needs remote config source (EAS Updates, Firebase, backend)
   - OK to split: **4a** = local persistence + UI; **4b** = remote purge

6. **Keep YVP out of AI/ML features** (license prohibition).

### Before shipping

- [ ] Confirm ASD (`yvp:1264`) on Biblica TRANSLATIONS schedule
- [ ] Optionally email Biblica re: bulk download (Phase 6 scope only)

### Done when

- [ ] Pin NIV → read chapter → kill app → airplane mode → renders from disk
- [ ] Copyright notice + Biblica link visible on cached chapter
- [ ] Remote revoke flag purges on next launch (when 4b infra exists)

### Do not start

- Full-translation download UI (Phase 6)

---

## Phase 5 — Startup prefetch for pinned translations

**Goal:** Default pins work offline after one online session.

### Tasks

1. **Prefetch hook** — after first online session
   - Prefer `app/(tabs)/_layout.tsx` (already warms caches) **or** reader first frame
   - Walk `favoriteTranslationIds` — **wait for favorites load** (hook starts as `[]`)
     or seed from `getDefaultPinnedTranslationIds()` synchronously on first run

2. **Prime ±2 chapters** per pinned translation via existing
   `primeReaderChapterFetch` / `prefetchTranslationChaptersForReader` (now writes SQLite)

3. **Context fallback** when no active reader position:
   - Last-read position (`lib/reader-last-position.ts`)
   - Else Genesis 1

4. **`netinfo`**
   - Distinguish offline-not-downloaded vs server error
   - Reader message: "This translation isn't downloaded for offline use"

### Done when

- [ ] Fresh install → open reader once online → airplane mode → default pins render
  current-neighborhood chapters

---

## Phase 6 — Full-translation download (HelloAO + bundled only)

**Goal:** Explicit offline download for non-Biblica translations.

### Tasks

1. Per-translation download action (picker or auto on pin over Wi-Fi)
2. Stream batches into `putChapters`, progress UI
3. Set `translation_meta.fully_downloaded = 1` on completion
4. **Biblica excluded** — show "available offline as you read" copy
5. With `fully_downloaded`, all chapters hit sync fast path

### Done when

- [ ] Downloaded translation navigates arbitrarily offline (Psalms → John → Romans)
  with zero fetch-path hits

---

## Phase 7 — Cleanup & data deletion

**Goal:** No dead paths; compliant wipe on "delete my data".

### Tasks

1. **`lib/delete-my-data.ts`**
   - Close DB, `SQLite.deleteDatabaseAsync`, delete SecureStore key
   - Note: `AsyncStorage.clear()` resets migration flag — benign (re-scan finds nothing)
   - Extend `clearBibleApiMemoryCaches()` to clear store LRU / in-flight state

2. **`clearChapterCache()`** — document semantics (all sources vs API-only); target SQLite

3. **Dead code**
   - Remove `lib/reader-chapter-cache.ts` once store LRU fully replaces it
   - Remove or wire `isContentSynced` in `useReaderChapter` (currently unused by reader screen)

4. **Rendering polish** (from rendering review)
   - Verse-tap handlers resolve from rendered item data, not stale route state
   - Header-vs-verse mismatch during chapter nav: tie header to rendered chapter or dim stale verses

### Done when

- [ ] Delete my data wipes SQLite + key + AsyncStorage
- [ ] No references to legacy chapter memory cache
- [ ] `grep sb:bible-api:chapter` shows migration-only reads, no live writes

---

## Phase order (strict)

```
Phase 0 (decisions)
  → Phase 1 (store)
  → Phase 2 (reroute — stops plaintext)
  → Phase 3 (migrate legacy)
  → Phase 4 (YVP + license UI)
  → Phases 5, 6, 7 (can interleave after 4)
```

---

## Open items (track separately)

- [ ] Email Biblica: full-translation download for pinned offline use?
- [ ] Confirm ASD (`yvp:1264`) covered by Biblica agreement
- [ ] Biblica digital IP protection page — screenshot/export restrictions?
- [ ] Remote config provider for `reconcileWithRemoteConfig`
- [ ] Books nav migration timing vs compliance scope for plaintext `sb:bible-api:books:*`

---

## Chat split guide (last resort)

| Chat | Scope |
|---|---|
| **This planning thread** | Audit + plan only — do not implement here |
| **Chat A** | Phases 1 → 2 → 3 sequentially |
| **Chat B** | Phase 4 (YVP + UI + compliance) |
| **Chat C** | Phases 5, 6, 7 (any order) |

Always `@docs/reader_rendering_fix.md` + state which phase and what's already merged.
