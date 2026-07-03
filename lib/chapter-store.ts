import { getDb } from "@/lib/chapter-db";
import { canonicalTranslationId } from "@/lib/canonical-translation-id";

export type ChapterSource = "helloao" | "yvp";

export type StoredChapter = {
  translationId: string;
  bookSlug: string;
  chapterNumber: number;
  source: ChapterSource;
  payload: unknown;
  updatedAt?: number;
};

export type TranslationMeta = {
  translationId: string;
  copyrightNotice?: string | null;
  trademarkNotice?: string | null;
  contentVersion?: string | null;
  fullyDownloaded?: boolean;
  updatedAt?: number;
};

export type RemoteConfigReconcileInput = {
  revoked?: string[];
  versions?: Record<string, string>;
};

const LRU_MAX_ENTRIES = 60;

type ChapterRow = {
  translation_id: string;
  book_slug: string;
  chapter_number: number;
  source: ChapterSource;
  payload: string;
  updated_at: number;
};

type TranslationMetaRow = {
  translation_id: string;
  copyright_notice: string | null;
  trademark_notice: string | null;
  content_version: string | null;
  fully_downloaded: number;
  updated_at: number;
};

class ChapterLruCache {
  private readonly maxSize: number;
  private readonly map = new Map<string, StoredChapter>();

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): StoredChapter | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  set(key: string, value: StoredChapter): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }
    this.map.set(key, value);
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  deleteByTranslation(translationId: string): void {
    const prefix = `${translationId}:`;
    for (const key of [...this.map.keys()]) {
      if (key.startsWith(prefix)) {
        this.map.delete(key);
      }
    }
  }

  clear(): void {
    this.map.clear();
  }
}

const chapterLru = new ChapterLruCache(LRU_MAX_ENTRIES);

export function chapterStoreKey(
  translationId: string,
  bookSlug: string,
  chapterNumber: number,
): string {
  return `${translationId}:${bookSlug}:${chapterNumber}`;
}

function rowToStoredChapter(row: ChapterRow): StoredChapter {
  return {
    translationId: row.translation_id,
    bookSlug: row.book_slug,
    chapterNumber: row.chapter_number,
    source: row.source,
    payload: JSON.parse(row.payload) as unknown,
    updatedAt: row.updated_at,
  };
}

function rowToTranslationMeta(row: TranslationMetaRow): TranslationMeta {
  return {
    translationId: row.translation_id,
    copyrightNotice: row.copyright_notice,
    trademarkNotice: row.trademark_notice,
    contentVersion: row.content_version,
    fullyDownloaded: row.fully_downloaded === 1,
    updatedAt: row.updated_at,
  };
}

