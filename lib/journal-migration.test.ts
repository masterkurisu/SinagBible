import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalJournalEntry } from "@sinag-bible/types";
import {
  asyncStorageMock,
  expoSqliteMock,
  getMockAsyncStorage,
  getMockJournalRows,
  makeJournalEntry,
  resetJournalStorageMocks,
} from "./__tests__/journal-storage-mocks";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: asyncStorageMock,
}));

vi.mock("expo-sqlite", () => expoSqliteMock);

import {
  JOURNAL_LEGACY_BLOB_KEY,
  JOURNAL_MIGRATION_FLAG_KEY,
  dbCount,
  dbReplaceAll,
  dbSelectAll,
  deleteJournalDatabase,
  migrateJournalBlobIfNeeded,
  resetJournalDbStateForTests,
} from "./journal-db";

function seedBlob(entries: LocalJournalEntry[]): void {
  getMockAsyncStorage().set(JOURNAL_LEGACY_BLOB_KEY, JSON.stringify(entries));
}

function flagValue(): string | undefined {
  return getMockAsyncStorage().get(JOURNAL_MIGRATION_FLAG_KEY);
}

function blobValue(): string | undefined {
  return getMockAsyncStorage().get(JOURNAL_LEGACY_BLOB_KEY);
}

function entriesMatch(a: LocalJournalEntry[], b: LocalJournalEntry[]): void {
  expect(a).toHaveLength(b.length);
  const byId = new Map(b.map((entry) => [entry.id, entry]));
  for (const entry of a) {
    expect(byId.get(entry.id)).toEqual(entry);
  }
}

describe("migrateJournalBlobIfNeeded", () => {
  beforeEach(async () => {
    resetJournalStorageMocks();
    await resetJournalDbStateForTests();
  });

  it("migrates N blob entries with matching count and content", async () => {
    const source = [
      makeJournalEntry({ id: "local-1", title: "First", created_at: "2024-06-03T00:00:00.000Z" }),
      makeJournalEntry({ id: "local-2", title: "Second", created_at: "2024-06-02T00:00:00.000Z" }),
      makeJournalEntry({ id: "local-3", title: "Third", created_at: "2024-06-01T00:00:00.000Z" }),
    ];
    seedBlob(source);

    await migrateJournalBlobIfNeeded();

    expect(await dbCount()).toBe(3);
    entriesMatch(await dbSelectAll(), source);
    expect(flagValue()).toBe("true");
    expect(blobValue()).toBe(JSON.stringify(source));
  });

  it("throws on corrupt blob, leaves flag unset and blob intact", async () => {
    const corrupt = "{not valid json";
    getMockAsyncStorage().set(JOURNAL_LEGACY_BLOB_KEY, corrupt);

    await expect(migrateJournalBlobIfNeeded()).rejects.toThrow(/could not parse legacy blob/i);
    expect(flagValue()).toBeUndefined();
    expect(blobValue()).toBe(corrupt);
    expect(await dbCount()).toBe(0);
    expect(getMockJournalRows().size).toBe(0);
  });

  it("sets flag with zero rows on empty install (no blob)", async () => {
    await migrateJournalBlobIfNeeded();

    expect(await dbCount()).toBe(0);
    expect(flagValue()).toBe("true");
    expect(blobValue()).toBeUndefined();
  });

  it("does not re-migrate on second launch when flag is set", async () => {
    const source = [makeJournalEntry({ id: "local-only" })];
    seedBlob(source);

    await migrateJournalBlobIfNeeded();
    expect(await dbCount()).toBe(1);

    getMockAsyncStorage().delete(JOURNAL_LEGACY_BLOB_KEY);
    await dbReplaceAll([]);
    expect(await dbCount()).toBe(0);

    await migrateJournalBlobIfNeeded();

    expect(await dbCount()).toBe(0);
    expect(flagValue()).toBe("true");
    expect(blobValue()).toBeUndefined();
  });

  it("filters non-local ids during migration", async () => {
    seedBlob([
      makeJournalEntry({ id: "local-ok" }),
      makeJournalEntry({ id: "remote-bad" }),
      { ...makeJournalEntry({ id: "local-2" }), id: "not-local" } as LocalJournalEntry,
    ]);

    await migrateJournalBlobIfNeeded();

    expect(await dbCount()).toBe(1);
    expect((await dbSelectAll())[0]?.id).toBe("local-ok");
  });
});

describe("deleteJournalDatabase", () => {
  beforeEach(async () => {
    resetJournalStorageMocks();
    await resetJournalDbStateForTests();
  });

  it("closes the connection and quarantines the active database file", async () => {
    seedBlob([makeJournalEntry({ id: "local-wipe-me" })]);
    await migrateJournalBlobIfNeeded();
    expect(await dbCount()).toBe(1);

    await deleteJournalDatabase();
    resetJournalStorageMocks();
    expect(await dbCount()).toBe(0);
  });
});

describe("dbReplaceAll", () => {
  beforeEach(async () => {
    resetJournalStorageMocks();
    await resetJournalDbStateForTests();
  });

  it("replaces all rows atomically for backup import", async () => {
    const initial = [makeJournalEntry({ id: "local-a" }), makeJournalEntry({ id: "local-b" })];
    await dbReplaceAll(initial);
    expect(await dbCount()).toBe(2);

    const replacement = [makeJournalEntry({ id: "local-c", title: "Imported only" })];
    await dbReplaceAll(replacement);

    expect(await dbCount()).toBe(1);
    expect((await dbSelectAll())[0]?.title).toBe("Imported only");
  });

  it("verifies row count after replace (import guard)", async () => {
    const entries = [
      makeJournalEntry({ id: "local-import-1" }),
      makeJournalEntry({ id: "local-import-2" }),
    ];
    await dbReplaceAll(entries);
    expect(await dbCount()).toBe(2);
    const rows = await dbSelectAll();
    expect(rows.map((row) => row.id).sort()).toEqual(["local-import-1", "local-import-2"]);
  });

  it("round-trips tags through sqlite", async () => {
    const source = [
      makeJournalEntry({ id: "local-tagged", tags: ["Gratitude", "prayer"] }),
    ];
    await dbReplaceAll(source);
    expect((await dbSelectAll())[0]?.tags).toEqual(["gratitude", "prayer"]);
  });
});
