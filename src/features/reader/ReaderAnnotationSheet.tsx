import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import {
  DEFAULT_VERSE_ANNOTATION,
  isHighlightColor,
  type AnnotationColorId,
  type AnnotationStyle,
  type UnderlineStyle,
  type VerseAnnotation,
} from "@sinag-bible/types";
import {
  highlightColorOptions,
  underlineDarkColorOptions,
} from "@sinag-bible/ui";
import { M3Button } from "@/src/components/m3/M3Button";
import { ReaderM3BottomSheet } from "@/src/components/m3/ReaderM3BottomSheet";
import { hapticLightImpact, hapticSelection } from "@/lib/haptics";
import { useReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import {
  SquigglyUnderlineStyleIcon,
  StraightUnderlineStyleIcon,
} from "@/src/features/reader/AnnotationUnderlineStyleIcons";
import {
  ReaderM3SegmentedIconButton,
  readerM3SegmentedIconColor,
} from "@/src/features/reader/ReaderM3SegmentedIconButton";
import { ReaderM3SegmentedTextButton } from "@/src/features/reader/ReaderM3SegmentedTextButton";
import { resolveUnderlineStyle } from "@/src/features/reader/verseAnnotationUnderlineMetrics";
import {
  READER_M3_LABEL_FONT_PX,
  READER_M3_LABEL_LETTER_SPACING,
  READER_M3_LABEL_LINE_HEIGHT_PX,
  READER_OVERLAY_CONTENT_SCALE,
} from "@/src/features/reader/readerSettingsPanelChrome";

export type ReaderAnnotationSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  bundle: MobileAppThemeBundle;
  insets: { top: number; bottom: number; left: number; right: number };
  isTabletReaderLayout?: boolean;
  selectedVerses: number[];
  selectionSubtitle?: string;
  initialAnnotation: VerseAnnotation;
  existingAnnotation?: VerseAnnotation;
  onApply: (annotation: VerseAnnotation) => void;
  onRemove: () => void;
};

const STYLE_OPTIONS = [
  { value: "highlight" as const, label: "Highlighter", accessibilityLabel: "Highlighter style" },
  { value: "underline" as const, label: "Underline", accessibilityLabel: "Underline style" },
] as const;

const UNDERLINE_STYLE_OPTIONS = [
  {
    value: "straight" as const,
    accessibilityLabel: "Straight underline",
  },
  {
    value: "squiggly" as const,
    accessibilityLabel: "Squiggly underline",
  },
] as const;

function coerceColorForStyle(
  style: AnnotationStyle,
  colorId: AnnotationColorId,
): AnnotationColorId {
  if (style === "highlight") {
    return isHighlightColor(colorId) ? colorId : "yellow";
  }
  return colorId;
}

function normalizeDraft(annotation: VerseAnnotation): VerseAnnotation {
  const style = annotation.style;
  const colorId = coerceColorForStyle(style, annotation.colorId);
  if (style === "underline") {
    return {
      style,
      colorId,
      underlineStyle: resolveUnderlineStyle(annotation.underlineStyle),
    };
  }
  return { style, colorId };
}

