import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutRectangle,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextInputSelectionChangeEvent,
} from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import type { VerseTagRef } from "@sinag-bible/types";
import { getBookNameFromSlug } from "@sinag-bible/core/bible-meta";
import { formatVerseTagLabel } from "@sinag-bible/core/verse-tags";
import { M3OutlinedTextField } from "@/src/components/m3/M3OutlinedTextField";
import { measureOnboardingTarget } from "@/src/components/feature-onboarding/measureOnboardingTarget";
import { getTranslationDisplayAbbreviation } from "@/lib/translation-display-label";
import {
  getJournalVersePreview,
  resolveJournalPassageBookSlug,
} from "@/lib/journal-verse-preview";
import { getReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import {
  READER_M3_BODY_FONT_PX,
  READER_M3_BODY_LINE_HEIGHT_PX,
  READER_M3_ERROR,
} from "@/src/features/reader/readerSettingsPanelChrome";
import { formatVerseTagChipAccessibilityLabel, formatVerseTagTooltipTitle } from "@/src/features/verse-tags/verseTagChipCopy";
import { focusVerseTagElement } from "@/src/features/verse-tags/verseTagFocus";
import { VerseTagChip } from "@/src/features/verse-tags/VerseTagChip";
import { VerseTagPreviewTooltip } from "@/src/features/verse-tags/VerseTagPreviewTooltip";
import { openVerseTagInReader } from "@/src/features/verse-tags/openVerseTagInReader";
import type { VerseTagComposerError } from "@/src/features/verse-tags/verseTagComposer";
import {
  buildVerseChipInputModel,
  deleteAtomicBeforeCursor,
  findTextRunAtCursor,
  globalSelectionFromLocal,
  inferLocalCursorAfterEdit,
  replaceTextRunValue,
  type VerseChipInputTextRun,
} from "@/src/features/verse-tags/verseChipInputModel";

const BLUR_DEBOUNCE_MS = 80;

export type VerseChipInputProps = {
  label: string;
  value: string;
  onChangeText: (text: string, cursorIndex?: number) => void;
  onCursorChange: (selection: { start: number; end: number }) => void;
  onKeyPress: (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => void;
  onBlur: () => void;
  selection: { start: number; end: number };
  inputRef: RefObject<TextInput | null>;
  surfaceColor: string;
  accentColor: string;
  scale?: number;
  minHeight?: number;
  maxHeight?: number;
  error?: boolean;
  mentionError?: VerseTagComposerError | null;
  bundle: MobileAppThemeBundle;
  translationId: string;
};

type ActiveTagState = {
  key: string;
  ref: VerseTagRef;
  title: string;
  anchor: LayoutRectangle;
};

type LocalCaret = { runId: string; start: number; end: number };

/** Notes composer: 32dp chips in the field; persistence stays the tokenized string. */
export function VerseChipInput({
  label,
  value,
  onChangeText,
  onCursorChange,
  onKeyPress,
  onBlur,
  selection,
  inputRef,
  surfaceColor,
  accentColor,
  scale = 1,
  minHeight = 120,
  maxHeight = 160,
  error = false,
  mentionError = null,
  bundle,
  translationId,
}: VerseChipInputProps) {
  const chrome = getReaderSheetChrome(bundle);
  const lines = useMemo(() => buildVerseChipInputModel(value), [value]);
  const inputRefs = useRef(new Map<string, TextInput | null>());
  const chipRefs = useRef(new Map<string, RefObject<View | null>>());
  const focusedRunIdRef = useRef<string | null>(null);
  const nativeFocusedRef = useRef(false);
  const localCaretRef = useRef<LocalCaret>({ runId: "", start: 0, end: 0 });
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fieldFocused, setFieldFocused] = useState(false);
  const [focusedRunId, setFocusedRunId] = useState<string | null>(null);
  const [forcedSelection, setForcedSelection] = useState<{
    id: string;
    start: number;
    end: number;
  } | null>(null);
  const [activeTag, setActiveTag] = useState<ActiveTagState | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewPending, setPreviewPending] = useState(false);

  const fontSize = READER_M3_BODY_FONT_PX * scale;
  const lineHeight = READER_M3_BODY_LINE_HEIGHT_PX * scale;
  const innerMaxHeight = maxHeight * scale - 28 * scale;
  const versionAbbreviation = useMemo(
    () => getTranslationDisplayAbbreviation(translationId),
    [translationId],
  );
  const showPlaceholder = !fieldFocused && value.length === 0;
  const bufferHasError = mentionError != null;

  const getChipRef = useCallback((key: string) => {
    const existing = chipRefs.current.get(key);
    if (existing) return existing;
    const next = { current: null } as RefObject<View | null>;
    chipRefs.current.set(key, next);
    return next;
  }, []);

  const assignInputRef = useCallback(
    (runId: string, node: TextInput | null) => {
      inputRefs.current.set(runId, node);
      if (focusedRunIdRef.current === runId || focusedRunIdRef.current == null) {
        inputRef.current = node;
      }
    },
    [inputRef],
  );

  const cancelPendingBlur = useCallback(() => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => cancelPendingBlur(), [cancelPendingBlur]);

  const handleRunFocus = useCallback(
    (run: VerseChipInputTextRun) => {
      cancelPendingBlur();
      nativeFocusedRef.current = true;
      setFieldFocused(true);
      focusedRunIdRef.current = run.id;
      setFocusedRunId(run.id);
      inputRef.current = inputRefs.current.get(run.id) ?? null;
    },
    [cancelPendingBlur, inputRef],
  );

  const handleRunBlur = useCallback(() => {
    nativeFocusedRef.current = false;
    cancelPendingBlur();
    blurTimerRef.current = setTimeout(() => {
      setFieldFocused(false);
      focusedRunIdRef.current = null;
      setFocusedRunId(null);
      onBlur();
    }, BLUR_DEBOUNCE_MS);
  }, [cancelPendingBlur, onBlur]);

  const handleRunSelectionChange = useCallback(
    (run: VerseChipInputTextRun, event: TextInputSelectionChangeEvent) => {
      const local = event.nativeEvent.selection;
      localCaretRef.current = { runId: run.id, start: local.start, end: local.end };
      if (forcedSelection?.id === run.id) {
        setForcedSelection(null);
      }
      onCursorChange(globalSelectionFromLocal(run.start, local));
    },
    [forcedSelection, onCursorChange],
  );

  const handleRunChangeText = useCallback(
    (run: VerseChipInputTextRun, nextValue: string) => {
      const local =
        localCaretRef.current.runId === run.id
          ? localCaretRef.current
          : { start: run.value.length, end: run.value.length };
      const nextText = replaceTextRunValue(value, run, nextValue);
      const localCursor = inferLocalCursorAfterEdit(run.value, nextValue, local);
      localCaretRef.current = { runId: run.id, start: localCursor, end: localCursor };
      onChangeText(nextText, run.start + localCursor);
    },
    [onChangeText, value],
  );

  const handleRunKeyPress = useCallback(
    (run: VerseChipInputTextRun, event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      const key = event.nativeEvent.key;
      const caret = localCaretRef.current.runId === run.id ? localCaretRef.current : { start: 0, end: 0 };
      if (key === "Backspace" && caret.start === 0 && caret.end === 0) {
        const deleted = deleteAtomicBeforeCursor(value, run.start);
        if (deleted) {
          event.preventDefault?.();
          onChangeText(deleted.text, deleted.cursorIndex);
          return;
        }
      }
      onKeyPress(event);
    },
    [onChangeText, onKeyPress, value],
  );

  const prevValueRef = useRef(value);
  useLayoutEffect(() => {
    if (prevValueRef.current === value) return;
    prevValueRef.current = value;
    cancelPendingBlur();

    const target = findTextRunAtCursor(lines, selection.end);
    if (!target) return;

    if (nativeFocusedRef.current && target.id === focusedRunIdRef.current) {
      return;
    }
    if (focusedRunIdRef.current == null && !fieldFocused) return;

    focusedRunIdRef.current = target.id;
    setFocusedRunId(target.id);
    const local = Math.max(0, Math.min(target.value.length, selection.end - target.start));
    const node = inputRefs.current.get(target.id);
    node?.focus();
    inputRef.current = node ?? null;
    localCaretRef.current = { runId: target.id, start: local, end: local };
    setForcedSelection({ id: target.id, start: local, end: local });
  }, [cancelPendingBlur, fieldFocused, inputRef, lines, selection.end, value]);

  const loadPreview = useCallback(
    async (ref: VerseTagRef) => {
      setPreviewPending(true);
      setPreviewText(null);
      try {
        const canonicalBook = await resolveJournalPassageBookSlug(translationId, ref.book);
        if (!canonicalBook) {
          setPreviewText(null);
          return;
        }
        const preview = await getJournalVersePreview(
          translationId,
          canonicalBook,
          ref.chapter,
          ref.verseStart,
          ref.verseEnd ?? null,
        );
        setPreviewText(preview);
      } finally {
        setPreviewPending(false);
      }
    },
    [translationId],
  );

  const openTooltip = useCallback(
    async (ref: VerseTagRef, chipLabel: string, key: string) => {
      const chipRef = getChipRef(key);
      const anchor = await measureOnboardingTarget(chipRef, {
        waitForInteractions: false,
        retries: 2,
      });
      if (!anchor) return;
      setActiveTag({
        key,
        ref,
        title: formatVerseTagTooltipTitle(chipLabel, versionAbbreviation),
        anchor,
      });
      void loadPreview(ref);
    },
    [getChipRef, loadPreview, versionAbbreviation],
  );

  const dismissTooltip = useCallback(() => {
    const chipRef = activeTag ? chipRefs.current.get(activeTag.key) : undefined;
    setActiveTag(null);
    setPreviewText(null);
    setPreviewPending(false);
    requestAnimationFrame(() => {
      focusVerseTagElement(chipRef);
    });
  }, [activeTag]);

  const handleOpenInReader = useCallback(() => {
    if (!activeTag) return;
    openVerseTagInReader(activeTag.ref, translationId);
    dismissTooltip();
  }, [activeTag, dismissTooltip, translationId]);

  const textInputShared = {
    multiline: true,
    blurOnSubmit: false,
    scrollEnabled: false,
    autoCorrect: false,
    spellCheck: false,
    autoCapitalize: "sentences" as const,
    importantForAutofill: "no" as const,
    underlineColorAndroid: "transparent",
    textAlignVertical: "top" as const,
    placeholderTextColor: chrome.onSurfaceVariant,
    ...(Platform.OS === "ios" ? { textContentType: "none" as const } : {}),
  };

  return (
    <>
      <M3OutlinedTextField
        label={label}
        value={value}
        onChangeText={() => {}}
        surfaceColor={surfaceColor}
        accentColor={accentColor}
        scale={scale}
        multiline
        minHeight={minHeight}
        maxHeight={maxHeight}
        error={error}
        fieldFocused={fieldFocused}
        accessibilityLabel={label}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: innerMaxHeight }}
        >
          {lines.map((line) => (
            <View key={`line-${line.lineIndex}`} style={styles.line}>
              {line.runs.map((run) => {
                if (run.kind === "chip") {
                  const bookLabel = getBookNameFromSlug(run.ref.book);
                  const chipLabel = formatVerseTagLabel(run.ref, bookLabel ?? undefined);
                  const key = run.id;
                  const chipRef = getChipRef(key);
                  return (
                    <View key={key} style={styles.chipSlot} collapsable={false}>
                      <VerseTagChip
                        variant="input"
                        bundle={bundle}
                        chipRef={chipRef}
                        label={chipLabel}
                        accessibilityLabel={formatVerseTagChipAccessibilityLabel(
                          run.ref,
                          bookLabel ?? undefined,
                        )}
                        onPress={() => {
                          void openTooltip(run.ref, chipLabel, key);
                        }}
                        onLongPress={() => openVerseTagInReader(run.ref, translationId)}
                      />
                    </View>
                  );
                }

                const isErrorBuffer = bufferHasError && focusedRunId === run.id;
                const placeholder = showPlaceholder && run.trailing && run.value.length === 0 ? label : undefined;
                return (
                  <View
                    key={run.id}
                    style={run.trailing ? styles.trailingWrap : styles.runWrap}
                  >
                    {run.trailing ? null : (
                      <Text
                        pointerEvents="none"
                        style={[
                          styles.measure,
                          {
                            fontSize,
                            lineHeight,
                            color: chrome.onSurface,
                          },
                        ]}
                      >
                        {run.value.length > 0 ? run.value : " "}
                      </Text>
                    )}
                    <TextInput
                      ref={(node) => assignInputRef(run.id, node)}
                      {...textInputShared}
                      value={run.value}
                      placeholder={placeholder}
                      accessibilityLabel={label}
                      selection={
                        forcedSelection?.id === run.id
                          ? { start: forcedSelection.start, end: forcedSelection.end }
                          : undefined
                      }
                      onFocus={() => handleRunFocus(run)}
                      onBlur={handleRunBlur}
                      onChangeText={(nextValue) => handleRunChangeText(run, nextValue)}
                      onSelectionChange={(event) => handleRunSelectionChange(run, event)}
                      onKeyPress={(event) => handleRunKeyPress(run, event)}
                      style={[
                        run.trailing ? styles.trailingInput : styles.runInput,
                        {
                          fontSize,
                          lineHeight,
                          color: isErrorBuffer ? READER_M3_ERROR : chrome.onSurface,
                          minHeight: lineHeight,
                          textDecorationLine: isErrorBuffer ? "underline" : "none",
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </M3OutlinedTextField>

      <VerseTagPreviewTooltip
        visible={activeTag != null}
        anchor={activeTag?.anchor ?? { x: 0, y: 0, width: 0, height: 0 }}
        title={activeTag?.title ?? ""}
        description={
          previewPending
            ? "Loading verse..."
            : previewText?.trim()
              ? previewText
              : "Verse not found"
        }
        canOpenInReader={Boolean(previewText?.trim()) && !previewPending}
        bundle={bundle}
        onDismiss={dismissTooltip}
        onOpenInReader={handleOpenInReader}
      />
    </>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    width: "100%",
  },
  chipSlot: {
    marginRight: 4,
    marginVertical: 2,
    maxWidth: "100%",
  },
  runWrap: {
    maxWidth: "100%",
    justifyContent: "center",
  },
  trailingWrap: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 48,
    minWidth: 48,
    maxWidth: "100%",
    justifyContent: "center",
  },
  measure: {
    fontFamily: "Inter_400Regular",
    opacity: 0,
  },
  runInput: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    padding: 0,
    margin: 0,
    fontFamily: "Inter_400Regular",
  },
  trailingInput: {
    padding: 0,
    margin: 0,
    fontFamily: "Inter_400Regular",
  },
});
