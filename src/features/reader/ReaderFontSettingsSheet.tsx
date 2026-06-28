import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { ReaderFontSizeSlider } from "@/components/reader-font-size-slider";
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
  type ReaderVerseBodyFontId,
} from "@/lib/reader-verse-body-font";
import { READER_MENU_SLIDE_FROM_PX } from "@/src/features/reader/useReaderGestures";

type ReaderVerseTextAlign = "left" | "right" | "center" | "justify";

const READER_FONT_CARD_PADDING_TOP_PX = 12;
const READER_FONT_CARD_GAP_AFTER_SIZE_SLIDER_PX = 5;
const READER_FONT_CARD_GAP_AFTER_SPACING_SLIDER_PX = 5;
const FONT_SCALE_MIN = 0.5;
const FONT_SCALE_MAX = 3;
const LINE_SPACING_MIN = 0.6;
const LINE_SPACING_MAX = 2;

const FONT_SHEET_ALIGN_ROW: readonly {
  align: ReaderVerseTextAlign;
  Icon: typeof ReaderAlignLeftIcon;
}[] = [
  { align: "left", Icon: ReaderAlignLeftIcon },
  { align: "center", Icon: ReaderAlignCenterIcon },
  { align: "right", Icon: ReaderAlignRightIcon },
  { align: "justify", Icon: ReaderAlignJustifyIcon },
];

