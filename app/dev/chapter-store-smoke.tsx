import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import {
  getChapterDbPath,
  isChapterDbOpen,
  openChapterDb,
} from "@/lib/chapter-db";
import {
  getChapterSync,
  hasChapterSync,
  putChapter,
  purgeTranslation,
  type StoredChapter,
} from "@/lib/chapter-store";

const SMOKE_TRANSLATION_ID = "ENG_ASV";
const SMOKE_BOOK_SLUG = "genesis";
const SMOKE_CHAPTER = 1;

function buildSmokeChapter(): StoredChapter {
  return {
    translationId: SMOKE_TRANSLATION_ID,
    bookSlug: SMOKE_BOOK_SLUG,
    chapterNumber: SMOKE_CHAPTER,
    source: "helloao",
    payload: {
      translationId: SMOKE_TRANSLATION_ID,
      bookId: "GEN",
      chapterNumber: SMOKE_CHAPTER,
      bookName: "Genesis",
      verses: [{ number: 1, text: "Phase 1 smoke-test verse." }],
    },
  };
}

/**
 * Dev-only screen for Phase 1 verification:
 * putChapter → kill app → getChapterSync returns data after cold restart.
 *
 * Route: /dev/chapter-store-smoke
 */
function ChapterStoreSmokeContent() {
  const [status, setStatus] = useState("Opening database…");
  const [dbPath, setDbPath] = useState<string | null>(null);
  const [readResult, setReadResult] = useState<string>("—");

  const refreshRead = useCallback(() => {
    if (!isChapterDbOpen()) {
      setReadResult("DB not open");
      return;
    }

    const exists = hasChapterSync(SMOKE_TRANSLATION_ID, SMOKE_BOOK_SLUG, SMOKE_CHAPTER);
    const chapter = getChapterSync(SMOKE_TRANSLATION_ID, SMOKE_BOOK_SLUG, SMOKE_CHAPTER);
    if (!chapter) {
      setReadResult(exists ? "hasChapterSync=true but getChapterSync=null" : "No row (write first)");
      return;
    }

    setReadResult(JSON.stringify(chapter.payload, null, 2));
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await openChapterDb();
        if (cancelled) return;
        setDbPath(getChapterDbPath());
        setStatus("Database open (SQLCipher)");
        refreshRead();
      } catch (error) {
        if (cancelled) return;
        setStatus(error instanceof Error ? error.message : "Failed to open database");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshRead]);

  const handleWrite = () => {
    try {
      putChapter(buildSmokeChapter());
      setStatus("Wrote smoke chapter — kill app and reopen to verify persistence");
      refreshRead();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Write failed");
    }
  };

  const handlePurge = () => {
    try {
      purgeTranslation(SMOKE_TRANSLATION_ID);
      setStatus("Purged smoke translation");
      refreshRead();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Purge failed");
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Chapter Store Smoke" }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        style={{ flex: 1, backgroundColor: "#f5f0e8" }}
      >
        <Text style={{ fontSize: 16, fontWeight: "600" }}>{status}</Text>
        <Text style={{ fontSize: 13, color: "#444" }}>
          DB path (verify off-device ciphertext):{"\n"}
          {dbPath ?? "—"}
        </Text>

        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Pressable
            onPress={handleWrite}
            style={{
              backgroundColor: "#5c4a32",
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#fff" }}>Write smoke chapter</Text>
          </Pressable>
          <Pressable
            onPress={refreshRead}
            style={{
              backgroundColor: "#8a7355",
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#fff" }}>Read sync</Text>
          </Pressable>
          <Pressable
            onPress={handlePurge}
            style={{
              backgroundColor: "#a04444",
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#fff" }}>Purge</Text>
          </Pressable>
        </View>

        <Text style={{ fontSize: 14, fontWeight: "600" }}>getChapterSync payload</Text>
        <Text selectable style={{ fontFamily: "monospace", fontSize: 12 }}>
          {readResult}
        </Text>
      </ScrollView>
    </>
  );
}

export default function ChapterStoreSmokeScreen() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <ChapterStoreSmokeContent />;
}
