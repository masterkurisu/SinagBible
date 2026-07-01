import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { M3Slider } from "@/src/components/m3/M3Slider";
import {
  ReaderAlignCenterIcon,
  ReaderAlignJustifyIcon,
  ReaderAlignLeftIcon,
  ReaderAlignRightIcon,
} from "@/components/icons/ReaderFontSheetAlignIcons";
import { nativeTabSheetBottomInsetPx } from "@/lib/native-tab-chrome";
import { hapticLightImpact } from "@/lib/haptics";
import {
  READER_VERSE_BODY_FONT_OPTIONS,
  readerVerseBodyFontFamily,
  readerVerseBodyFontLazyKey,
  type ReaderVerseBodyFontId,
} from "@/lib/reader-verse-body-font";
import { useLazyFont } from "@/lib/use-lazy-font";
import {
  M3_EMPHASIZED_DECELERATE_EASING,
  M3_MOTION_DURATION_SHORT4_MS,
} from "@/src/components/m3/m3-motion";
import {
  ReaderM3SegmentedIconButton,
  readerM3SegmentedIconColor,
} from "@/src/features/reader/ReaderM3SegmentedIconButton";
import {
  READER_M3_BODY_FONT_PX,
  READER_M3_BODY_LINE_HEIGHT_PX,
  READER_M3_BOTTOM_SHEET_HANDLE_HEIGHT_PX,
  READER_M3_BOTTOM_SHEET_HANDLE_WIDTH_PX,
  READER_M3_BOTTOM_SHEET_RADIUS_PX,
  READER_M3_LABEL_FONT_PX,
  READER_M3_LABEL_LETTER_SPACING,
  READER_M3_LABEL_LINE_HEIGHT_PX,
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
  READER_M3_OUTLINE_VARIANT,
  READER_M3_SHEET_TITLE_FONT_PX,
  READER_M3_SHEET_TITLE_LINE_HEIGHT_PX,
  READER_M3_SURFACE_CONTAINER,
  READER_M3_SURFACE_CONTAINER_HIGH,
} from "@/src/features/reader/readerSettingsPanelChrome";
import { READER_MENU_SLIDE_FROM_PX } from "@/src/features/reader/useReaderGestures";

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
  const rippleColor = bundle.chrome.androidRipple;
  const { width: screenW } = useWindowDimensions();

  const [readerFontPickerOpen, setReaderFontPickerOpen] = useState(false);
  const { ensureFontLoaded, isFontLoaded } = useLazyFont();
  const sheetSlideAnim = useRef(new Animated.Value(0)).current;
  const sheetOpacityAnim = useRef(new Animated.Value(0)).current;

  const scale = isTabletReaderLayout ? 1.35 : 1;
  const useBottomSheet = !isTabletReaderLayout;
  const sheetMaxW = useBottomSheet ? screenW : Math.min(420, screenW - 48);
  const sheetMaxH = Dimensions.get("window").height * (isTabletReaderLayout ? 0.72 : 0.82);
  const padH = 20 * scale;
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
          <Icon size={alignIconSize} color={readerM3SegmentedIconColor(selected)} />
        ),
      })),
    [alignIconSize],
  );

  useEffect(() => {
    if (!isOpen) {
      setReaderFontPickerOpen(false);
      sheetSlideAnim.setValue(0);
      sheetOpacityAnim.setValue(0);
      return;
    }
    sheetSlideAnim.setValue(0);
    sheetOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(sheetSlideAnim, {
        toValue: 1,
        duration: M3_MOTION_DURATION_SHORT4_MS + 80,
        easing: M3_EMPHASIZED_DECELERATE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(sheetOpacityAnim, {
        toValue: 1,
        duration: M3_MOTION_DURATION_SHORT4_MS,
        easing: M3_EMPHASIZED_DECELERATE_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen, sheetSlideAnim, sheetOpacityAnim]);

  const sheetSurface = rc.popoverSurface;
  const slideFrom = useBottomSheet ? 48 : READER_MENU_SLIDE_FROM_PX;

  return (
    <Modal visible={isOpen} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: rc.menuScrim }]}
          onPress={onClose}
          accessibilityLabel="Dismiss font settings"
        />
        <View
          pointerEvents="box-none"
          style={[
            styles.sheetAnchor,
            {
              justifyContent: useBottomSheet ? "flex-end" : "flex-start",
              paddingTop: useBottomSheet ? 0 : Math.max(insets.top, 12) + 16,
              paddingBottom: useBottomSheet ? nativeTabSheetBottomInsetPx(insets.bottom, 0) : 0,
              paddingHorizontal: useBottomSheet ? 0 : 12,
            },
          ]}
        >
          <Animated.View
            style={{
              width: sheetMaxW,
              maxHeight: sheetMaxH,
              opacity: sheetOpacityAnim,
              transform: [
                {
                  translateY: sheetSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [slideFrom, 0],
                  }),
                },
              ],
            }}
          >
            <View
              style={[
                styles.sheetCard,
                {
                  backgroundColor: sheetSurface,
                  borderTopLeftRadius: useBottomSheet ? READER_M3_BOTTOM_SHEET_RADIUS_PX : 28,
                  borderTopRightRadius: useBottomSheet ? READER_M3_BOTTOM_SHEET_RADIUS_PX : 28,
                  borderBottomLeftRadius: useBottomSheet ? 0 : 28,
                  borderBottomRightRadius: useBottomSheet ? 0 : 28,
                  shadowColor: rc.popoverShadow,
                },
              ]}
            >
              {useBottomSheet ? (
                <View style={styles.handleRow}>
                  <View
                    style={{
                      width: READER_M3_BOTTOM_SHEET_HANDLE_WIDTH_PX,
                      height: READER_M3_BOTTOM_SHEET_HANDLE_HEIGHT_PX,
                      borderRadius: 2,
                      backgroundColor: READER_M3_OUTLINE_VARIANT,
                    }}
                  />
                </View>
              ) : null}

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={{
                  paddingHorizontal: padH,
                  paddingTop: useBottomSheet ? 4 * scale : 20 * scale,
                  paddingBottom: 24 * scale,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: READER_M3_SHEET_TITLE_FONT_PX * scale,
                    lineHeight: READER_M3_SHEET_TITLE_LINE_HEIGHT_PX * scale,
                    color: READER_M3_ON_SURFACE,
                    marginBottom: sectionGap,
                  }}
                >
                  Text appearance
                </Text>

                {/* Font family */}
                <View style={{ marginBottom: sectionGap, gap: 6 * scale }}>
                  <Text style={labelStyle(scale, READER_M3_ON_SURFACE_VARIANT)}>Font</Text>
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
                      borderColor: readerFontPickerOpen ? colors.brown800 : READER_M3_OUTLINE_VARIANT,
                      backgroundColor: readerFontPickerOpen
                        ? READER_M3_SURFACE_CONTAINER
                        : READER_M3_SURFACE_CONTAINER_HIGH,
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
                        color: READER_M3_ON_SURFACE,
                      }}
                    >
                      {selectedFontLabel}
                    </Text>
                    <MaterialIcons
                      name={readerFontPickerOpen ? "expand-less" : "expand-more"}
                      size={24 * scale}
                      color={READER_M3_ON_SURFACE_VARIANT}
                    />
                  </Pressable>

                  {readerFontPickerOpen ? (
                    <View
                      style={{
                        borderRadius: 12 * scale,
                        borderWidth: 1,
                        borderColor: READER_M3_OUTLINE_VARIANT,
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
                              android_ripple={
                                Platform.OS === "android" ? { color: rippleColor } : undefined
                              }
                              style={({ pressed }) => ({
                                width: "100%",
                                borderRadius: 8 * scale,
                                overflow: "hidden",
                                backgroundColor: pressed
                                  ? READER_M3_SURFACE_CONTAINER
                                  : selected
                                    ? READER_M3_SURFACE_CONTAINER_HIGH
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
                                    color: READER_M3_ON_SURFACE,
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
                                    <MaterialIcons
                                      name="check"
                                      size={20 * scale}
                                      color={colors.brown800}
                                    />
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

                {/* Font size */}
                <View style={{ marginBottom: sectionGap, gap: 8 * scale }}>
                  <View style={styles.labelRow}>
                    <Text style={labelStyle(scale, READER_M3_ON_SURFACE_VARIANT)}>Font size</Text>
                    <Text style={valueStyle(scale)}>{formatScalePercent(fontSizeScale)}</Text>
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

                {/* Line spacing */}
                <View style={{ marginBottom: sectionGap, gap: 8 * scale }}>
                  <View style={styles.labelRow}>
                    <Text style={labelStyle(scale, READER_M3_ON_SURFACE_VARIANT)}>Line spacing</Text>
                    <Text style={valueStyle(scale)}>{formatScalePercent(lineSpacingScale)}</Text>
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

                {/* Alignment */}
                <View style={{ gap: 8 * scale }}>
                  <Text style={labelStyle(scale, READER_M3_ON_SURFACE_VARIANT)}>Alignment</Text>
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
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
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

function valueStyle(scale: number) {
  return {
    fontFamily: "Inter_500Medium" as const,
    fontSize: READER_M3_LABEL_FONT_PX * scale,
    lineHeight: READER_M3_LABEL_LINE_HEIGHT_PX * scale,
    color: READER_M3_ON_SURFACE,
  };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  sheetAnchor: {
    flex: 1,
    alignItems: "center",
  },
  sheetCard: {
    overflow: "hidden",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  handleRow: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
