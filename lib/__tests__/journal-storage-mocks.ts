import type { LocalJournalEntry } from "@sinag-bible/types";

type JournalRow = {
  id: string;
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  bible_translation: string | null;
  title: string | null;
  content: string;
  created_at: string;
  is_favorite: number;
};

const rows = new Map<string, JournalRow>();
const asyncStore = new Map<string, string>();

function rowFromParams(params: (string | number | null)[]): JournalRow {
  return {
    id: String(params[0]),
    book: String(params[1]),
    chapter: Number(params[2]),
    verse_start: params[3] as number | null,
    verse_end: params[4] as number | null,
    bible_translation: params[5] as string | null,
    title: params[6] as string | null,
    content: String(params[7]),
    created_at: String(params[8]),
    is_favorite: Number(params[9]),
  };
}

function createDbHandle() {
  return {
    execAsync: async () => {},
    getAllAsync: async <T>(_sql: string): Promise<T[]> => {
      const sorted = [...rows.values()].sort((a, b) => {
        const byDate = b.created_at.localeCompare(a.created_at);
        return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
      });
      return sorted as T[];
    },
    getFirstAsync: async <T>(sql: string, params?: unknown[]): Promise<T | null> => {
      if (sql.includes("COUNT(*)")) {
        return { n: rows.size } as T;
      }
      if (sql.includes("WHERE id = ?") && params?.[0]) {
        return (rows.get(String(params[0])) ?? null) as T | null;
      }
      return null;
    },
    runAsync: async (sql: string, params?: (string | number | null)[]) => {
      if (sql.startsWith("DELETE FROM journal_entries WHERE id = ?") && params?.[0]) {
        const existed = rows.delete(String(params[0]));
        return { changes: existed ? 1 : 0 };
      }
      if (sql === "DELETE FROM journal_entries") {
        const count = rows.size;
        rows.clear();
        return { changes: count };
      }
      if (sql.includes("INSERT OR REPLACE INTO journal_entries") && params) {
        const row = rowFromParams(params);
        rows.set(row.id, row);
        return { changes: 1 };
      }
      return { changes: 0 };
    },
    withExclusiveTransactionAsync: async (
      fn: (txn: {
        runAsync: (sql: string, params?: (string | number | null)[]) => Promise<{ changes: number }>;
      }) => Promise<void>,
    ) => {
      await fn({
        runAsync: async (sql, params) => createDbHandle().runAsync(sql, params),
      });
    },
    closeAsync: async () => {},
  };
}

export function resetJournalStorageMocks(): void {
  rows.clear();
  asyncStore.clear();
}

export function getMockJournalRows(): Map<string, JournalRow> {
  return rows;
}

export function getMockAsyncStorage(): Map<string, string> {
  return asyncStore;
}

export const expoSqliteMock = {
  defaultDatabaseDirectory: "/tmp/sinag-test-sqlite",
  openDatabaseAsync: async () => createDbHandle(),
  deleteDatabaseAsync: async () => {
    rows.clear();
  },
};

export const asyncStorageMock = {
  getItem: async (key: string) => asyncStore.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    asyncStore.set(key, value);
  },
  removeItem: async (key: string) => {
    asyncStore.delete(key);
  },
  clear: async () => {
    asyncStore.clear();
  },
  getAllKeys: async () => [...asyncStore.keys()],
};

export function makeJournalEntry(overrides: Partial<LocalJournalEntry> & { id: string }): LocalJournalEntry {
  return {
    book: "john",
    chapter: 3,
    verse_start: 16,
    verse_end: null,
    bible_translation: "KJV",
    title: "Test entry",
    content: "<p>Hello migration</p>",
    created_at: "2024-06-01T12:00:00.000Z",
    is_favorite: false,
    ...overrides,
  };
}
