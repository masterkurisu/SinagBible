import { Redirect, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { dbSelectAll } from "@/lib/journal-db";
import { censusJournalReflectionRows } from "@/lib/journal-reflection-census";

/**
 * Phase 0 census — count null/empty content_markdown and nested-list HTML
 * on the local journal DB. Route: /dev/journal-census
 */
function JournalCensusContent() {
  const [status, setStatus] = useState("Ready");
  const [report, setReport] = useState<string>("—");

  const run = useCallback(async () => {
    try {
      setStatus("Querying…");
      const rows = await dbSelectAll();
      const census = censusJournalReflectionRows(rows);
      const nastyLines =
        census.otherNasties.length === 0
          ? "other nasties: none"
          : census.otherNasties
              .map((row) => `  ${row.id}: ${row.tags.join(", ")}`)
              .join("\n");
      setReport(
        [
          `total rows: ${census.totalRows}`,
          `content_markdown null or empty: ${census.nullOrEmptyMarkdown}`,
          `nested-list HTML (legacy router): ${census.nestedListHtml}`,
          nastyLines,
        ].join("\n"),
      );
      setStatus("Done");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Census failed");
    }
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: "Journal census" }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
        <Text style={{ fontSize: 14, lineHeight: 20, color: "#444" }}>
          Phase 0 census against the on-device journal DB. Run before treating the
          shadow table / per-row router as load-bearing.
        </Text>
        <Pressable
          onPress={() => void run()}
          style={{ backgroundColor: "#3d2b1f", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6 }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Run census</Text>
        </Pressable>
        <Text style={{ fontSize: 13, color: "#666" }}>{status}</Text>
        <Text style={{ fontSize: 13, fontFamily: "monospace", color: "#222" }}>{report}</Text>
      </ScrollView>
    </>
  );
}

export default function JournalCensusScreen() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  return <JournalCensusContent />;
}
