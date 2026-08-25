import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { ReaderM3BottomSheet } from "@/src/components/m3/ReaderM3BottomSheet";
import { M3Slider } from "@/src/components/m3/M3Slider";
import {
  ReaderAlignCenterIcon,
  ReaderAlignJustifyIcon,
  ReaderAlignLeftIcon,
  ReaderAlignRightIcon,
} from "@/components/icons/ReaderFontSheetAlignIcons";
import { hapticLightImpact } from "@/lib/haptics";
import { getReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import {
  READER_VERSE_BODY_FONT_OPTIONS,
  readerVerseBodyFontFamily,
  readerVerseBodyFontLazyKey,
  type ReaderVerseBodyFontId,
} from "@/lib/reader-verse-body-font";
import { useLazyFont } from "@/lib/use-lazy-font";
import {
  ReaderM3SegmentedIconButton,
  readerM3SegmentedIconColor,
} from "@/src/features/reader/ReaderM3SegmentedIconButton";
import {
  READER_M3_LABEL_FONT_PX,
  READER_M3_LABEL_LETTER_SPACING,
  READER_M3_LABEL_LINE_HEIGHT_PX,
  READER_M3_BODY_FONT_PX,
  READER_M3_BODY_LINE_HEIGHT_PX,
  READER_OVERLAY_CONTENT_SCALE,
} from "@/src/features/reader/readerSettingsPanelChrome";

type ReaderVerseTextAlign = "left" | "right" | "center" | "justify";

const FONT_SCALE_MIN = 0.5;
const FONT_SCALE_MAX = 3;
const LINE_SPACING_MIN = 0.6;
const LINE_SPACING_MAX = 2;

const FONT_SHEET_ALIGN_ROW: readonly {
  align: ReaderVerseTextAlign;
  Icon: typeof ReaderAlignLeftIcon;
  label: string;
}[] = [
  { align: "left", Icon: ReaderAlignLeftIcon, label: "Left aligned" },
  { align: "center", Icon: ReaderAlignCenterIcon, label: "Center aligned" },
  { align: "right", Icon: ReaderAlignRightIcon, label: "Right aligned" },
  { align: "justify", Icon: ReaderAlignJustifyIcon, label: "Justify aligned" },
];

function formatScalePercent(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

export type ReaderFontSettingsSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  bundle: MobileAppThemeBundle;
  insets: { top: number; bottom: number; left: number; right: number };
  isTabletReaderLayout: boolean;
  fontSizeScale: number;
  setFontSizeScalePersisted: (v: number) => void;
  lineSpacingScale: number;
  setLineSpacingScalePersisted: (v: number) => void;
  verseTextAlign: ReaderVerseTextAlign;
  setVerseTextAlignPersisted: (a: ReaderVerseTextAlign) => void;
  readerVerseBodyFontId: ReaderVerseBodyFontId;
  setReaderVerseBodyFontIdPersisted: (id: ReaderVerseBodyFontId) => void;
  settingsMutedTextColor: string;
};

export function ReaderFontSettingsSheet({
  isOpen,
  onClose,
  bundle,
  insets,
  isTabletReaderLayout,
  fontSizeScale,
  setFontSizeScalePersisted,
  lineSpacingScale,
  setLineSpacingScalePersisted,
  verseTextAlign,
  setVerseTextAlignPersisted,
  readerVerseBodyFontId,
  setReaderVerseBodyFontIdPersisted,
  settingsMutedTextColor: _settingsMutedTextColor,
}: ReaderFontSettingsSheetProps) {
  const rc = bundle.reader;
  const colors = bundle.ui;
  const sheetChrome = useMemo(() => getReaderSheetChrome(bundle), [bundle]);
  const rippleColor = bundle.chrome.androidRipple;

  const [readerFontPickerOpen, setReaderFontPickerOpen] = useState(false);
  const { ensureFontLoaded, isFontLoaded } = useLazyFont();

  const scale = READER_OVERLAY_CONTENT_SCALE;
  const useBottomSheet = !isTabletReaderLayout;
  const sectionGap = 20 * scale;
  const alignIconSize = 22 * scale;

  const selectedFontLabel =
    READER_VERSE_BODY_FONT_OPTIONS.find((o) => o.id === readerVerseBodyFontId)?.label ?? "Lora";

  const handleFontSelect = useCallback(
    (fontId: ReaderVerseBodyFontId) => {
      hapticLightImpact();
      const lazyKey = readerVerseBodyFontLazyKey(fontId);
      if (lazyKey && !isFontLoaded(lazyKey)) {
        void ensureFontLoaded(lazyKey);
      }
      setReaderVerseBodyFontIdPersisted(fontId);
      setReaderFontPickerOpen(false);
    },
    [ensureFontLoaded, isFontLoaded, setReaderVerseBodyFontIdPersisted],
  );

  const segmentedOptions = useMemo(
    () =>
      FONT_SHEET_ALIGN_ROW.map(({ align, Icon, label }) => ({
        value: align,
        accessibilityLabel: label,
        renderIcon: (selected: boolean) => (
          <Icon size={alignIconSize} color={readerM3SegmentedIconColor(selected, bundle)} />
        ),
      })),
    [alignIconSize, bundle],
  );

  useEffect(() => {
    if (!isOpen) {
      setReaderFontPickerOpen(false);
    }
  }, [isOpen]);

  const sheetSurface = rc.popoverSurface;

  return (
    <ReaderM3BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      bundle={bundle}
      insets={insets}
      isTabletReaderLayout={isTabletReaderLayout}
      title="Text appearance"
      accessibilityDismissLabel="Dismiss font settings"
      contentPaddingBottom={24 * scale + (useBottomSheet ? insets.bottom : 0)}
    >
      <View style={{ marginBottom: sectionGap, gap: 6 * scale }}>
        <Text style={labelStyle(scale, sheetChrome.onSurfaceVariant)}>Font</Text>
        <Pressable
          onPress={() => {
            hapticLightImpact();
            setReaderFontPickerOpen((open) => !open);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Font, ${selectedFontLabel}`}
          accessibilityState={{ expanded: readerFontPickerOpen }}
          android_ripple={Platform.OS === "android" ? { color: rippleColor } : undefined}
          style={{
            minHeight: 48 * scale,
            borderRadius: 12 * scale,
            borderWidth: 1,
            borderColor: readerFontPickerOpen ? colors.brown800 : sheetChrome.outlineVariant,
            backgroundColor: readerFontPickerOpen
              ? sheetChrome.surfaceContainer
              : sheetChrome.surfaceContainerHigh,
            paddingHorizontal: 20 * scale,
            flexDirection: "row",
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: readerVerseBodyFontFamily(readerVerseBodyFontId),
              fontSize: READER_M3_BODY_FONT_PX * scale,
              lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale,
              color: sheetChrome.onSurface,
            }}
          >
            {selectedFontLabel}
          </Text>
          <MaterialIcons
            name={readerFontPickerOpen ? "expand-less" : "expand-more"}
            size={24 * scale}
            color={sheetChrome.onSurfaceVariant}
          />
        </Pressable>

        {readerFontPickerOpen ? (
          <View
            style={{
              borderRadius: 12 * scale,
              borderWidth: 1,
              borderColor: sheetChrome.outlineVariant,
              backgroundColor: sheetSurface,
              maxHeight: 220 * scale,
              overflow: "hidden",
            }}
          >
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={{
                padding: 6 * scale,
                gap: 4 * scale,
              }}
            >
              {READER_VERSE_BODY_FONT_OPTIONS.map((opt) => {
                const selected = opt.id === readerVerseBodyFontId;
                const lazyKey = readerVerseBodyFontLazyKey(opt.id);
                const fontReady = lazyKey == null || isFontLoaded(lazyKey);
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => handleFontSelect(opt.id)}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected }}
                    android_ripple={Platform.OS === "android" ? { color: rippleColor } : undefined}
                    style={({ pressed }) => ({
                      width: "100%",
                      borderRadius: 8 * scale,
                      overflow: "hidden",
                      backgroundColor: pressed
                        ? sheetChrome.surfaceContainer
                        : selected
                          ? sheetChrome.surfaceContainerHigh
                          : "transparent",
                    })}
                  >
                    <View
                      style={{
                        width: "100%",
                        flexDirection: "row",
                        alignItems: "center",
                        minHeight: 44 * scale,
                        paddingVertical: 10 * scale,
                        paddingHorizontal: 12 * scale,
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          flexShrink: 1,
                          fontFamily: fontReady ? readerVerseBodyFontFamily(opt.id) : undefined,
                          fontSize: READER_M3_BODY_FONT_PX * scale,
                          lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale,
                          color: sheetChrome.onSurface,
                        }}
                      >
                        {opt.label}
                      </Text>
                      <View
                        style={{
                          width: 28 * scale,
                          alignItems: "flex-end",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginLeft: 8 * scale,
                        }}
                      >
                        {selected ? (
                          <MaterialIcons name="check" size={20 * scale} color={colors.brown800} />
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>

      <View style={{ marginBottom: sectionGap, gap: 8 * scale }}>
        <View style={styles.labelRow}>
          <Text style={labelStyle(scale, sheetChrome.onSurfaceVariant)}>Font size</Text>
          <Text style={valueStyle(scale, sheetChrome.onSurface)}>{formatScalePercent(fontSizeScale)}</Text>
        </View>
        <M3Slider
          value={fontSizeScale}
          min={FONT_SCALE_MIN}
          max={FONT_SCALE_MAX}
          onValueChange={setFontSizeScalePersisted}
          accessibilityLabel={`Font size ${formatScalePercent(fontSizeScale)}`}
          bundle={bundle}
          scale={scale}
        />
      </View>

      <View style={{ marginBottom: sectionGap, gap: 8 * scale }}>
        <View style={styles.labelRow}>
          <Text style={labelStyle(scale, sheetChrome.onSurfaceVariant)}>Line spacing</Text>
          <Text style={valueStyle(scale, sheetChrome.onSurface)}>{formatScalePercent(lineSpacingScale)}</Text>
        </View>
        <M3Slider
          value={lineSpacingScale}
          min={LINE_SPACING_MIN}
          max={LINE_SPACING_MAX}
          onValueChange={setLineSpacingScalePersisted}
          accessibilityLabel={`Line spacing ${formatScalePercent(lineSpacingScale)}`}
          bundle={bundle}
          scale={scale}
        />
      </View>

      <View style={{ gap: 8 * scale }}>
        <Text style={labelStyle(scale, sheetChrome.onSurfaceVariant)}>Alignment</Text>
        <ReaderM3SegmentedIconButton
          options={segmentedOptions}
          value={verseTextAlign}
          onChange={(align) => {
            hapticLightImpact();
            setVerseTextAlignPersisted(align);
          }}
          bundle={bundle}
          scale={scale}
        />
      </View>
    </ReaderM3BottomSheet>
  );
}

function labelStyle(scale: number, color: string) {
  return {
    fontFamily: "Inter_500Medium" as const,
    fontSize: READER_M3_LABEL_FONT_PX * scale,
    lineHeight: READER_M3_LABEL_LINE_HEIGHT_PX * scale,
    letterSpacing: READER_M3_LABEL_LETTER_SPACING,
    color,
  };
}

function valueStyle(scale: number, color: string) {
  return {
    fontFamily: "Inter_500Medium" as const,
    fontSize: READER_M3_LABEL_FONT_PX * scale,
    lineHeight: READER_M3_LABEL_LINE_HEIGHT_PX * scale,
    color,
  };
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