function upsertChapterRow(chapter: StoredChapter, updatedAt: number): void {
  const db = getDb();
  db.runSync(
    `INSERT OR REPLACE INTO chapters (
      translation_id, book_slug, chapter_number, source, payload, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      chapter.translationId,
      chapter.bookSlug,
      chapter.chapterNumber,
      chapter.source,
      JSON.stringify(chapter.payload),
      updatedAt,
    ],
  );
}

export function putChapter(chapter: StoredChapter): void {
  const updatedAt = chapter.updatedAt ?? Date.now();
  upsertChapterRow(chapter, updatedAt);

  const key = chapterStoreKey(chapter.translationId, chapter.bookSlug, chapter.chapterNumber);
  chapterLru.set(key, { ...chapter, updatedAt });
}

export function putChapters(chapters: StoredChapter[]): void {
  if (chapters.length === 0) return;

  const db = getDb();
  const batchUpdatedAt = Date.now();

  db.withTransactionSync(() => {
    for (const chapter of chapters) {
      const updatedAt = chapter.updatedAt ?? batchUpdatedAt;
      upsertChapterRow(chapter, updatedAt);
    }
  });

  for (const chapter of chapters) {
    const updatedAt = chapter.updatedAt ?? batchUpdatedAt;
    const key = chapterStoreKey(chapter.translationId, chapter.bookSlug, chapter.chapterNumber);
    chapterLru.set(key, { ...chapter, updatedAt });
  }
}

export function getChapterSync(
  translationId: string,
  bookSlug: string,
  chapterNumber: number,
): StoredChapter | null {
  const key = chapterStoreKey(translationId, bookSlug, chapterNumber);
  const cached = chapterLru.get(key);
  if (cached) return cached;

  const db = getDb();
  const row = db.getFirstSync<ChapterRow>(
    `SELECT translation_id, book_slug, chapter_number, source, payload, updated_at
     FROM chapters
     WHERE translation_id = ? AND book_slug = ? AND chapter_number = ?`,
    [translationId, bookSlug, chapterNumber],
  );

  if (!row) return null;

  const chapter = rowToStoredChapter(row);
  chapterLru.set(key, chapter);
  return chapter;
}

export function hasChapterSync(
  translationId: string,
  bookSlug: string,
  chapterNumber: number,
): boolean {
  const key = chapterStoreKey(translationId, bookSlug, chapterNumber);
  if (chapterLru.has(key)) return true;

  const db = getDb();
  const row = db.getFirstSync<{ found: number }>(
    `SELECT 1 AS found
     FROM chapters
     WHERE translation_id = ? AND book_slug = ? AND chapter_number = ?
     LIMIT 1`,
    [translationId, bookSlug, chapterNumber],
  );

  return row?.found === 1;
}

export function upsertTranslationMeta(meta: TranslationMeta): void {
  const db = getDb();
  const updatedAt = meta.updatedAt ?? Date.now();

  db.runSync(
    `INSERT INTO translation_meta (
      translation_id, copyright_notice, trademark_notice, content_version,
      fully_downloaded, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(translation_id) DO UPDATE SET
      copyright_notice = excluded.copyright_notice,
      trademark_notice = excluded.trademark_notice,
      content_version = excluded.content_version,
      fully_downloaded = excluded.fully_downloaded,
      updated_at = excluded.updated_at`,
    [
      meta.translationId,
      meta.copyrightNotice ?? null,
      meta.trademarkNotice ?? null,
      meta.contentVersion ?? null,
      meta.fullyDownloaded ? 1 : 0,
      updatedAt,
    ],
  );
}

export function getTranslationMetaSync(translationId: string): TranslationMeta | null {
  const db = getDb();
  const row = db.getFirstSync<TranslationMetaRow>(
    `SELECT translation_id, copyright_notice, trademark_notice, content_version,
            fully_downloaded, updated_at
     FROM translation_meta
     WHERE translation_id = ?`,
    [translationId],
  );

  return row ? rowToTranslationMeta(row) : null;
}

/** Sets fully_downloaded without clearing existing copyright / version fields. */
export function setTranslationFullyDownloaded(translationId: string, fullyDownloaded: boolean): void {
  const existing = getTranslationMetaSync(translationId);
  upsertTranslationMeta({
    translationId,
    copyrightNotice: existing?.copyrightNotice ?? null,
    trademarkNotice: existing?.trademarkNotice ?? null,
    contentVersion: existing?.contentVersion ?? null,
    fullyDownloaded,
  });
}

export function purgeTranslation(translationId: string): void {
  const db = getDb();

  db.withTransactionSync(() => {
    db.runSync("DELETE FROM chapters WHERE translation_id = ?", [translationId]);
    db.runSync("DELETE FROM translation_meta WHERE translation_id = ?", [translationId]);
  });

  chapterLru.deleteByTranslation(translationId);
}

/** Applies remote revoke + revision updates. Phase 4b supplies config via {@link fetchChapterRemoteConfig}. */
export function reconcileWithRemoteConfig(input: RemoteConfigReconcileInput): void {
  for (const rawId of input.revoked ?? []) {
    purgeTranslation(canonicalTranslationId(rawId));
  }

  for (const [rawId, nextVersion] of Object.entries(input.versions ?? {})) {
    const translationId = canonicalTranslationId(rawId);
    const meta = getTranslationMetaSync(translationId);
    if (!meta?.contentVersion) continue;
    if (meta.contentVersion !== nextVersion) {
      purgeTranslation(translationId);
    }
  }
}

/** Clears the in-memory LRU without touching SQLite. Used during data deletion in Phase 7. */
export function clearChapterStoreMemoryCache(): void {
  chapterLru.clear();
}

/** Removes all persisted chapter rows (all sources). Translation meta is kept. */
export function clearAllStoredChapters(): void {
  const db = getDb();
  db.runSync("DELETE FROM chapters");
  chapterLru.clear();
}
