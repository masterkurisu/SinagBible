import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUsfmBookId } from "@sinag-bible/core";
import type { BibleChapter } from "@sinag-bible/types";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { ReaderM3BottomSheet } from "@/src/components/m3/ReaderM3BottomSheet";
import { getReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import { READER_OVERLAY_CONTENT_SCALE } from "@/src/features/reader/readerSettingsPanelChrome";
import {
  COMMENTARY_API_BASE_URL,
  COMMENTARY_DEFAULT_ID,
  COMMENTARY_REQUEST_TIMEOUT_MS,
  COMMENTARY_STORAGE_KEY,
  type CommentaryApiChapterItem,
  filterCommentaryEntriesForVerses,
  flattenCommentaryInline,
  fetchCommentaryChapterEntries,
  fetchWithTimeout,
  isCommentaryRequestAborted,
} from "@/lib/commentary-api";

export type ReaderStudyNotesSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  bundle: MobileAppThemeBundle;
  insets: { top: number; bottom: number; left: number; right: number };
  isTabletReaderLayout: boolean;
  chapter: Pick<BibleChapter, "bookSlug" | "chapterNumber">;
  selectedVerses: number[];
  settingsMutedTextColor: string;
};

export function ReaderStudyNotesSheet({
  isOpen,
  onClose,
  bundle,
  insets,
  isTabletReaderLayout,
  chapter,
  selectedVerses,
  settingsMutedTextColor,
}: ReaderStudyNotesSheetProps) {
  const colors = bundle.ui;
  const primary = bundle.chrome.tabTint;
  const sheetChrome = useMemo(() => getReaderSheetChrome(bundle), [bundle]);
  const scale = READER_OVERLAY_CONTENT_SCALE;

  const [selectedCommentary, setSelectedCommentary] = useState(COMMENTARY_DEFAULT_ID);
  const [commentaryListLoading, setCommentaryListLoading] = useState(false);
  const [commentaryListResolved, setCommentaryListResolved] = useState(false);
  const [commentaryChapterLoading, setCommentaryChapterLoading] = useState(false);
  const [commentaryError, setCommentaryError] = useState<string | null>(null);
  const [commentaryEntries, setCommentaryEntries] = useState<CommentaryApiChapterItem[]>([]);
  const [commentarySelectionReady, setCommentarySelectionReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(COMMENTARY_STORAGE_KEY);
        if (!cancelled && stored?.trim()) {
          setSelectedCommentary(stored.trim());
        }
      } catch {
        // Keep default commentary when storage read fails.
      } finally {
        if (!cancelled) setCommentarySelectionReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!commentarySelectionReady) return;
    void AsyncStorage.setItem(COMMENTARY_STORAGE_KEY, selectedCommentary).catch(() => {
      // Ignore persistence failures; selection still works for this session.
    });
  }, [commentarySelectionReady, selectedCommentary]);

  useEffect(() => {
    if (!isOpen) return;
    if (commentaryListResolved || commentaryListLoading) return;
    const abortController = new AbortController();
    let cancelled = false;
    (async () => {
      setCommentaryListLoading(true);
      try {
        const res = await fetchWithTimeout(
          `${COMMENTARY_API_BASE_URL}/available_commentaries.json`,
          { signal: abortController.signal },
          COMMENTARY_REQUEST_TIMEOUT_MS,
        );
        if (!res.ok) throw new Error(`commentary list HTTP ${res.status}`);
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
          throw new Error("commentary list unexpected content-type");
        }
        const raw = (await res.json()) as
          | { commentaries?: { id?: string; name?: string }[] }
          | { id?: string; name?: string }[];
        const list = Array.isArray(raw) ? raw : Array.isArray(raw.commentaries) ? raw.commentaries : [];
        const normalized = list
          .filter((c) => typeof c.id === "string" && typeof c.name === "string")
          .map((c) => ({ id: c.id!.trim(), name: c.name!.trim() }))
          .filter((c) => c.id.length > 0 && c.name.length > 0);
        if (!isCommentaryRequestAborted(cancelled, abortController.signal) && normalized.length === 0) {
          setCommentaryError("Commentary list unavailable right now.");
        }
      } catch {
        if (!isCommentaryRequestAborted(cancelled, abortController.signal)) {
          setCommentaryError("Unable to load available commentaries right now.");
        }
      } finally {
        if (!isCommentaryRequestAborted(cancelled, abortController.signal)) {
          setCommentaryListLoading(false);
          setCommentaryListResolved(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [isOpen, commentaryListResolved, commentaryListLoading]);

  useEffect(() => {
    if (!isOpen || commentaryListResolved) return;
    const timer = setTimeout(() => {
      setCommentaryListLoading(false);
      setCommentaryListResolved(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isOpen, commentaryListResolved]);

  useEffect(() => {
    if (!isOpen) return;
    const abortController = new AbortController();
    let cancelled = false;
    (async () => {
      setCommentaryChapterLoading(true);
      setCommentaryError(null);
      try {
        const commentaryBookId = getUsfmBookId(chapter.bookSlug);
        if (!commentaryBookId) {
          if (!isCommentaryRequestAborted(cancelled, abortController.signal)) {
            setCommentaryEntries([]);
            setCommentaryError("Study notes are unavailable for this book.");
          }
          return;
        }
        const items = await fetchCommentaryChapterEntries(
          selectedCommentary,
          chapter.bookSlug,
          chapter.chapterNumber,
          abortController.signal,
        );
        if (!isCommentaryRequestAborted(cancelled, abortController.signal)) {
          setCommentaryEntries(items);
        }
      } catch {
        if (!isCommentaryRequestAborted(cancelled, abortController.signal)) {
          setCommentaryEntries([]);
          setCommentaryError("Unable to load this commentary chapter.");
        }
      } finally {
        if (!isCommentaryRequestAborted(cancelled, abortController.signal)) {
          setCommentaryChapterLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [isOpen, selectedCommentary, chapter.bookSlug, chapter.chapterNumber]);

  const filteredCommentaryEntries = useMemo(
    () => filterCommentaryEntriesForVerses(commentaryEntries, selectedVerses),
    [commentaryEntries, selectedVerses],
  );

  const selectedVerseFeedbackLabel = useMemo(() => {
    if (selectedVerses.length === 0) return null;
    const first = selectedVerses[0]!;
    const last = selectedVerses[selectedVerses.length - 1]!;
    if (selectedVerses.length === 1) return `Showing study notes for verse ${first}`;
    if (last - first + 1 === selectedVerses.length) return `Showing study notes for verses ${first}-${last}`;
    return `Showing study notes for ${selectedVerses.length} selected verses`;
  }, [selectedVerses]);

  return (
    <ReaderM3BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      bundle={bundle}
      insets={insets}
      isTabletReaderLayout={isTabletReaderLayout}
      title="Study Notes"
      accessibilityDismissLabel="Dismiss study notes"
      widthVariant="reading"
      maxHeightRatio={0.78}
    >
      {selectedVerseFeedbackLabel ? (
        <View
          style={{
            alignSelf: "flex-start",
            borderRadius: 999,
            backgroundColor: sheetChrome.surfaceContainer,
            paddingHorizontal: 12 * scale,
            paddingVertical: 6 * scale,
            marginBottom: 12 * scale,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 12 * scale,
              color: sheetChrome.onSurfaceVariant,
            }}
          >
            {selectedVerseFeedbackLabel}
          </Text>
        </View>
      ) : null}

      {commentaryChapterLoading && filteredCommentaryEntries.length === 0 ? (
        <View style={{ paddingVertical: 28 * scale, alignItems: "center" }}>
          <ActivityIndicator size="small" color={primary} />
          <Text
            style={{
              marginTop: 10 * scale,
              fontFamily: "Inter_400Regular",
              fontSize: 13 * scale,
              color: settingsMutedTextColor,
            }}
          >
            Loading commentary...
          </Text>
        </View>
      ) : commentaryError ? (
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14 * scale,
            color: settingsMutedTextColor,
            lineHeight: 20 * scale,
          }}
        >
          {commentaryError}
        </Text>
      ) : filteredCommentaryEntries.length === 0 ? (
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14 * scale,
            color: settingsMutedTextColor,
            lineHeight: 20 * scale,
          }}
        >
          {selectedVerses.length > 0
            ? "No study notes are available for the selected verse(s) in this chapter."
            : "No commentary is available for this chapter in the selected study notes."}
        </Text>
      ) : (
        filteredCommentaryEntries.map((entry, index) => {
          if (entry.type === "line_break") return <View key={`break-${index}`} style={{ height: 10 * scale }} />;
          const text = flattenCommentaryInline("content" in entry ? entry.content : undefined);
          if (!text) return null;
          if (entry.type === "heading" || entry.type === "hebrew_subtitle") {
            return (
              <Text
                key={`heading-${index}`}
                style={{
                  fontFamily: "Lora_400Regular",
                  fontSize: 17 * scale,
                  color: sheetChrome.onSurface,
                  marginTop: index === 0 ? 0 : 8 * scale,
                  marginBottom: 6 * scale,
                }}
              >
                {text}
              </Text>
            );
          }
          if (entry.type === "verse") {
            return (
              <Text
                key={`verse-${entry.number ?? index}`}
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 15 * scale,
                  color: sheetChrome.onSurface,
                  lineHeight: 24 * scale,
                  marginBottom: 8 * scale,
                }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", color: primary }}>
                  {typeof entry.number === "number" ? `${entry.number} ` : ""}
                </Text>
                {text}
              </Text>
            );
          }
          return (
            <Text
              key={`item-${index}`}
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 15 * scale,
                color: colors.brown800,
                lineHeight: 24 * scale,
                marginBottom: 8 * scale,
              }}
            >
              {text}
            </Text>
          );
        })
      )}
    </ReaderM3BottomSheet>
  );
}
