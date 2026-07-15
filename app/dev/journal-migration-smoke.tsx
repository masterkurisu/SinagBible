import { Redirect, Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LocalJournalEntry } from "@sinag-bible/types";
import {
  JOURNAL_LEGACY_BLOB_KEY,
  JOURNAL_MIGRATION_FLAG_KEY,
  dbCount,
  dbSelectAll,
  migrateJournalBlobIfNeeded,
  resetJournalDbStateForTests,
} from "@/lib/journal-db";
import {
  clearLocalEntriesMemoryCache,
  getCachedLocalEntries,
  getLocalEntries,
  replaceAllLocalEntries,
} from "@/lib/journal-local";

function makeSmokeEntry(index: number): LocalJournalEntry {
  return {
    id: `local-smoke-${index}`,
    book: "john",
    chapter: 3,
    verse_start: 16,
    verse_end: null,
    bible_translation: "KJV",
    title: `Smoke entry ${index}`,
    content: `<p>Smoke migration content ${index}</p>`,
    created_at: new Date(Date.UTC(2024, 5, index)).toISOString(),
    is_favorite: index % 2 === 0,
  };
}

function JournalMigrationSmokeContent() {
  const [status, setStatus] = useState("Ready");
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [flag, setFlag] = useState<string | null>(null);
  const [cacheCount, setCacheCount] = useState(0);

  const refresh = useCallback(async () => {
    const [count, migrationFlag] = await Promise.all([
      dbCount(),
      AsyncStorage.getItem(JOURNAL_MIGRATION_FLAG_KEY),
    ]);
    setRowCount(count);
    setFlag(migrationFlag);
    setCacheCount(getCachedLocalEntries().length);
  }, []);

  const runMigration = useCallback(async () => {
    try {
      await migrateJournalBlobIfNeeded();
      await getLocalEntries();
      setStatus("Migration finished");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Migration failed");
      await refresh();
    }
  }, [refresh]);

  const seedBlob = useCallback(async () => {
    const entries = [makeSmokeEntry(1), makeSmokeEntry(2), makeSmokeEntry(3)];
    await AsyncStorage.setItem(JOURNAL_LEGACY_BLOB_KEY, JSON.stringify(entries));
    await AsyncStorage.removeItem(JOURNAL_MIGRATION_FLAG_KEY);
    await resetJournalDbStateForTests();
    clearLocalEntriesMemoryCache();
    setStatus("Seeded legacy blob (3 entries). Run migration next.");
    await refresh();
  }, [refresh]);

  const verifyContent = useCallback(async () => {
    const rows = await dbSelectAll();
    const blobRaw = await AsyncStorage.getItem(JOURNAL_LEGACY_BLOB_KEY);
    if (!blobRaw) {
      setStatus(`No legacy blob; ${rows.length} SQLite row(s)`);
      await refresh();
      return;
    }
    const blobEntries = JSON.parse(blobRaw) as LocalJournalEntry[];
    const blobById = new Map(
      blobEntries.filter((entry) => entry.id.startsWith("local-")).map((entry) => [entry.id, entry]),
    );
    for (const row of rows) {
      const fromBlob = blobById.get(row.id);
      if (fromBlob && JSON.stringify(fromBlob) !== JSON.stringify(row)) {
        setStatus(`Content mismatch for ${row.id}`);
        await refresh();
        return;
      }
    }
    setStatus(`Verified ${rows.length} SQLite row(s); cache=${getCachedLocalEntries().length}`);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const roundtripImport = useCallback(async () => {
    try {
      const exported = await getLocalEntries();
      const real = exported.filter((entry) => !entry.id.includes("sample"));
      await replaceAllLocalEntries(real);
      const after = await getLocalEntries();
      setStatus(`Import roundtrip ok: ${real.length} → ${after.length} entries`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import roundtrip failed");
      await refresh();
    }
  }, [refresh]);

  const simulateDeleteMyDataCaches = useCallback(async () => {
    clearLocalEntriesMemoryCache();
    setStatus(`Cache cleared (count=${getCachedLocalEntries().length}). DB untouched — ghost-entry check.`);
    await refresh();
  }, [refresh]);

  const resetAll = useCallback(() => {
    Alert.alert(
      "Reset journal smoke state",
      "Clears SQLite file, migration flag, legacy blob, and memory cache.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await resetJournalDbStateForTests();
              clearLocalEntriesMemoryCache();
              await AsyncStorage.multiRemove([JOURNAL_MIGRATION_FLAG_KEY, JOURNAL_LEGACY_BLOB_KEY]);
              setStatus("Reset complete");
              await refresh();
            })();
          },
        },
      ],
    );
  }, [refresh]);

  return (
    <>
      <Stack.Screen options={{ title: "Journal Migration Smoke" }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        style={{ flex: 1, backgroundColor: "#f5f0e8" }}
      >
        <Text style={{ fontSize: 16, fontWeight: "600" }}>{status}</Text>
        <Text style={{ fontSize: 13, color: "#444" }}>
          SQLite rows: {rowCount ?? "—"}{"\n"}
          Migration flag: {flag ?? "—"}{"\n"}
          In-memory cache: {cacheCount}
        </Text>

        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {(
            [
              ["Refresh", () => void refresh()],
              ["Seed blob (3)", () => void seedBlob()],
              ["Run migration", () => void runMigration()],
              ["Verify content", () => void verifyContent()],
              ["Import roundtrip", () => void roundtripImport()],
              ["Clear cache only", () => void simulateDeleteMyDataCaches()],
              ["Reset all", () => resetAll()],
            ] as const
          ).map(([label, onPress]) => (
            <Pressable
              key={label}
              onPress={onPress}
              style={{
                backgroundColor: "#5c4a32",
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "#fff" }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={{ fontSize: 13, color: "#444" }}>
          Manual pass: (1) open on a build with real journal data and confirm list + search;
          (2) export backup JSON, reset, import, confirm counts match.
        </Text>
      </ScrollView>
    </>
  );
}

export default function JournalMigrationSmokeScreen() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <JournalMigrationSmokeContent />;
}
