import { LruMap } from "@sinag-bible/core/lru-map";
import { getDb, isChapterDbOpen } from "@/lib/chapter-db";
import { yvpPassageToBibleChapter, type StoredYvpChapterPayload } from "@/lib/yvp-chapter-payload";

const TOKEN_RE = /[a-z']+/g;
const CHAPTERS_PER_TRANSLATION = 60;

export type YvpKeywordPosting = {
  bookSlug: string;
  chapterNumber: number;
  verseNumber: number;
};

type ChapterKey = `${string}:${number}`;

function chapterKey(bookSlug: string, chapterNumber: number): ChapterKey {
  return `${bookSlug}:${chapterNumber}`;
}

function tokenizeVerseText(text: string): string[] {
  return text.toLowerCase().match(TOKEN_RE) ?? [];
}

type TranslationIndex = {
  chapters: LruMap<ChapterKey, true>;
  postings: Map<string, YvpKeywordPosting[]>;
};

const memoryByTranslation = new Map<string, TranslationIndex>();

function getOrCreateIndex(translationId: string): TranslationIndex {
  let index = memoryByTranslation.get(translationId);
  if (index) return index;
  index = {
    chapters: new LruMap<ChapterKey, true>(CHAPTERS_PER_TRANSLATION),
    postings: new Map(),
  };
  memoryByTranslation.set(translationId, index);
  return index;
}

function removeChapterFromMemory(index: TranslationIndex, bookSlug: string, chapterNumber: number): void {
  const key = chapterKey(bookSlug, chapterNumber);
  index.chapters.delete(key);
  for (const [token, list] of index.postings) {
    const next = list.filter(
      (row) => row.bookSlug !== bookSlug || row.chapterNumber !== chapterNumber,
    );
    if (next.length === 0) index.postings.delete(token);
    else index.postings.set(token, next);
  }
}

function persistChapterTokens(
  translationId: string,
  bookSlug: string,
  chapterNumber: number,
  verseTokens: Map<number, string[]>,
): void {
  if (!isChapterDbOpen()) return;
  try {
    ensureYvpKeywordIndexSchema();
    const db = getDb();
    const updatedAt = Date.now();
    db.withTransactionSync(() => {
      db.runSync(
        "DELETE FROM yvp_keyword_postings WHERE translation_id = ? AND book_slug = ? AND chapter_number = ?",
        [translationId, bookSlug, chapterNumber],
      );
      db.runSync(
        `INSERT OR REPLACE INTO yvp_indexed_chapters (
          translation_id, book_slug, chapter_number, updated_at
        ) VALUES (?, ?, ?, ?)`,
        [translationId, bookSlug, chapterNumber, updatedAt],
      );
      for (const [verseNumber, tokens] of verseTokens) {
        for (const token of tokens) {
          db.runSync(
            `INSERT OR IGNORE INTO yvp_keyword_postings (
              translation_id, token, book_slug, chapter_number, verse_number
            ) VALUES (?, ?, ?, ?, ?)`,
            [translationId, token, bookSlug, chapterNumber, verseNumber],
          );
        }
      }
    });
  } catch {
    /* persist must not fail chapter storage */
  }
}

export function ensureYvpKeywordIndexSchema(): void {
  if (!isChapterDbOpen()) return;
  getDb().execSync(`
    CREATE TABLE IF NOT EXISTS yvp_keyword_postings (
      translation_id TEXT NOT NULL,
      token TEXT NOT NULL,
      book_slug TEXT NOT NULL,
      chapter_number INTEGER NOT NULL,
      verse_number INTEGER NOT NULL,
      PRIMARY KEY (translation_id, token, book_slug, chapter_number, verse_number)
    ) WITHOUT ROWID;

    CREATE TABLE IF NOT EXISTS yvp_indexed_chapters (
      translation_id TEXT NOT NULL,
      book_slug TEXT NOT NULL,
      chapter_number INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (translation_id, book_slug, chapter_number)
    ) WITHOUT ROWID;

    CREATE INDEX IF NOT EXISTS idx_yvp_keyword_token
      ON yvp_keyword_postings (translation_id, token);
  `);
}

/** Parse a stored YVP chapter and merge tokens into the per-translation posting list. */
export function indexYvpStoredChapter(chapter: {
  translationId: string;
  bookSlug: string;
  chapterNumber: number;
  source: string;
  payload: unknown;
}): void {
  if (chapter.source !== "yvp") return;
  try {
    const parsed = yvpPassageToBibleChapter(
      chapter.bookSlug,
      chapter.chapterNumber,
      chapter.payload as StoredYvpChapterPayload,
    );
    mergeYvpChapterTokens(
      chapter.translationId,
      chapter.bookSlug,
      chapter.chapterNumber,
      parsed.verses,
    );
  } catch {
    /* skip unparseable payloads */
  }
}

export function mergeYvpChapterTokens(
  translationId: string,
  bookSlug: string,
  chapterNumber: number,
  verses: string[],
): void {
  const index = getOrCreateIndex(translationId);
  removeChapterFromMemory(index, bookSlug, chapterNumber);

  const verseTokens = new Map<number, string[]>();
  for (let i = 0; i < verses.length; i++) {
    const verseNumber = i + 1;
    const unique = [...new Set(tokenizeVerseText(verses[i] ?? ""))];
    if (unique.length === 0) continue;
    verseTokens.set(verseNumber, unique);
    for (const token of unique) {
      const list = index.postings.get(token) ?? [];
      list.push({ bookSlug, chapterNumber, verseNumber });
      index.postings.set(token, list);
    }
  }

  index.chapters.set(chapterKey(bookSlug, chapterNumber), true, (evicted) => {
    const [slug, chapterStr] = evicted.split(":");
    const n = Number(chapterStr);
    if (!slug || !Number.isFinite(n)) return;
    // Memory-only: SQLite postings stay so a background corpus fill can accumulate.
    removeChapterFromMemory(index, slug, n);
  });

  persistChapterTokens(translationId, bookSlug, chapterNumber, verseTokens);
}

function mergePostingLists(a: YvpKeywordPosting[], b: YvpKeywordPosting[]): YvpKeywordPosting[] {
  if (b.length === 0) return a;
  if (a.length === 0) return b;
  const seen = new Set(a.map((row) => `${row.bookSlug}:${row.chapterNumber}:${row.verseNumber}`));
  const out = [...a];
  for (const row of b) {
    const key = `${row.bookSlug}:${row.chapterNumber}:${row.verseNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export function lookupYvpKeywordPostings(
  translationId: string,
  token: string,
): YvpKeywordPosting[] {
  const q = token.trim().toLowerCase();
  if (!q) return [];
  const memoryHits = memoryByTranslation.get(translationId)?.postings.get(q) ?? [];
  return mergePostingLists(memoryHits, loadPostingsFromSqlite(translationId, q));
}

function loadPostingsFromSqlite(translationId: string, token: string): YvpKeywordPosting[] {
  if (!isChapterDbOpen()) return [];
  try {
    ensureYvpKeywordIndexSchema();
    const rows = getDb().getAllSync<{
      book_slug: string;
      chapter_number: number;
      verse_number: number;
    }>(
      `SELECT book_slug, chapter_number, verse_number
       FROM yvp_keyword_postings
       WHERE translation_id = ? AND token = ?`,
      [translationId, token],
    );
    return rows.map((row) => ({
      bookSlug: row.book_slug,
      chapterNumber: row.chapter_number,
      verseNumber: row.verse_number,
    }));
  } catch {
    return [];
  }
}

function loadPrefixPostingsFromSqlite(translationId: string, tokenPrefix: string): YvpKeywordPosting[] {
  if (!isChapterDbOpen()) return [];
  try {
    ensureYvpKeywordIndexSchema();
    const escaped = tokenPrefix.replace(/[%_\\]/g, (ch) => `\\${ch}`);
    const rows = getDb().getAllSync<{
      book_slug: string;
      chapter_number: number;
      verse_number: number;
    }>(
      `SELECT book_slug, chapter_number, verse_number
       FROM yvp_keyword_postings
       WHERE translation_id = ? AND token LIKE ? ESCAPE '\\'
       LIMIT 500`,
      [translationId, `${escaped}%`],
    );
    return rows.map((row) => ({
      bookSlug: row.book_slug,
      chapterNumber: row.chapter_number,
      verseNumber: row.verse_number,
    }));
  } catch {
    return [];
  }
}

export function lookupYvpKeywordPostingsForQuery(
  translationId: string,
  rawQuery: string,
): YvpKeywordPosting[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];
  const exact = lookupYvpKeywordPostings(translationId, q);
  if (exact.length > 0 || q.length < 3) return exact;

  const merged: YvpKeywordPosting[] = [];
  const seen = new Set<string>();
  const push = (row: YvpKeywordPosting) => {
    const key = `${row.bookSlug}:${row.chapterNumber}:${row.verseNumber}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(row);
  };

  const index = memoryByTranslation.get(translationId);
  if (index) {
    for (const [token, list] of index.postings) {
      if (!token.startsWith(q)) continue;
      for (const row of list) push(row);
    }
  }
  for (const row of loadPrefixPostingsFromSqlite(translationId, q)) {
    push(row);
  }
  return merged;
}

export function yvpIndexHasCoverage(translationId: string, rawQuery: string): boolean {
  const tokens = rawQuery.trim().toLowerCase().match(TOKEN_RE) ?? [];
  if (tokens.length === 0) return false;
  return tokens.every((token) => lookupYvpKeywordPostingsForQuery(translationId, token).length > 0);
}

export function clearYvpKeywordIndex(translationId?: string): void {
  if (translationId) {
    memoryByTranslation.delete(translationId);
    if (isChapterDbOpen()) {
      try {
        const db = getDb();
        db.runSync("DELETE FROM yvp_keyword_postings WHERE translation_id = ?", [translationId]);
        db.runSync("DELETE FROM yvp_indexed_chapters WHERE translation_id = ?", [translationId]);
      } catch {
        /* tables may not exist yet */
      }
    }
    return;
  }
  memoryByTranslation.clear();
  if (isChapterDbOpen()) {
    try {
      const db = getDb();
      db.runSync("DELETE FROM yvp_keyword_postings");
      db.runSync("DELETE FROM yvp_indexed_chapters");
    } catch {
      /* tables may not exist yet */
    }
  }
}

export function resetYvpKeywordIndexForTests(): void {
  memoryByTranslation.clear();
}

export function yvpIndexedChapterCount(translationId: string): number {
  return memoryByTranslation.get(translationId)?.chapters.size ?? 0;
}

/** SQLite indexed-chapter count (survives process death and memory LRU eviction). */
export function countPersistedYvpIndexedChapters(translationId: string): number {
  if (!isChapterDbOpen()) return 0;
  try {
    ensureYvpKeywordIndexSchema();
    const row = getDb().getFirstSync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM yvp_indexed_chapters WHERE translation_id = ?",
      [translationId],
    );
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

export function listPersistedYvpIndexedChapterKeys(
  translationId: string,
): { bookSlug: string; chapterNumber: number }[] {
  if (!isChapterDbOpen()) return [];
  try {
    ensureYvpKeywordIndexSchema();
    const rows = getDb().getAllSync<{ book_slug: string; chapter_number: number }>(
      "SELECT book_slug, chapter_number FROM yvp_indexed_chapters WHERE translation_id = ?",
      [translationId],
    );
    return rows.map((row) => ({ bookSlug: row.book_slug, chapterNumber: row.chapter_number }));
  } catch {
    return [];
  }
}