export function ReaderAnnotationSheet({
  isOpen,
  onClose,
  bundle,
  insets,
  isTabletReaderLayout = false,
  selectedVerses,
  selectionSubtitle,
  initialAnnotation,
  existingAnnotation,
  onApply,
  onRemove,
}: ReaderAnnotationSheetProps) {
  const sheetChrome = useReaderSheetChrome();
  const scale = READER_OVERLAY_CONTENT_SCALE;
  const [draft, setDraft] = useState<VerseAnnotation>(() => normalizeDraft(initialAnnotation));

  useEffect(() => {
    if (!isOpen) return;
    setDraft(normalizeDraft(initialAnnotation));
  }, [initialAnnotation, isOpen]);

  const colorOptions = useMemo(() => {
    if (draft.style === "highlight") {
      return highlightColorOptions.map((opt) => ({
        id: opt.id as AnnotationColorId,
        swatch: opt.swatch,
        ring: opt.ring,
      }));
    }
    return [
      ...highlightColorOptions.map((opt) => ({
        id: opt.id as AnnotationColorId,
        swatch: opt.swatch,
        ring: opt.ring,
      })),
      ...underlineDarkColorOptions.map((opt) => ({
        id: opt.id as AnnotationColorId,
        swatch: opt.swatch,
        ring: opt.ring,
      })),
    ];
  }, [draft.style]);

  const title =
    selectedVerses.length === 1 ? "Mark verse" : `Mark ${selectedVerses.length} verses`;
  const subtitle =
    selectionSubtitle ??
    (selectedVerses.length === 1 ? `Verse ${selectedVerses[0]}` : `${selectedVerses.length} selected`);

  const handleStyleChange = (style: AnnotationStyle) => {
    hapticSelection();
    setDraft((prev) => normalizeDraft({ ...prev, style }));
  };

  const handleColorChange = (colorId: AnnotationColorId) => {
    hapticSelection();
    setDraft((prev) => normalizeDraft({ ...prev, colorId }));
  };

  const handleUnderlineStyleChange = (underlineStyle: UnderlineStyle) => {
    hapticSelection();
    setDraft((prev) => normalizeDraft({ ...prev, underlineStyle }));
  };

  const underlineStyleSegmentOptions = useMemo(
    () =>
      UNDERLINE_STYLE_OPTIONS.map((opt) => ({
        value: opt.value,
        accessibilityLabel: opt.accessibilityLabel,
        renderIcon: (selected: boolean) => {
          const color = readerM3SegmentedIconColor(selected, bundle);
          return opt.value === "squiggly" ? (
            <SquigglyUnderlineStyleIcon color={color} />
          ) : (
            <StraightUnderlineStyleIcon color={color} />
          );
        },
      })),
    [bundle],
  );

  const handleApply = () => {
    hapticLightImpact();
    onApply(normalizeDraft(draft));
  };

  const handleRemove = () => {
    hapticLightImpact();
    onRemove();
  };

  const labelStyle = {
    fontFamily: "Inter_500Medium" as const,
    fontSize: READER_M3_LABEL_FONT_PX * scale,
    lineHeight: READER_M3_LABEL_LINE_HEIGHT_PX * scale,
    letterSpacing: READER_M3_LABEL_LETTER_SPACING,
    color: sheetChrome.onSurfaceVariant,
  };

  return (
    <ReaderM3BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      bundle={bundle}
      insets={insets}
      isTabletReaderLayout={isTabletReaderLayout}
      title={title}
      subtitle={subtitle}
      accessibilityDismissLabel="Dismiss mark verse sheet"
      scrollable={false}
      footer={
        <View
          style={[
            styles.footer,
            {
              marginTop: 20 * scale,
              gap: 12 * scale,
            },
          ]}
        >
          <View style={[styles.footerActions, { gap: 12 * scale }]}>
            {existingAnnotation ? (
              <M3Button
                label="Remove"
                onPress={handleRemove}
                variant="text"
                destructive
                bundle={bundle}
                scale={scale}
                accessibilityLabel="Remove mark from selection"
              />
            ) : (
              <View style={{ minWidth: 72 * scale }} />
            )}
            <View style={{ flex: 1 }} />
            <M3Button
              label="Apply"
              onPress={handleApply}
              variant="filled"
              bundle={bundle}
              scale={scale}
              accessibilityLabel="Apply mark to selection"
            />
          </View>
        </View>
      }
    >
      <View style={{ gap: 20 * scale }}>
        <View style={{ gap: 8 * scale }}>
          <Text style={labelStyle}>Style</Text>
          <ReaderM3SegmentedTextButton
            options={STYLE_OPTIONS}
            value={draft.style}
            onChange={handleStyleChange}
            bundle={bundle}
            scale={scale}
          />
        </View>

        {draft.style === "underline" ? (
          <View style={{ gap: 8 * scale }}>
            <Text style={labelStyle}>Line style</Text>
            <ReaderM3SegmentedIconButton
              options={underlineStyleSegmentOptions}
              value={resolveUnderlineStyle(draft.underlineStyle)}
              onChange={handleUnderlineStyleChange}
              bundle={bundle}
              scale={scale}
            />
          </View>
        ) : null}

        <View style={{ gap: 10 * scale }}>
          <Text style={labelStyle}>Color</Text>
          <View style={styles.colorGrid}>
            {colorOptions.map((opt) => {
              const picked = draft.colorId === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => handleColorChange(opt.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${opt.id} color`}
                  accessibilityState={{ selected: picked }}
                  android_ripple={
                    Platform.OS === "android"
                      ? { color: bundle.chrome.androidRipple, borderless: true }
                      : undefined
                  }
                  style={({ pressed }) => [
                    styles.colorSwatchOuter,
                    {
                      opacity: pressed ? 0.85 : 1,
                      borderColor: picked ? sheetChrome.onSurface : sheetChrome.outlineVariant,
                      borderWidth: picked ? 3 : 1,
                      backgroundColor: picked ? sheetChrome.secondaryContainer : "transparent",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.colorSwatchInner,
                      {
                        backgroundColor: opt.swatch,
                        borderColor: opt.ring,
                        borderWidth: draft.style === "underline" && !isHighlightColor(opt.id) ? 0 : 1,
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </ReaderM3BottomSheet>
  );
}

const SWATCH_OUTER = 40;
const SWATCH_INNER = 28;

const styles = StyleSheet.create({
  footer: {
    width: "100%",
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  colorSwatchOuter: {
    width: SWATCH_OUTER,
    height: SWATCH_OUTER,
    borderRadius: SWATCH_OUTER / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchInner: {
    width: SWATCH_INNER,
    height: SWATCH_INNER,
    borderRadius: SWATCH_INNER / 2,
  },
});