import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
  type TextLayoutLine,
} from "react-native";
import type { BibleVerseInlineItem, VerseAnnotation } from "@sinag-bible/types";
import { isMobileAppDarkThemeId } from "@sinag-bible/tokens";
import { highlightColors, resolveAnnotationColorHex } from "@sinag-bible/ui";
import { resolveUnderlineStyle } from "@/src/features/reader/verseAnnotationUnderlineMetrics";
import { VerseAnnotationUnderlineOverlay } from "@/src/features/reader/VerseAnnotationUnderlineOverlay";
import { READER_INLINE_NOTE_LONG_PRESS_EDIT_HINT } from "@/src/features/reader/readerVerseMarksCopy";
import { VerseTaggedText } from "@/src/features/verse-tags/VerseTaggedText";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";

/** Deep red on parchment / light reader backgrounds */
const WORDS_OF_JESUS_COLOR = "#C41E1E";
/** Softer pastel red for dark and night themes (better contrast on near-black surfaces) */
const WORDS_OF_JESUS_COLOR_DARK_THEME = "#E8A0A0";

const styles = StyleSheet.create({
  versePressable: {
    flexDirection: "row",
    marginHorizontal: -4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 7,
  },
  verseNumber: {
    fontSize: 12,
    minWidth: 18,
    paddingTop: 4,
  },
  verseBody: {
    flex: 1,
  },
  verseBodyWrap: {
    flex: 1,
    position: "relative",
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
  inlineHeading: {
    fontWeight: "600",
  },
});

export type ReaderVerseTextAlignProp = "left" | "right" | "center" | "justify";

export type ReaderVerseRowProps = {
  verseNum: number;
  verseText: string;
  /** When set and non-empty, verse body uses structured inline spans (e.g. words of Jesus). */
  verseInlineContent?: BibleVerseInlineItem[];
  isSelected: boolean;
  annotation: VerseAnnotation | undefined;
  noteText: string | undefined;
  themeId: string;
  selectionBackground: string;
  selectionText: string;
  verseNumberColor: string;
  noteBelowVerseBackground: string;
  /** Default verse ink and note body color (e.g. theme `brown800`). */
  bodyTextColor: string;
  readerVerseFontSize: number;
  readerVerseLineHeight: number;
  /** Loaded `fontFamily` for verse body text only (e.g. `Lora_400Regular`). */
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

export function renderVerseBodyInline(
  items: BibleVerseInlineItem[],
  wordsOfJesusColor: string,
  verseBodyTypography: Pick<
    ReaderVerseRowProps,
    "readerVerseFontSize" | "readerVerseLineHeight" | "readerVerseBodyFontFamily"
  >,
  yvpFootnotes?: Record<number, { label: string; body: string }>,
  onYvpFootnotePress?: (noteId: number) => void,
  breakBeforeHeadings = false,
) {
  const nestedTextStyle = {
    fontFamily: verseBodyTypography.readerVerseBodyFontFamily,
    fontSize: verseBodyTypography.readerVerseFontSize,
    lineHeight: verseBodyTypography.readerVerseLineHeight,
    includeFontPadding: false,
  } as const;

  return items.map((item, idx) => {
    const key = `seg-${idx}`;
    if (typeof item === "string") {
      return (
        <Text key={key} style={nestedTextStyle}>
          {item}
        </Text>
      );
    }
    if ("lineBreak" in item && item.lineBreak === true) {
      return (
        <Text key={key} style={nestedTextStyle}>
          {"\n"}
        </Text>
      );
    }
    if ("noteId" in item && typeof item.noteId === "number") {
      const footnote = yvpFootnotes?.[item.noteId];
      if (!footnote || !onYvpFootnotePress) return null;
      return (
        <Text
          key={key}
          onPress={() => onYvpFootnotePress(item.noteId)}
          suppressHighlighting
          style={{ fontSize: 11, lineHeight: 16, textDecorationLine: "underline" }}
          accessibilityRole="button"
          accessibilityLabel={`Footnote ${footnote.label}`}
        >
          {footnote.label}
        </Text>
      );
    }
    if ("heading" in item && typeof item.heading === "string") {
      return (
        <Text key={key} style={[styles.inlineHeading, nestedTextStyle]}>
          {breakBeforeHeadings ? `\n${item.heading}\n` : item.heading}
        </Text>
      );
    }
    if ("text" in item && typeof item.text === "string") {
      if (item.wordsOfJesus === true) {
        return (
          <Text key={key} style={[nestedTextStyle, { color: wordsOfJesusColor }]}>
            {item.text}
          </Text>
        );
      }
      return (
        <Text key={key} style={nestedTextStyle}>
          {item.text}
        </Text>
      );
    }
    return null;
  });
}

function ReaderVerseRowInner({
  verseNum,
  verseText,
  verseInlineContent,
  isSelected,
  annotation,
  noteText,
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
}: ReaderVerseRowProps) {
  const useInlineBody = Boolean(verseInlineContent && verseInlineContent.length > 0);
  const isHighlight = !isSelected && annotation?.style === "highlight";
  const isUnderline = !isSelected && annotation?.style === "underline";
  const highlightBg =
    isHighlight && annotation
      ? highlightColors[annotation.colorId as keyof typeof highlightColors]
      : undefined;
  const underlineColor =
    isUnderline && annotation ? resolveAnnotationColorHex(annotation.colorId) : undefined;
  const underlineStyle = isUnderline && annotation
    ? resolveUnderlineStyle(annotation.underlineStyle)
    : undefined;
  const rowBg = isSelected ? selectionBackground : highlightBg ?? "transparent";
  /** Highlight fills are shared pastel swatches; dark/night use light body ink, so use selection ink on highlight for contrast. */
  const isDarkTheme = isMobileAppDarkThemeId(themeId);
  const inkOnHighlight =
    isHighlight && isDarkTheme ? selectionText : null;
  const textCol = isSelected ? selectionText : inkOnHighlight ?? bodyTextColor;
  const numCol = isSelected ? selectionText : inkOnHighlight ?? verseNumberColor;
  const wordsOfJesusDefaultColor = isDarkTheme
    ? WORDS_OF_JESUS_COLOR_DARK_THEME
    : WORDS_OF_JESUS_COLOR;
  /** Nested `<Text>` overrides parent color; match selection/highlight ink so red is not left on tinted rows. */
  const wordsOfJesusInk =
    isSelected || inkOnHighlight != null ? textCol : wordsOfJesusDefaultColor;

  const [underlineLines, setUnderlineLines] = useState<readonly TextLayoutLine[]>([]);
  const verseBodyLayoutLinesRef = useRef<readonly TextLayoutLine[]>([]);

  useEffect(() => {
    if (isUnderline) {
      setUnderlineLines(verseBodyLayoutLinesRef.current);
    }
  }, [isUnderline]);

  const handleVerseBodyTextLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      const lines = event.nativeEvent.lines;
      verseBodyLayoutLinesRef.current = lines;
      if (isUnderline) {
        setUnderlineLines(lines);
      }
    },
    [isUnderline],
  );

  const verseBodyTextStyle = {
    fontFamily: readerVerseBodyFontFamily,
    fontSize: readerVerseFontSize,
    lineHeight: readerVerseLineHeight,
    color: textCol,
    textAlign: verseTextAlign,
  } as const;

  return (
    <View>
      <Pressable
        onPress={() => onVersePress(verseNum)}
        onLongPress={() => onVerseLongPress(verseNum)}
        delayLongPress={260}
        style={[styles.versePressable, { backgroundColor: rowBg }]}
        hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={
          isSelected ? `Deselect verse ${verseNum}` : `Select verse ${verseNum}`
        }
      >
        <Text
          style={[styles.verseNumber, { fontFamily: "Inter_400Regular", color: numCol }]}
        >
          {verseNum}
        </Text>
        <View style={styles.verseBodyWrap}>
          <Text
            style={[styles.verseBody, verseBodyTextStyle]}
            onTextLayout={handleVerseBodyTextLayout}
          >
            {useInlineBody && verseInlineContent
              ? renderVerseBodyInline(
                  verseInlineContent,
                  wordsOfJesusInk,
                  {
                    readerVerseFontSize,
                    readerVerseLineHeight,
                    readerVerseBodyFontFamily,
                  },
                  yvpFootnotes,
                  onYvpFootnotePress,
                )
              : verseText}
          </Text>
          {underlineColor ? (
            <VerseAnnotationUnderlineOverlay
              lines={underlineLines}
              color={underlineColor}
              colorId={annotation?.colorId}
              underlineStyle={underlineStyle}
              fontSize={readerVerseFontSize}
            />
          ) : null}
        </View>
      </Pressable>
      {noteText ? (
        <Pressable
          onLongPress={() => onNoteLongPress?.(verseNum)}
          delayLongPress={420}
          style={[styles.noteContainer, { backgroundColor: noteBelowVerseBackground }]}
          accessibilityRole="button"
          accessibilityLabel={`Note on verse ${verseNum}`}
          accessibilityHint={READER_INLINE_NOTE_LONG_PRESS_EDIT_HINT}
        >
          <VerseTaggedText
            text={noteText}
            textStyle={styles.noteText}
            textColor={bodyTextColor}
            translationId={translationId}
            bundle={bundle}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

export const ReaderVerseRow = memo(ReaderVerseRowInner, (prev, next) => {
  if (prev.verseNum !== next.verseNum) return false;
  if (prev.verseText !== next.verseText) return false;
  if (prev.verseInlineContent !== next.verseInlineContent) return false;
  if (prev.isSelected !== next.isSelected) return false;
  const prevAnn = prev.annotation;
  const nextAnn = next.annotation;
  if (prevAnn?.style !== nextAnn?.style) return false;
  if (prevAnn?.colorId !== nextAnn?.colorId) return false;
  if (prevAnn?.underlineStyle !== nextAnn?.underlineStyle) return false;
  if (prev.noteText !== next.noteText) return false;
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
  return true;
});
