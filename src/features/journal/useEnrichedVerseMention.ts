import { useCallback, useEffect, useRef, useState } from "react";
import type { EnrichedTextInputInstance } from "react-native-enriched-html";
import type { VerseTagRef } from "@sinag-bible/types";
import { verseTagToEnrichedMention } from "@/lib/journal-reflection-enriched-mapping";
import {
  searchVerseTagSuggestions,
  type VerseTagSuggestion,
} from "@/src/features/verse-tags/searchVerseTagSuggestions";

type Options = {
  enabled: boolean;
  translationId: string;
  getEditor: () => EnrichedTextInputInstance | null;
};

/**
 * Reuses the verse-tag suggestion sheet/overlay against Enriched `startMention` /
 * `setMention` (0b attributes: data-verse-ref + data-translation). Does not rebuild
 * the markdown composer used by `MarkdownTextInput`.
 */
export function useEnrichedVerseMention({ enabled, translationId, getEditor }: Options) {
  const pickingRef = useRef(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [suggestions, setSuggestions] = useState<VerseTagSuggestion[]>([]);
  const [suggestionsPending, setSuggestionsPending] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

  useEffect(() => {
    if (!enabled || !mentionOpen) {
      setSuggestions([]);
      setSuggestionsPending(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setSuggestionsPending(true);
        try {
          const next = await searchVerseTagSuggestions(mentionQuery, translationId);
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
  }, [enabled, mentionOpen, mentionQuery, translationId]);

  const beginSuggestionPick = useCallback(() => {
    pickingRef.current = true;
  }, []);

  const releaseSuggestionPick = useCallback(() => {
    setTimeout(() => {
      pickingRef.current = false;
    }, 0);
  }, []);

  const closeMention = useCallback(() => {
    setMentionOpen(false);
    setMentionQuery("");
    setSuggestions([]);
  }, []);

  const handleStartMention = useCallback((indicator: string) => {
    if (!enabled || indicator !== "@") return;
    setMentionOpen(true);
    setMentionQuery("");
  }, [enabled]);

  const handleChangeMention = useCallback(
    (event: { indicator: string; text: string }) => {
      if (!enabled || event.indicator !== "@") return;
      setMentionOpen(true);
      setMentionQuery(event.text);
    },
    [enabled],
  );

  const handleEndMention = useCallback(() => {
    if (pickingRef.current) return;
    closeMention();
  }, [closeMention]);

  const insertVerseMention = useCallback(
    (ref: VerseTagRef, alreadyActive = false) => {
      const editor = getEditor();
      if (!editor) return;
      const mention = verseTagToEnrichedMention(ref, translationId);
      pickingRef.current = true;
      editor.focus();
      if (!alreadyActive) editor.startMention("@");
      editor.setMention("@", mention.text, mention.attributes);
      closeMention();
      releaseSuggestionPick();
    },
    [closeMention, getEditor, releaseSuggestionPick, translationId],
  );

  const confirmSuggestion = useCallback(
    (item: VerseTagSuggestion) => {
      if (item.kind === "query") {
        setMentionQuery(item.query);
        return;
      }
      insertVerseMention(item.ref, true);
    },
    [insertVerseMention],
  );

  return {
    mentionOpen: enabled && mentionOpen,
    mentionQuery,
    suggestions,
    suggestionsPending,
    selectedSuggestionIndex,
    beginSuggestionPick,
    closeMention,
    handleStartMention,
    handleChangeMention,
    handleEndMention,
    confirmSuggestion,
    insertVerseMention,
  };
}
