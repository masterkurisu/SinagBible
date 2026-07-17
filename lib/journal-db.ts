/**
 * SQLite persistence for journal entries.
 *
 * Replaces the single-key AsyncStorage JSON blob (`sinagbible_journal_entries`)
 * with per-row storage. Public CRUD stays in journal-local.ts; this module owns
 * the connection, schema, row mapping, and the one-time blob migration.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getInfoAsync, moveAsync } from "expo-file-system/legacy";
import * as SQLite from "expo-sqlite";
import type { LocalJournalEntry } from "@sinag-bible/types";

const DB_NAME = "sinag-journal.db";
export const JOURNAL_MIGRATION_FLAG_KEY = "sinagbible_journal_migrated_v1";
export const JOURNAL_LEGACY_BLOB_KEY = "sinagbible_journal_entries";
const MIGRATION_FLAG_KEY = JOURNAL_MIGRATION_FLAG_KEY;
const LEGACY_BLOB_KEY = JOURNAL_LEGACY_BLOB_KEY;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let migrationPromise: Promise<void> | null = null;

const INIT_SQL = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    book TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    verse_start INTEGER,
    verse_end INTEGER,
    bible_translation TEXT,
    title TEXT,
    content TEXT NOT NULL,
    content_markdown TEXT,
    created_at TEXT NOT NULL,
    is_favorite INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_journal_created_at
    ON journal_entries(created_at DESC, id DESC);
`;

async function migrateJournalSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(journal_entries)");
  const hasMarkdown = columns.some((col) => col.name === "content_markdown");
  if (!hasMarkdown) {
    await db.execAsync("ALTER TABLE journal_entries ADD COLUMN content_markdown TEXT");
  }
}

function databaseOpenErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isCorruptDatabaseFileError(error: unknown): boolean {
  const message = databaseOpenErrorMessage(error);
  return /file is not a database/i.test(message);
}

/** Native handle is closed/invalid — retry must reopen, not reuse the same handle. */
function isStaleDatabaseHandleError(error: unknown): boolean {
  const message = databaseOpenErrorMessage(error);
  return (
    /NullPointerException/i.test(message) ||
    /already closed/i.test(message) ||
    /closed database/i.test(message)
  );
}

function isDatabaseLockedError(error: unknown): boolean {
  return /database is locked/i.test(databaseOpenErrorMessage(error));
}

function resolveJournalDatabaseFilePath(): string | null {
  const directory = SQLite.defaultDatabaseDirectory as string | null | undefined;
  if (!directory) return null;
  const normalizedDirectory = directory.replace(/\/*$/, "");
  return `${normalizedDirectory}/${DB_NAME}`;
}

function quarantinePathFor(sourcePath: string, reason: string): string {
  const stamp = Date.now();
  if (sourcePath.endsWith(".db")) {
    return sourcePath.replace(/\.db$/, `.${reason}-${stamp}.db`);
  }
  return `${sourcePath}.${reason}-${stamp}`;
}

/**
 * Moves the on-disk journal DB (+ WAL/SHM sidecars) aside instead of deleting.
 * Active connections must be closed before calling.
 */
async function quarantineJournalDatabaseFiles(reason: string): Promise<void> {
  const sourcePath = resolveJournalDatabaseFilePath();
  if (!sourcePath) return;

  const mainInfo = await getInfoAsync(sourcePath).catch(() => null);
  if (mainInfo?.exists) {
    const destination = quarantinePathFor(sourcePath, reason);
    await moveAsync({ from: sourcePath, to: destination }).catch(() => {});
    if (__DEV__) {
      console.warn(`[journal-db] quarantined journal database (${reason})`, { destination });
    }
  }

  for (const suffix of ["-wal", "-shm"]) {
    const sidecarPath = `${sourcePath}${suffix}`;
    const sidecarInfo = await getInfoAsync(sidecarPath).catch(() => null);
    if (!sidecarInfo?.exists) continue;
    const destination = quarantinePathFor(sourcePath, reason) + suffix;
    await moveAsync({ from: sidecarPath, to: destination }).catch(() => {});
  }
}

export function resetJournalDbLifecycleState(): void {
  dbPromise = null;
  migrationPromise = null;
}

/** @deprecated Use {@link resetJournalDbLifecycleState}. */
export const resetJournalDbPromisesForTests = resetJournalDbLifecycleState;

function invalidateJournalDbConnection(): void {
  resetJournalDbLifecycleState();
}

export function getJournalDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndInit().catch((error) => {
      invalidateJournalDbConnection();
      throw error;
    });
  }
  return dbPromise;
}

async function openJournalDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(INIT_SQL);
  await migrateJournalSchema(db);
  return db;
}

async function openAndInit(): Promise<SQLite.SQLiteDatabase> {
  try {
    return await openJournalDatabase();
  } catch (error) {
    if (!isCorruptDatabaseFileError(error)) throw error;
    await quarantineJournalDatabaseFiles("corrupt-open");
    return await openJournalDatabase();
  }
}

async function withJournalDb<T>(
  fn: (db: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const db = await getJournalDb();
      return await fn(db);
    } catch (error) {
      lastError = error;
      const shouldReopen =
        isStaleDatabaseHandleError(error) ||
        (isDatabaseLockedError(error) && attempt < 3);
      if (!shouldReopen) throw error;
      if (__DEV__) {
        console.warn("[journal-db] reopening journal connection after handle error", error);
      }
      await closeJournalDb();
      invalidateJournalDbConnection();
      await sleepMs(50 * (attempt + 1));
    }
  }
  throw lastError ?? new Error(`Journal database operation failed: ${databaseOpenErrorMessage(lastError)}`);
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Test/teardown helper. */
export async function closeJournalDb(): Promise<void> {
  const pending = dbPromise;
  invalidateJournalDbConnection();
  if (!pending) return;
  const db = await pending.catch(() => null);
  if (db) await db.closeAsync().catch(() => {});
}

