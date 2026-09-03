import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { VerseAnnotation } from "@sinag-bible/types";
import { isMobileAppDarkThemeId } from "@sinag-bible/tokens";
import { highlightColors, resolveAnnotationColorHex } from "@sinag-bible/ui";
import { READER_INLINE_NOTE_LONG_PRESS_EDIT_HINT } from "@/src/features/reader/readerVerseMarksCopy";
import { VerseTaggedText } from "@/src/features/verse-tags/VerseTaggedText";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import {
  renderVerseBodyInline,
  type ReaderVerseTextAlignProp,
} from "@/components/reader-verse-row";
import type { ReaderVerseFlashVerse } from "@/src/features/reader/readerVerseFlashListData";

/** Deep red on parchment / light reader backgrounds */
const WORDS_OF_JESUS_COLOR = "#C41E1E";
/** Softer pastel red for dark and night themes (better contrast on near-black surfaces) */
const WORDS_OF_JESUS_COLOR_DARK_THEME = "#E8A0A0";

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: -4,
    paddingHorizontal: 8,
  },
  runText: {
    alignSelf: "stretch",
  },
  noteContainer: {
    marginTop: 6,
    marginBottom: 8,
    marginHorizontal: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  noteText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
});

export type ReaderVerseParagraphBlockProps = {
  verses: readonly ReaderVerseFlashVerse[];
  selectedVerseNumbers: ReadonlySet<number>;
  annotations: Record<number, VerseAnnotation | undefined>;
  notes: Record<number, string | undefined>;
  themeId: string;
  selectionBackground: string;
  selectionText: string;
  verseNumberColor: string;
  noteBelowVerseBackground: string;
  bodyTextColor: string;
  readerVerseFontSize: number;
  readerVerseLineHeight: number;
  readerVerseBodyFontFamily: string;
  verseTextAlign: ReaderVerseTextAlignProp;
  onVersePress: (verseNum: number) => void;
  onVerseLongPress: (verseNum: number) => void;
  onNoteLongPress?: (verseNum: number) => void;
  translationId: string;
  bundle: MobileAppThemeBundle;
  yvpFootnotes?: Record<number, { label: string; body: string }>;
  onYvpFootnotePress?: (noteId: number) => void;
};

type ParagraphRun = {
  verses: ReaderVerseFlashVerse[];
  noteVerseNum?: number;
  noteText?: string;
};

function buildParagraphRuns(
  verses: readonly ReaderVerseFlashVerse[],
  notes: Record<number, string | undefined>,
): ParagraphRun[] {
  const runs: ParagraphRun[] = [];
  let current: ReaderVerseFlashVerse[] = [];
  for (const verse of verses) {
    current.push(verse);
    const verseNum = verse.verseIndex + 1;
    const noteText = notes[verseNum]?.trim();
    if (noteText) {
      runs.push({ verses: current, noteVerseNum: verseNum, noteText });
      current = [];
    }
  }
  if (current.length > 0) {
    runs.push({ verses: current });
  }
  return runs;
}

type ParagraphVerseTypography = {
  readerVerseFontSize: number;
  readerVerseLineHeight: number;
  readerVerseBodyFontFamily: string;
};

type RenderParagraphVerseParams = {
  verse: ReaderVerseFlashVerse;
  isLastInRun: boolean;
  verseTextAlign: ReaderVerseTextAlignProp;
  selectedVerseNumbers: ReadonlySet<number>;
  annotations: Record<number, VerseAnnotation | undefined>;
  isDarkTheme: boolean;
  selectionBackground: string;
  selectionText: string;
  verseNumberColor: string;
  bodyTextColor: string;
  wordsOfJesusDefaultColor: string;
  verseNumberFontSize: number;
  typography: ParagraphVerseTypography;
  yvpFootnotes?: Record<number, { label: string; body: string }>;
  onVersePress: (verseNum: number) => void;
  onVerseLongPress: (verseNum: number) => void;
  onYvpFootnotePress?: (noteId: number) => void;
};

