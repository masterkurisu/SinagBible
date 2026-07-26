import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import { formatSelectedReference } from "@sinag-bible/core";
import {
  DEFAULT_VERSE_ANNOTATION,
  type VerseAnnotation,
} from "@sinag-bible/types";
import { hapticLightImpact, hapticMediumImpact, hapticSelection } from "@/lib/haptics";
import {
  loadReaderAnnotationPrefs,
  persistReaderAnnotationPrefs,
} from "@/lib/reader-annotation-prefs";
import { getTranslationDisplayAbbreviation } from "@/lib/translation-display-label";
import type { TranslationPickerItem } from "@/lib/use-translation-picker";

export function useReaderSelection({
  chapter,
  resolvedTranslationId,
  annotations,
  notes,
  removeAnnotationsFromVerses,
  applyAnnotationToVerses,
  persistNoteForVerse,
  bookSlug,
  chapterNumber,
  requestedTranslationId,
  translationPickerItems,
  toolsMenuOpen,
  closeToolsMenu,
}: {
  chapter: { bookName: string; chapterNumber: number; verses: readonly string[]; bookSlug: string } | null;
  resolvedTranslationId: string | undefined;
  annotations: Record<number, VerseAnnotation | undefined>;
  notes: Record<number, string | undefined>;
  removeAnnotationsFromVerses: (verses: number[]) => void;
  applyAnnotationToVerses: (verses: number[], annotation: VerseAnnotation) => void;
  persistNoteForVerse: (verse: number, text: string) => void;
  bookSlug: string | undefined;
  chapterNumber: number;
  requestedTranslationId: string;
  translationPickerItems?: readonly TranslationPickerItem[];
  toolsMenuOpen: boolean;
  closeToolsMenu: () => void;
}) {
  const [selectedVerseNumbers, setSelectedVerseNumbers] = useState<Set<number>>(() => new Set());
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteTargetVerse, setNoteTargetVerse] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [annotationSheetOpen, setAnnotationSheetOpen] = useState(false);
  const [lastUsedAnnotation, setLastUsedAnnotation] = useState<VerseAnnotation>(DEFAULT_VERSE_ANNOTATION);
  const suppressNextVerseTapRef = useRef<number | null>(null);
  const [copyToastVisible, setCopyToastVisible] = useState(false);

  useEffect(() => {
    void loadReaderAnnotationPrefs().then(setLastUsedAnnotation);
  }, []);

  const clearVerseSelection = useCallback(() => {
    setSelectedVerseNumbers(new Set());
  }, []);

  const dismissVerseSelectionMode = useCallback(() => {
    setSelectedVerseNumbers(new Set());
    setNoteModalVisible(false);
    setNoteTargetVerse(null);
    setNoteDraft("");
    setAnnotationSheetOpen(false);
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
      if (annotations[verseNumber]) {
        removeAnnotationsFromVerses([verseNumber]);
      } else {
        applyAnnotationToVerses([verseNumber], lastUsedAnnotation);
        persistReaderAnnotationPrefs(lastUsedAnnotation);
      }
      suppressNextVerseTapRef.current = verseNumber;
    },
    [annotations, applyAnnotationToVerses, lastUsedAnnotation, removeAnnotationsFromVerses],
  );

  useEffect(() => {
    setSelectedVerseNumbers(new Set());
    setNoteModalVisible(false);
    setNoteTargetVerse(null);
    setNoteDraft("");
    setAnnotationSheetOpen(false);
  }, [
    chapter?.bookSlug ?? bookSlug,
    chapter?.chapterNumber ?? chapterNumber,
    requestedTranslationId,
  ]);

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
    const translationAbbr = getTranslationDisplayAbbreviation(tid, translationPickerItems);
    const refLine = translationAbbr ? `${refBase} (${translationAbbr})` : refBase;
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
  }, [chapter, resolvedTranslationId, selectedVerses, translationPickerItems, clearVerseSelection]);

  const openAnnotationSheet = useCallback(() => {
    if (selectedVerses.length === 0) return;
    setAnnotationSheetOpen(true);
  }, [selectedVerses.length]);

  const closeAnnotationSheet = useCallback(() => {
    setAnnotationSheetOpen(false);
  }, []);

  const removeAnnotationsFromSelection = useCallback(() => {
    if (selectedVerses.length === 0) return;
    removeAnnotationsFromVerses(selectedVerses);
    setAnnotationSheetOpen(false);
    clearVerseSelection();
  }, [removeAnnotationsFromVerses, selectedVerses, clearVerseSelection]);

  const applyAnnotationToSelection = useCallback(
    (annotation: VerseAnnotation) => {
      if (selectedVerses.length === 0) return;
      applyAnnotationToVerses(selectedVerses, annotation);
      setLastUsedAnnotation(annotation);
      persistReaderAnnotationPrefs(annotation);
      setAnnotationSheetOpen(false);
      clearVerseSelection();
    },
    [applyAnnotationToVerses, selectedVerses, clearVerseSelection],
  );

  const annotationSheetInitial = useMemo((): VerseAnnotation => {
    const first = selectedVerses[0];
    if (first != null && annotations[first]) {
      return annotations[first]!;
    }
    return lastUsedAnnotation;
  }, [annotations, lastUsedAnnotation, selectedVerses]);

  const selectionHasExistingAnnotation = useMemo(
    () => selectedVerses.some((verse) => annotations[verse] != null),
    [annotations, selectedVerses],
  );

  const openNoteForVerse = useCallback(
    (verse: number) => {
      setNoteTargetVerse(verse);
      setNoteDraft(notes[verse] ?? "");
      setNoteModalVisible(true);
    },
    [notes],
  );

  const openNoteForSelection = useCallback(() => {
    if (selectedVerses.length === 0) return;
    const last = selectedVerses[selectedVerses.length - 1]!;
    openNoteForVerse(last);
  }, [selectedVerses, openNoteForVerse]);

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
    annotationSheetOpen,
    openAnnotationSheet,
    closeAnnotationSheet,
    lastUsedAnnotation,
    annotationSheetInitial,
    selectionHasExistingAnnotation,
    suppressNextVerseTapRef,
    copyToastVisible,
    setCopyToastVisible,
    clearVerseSelection,
    dismissVerseSelectionMode,
    toggleVerseSelection,
    handleVerseTap,
    handleVerseLongPress,
    selectedVerses,
    copySelectedVerses,
    removeAnnotationsFromSelection,
    applyAnnotationToSelection,
    openNoteForSelection,
    openNoteForVerse,
    saveNoteFromModal,
  };
}
