import { memo } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import type { BibleVerseInlineItem, HighlightColor } from "@sinag-bible/types";
import { highlightColors } from "@sinag-bible/ui";

/** Deep red on parchment / light reader backgrounds */
const WORDS_OF_JESUS_COLOR = "#C41E1E";
/** Softer pastel red for dark and night themes (better contrast on near-black surfaces) */
const WORDS_OF_JESUS_COLOR_DARK_THEME = "#E8A0A0";

const HIGHLIGHT_BG: Record<HighlightColor, string> = {
  yellow: highlightColors.yellow,
  blue: highlightColors.blue,
  pink: highlightColors.pink,
  green: highlightColors.green,
  purple: highlightColors.purple,
};

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
  highlight: HighlightColor | undefined;
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
};

function renderVerseBodyInline(items: BibleVerseInlineItem[], wordsOfJesusColor: string) {
  return items.map((item, idx) => {
    const key = `seg-${idx}`;
    if (typeof item === "string") {
      return <Text key={key}>{item}</Text>;
    }
    if ("lineBreak" in item && item.lineBreak === true) {
      return (
        <Text key={key}>
          {"\n"}
        </Text>
      );
    }
    if ("noteId" in item && typeof item.noteId === "number") {
      return null;
    }
    if ("heading" in item && typeof item.heading === "string") {
      return (
        <Text key={key} style={styles.inlineHeading}>
          {item.heading}
        </Text>
      );
    }
    if ("text" in item && typeof item.text === "string") {
      if (item.wordsOfJesus === true) {
        return (
          <Text key={key} style={{ color: wordsOfJesusColor }}>
            {item.text}
          </Text>
        );
      }
      return <Text key={key}>{item.text}</Text>;
    }
    return null;
  });
}

function ReaderVerseRowInner({
  verseNum,
  verseText,
  verseInlineContent,
  isSelected,
  highlight: hl,
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
}: ReaderVerseRowProps) {
  const useInlineBody = Boolean(verseInlineContent && verseInlineContent.length > 0);
  const rowBg = isSelected ? selectionBackground : hl ? HIGHLIGHT_BG[hl] : "transparent";
  /** Highlight fills are shared pastel swatches; dark/night use light body ink, so use selection ink on highlight for contrast. */
  const inkOnHighlight =
    !isSelected && hl && (themeId === "dark" || themeId === "night") ? selectionText : null;
  const textCol = isSelected ? selectionText : inkOnHighlight ?? bodyTextColor;
  const numCol = isSelected ? selectionText : inkOnHighlight ?? verseNumberColor;
  const wordsOfJesusDefaultColor =
    themeId === "dark" || themeId === "night"
      ? WORDS_OF_JESUS_COLOR_DARK_THEME
      : WORDS_OF_JESUS_COLOR;
  /** Nested `<Text>` overrides parent color; match selection/highlight ink so red is not left on tinted rows. */
  const wordsOfJesusInk =
    isSelected || inkOnHighlight != null ? textCol : wordsOfJesusDefaultColor;

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
        <Text
          style={[
            styles.verseBody,
            {
              fontFamily: readerVerseBodyFontFamily,
              fontSize: readerVerseFontSize,
              lineHeight: readerVerseLineHeight,
              color: textCol,
              textAlign: verseTextAlign,
            },
          ]}
        >
          {useInlineBody && verseInlineContent
            ? renderVerseBodyInline(verseInlineContent, wordsOfJesusInk)
            : verseText}
        </Text>
      </Pressable>
      {noteText ? (
        <View style={[styles.noteContainer, { backgroundColor: noteBelowVerseBackground }]}>
          <Text style={[styles.noteText, { color: bodyTextColor }]}>
            {noteText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export const ReaderVerseRow = memo(ReaderVerseRowInner, (prev, next) => {
  if (prev.verseNum !== next.verseNum) return false;
  if (prev.verseText !== next.verseText) return false;
  if (prev.verseInlineContent !== next.verseInlineContent) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.highlight !== next.highlight) return false;
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
  return true;
});
