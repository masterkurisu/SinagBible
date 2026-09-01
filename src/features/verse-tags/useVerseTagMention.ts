import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  NativeSyntheticEvent,
  TextInput,
  TextInputKeyPressEventData,
  TextInputSelectionChangeEvent,
} from "react-native";
import type { VerseTagRef } from "@sinag-bible/types";
import { getActiveVerseTagMention, insertVerseTagAtMention } from "@sinag-bible/core/verse-tags";
import { getJournalChapter } from "@/lib/journal-verse-preview";
import {
  searchVerseTagSuggestions,
  type VerseTagSuggestion,
} from "@/src/features/verse-tags/searchVerseTagSuggestions";
import {
  createVerseTagComposer,
  type VerseTagComposerError,
  type VerseTagComposerPhase,
  type VerseTagComposerResult,
} from "@/src/features/verse-tags/verseTagComposer";
import {
  createVerseTagChapterCache,
  resolveVerseTagPrefetchTarget,
} from "@/src/features/verse-tags/verseTagChapterCache";

export type UseVerseTagMentionOptions = {
  text: string;
  onChangeText: (text: string) => void;
  contextTranslation?: string;
};

export type UseVerseTagMentionResult = {
  mentionOpen: boolean;
  mentionQuery: string;
  mentionError: VerseTagComposerError | null;
  composerPhase: VerseTagComposerPhase;
  suggestions: VerseTagSuggestion[];
  suggestionsPending: boolean;
  selectedSuggestionIndex: number;
  sheetOpen: boolean;
  selection: { start: number; end: number };
  inputRef: React.RefObject<TextInput | null>;
  handleChangeText: (next: string) => void;
  handleSelectionChange: (event: TextInputSelectionChangeEvent) => void;
  handleKeyPress: (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => void;
  handleBlur: () => void;
  insertTag: (ref: VerseTagRef) => void;
  confirmSuggestion: (item: VerseTagSuggestion) => void;
  beginSuggestionPick: () => void;
  openMentionSheet: () => void;
  closeMention: () => void;
};

function nextCursorAfterEdit(
  prevText: string,
  nextText: string,
  selection: { start: number; end: number },
): number {
  if (selection.start === selection.end) {
    const delta = nextText.length - prevText.length;
    return Math.max(0, Math.min(nextText.length, selection.end + delta));
  }
  return Math.max(0, Math.min(nextText.length, selection.end));
}

function replaceMentionBuffer(
  text: string,
  cursorIndex: number,
  nextBuffer: string,
): { text: string; cursorIndex: number } {
  const mention = getActiveVerseTagMention(text, cursorIndex);
  if (!mention) return { text, cursorIndex };
  const nextText = text.slice(0, mention.atIndex + 1) + nextBuffer + text.slice(cursorIndex);
  return { text: nextText, cursorIndex: mention.atIndex + 1 + nextBuffer.length };
}

export function useVerseTagMention({
  text,
  onChangeText,
  contextTranslation = "KJV",
}: UseVerseTagMentionOptions): UseVerseTagMentionResult {
  const inputRef = useRef<TextInput | null>(null);
  const textRef = useRef(text);
  const selectionRef = useRef({ start: text.length, end: text.length });
  const pickingRef = useRef(false);
  const cacheRef = useRef(createVerseTagChapterCache());
  const inflightPrefetch = useRef(new Set<string>());
  const translation = contextTranslation.trim() || "KJV";

  const composerRef = useRef(
    createVerseTagComposer({
      translation,
      getVerseCount: (bookSlug, chapter) => cacheRef.current.get(translation, bookSlug, chapter),
    }),
  );

  const [selection, setSelection] = useState({ start: text.length, end: text.length });
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionError, setMentionError] = useState<VerseTagComposerError | null>(null);
  const [composerPhase, setComposerPhase] = useState<VerseTagComposerPhase>("idle");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<VerseTagSuggestion[]>([]);
  const [suggestionsPending, setSuggestionsPending] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    composerRef.current = createVerseTagComposer({
      translation,
      getVerseCount: (bookSlug, chapter) => cacheRef.current.get(translation, bookSlug, chapter),
    });
  }, [translation]);

  const applyResult = useCallback((result: VerseTagComposerResult) => {
    setComposerPhase(result.state.phase);
    setMentionQuery(result.state.buffer);
    setMentionError(result.state.error);
    const open = result.state.phase !== "idle";
    setMentionOpen(open);
    if (!open) {
      setSuggestions([]);
      setSuggestionsPending(false);
      setSelectedSuggestionIndex(0);
    }
    return result;
  }, []);

  const prefetchChapter = useCallback(
    async (slug: string, chapter: number) => {
      if (cacheRef.current.has(translation, slug, chapter)) return;
      const key = `${translation}:${slug}:${chapter}`;
      if (inflightPrefetch.current.has(key)) return;
      inflightPrefetch.current.add(key);
      try {
        const data = await getJournalChapter(translation, slug, chapter);
        cacheRef.current.set(translation, slug, chapter, data ? data.verses.length : null);
        const cursor = selectionRef.current.end;
        const replay = composerRef.current.push({
          type: "change",
          text: textRef.current,
          cursorIndex: cursor,
        });
        applyResult(replay);
      } finally {
        inflightPrefetch.current.delete(key);
      }
    },
    [applyResult, translation],
  );

  const maybePrefetch = useCallback(
    (result: VerseTagComposerResult) => {
      const target = resolveVerseTagPrefetchTarget(
        result.state.confirmedBook,
        result.state.chapter,
        result.commit,
      );
      if (!target) return;
      void prefetchChapter(target.slug, target.chapter);
    },
    [prefetchChapter],
  );

  const applyText = useCallback(
    (nextText: string, cursorIndex: number) => {
      textRef.current = nextText;
      onChangeText(nextText);
      selectionRef.current = { start: cursorIndex, end: cursorIndex };
      setSelection(selectionRef.current);
    },
    [onChangeText],
  );

  const handleChangeText = useCallback(
    (next: string) => {
      const cursor = nextCursorAfterEdit(textRef.current, next, selectionRef.current);
      textRef.current = next;
      const result = composerRef.current.push({ type: "change", text: next, cursorIndex: cursor });
      if (result.commit) {
        applyText(result.commit.text, result.commit.cursorIndex);
        applyResult(result);
        return;
      }
      onChangeText(next);
      applyResult(result);
      maybePrefetch(result);
    },
    [applyResult, applyText, maybePrefetch, onChangeText],
  );

  const handleSelectionChange = useCallback(
    (event: TextInputSelectionChangeEvent) => {
      const next = event.nativeEvent.selection;
      selectionRef.current = next;
      setSelection(next);
      const result = composerRef.current.push({
        type: "change",
        text: textRef.current,
        cursorIndex: next.end,
      });
      if (result.commit) {
        applyText(result.commit.text, result.commit.cursorIndex);
      }
      applyResult(result);
      maybePrefetch(result);
    },
    [applyResult, applyText, maybePrefetch],
  );

  const closeOverlay = useCallback(() => {
    const result = composerRef.current.push({
      type: "escape",
      text: textRef.current,
      cursorIndex: selectionRef.current.end,
    });
    applyResult(result);
  }, [applyResult]);

  const insertTag = useCallback(
    (ref: VerseTagRef) => {
      pickingRef.current = true;
      const cursorIndex = selectionRef.current.end;
      const next = insertVerseTagAtMention(textRef.current, cursorIndex, ref, translation);
      const spaced =
        next.text[next.cursorIndex] === " "
          ? next
          : { text: `${next.text} `, cursorIndex: next.cursorIndex + 1 };
      applyText(spaced.text, spaced.cursorIndex);
      applyResult(
        composerRef.current.push({
          type: "escape",
          text: spaced.text,
          cursorIndex: spaced.cursorIndex,
        }),
      );
      setSheetOpen(false);
      pickingRef.current = false;
    },
    [applyResult, applyText, translation],
  );

  const confirmSuggestion = useCallback(
    (item: VerseTagSuggestion) => {
      pickingRef.current = true;
      if (item.kind === "ref") {
        insertTag(item.ref);
        return;
      }

      const replaced = replaceMentionBuffer(
        textRef.current,
        selectionRef.current.end,
        `${item.label} `,
      );
      applyText(replaced.text, replaced.cursorIndex);
      const result = composerRef.current.push({
        type: "change",
        text: replaced.text,
        cursorIndex: replaced.cursorIndex,
      });
      applyResult(result);
      maybePrefetch(result);
      pickingRef.current = false;
    },
    [applyResult, applyText, insertTag, maybePrefetch],
  );

  const handleKeyPress = useCallback(
    (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (!mentionOpen) return;
      const key = event.nativeEvent.key;
      if (key === "Escape") {
        event.preventDefault?.();
        closeOverlay();
        return;
      }
      if (key === "ArrowDown") {
        event.preventDefault?.();
        setSelectedSuggestionIndex((index) =>
          suggestions.length === 0 ? 0 : Math.min(index + 1, suggestions.length - 1),
        );
        return;
      }
      if (key === "ArrowUp") {
        event.preventDefault?.();
        setSelectedSuggestionIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (key === "Enter") {
        event.preventDefault?.();
        const selected = suggestions[selectedSuggestionIndex];
        if (selected) {
          confirmSuggestion(selected);
          return;
        }
        const result = composerRef.current.push({
          type: "commit",
          text: textRef.current,
          cursorIndex: selectionRef.current.end,
        });
        if (result.commit) {
          applyText(result.commit.text, result.commit.cursorIndex);
        }
        applyResult(result);
        maybePrefetch(result);
      }
    },
    [
      applyResult,
      applyText,
      closeOverlay,
      confirmSuggestion,
      maybePrefetch,
      mentionOpen,
      selectedSuggestionIndex,
      suggestions,
    ],
  );

  const beginSuggestionPick = useCallback(() => {
    pickingRef.current = true;
  }, []);

  const handleBlur = useCallback(() => {
    if (pickingRef.current) return;
    const result = composerRef.current.push({
      type: "blur",
      text: textRef.current,
      cursorIndex: selectionRef.current.end,
    });
    if (result.commit) {
      applyText(result.commit.text, result.commit.cursorIndex);
    }
    applyResult(result);
  }, [applyResult, applyText]);

  const openMentionSheet = useCallback(() => {
    setSheetOpen(true);
  }, []);

  const closeMention = useCallback(() => {
    setSheetOpen(false);
    closeOverlay();
  }, [closeOverlay]);

  useEffect(() => {
    if (!mentionOpen) {
      setSuggestions([]);
      setSuggestionsPending(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setSuggestionsPending(true);
        try {
          const next = await searchVerseTagSuggestions(mentionQuery, translation);
          if (!cancelled) {
            setSuggestions(next);
            setSelectedSuggestionIndex(0);
          }
        } finally {
          if (!cancelled) setSuggestionsPending(false);
        }
      })();
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mentionOpen, mentionQuery, translation]);

  return useMemo(
    () => ({
      mentionOpen,
      mentionQuery,
      mentionError,
      composerPhase,
      suggestions,
      suggestionsPending,
      selectedSuggestionIndex,
      sheetOpen,
      selection,
      inputRef,
      handleChangeText,
      handleSelectionChange,
      handleKeyPress,
      handleBlur,
      insertTag,
      confirmSuggestion,
      beginSuggestionPick,
      openMentionSheet,
      closeMention,
    }),
    [
      closeMention,
      composerPhase,
      confirmSuggestion,
      beginSuggestionPick,
      handleBlur,
      handleChangeText,
      handleKeyPress,
      handleSelectionChange,
      insertTag,
      mentionError,
      mentionOpen,
      mentionQuery,
      openMentionSheet,
      selectedSuggestionIndex,
      selection,
      sheetOpen,
      suggestions,
      suggestionsPending,
    ],
  );
}
