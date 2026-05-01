import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import { formatSelectedReference } from "@sinag-bible/core";
import type { HighlightColor } from "@sinag-bible/types";
import { hapticLightImpact, hapticMediumImpact, hapticSelection } from "@/lib/haptics";

export function useReaderSelection({
  chapter,
  resolvedTranslationId,
  highlights,
  notes,
  removeHighlightsFromVerses,
  applyHighlightToVerses,
  persistNoteForVerse,
  bookSlug,
  chapterNumber,
  requestedTranslationId,
  toolsMenuOpen,
  closeToolsMenu,
}: {
  chapter: { bookName: string; chapterNumber: number; verses: readonly string[]; bookSlug: string } | null;
  resolvedTranslationId: string | undefined;
  highlights: Record<number, HighlightColor | undefined>;
  notes: Record<number, string | undefined>;
  removeHighlightsFromVerses: (verses: number[]) => void;
  applyHighlightToVerses: (verses: number[], color: HighlightColor) => void;
  persistNoteForVerse: (verse: number, text: string) => void;
  bookSlug: string | undefined;
  chapterNumber: number;
  requestedTranslationId: string;
  toolsMenuOpen: boolean;
  closeToolsMenu: () => void;
}) {
  const [selectedVerseNumbers, setSelectedVerseNumbers] = useState<Set<number>>(() => new Set());
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteTargetVerse, setNoteTargetVerse] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [actionBarMode, setActionBarMode] = useState<"default" | "highlight">("default");
  const suppressNextVerseTapRef = useRef<number | null>(null);
  const [pickedHighlightColor, setPickedHighlightColor] = useState<HighlightColor>("yellow");
  const [copyToastVisible, setCopyToastVisible] = useState(false);

  const clearVerseSelection = useCallback(() => {
    setSelectedVerseNumbers(new Set());
  }, []);

  const toggleVerseSelection = useCallback(
    (verseNumber: number) => {
      if (toolsMenuOpen) closeToolsMenu();
      setSelectedVerseNumbers((current) => {
        const next = new Set(current);
        if (next.has(verseNumber)) next.delete(verseNumber);
        else next.add(verseNumber);
        return next;
      });
    },
    [toolsMenuOpen, closeToolsMenu],
  );

  const handleVerseTap = useCallback(
    (verseNumber: number) => {
      if (suppressNextVerseTapRef.current === verseNumber) {
        suppressNextVerseTapRef.current = null;
        return;
      }
      hapticSelection();
      toggleVerseSelection(verseNumber);
    },
    [toggleVerseSelection],
  );

  const handleVerseLongPress = useCallback(
    (verseNumber: number) => {
      hapticMediumImpact();
      if (highlights[verseNumber]) {
        removeHighlightsFromVerses([verseNumber]);
      } else {
        applyHighlightToVerses([verseNumber], pickedHighlightColor);
      }
      suppressNextVerseTapRef.current = verseNumber;
    },
    [applyHighlightToVerses, highlights, pickedHighlightColor, removeHighlightsFromVerses],
  );

  useEffect(() => {
    setSelectedVerseNumbers(new Set());
    setNoteModalVisible(false);
    setNoteTargetVerse(null);
    setNoteDraft("");
    setActionBarMode("default");
  }, [bookSlug, chapterNumber, requestedTranslationId]);

  useEffect(() => {
    if (!copyToastVisible) return;
    const t = setTimeout(() => setCopyToastVisible(false), 2200);
    return () => clearTimeout(t);
  }, [copyToastVisible]);

  const selectedVerses = useMemo(
    () => Array.from(selectedVerseNumbers).sort((a, b) => a - b),
    [selectedVerseNumbers],
  );

  const copySelectedVerses = useCallback(async () => {
    const ch = chapter;
    const tid = resolvedTranslationId;
    if (!ch || !tid || selectedVerses.length === 0) return;
    const refBase = formatSelectedReference(ch.bookName, ch.chapterNumber, selectedVerses);
    const refLine = `${refBase} (${tid})`;
    const text = selectedVerses
      .map((n) => ch.verses[n - 1])
      .filter(Boolean)
      .join(" ");
    try {
      await Clipboard.setStringAsync(`${refLine}\n${text}`);
      hapticLightImpact();
      setCopyToastVisible(true);
      clearVerseSelection();
    } catch {
      Alert.alert("Copy failed", "Could not copy to the clipboard.");
    }
  }, [chapter, resolvedTranslationId, selectedVerses, clearVerseSelection]);

  const removeHighlightsFromSelection = useCallback(() => {
    if (selectedVerses.length === 0) return;
    removeHighlightsFromVerses(selectedVerses);
    setActionBarMode("default");
    clearVerseSelection();
  }, [removeHighlightsFromVerses, selectedVerses, clearVerseSelection]);

  const applyPickedHighlightToSelection = useCallback(() => {
    if (selectedVerses.length === 0) return;
    applyHighlightToVerses(selectedVerses, pickedHighlightColor);
    setActionBarMode("default");
    clearVerseSelection();
  }, [
    applyHighlightToVerses,
    pickedHighlightColor,
    selectedVerses,
    clearVerseSelection,
  ]);

  const openNoteForSelection = useCallback(() => {
    if (selectedVerses.length === 0) return;
    const last = selectedVerses[selectedVerses.length - 1]!;
    setNoteTargetVerse(last);
    setNoteDraft(notes[last] ?? "");
    setNoteModalVisible(true);
  }, [selectedVerses, notes]);

  const saveNoteFromModal = useCallback(() => {
    const verse = noteTargetVerse;
    if (verse == null) return;
    persistNoteForVerse(verse, noteDraft.trim());
    setNoteModalVisible(false);
    setNoteTargetVerse(null);
    setNoteDraft("");
    clearVerseSelection();
  }, [noteTargetVerse, noteDraft, persistNoteForVerse, clearVerseSelection]);

  return {
    selectedVerseNumbers,
    setSelectedVerseNumbers,
    noteModalVisible,
    setNoteModalVisible,
    noteTargetVerse,
    setNoteTargetVerse,
    noteDraft,
    setNoteDraft,
    actionBarMode,
    setActionBarMode,
    suppressNextVerseTapRef,
    pickedHighlightColor,
    setPickedHighlightColor,
    copyToastVisible,
    setCopyToastVisible,
    clearVerseSelection,
    toggleVerseSelection,
    handleVerseTap,
    handleVerseLongPress,
    selectedVerses,
    copySelectedVerses,
    removeHighlightsFromSelection,
    applyPickedHighlightToSelection,
    openNoteForSelection,
    saveNoteFromModal,
  };
}
