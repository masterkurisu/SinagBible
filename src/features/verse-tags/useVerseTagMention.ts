import { useCallback, useEffect, useRef, useState } from "react";
import type { TextInput, TextInputSelectionChangeEvent } from "react-native";
import type { VerseTagRef } from "@sinag-bible/types";
import {
  extractActiveVerseTagMention,
  insertVerseTagAtMention,
  isVerseTagMentionTrigger,
} from "@sinag-bible/core";

export type UseVerseTagMentionOptions = {
  text: string;
  onChangeText: (text: string) => void;
  contextTranslation?: string;
};

export type UseVerseTagMentionResult = {
  mentionOpen: boolean;
  mentionQuery: string;
  selection: { start: number; end: number };
  inputRef: React.RefObject<TextInput | null>;
  handleChangeText: (next: string) => void;
  handleSelectionChange: (event: TextInputSelectionChangeEvent) => void;
  insertTag: (ref: VerseTagRef) => void;
  openMentionSheet: () => void;
  closeMention: () => void;
};

export function useVerseTagMention({
  text,
  onChangeText,
  contextTranslation,
}: UseVerseTagMentionOptions): UseVerseTagMentionResult {
  const inputRef = useRef<TextInput | null>(null);
  const textRef = useRef(text);
  const selectionRef = useRef({ start: text.length, end: text.length });
  const [selection, setSelection] = useState({ start: text.length, end: text.length });
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const evaluateMention = useCallback((nextText: string, cursorIndex: number) => {
    if (isVerseTagMentionTrigger(nextText, cursorIndex)) {
      setMentionOpen(true);
      setMentionQuery(extractActiveVerseTagMention(nextText, cursorIndex) ?? "");
      return;
    }

    const activeQuery = extractActiveVerseTagMention(nextText, cursorIndex);
    if (activeQuery !== null) {
      setMentionOpen(true);
      setMentionQuery(activeQuery);
      return;
    }

    setMentionOpen(false);
    setMentionQuery("");
  }, []);

  const handleChangeText = useCallback(
    (next: string) => {
      textRef.current = next;
      onChangeText(next);
      evaluateMention(next, selectionRef.current.end);
    },
    [evaluateMention, onChangeText],
  );

  const handleSelectionChange = useCallback(
    (event: TextInputSelectionChangeEvent) => {
      const next = event.nativeEvent.selection;
      selectionRef.current = next;
      setSelection(next);
      evaluateMention(textRef.current, next.end);
    },
    [evaluateMention],
  );

  const insertTag = useCallback(
    (ref: VerseTagRef) => {
      const cursorIndex = selectionRef.current.end;
      const result = insertVerseTagAtMention(
        textRef.current,
        cursorIndex,
        ref,
        contextTranslation,
      );
      textRef.current = result.text;
      onChangeText(result.text);
      selectionRef.current = { start: result.cursorIndex, end: result.cursorIndex };
      setSelection(selectionRef.current);
      setMentionOpen(false);
      setMentionQuery("");
    },
    [contextTranslation, onChangeText],
  );

  const openMentionSheet = useCallback(() => {
    setMentionOpen(true);
    setMentionQuery(extractActiveVerseTagMention(textRef.current, selectionRef.current.end) ?? "");
  }, []);

  const closeMention = useCallback(() => {
    setMentionOpen(false);
    setMentionQuery("");
  }, []);

  return {
    mentionOpen,
    mentionQuery,
    selection,
    inputRef,
    handleChangeText,
    handleSelectionChange,
    insertTag,
    openMentionSheet,
    closeMention,
  };
}
