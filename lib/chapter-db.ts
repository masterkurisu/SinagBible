import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import {
  deleteDatabaseAsync,
  openDatabaseSync,
  type SQLiteDatabase,
} from "expo-sqlite";

const DB_NAME = "sinag-chapters.db";
const ENCRYPTION_KEY_STORAGE_KEY = "sb.chapter_db.encryption_key_v1";

let db: SQLiteDatabase | null = null;
let openPromise: Promise<SQLiteDatabase> | null = null;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function loadOrCreateEncryptionKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE_KEY);
  if (existing) return existing;

  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const hexKey = bytesToHex(randomBytes);
  await SecureStore.setItemAsync(ENCRYPTION_KEY_STORAGE_KEY, hexKey);
  return hexKey;
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function initSchema(database: SQLiteDatabase): void {
  database.execSync(`
    CREATE TABLE IF NOT EXISTS chapters (
      translation_id TEXT NOT NULL,
      book_slug TEXT NOT NULL,
      chapter_number INTEGER NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('helloao', 'yvp')),
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (translation_id, book_slug, chapter_number)
    ) WITHOUT ROWID;

    CREATE TABLE IF NOT EXISTS translation_meta (
      translation_id TEXT NOT NULL PRIMARY KEY,
      copyright_notice TEXT,
      trademark_notice TEXT,
      content_version TEXT,
      fully_downloaded INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    ) WITHOUT ROWID;

    CREATE TABLE IF NOT EXISTS store_flags (
      key TEXT NOT NULL PRIMARY KEY,
      value TEXT NOT NULL
    ) WITHOUT ROWID;
  `);
}

function openEncryptedDatabase(encryptionKey: string): SQLiteDatabase {
  const database = openDatabaseSync(DB_NAME);

  // SQLCipher requires the key before any other statement touches encrypted pages.
  database.execSync(`PRAGMA key = '${escapeSqlString(encryptionKey)}';`);

  // Verify the key unlocks the database (fresh DB accepts any key).
  database.getFirstSync("SELECT count(*) AS count FROM sqlite_master;");

  database.execSync("PRAGMA journal_mode = WAL;");
  database.execSync("PRAGMA synchronous = NORMAL;");

  initSchema(database);
  return database;
}

/**
 * Opens (or reuses) the encrypted chapter database.
 * Safe to call multiple times — subsequent calls return the same instance.
 */
export async function openChapterDb(): Promise<SQLiteDatabase> {
  if (db) return db;
  if (openPromise) return openPromise;

  openPromise = (async () => {
    const encryptionKey = await loadOrCreateEncryptionKey();
    db = openEncryptedDatabase(encryptionKey);
    return db;
  })();

  try {
    return await openPromise;
  } finally {
    openPromise = null;
  }
}

/** Sync accessor for the open database. Throws if `openChapterDb()` has not completed. */
export function getDb(): SQLiteDatabase {
  if (!db) {
    throw new Error("Chapter DB not open — call openChapterDb() before using the store");
  }
  return db;
}

export function isChapterDbOpen(): boolean {
  return db !== null;
}

export function getChapterDbPath(): string | null {
  return db?.databasePath ?? null;
}

/** Closes the database handle. Used before deleting the on-disk file. */
export function closeChapterDb(): void {
  if (!db) return;
  db.closeSync();
  db = null;
}

/**
 * Deletes the encrypted chapter database file and SecureStore encryption key.
 * Call {@link openChapterDb} afterward if the app session continues.
 */
export async function deleteChapterDatabase(): Promise<void> {
  closeChapterDb();
  openPromise = null;

  try {
    await deleteDatabaseAsync(DB_NAME);
  } catch {
    /* ok when the file was never created */
  }

  try {
    await SecureStore.deleteItemAsync(ENCRYPTION_KEY_STORAGE_KEY);
  } catch {
    /* ok when the key was never stored */
  }
}

/** Wipes the chapter store and opens a fresh encrypted database for the current session. */
export async function resetChapterDatabase(): Promise<void> {
  await deleteChapterDatabase();
  await openChapterDb();
}