function renderParagraphVerseText({
  verse,
  isLastInRun,
  verseTextAlign,
  selectedVerseNumbers,
  annotations,
  isDarkTheme,
  selectionBackground,
  selectionText,
  verseNumberColor,
  bodyTextColor,
  wordsOfJesusDefaultColor,
  verseNumberFontSize,
  typography,
  yvpFootnotes,
  onVersePress,
  onVerseLongPress,
  onYvpFootnotePress,
}: RenderParagraphVerseParams) {
  const verseNum = verse.verseIndex + 1;
  const isSelected = selectedVerseNumbers.has(verseNum);
  const annotation = annotations[verseNum];
  const isHighlight = !isSelected && annotation?.style === "highlight";
  const isUnderline = !isSelected && annotation?.style === "underline";
  const highlightBg =
    isHighlight && annotation
      ? highlightColors[annotation.colorId as keyof typeof highlightColors]
      : undefined;
  const underlineColor =
    isUnderline && annotation ? resolveAnnotationColorHex(annotation.colorId) : undefined;
  const inkOnHighlight = isHighlight && isDarkTheme ? selectionText : null;
  const textCol = isSelected ? selectionText : inkOnHighlight ?? bodyTextColor;
  const numCol = isSelected ? selectionText : inkOnHighlight ?? verseNumberColor;
  const wordsOfJesusInk =
    isSelected || inkOnHighlight != null ? textCol : wordsOfJesusDefaultColor;
  const useInlineBody = Boolean(verse.verseInlineContent && verse.verseInlineContent.length > 0);

  return (
    <Text
      key={verse.verseIndex}
      onPress={() => onVersePress(verseNum)}
      onLongPress={() => onVerseLongPress(verseNum)}
      suppressHighlighting
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={isSelected ? `Deselect verse ${verseNum}` : `Select verse ${verseNum}`}
      style={{
        fontFamily: typography.readerVerseBodyFontFamily,
        fontSize: typography.readerVerseFontSize,
        lineHeight: typography.readerVerseLineHeight,
        color: textCol,
        textAlign: verseTextAlign,
        backgroundColor: isSelected ? selectionBackground : highlightBg ?? "transparent",
        textDecorationLine: underlineColor ? "underline" : "none",
        textDecorationColor: underlineColor,
      }}
    >
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: verseNumberFontSize,
          lineHeight: typography.readerVerseLineHeight,
          color: numCol,
        }}
      >
        {verseNum}
        {"\u00a0"}
      </Text>
      {useInlineBody && verse.verseInlineContent
        ? renderVerseBodyInline(
            verse.verseInlineContent,
            wordsOfJesusInk,
            typography,
            yvpFootnotes,
            onYvpFootnotePress,
            true,
          )
        : verse.verseText}
      {isLastInRun ? null : " "}
    </Text>
  );
}