type JournalRow = {
  id: string;
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  bible_translation: string | null;
  title: string | null;
  content: string;
  content_markdown: string | null;
  created_at: string;
  is_favorite: number;
};

function rowToEntry(row: JournalRow): LocalJournalEntry {
  return {
    id: row.id,
    book: row.book,
    chapter: row.chapter,
    verse_start: row.verse_start,
    verse_end: row.verse_end,
    bible_translation: row.bible_translation,
    title: row.title,
    content: row.content,
    content_markdown: row.content_markdown,
    created_at: row.created_at,
    is_favorite: row.is_favorite === 1,
  };
}

function entryToParams(entry: LocalJournalEntry): (string | number | null)[] {
  return [
    entry.id,
    entry.book,
    entry.chapter,
    entry.verse_start,
    entry.verse_end,
    entry.bible_translation ?? null,
    entry.title ?? null,
    entry.content,
    entry.content_markdown ?? null,
    entry.created_at,
    entry.is_favorite ? 1 : 0,
  ];
}

const INSERT_SQL = `
  INSERT OR REPLACE INTO journal_entries
    (id, book, chapter, verse_start, verse_end, bible_translation,
     title, content, content_markdown, created_at, is_favorite)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

/** Newest-first; ISO-8601 strings sort correctly lexicographically. */
export async function dbSelectAll(): Promise<LocalJournalEntry[]> {
  const rows = await withJournalDb((db) =>
    db.getAllAsync<JournalRow>(
      "SELECT * FROM journal_entries ORDER BY created_at DESC, id DESC",
    ),
  );
  return rows.map(rowToEntry);
}

export async function dbSelectById(id: string): Promise<LocalJournalEntry | null> {
  const row = await withJournalDb((db) =>
    db.getFirstAsync<JournalRow>("SELECT * FROM journal_entries WHERE id = ?", [id]),
  );
  return row ? rowToEntry(row) : null;
}

export async function dbCount(): Promise<number> {
  const row = await withJournalDb((db) =>
    db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM journal_entries"),
  );
  return row?.n ?? 0;
}

export async function dbUpsert(entry: LocalJournalEntry): Promise<void> {
  await withJournalDb((db) => db.runAsync(INSERT_SQL, entryToParams(entry)));
}

/** Returns number of rows deleted (0 or 1). */
export async function dbDelete(id: string): Promise<number> {
  const result = await withJournalDb((db) =>
    db.runAsync("DELETE FROM journal_entries WHERE id = ?", [id]),
  );
  return result.changes;
}

/** Full replace for backup import. Atomic: all-or-nothing. */
export async function dbReplaceAll(entries: LocalJournalEntry[]): Promise<void> {
  await withJournalDb((db) =>
    db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync("DELETE FROM journal_entries");
      for (const entry of entries) {
        await txn.runAsync(INSERT_SQL, entryToParams(entry));
      }
    }),
  );
}

/**
 * Idempotent blob → SQLite migration. Call after legacy key consolidation.
 * The legacy blob is left in place for one release as a rollback safety net.
 */
export function migrateJournalBlobIfNeeded(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runJournalBlobMigration().catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }
  return migrationPromise;
}

async function runJournalBlobMigration(): Promise<void> {
  const flag = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
  if (flag === "true") return;

  const existing = await dbCount();
  if (existing > 0) {
    await AsyncStorage.setItem(MIGRATION_FLAG_KEY, "true");
    return;
  }

  const raw = await AsyncStorage.getItem(LEGACY_BLOB_KEY);
  if (!raw) {
    await AsyncStorage.setItem(MIGRATION_FLAG_KEY, "true");
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Journal migration failed: could not parse legacy blob (${String(error)})`,
    );
  }

  const entries = Array.isArray(parsed)
    ? (parsed as LocalJournalEntry[]).filter(
        (e) => e && typeof e.id === "string" && e.id.startsWith("local-"),
      )
    : [];

  if (entries.length > 0) {
    await withJournalDb((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        for (const entry of entries) {
          await txn.runAsync(INSERT_SQL, entryToParams(entry));
        }
      }),
    );

    const migrated = await dbCount();
    if (migrated < entries.length) {
      throw new Error(
        `Journal migration failed verification: expected ${entries.length}, found ${migrated}`,
      );
    }
  }

  await AsyncStorage.setItem(MIGRATION_FLAG_KEY, "true");
}

/**
 * Closes the journal DB and quarantines the on-disk file (does not reopen).
 * Used by delete-my-data — file is moved aside, not destroyed.
 */
export async function deleteJournalDatabase(): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (migrationPromise) {
        await migrationPromise.catch(() => {});
      }
      await closeJournalDb();
      await quarantineJournalDatabaseFiles("user-deleted");
      return;
    } catch (error) {
      lastError = error;
      invalidateJournalDbConnection();
      if (attempt < 2) await sleepMs(75 * (attempt + 1));
    }
  }
  throw lastError;
}

/** Quarantines the on-disk journal DB and reopens a fresh empty database. */
export async function resetJournalDatabase(): Promise<void> {
  await closeJournalDb();
  await quarantineJournalDatabaseFiles("reset");
  invalidateJournalDbConnection();
  await getJournalDb();
}

/** Closes the DB handle and quarantines the on-disk file (tests / dev smoke). */
export async function resetJournalDbStateForTests(): Promise<void> {
  await closeJournalDb();
  await quarantineJournalDatabaseFiles("test-reset");
  invalidateJournalDbConnection();
}
