import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUsfmBookId } from "@sinag-bible/core";
import type { BibleChapter } from "@sinag-bible/types";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { ReaderM3BottomSheet } from "@/src/components/m3/ReaderM3BottomSheet";
import {
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
  READER_M3_SURFACE_CONTAINER,
} from "@/src/features/reader/readerSettingsPanelChrome";

const COMMENTARY_STORAGE_KEY = "selectedCommentary";
const COMMENTARY_DEFAULT_ID = "tyndale";
const COMMENTARY_API_BASE_URL = "https://bible.helloao.org/api";
const COMMENTARY_REQUEST_TIMEOUT_MS = 10000;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = COMMENTARY_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("request timeout")), timeoutMs);
  });
  try {
    const response = await Promise.race([fetch(input, init), timeoutPromise]);
    return response as Response;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

type CommentaryApiInlineItem = string | { text?: string; content?: CommentaryApiInlineItem[] };
type CommentaryApiChapterItem =
  | { type: "heading"; content?: CommentaryApiInlineItem[] }
  | { type: "verse"; number?: number; content?: CommentaryApiInlineItem[] }
  | { type: "line_break" }
  | { type: "hebrew_subtitle"; content?: CommentaryApiInlineItem[] }
  | { type: string; content?: CommentaryApiInlineItem[]; number?: number };

type CommentaryApiChapterResponse = {
  chapter?: {
    content?: CommentaryApiChapterItem[];
  };
};

function flattenCommentaryInline(items: CommentaryApiInlineItem[] | undefined): string {
  if (!items || items.length === 0) return "";
  return items
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item.text === "string") return item.text;
      if (Array.isArray(item.content)) return flattenCommentaryInline(item.content);
      return "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

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
  const scale = isTabletReaderLayout ? 1.35 : 1;

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
    let cancelled = false;
    (async () => {
      setCommentaryListLoading(true);
      try {
        const res = await fetchWithTimeout(
          `${COMMENTARY_API_BASE_URL}/available_commentaries.json`,
          undefined,
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
        if (!cancelled && normalized.length === 0) {
          setCommentaryError("Commentary list unavailable right now.");
        }
      } catch {
        if (!cancelled) {
          setCommentaryError("Unable to load available commentaries right now.");
        }
      } finally {
        if (!cancelled) {
          setCommentaryListLoading(false);
          setCommentaryListResolved(true);
        }
      }
    })();
    return () => {
      cancelled = true;
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
    let cancelled = false;
    (async () => {
      setCommentaryChapterLoading(true);
      setCommentaryError(null);
      try {
        const commentaryBookId = getUsfmBookId(chapter.bookSlug);
        if (!commentaryBookId) {
          if (!cancelled) {
            setCommentaryEntries([]);
            setCommentaryError("Study notes are unavailable for this book.");
          }
          return;
        }
        const url = `${COMMENTARY_API_BASE_URL}/c/${encodeURIComponent(selectedCommentary)}/${encodeURIComponent(commentaryBookId)}/${chapter.chapterNumber}.json`;
        const res = await fetchWithTimeout(url, undefined, COMMENTARY_REQUEST_TIMEOUT_MS);
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) setCommentaryEntries([]);
            return;
          }
          throw new Error(`commentary chapter HTTP ${res.status}`);
        }
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
          throw new Error("commentary chapter unexpected content-type");
        }
        const raw = (await res.json()) as CommentaryApiChapterResponse;
        const items = Array.isArray(raw.chapter?.content) ? raw.chapter.content : [];
        if (!cancelled) setCommentaryEntries(items);
      } catch {
        if (!cancelled) {
          setCommentaryEntries([]);
          setCommentaryError("Unable to load this commentary chapter.");
        }
      } finally {
        if (!cancelled) setCommentaryChapterLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedCommentary, chapter.bookSlug, chapter.chapterNumber]);

  const filteredCommentaryEntries = useMemo(() => {
    if (selectedVerses.length === 0) return commentaryEntries;
    const selectedSet = new Set(selectedVerses);
    const output: CommentaryApiChapterItem[] = [];
    let pendingHeading: CommentaryApiChapterItem | null = null;
    let previousWasSelectedVerse = false;
    for (const entry of commentaryEntries) {
      if (entry.type === "heading" || entry.type === "hebrew_subtitle") {
        pendingHeading = entry;
        previousWasSelectedVerse = false;
        continue;
      }
      if (entry.type === "verse") {
        const selected = typeof entry.number === "number" && selectedSet.has(entry.number);
        if (selected) {
          if (pendingHeading) {
            output.push(pendingHeading);
            pendingHeading = null;
          }
          output.push(entry);
        }
        previousWasSelectedVerse = selected;
        continue;
      }
      if (entry.type === "line_break") {
        if (previousWasSelectedVerse) output.push(entry);
        continue;
      }
      if (previousWasSelectedVerse) output.push(entry);
    }
    return output;
  }, [commentaryEntries, selectedVerses]);

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
      maxHeightRatio={0.78}
    >
      {selectedVerseFeedbackLabel ? (
        <View
          style={{
            alignSelf: "flex-start",
            borderRadius: 999,
            backgroundColor: READER_M3_SURFACE_CONTAINER,
            paddingHorizontal: 12 * scale,
            paddingVertical: 6 * scale,
            marginBottom: 12 * scale,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 12 * scale,
              color: READER_M3_ON_SURFACE_VARIANT,
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
                  color: READER_M3_ON_SURFACE,
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
                  color: READER_M3_ON_SURFACE,
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