function ReaderVerseParagraphBlockInner({
  verses,
  selectedVerseNumbers,
  annotations,
  notes,
  themeId,
  selectionBackground,
  selectionText,
  verseNumberColor,
  noteBelowVerseBackground,
  bodyTextColor,
  readerVerseFontSize,
  readerVerseLineHeight,
  readerVerseBodyFontFamily,
  verseTextAlign,
  onVersePress,
  onVerseLongPress,
  onNoteLongPress,
  translationId,
  bundle,
  yvpFootnotes,
  onYvpFootnotePress,
}: ReaderVerseParagraphBlockProps) {
  const isDarkTheme = isMobileAppDarkThemeId(themeId);
  const wordsOfJesusDefaultColor = isDarkTheme
    ? WORDS_OF_JESUS_COLOR_DARK_THEME
    : WORDS_OF_JESUS_COLOR;
  const verseNumberFontSize = Math.max(10, Math.round(readerVerseFontSize * 0.68));
  const runs = buildParagraphRuns(verses, notes);
  const typography = {
    readerVerseFontSize,
    readerVerseLineHeight,
    readerVerseBodyFontFamily,
  } as const;

  const verseRenderParams = {
    selectedVerseNumbers,
    annotations,
    isDarkTheme,
    selectionBackground,
    selectionText,
    verseNumberColor,
    bodyTextColor,
    wordsOfJesusDefaultColor,
    verseNumberFontSize,
    typography,
    yvpFootnotes,
    onVersePress,
    onVerseLongPress,
    onYvpFootnotePress,
  } as const;

  return (
    <View style={styles.wrap}>
      {runs.map((run, runIndex) => (
        <View key={`run-${run.verses[0]?.verseIndex ?? runIndex}`}>
          <Text
            style={[
              styles.runText,
              {
                fontFamily: typography.readerVerseBodyFontFamily,
                fontSize: typography.readerVerseFontSize,
                lineHeight: typography.readerVerseLineHeight,
                textAlign: verseTextAlign,
              },
            ]}
          >
            {run.verses.map((verse, verseIndexInRun) =>
              renderParagraphVerseText({
                verse,
                isLastInRun: verseIndexInRun === run.verses.length - 1,
                ...verseRenderParams,
                verseTextAlign,
              }),
            )}
          </Text>
          {run.noteVerseNum != null && run.noteText ? (
            <Pressable
              onLongPress={() => onNoteLongPress?.(run.noteVerseNum!)}
              delayLongPress={420}
              style={[styles.noteContainer, { backgroundColor: noteBelowVerseBackground }]}
              accessibilityRole="button"
              accessibilityLabel={`Note on verse ${run.noteVerseNum}`}
              accessibilityHint={READER_INLINE_NOTE_LONG_PRESS_EDIT_HINT}
            >
              <VerseTaggedText
                text={run.noteText}
                textStyle={styles.noteText}
                textColor={bodyTextColor}
                translationId={translationId}
                bundle={bundle}
              />
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export const ReaderVerseParagraphBlock = memo(ReaderVerseParagraphBlockInner, (prev, next) => {
  if (prev.verses !== next.verses && prev.verses.length !== next.verses.length) return false;
  if (prev.verses !== next.verses) {
    for (let i = 0; i < prev.verses.length; i++) {
      const a = prev.verses[i];
      const b = next.verses[i];
      if (a?.verseIndex !== b?.verseIndex) return false;
      if (a?.verseText !== b?.verseText) return false;
      if (a?.verseInlineContent !== b?.verseInlineContent) return false;
    }
  }
  if (prev.themeId !== next.themeId) return false;
  if (prev.selectionBackground !== next.selectionBackground) return false;
  if (prev.selectionText !== next.selectionText) return false;
  if (prev.verseNumberColor !== next.verseNumberColor) return false;
  if (prev.noteBelowVerseBackground !== next.noteBelowVerseBackground) return false;
  if (prev.bodyTextColor !== next.bodyTextColor) return false;
  if (prev.readerVerseFontSize !== next.readerVerseFontSize) return false;
  if (prev.readerVerseLineHeight !== next.readerVerseLineHeight) return false;
  if (prev.readerVerseBodyFontFamily !== next.readerVerseBodyFontFamily) return false;
  if (prev.verseTextAlign !== next.verseTextAlign) return false;
  if (prev.onVersePress !== next.onVersePress) return false;
  if (prev.onVerseLongPress !== next.onVerseLongPress) return false;
  if (prev.onNoteLongPress !== next.onNoteLongPress) return false;
  if (prev.translationId !== next.translationId) return false;
  if (prev.bundle !== next.bundle) return false;
  if (prev.yvpFootnotes !== next.yvpFootnotes) return false;
  if (prev.onYvpFootnotePress !== next.onYvpFootnotePress) return false;

  for (const verse of next.verses) {
    const verseNum = verse.verseIndex + 1;
    if (prev.selectedVerseNumbers.has(verseNum) !== next.selectedVerseNumbers.has(verseNum)) {
      return false;
    }
    if (prev.annotations[verseNum] !== next.annotations[verseNum]) return false;
    if (prev.notes[verseNum]?.trim() !== next.notes[verseNum]?.trim()) return false;
  }
  return true;
});