function readerVerseTextAlignLabel(a: ReaderVerseTextAlign): string {
  switch (a) {
    case "left":
      return "Left";
    case "right":
      return "Right";
    case "center":
      return "Center";
    case "justify":
      return "Justify";
  }
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
  settingsMutedTextColor,
}: ReaderFontSettingsSheetProps) {
  const colors = bundle.ui;
  const rc = bundle.reader;
  const { width: screenW } = useWindowDimensions();

  const [readerFontPickerOpen, setReaderFontPickerOpen] = useState(false);
  const popupSlideAnim = useRef(new Animated.Value(0)).current;
  const popupOpacityAnim = useRef(new Animated.Value(0)).current;

  const fontSettingsScale = isTabletReaderLayout ? 1.5 : 1;
  const fontSettingsPopupMaxW = Math.min(isTabletReaderLayout ? 510 : 340, screenW - 24);
  const fontSettingsPopupMaxH = Dimensions.get("window").height * (isTabletReaderLayout ? 0.7 : 0.78);
  const fontSettingsPopupPadH = 16 * fontSettingsScale;
  const fontSettingsPopupPadTop = READER_FONT_CARD_PADDING_TOP_PX * fontSettingsScale;
  const fontSettingsPopupPadBottom = 12 * fontSettingsScale;
  const fontSettingsSectionLabelSize = 10 * fontSettingsScale;
  const fontSettingsAlignIconSize = 22 * fontSettingsScale;

  useEffect(() => {
    if (!isOpen) {
      setReaderFontPickerOpen(false);
      popupSlideAnim.setValue(0);
      popupOpacityAnim.setValue(0);
      return;
    }
    popupSlideAnim.setValue(0);
    popupOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(popupSlideAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(popupOpacityAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen, popupSlideAnim, popupOpacityAnim]);

  return (
    <Modal visible={isOpen} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: rc.menuScrim }]}
          onPress={onClose}
          accessibilityLabel="Dismiss font settings"
        />
        <View
          pointerEvents="box-none"
          style={{
            flex: 1,
            justifyContent: isTabletReaderLayout ? "flex-start" : "flex-end",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingTop: isTabletReaderLayout ? Math.max(insets.top, 12) + 16 : 0,
            paddingBottom: isTabletReaderLayout ? 0 : nativeTabSheetBottomInsetPx(insets.bottom, 5),
          }}
        >
          <Animated.View
            style={{
              width: fontSettingsPopupMaxW,
              maxHeight: fontSettingsPopupMaxH,
              opacity: popupOpacityAnim,
              transform: [
                {
                  translateY: popupSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-READER_MENU_SLIDE_FROM_PX, 0],
                  }),
                },
              ],
            }}
          >
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.borderSolid,
                backgroundColor: rc.popoverSurface,
                overflow: "hidden",
                shadowColor: rc.popoverShadow,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.16,
                shadowRadius: 14,
                elevation: 8,
              }}
            >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{
              paddingHorizontal: fontSettingsPopupPadH,
              paddingTop: fontSettingsPopupPadTop,
              paddingBottom: fontSettingsPopupPadBottom,
            }}
          >
            <View style={{ marginBottom: 10 * fontSettingsScale }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10 * fontSettingsScale,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: fontSettingsSectionLabelSize,
                    color: settingsMutedTextColor,
                  }}
                >
                  Font
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    hapticLightImpact();
                    setReaderFontPickerOpen((open) => !open);
                  }}
                  activeOpacity={0.8}
                  accessibilityLabel="Reader font"
                  accessibilityHint="Opens a list of fonts for Bible verse text"
                  accessibilityState={{ expanded: readerFontPickerOpen }}
                  style={{
                    flexShrink: 1,
                    maxWidth: "68%",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6 * fontSettingsScale,
                    paddingVertical: 8 * fontSettingsScale,
                    paddingHorizontal: 14 * fontSettingsScale,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.borderSolid,
                    backgroundColor: rc.popoverRow,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      flexShrink: 1,
                      fontFamily: readerVerseBodyFontFamily(readerVerseBodyFontId),
                      fontSize: 14 * fontSettingsScale,
                      color: colors.brown800,
                    }}
                  >
                    {READER_VERSE_BODY_FONT_OPTIONS.find((o) => o.id === readerVerseBodyFontId)?.label ??
                      "Lora"}
                  </Text>
                  <Ionicons
                    name={readerFontPickerOpen ? "chevron-up" : "chevron-down"}
                    size={Math.round(16 * fontSettingsScale)}
                    color={colors.tan300}
                  />
                </TouchableOpacity>
              </View>
              {readerFontPickerOpen ? (
                <View
                  style={{
                    marginTop: 8 * fontSettingsScale,
                    borderRadius: 12 * fontSettingsScale,
                    borderWidth: 1,
                    borderColor: colors.borderSolid,
                    backgroundColor: rc.popoverSurface,
                    maxHeight: 240 * fontSettingsScale,
                    overflow: "hidden",
                  }}
                >
                  <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator
                    bounces={false}
                  >
                    {READER_VERSE_BODY_FONT_OPTIONS.map((opt) => {
                      const selected = opt.id === readerVerseBodyFontId;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          onPress={() => {
                            hapticLightImpact();
                            setReaderVerseBodyFontIdPersisted(opt.id);
                            setReaderFontPickerOpen(false);
                          }}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          style={{
                            paddingVertical: 11 * fontSettingsScale,
                            paddingHorizontal: 12 * fontSettingsScale,
                            backgroundColor: selected ? rc.popoverRow : "transparent",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: readerVerseBodyFontFamily(opt.id),
                              fontSize: 16 * fontSettingsScale,
                              color: colors.brown800,
                            }}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
            </View>

            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: fontSettingsSectionLabelSize,
                color: settingsMutedTextColor,
                marginBottom: 8 * fontSettingsScale,
              }}
            >
              Font size
            </Text>
            <ReaderFontSizeSlider
              variant="sheet"
              value={fontSizeScale}
              min={FONT_SCALE_MIN}
              max={FONT_SCALE_MAX}
              onValueChange={setFontSizeScalePersisted}
              accessibilityLabel={`Font size ${Math.round(fontSizeScale * 100)} percent`}
            />

            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: fontSettingsSectionLabelSize,
                color: settingsMutedTextColor,
                marginTop: READER_FONT_CARD_GAP_AFTER_SIZE_SLIDER_PX * fontSettingsScale,
                marginBottom: 4 * fontSettingsScale,
              }}
            >
              Font spacing
            </Text>
            <ReaderFontSizeSlider
              variant="sheet"
              value={lineSpacingScale}
              min={LINE_SPACING_MIN}
              max={LINE_SPACING_MAX}
              onValueChange={setLineSpacingScalePersisted}
              accessibilityLabel={`Font spacing ${Math.round(lineSpacingScale * 100)} percent`}
            />

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "stretch",
                marginTop: READER_FONT_CARD_GAP_AFTER_SPACING_SLIDER_PX * fontSettingsScale,
                gap: 10 * fontSettingsScale,
              }}
            >
              {FONT_SHEET_ALIGN_ROW.map(({ align, Icon }) => {
                const isActive = verseTextAlign === align;
                const label = readerVerseTextAlignLabel(align);
                const cellStyle = {
                  width: "100%" as const,
                  minHeight: 48 * fontSettingsScale,
                  alignItems: "center" as const,
                  justifyContent: "center" as const,
                  paddingVertical: 12 * fontSettingsScale,
                  borderRadius: 12 * fontSettingsScale,
                };
                return (
                  <TouchableOpacity
                    key={align}
                    onPress={() => setVerseTextAlignPersisted(align)}
                    activeOpacity={0.75}
                    accessibilityLabel={`Verse text ${label.toLowerCase()} aligned`}
                    accessibilityState={{ selected: isActive }}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    {isActive ? (
                      <LinearGradient
                        colors={rc.translationSelectedGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={cellStyle}
                      >
                        <Icon size={fontSettingsAlignIconSize} color="#f5e9d6" />
                      </LinearGradient>
                    ) : (
                      <View style={[cellStyle, { backgroundColor: rc.popoverRow }]}>
                        <Icon size={fontSettingsAlignIconSize} color={colors.brown800} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}
