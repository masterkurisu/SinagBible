import { useCallback, useEffect, useRef } from "react";
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
import {
  mobileAppThemePickerOptions,
  type MobileAppThemeBundle,
  type MobileAppThemeId,
} from "@sinag-bible/tokens";
import { M3Button } from "@/src/components/m3/M3Button";
import {
  M3_EMPHASIZED_DECELERATE_EASING,
  M3_MOTION_DURATION_SHORT4_MS,
} from "@/src/components/m3/m3-motion";
import { hapticLightImpact } from "@/lib/haptics";
import { readerThemeTileOnSwatchLabel } from "@/src/features/reader/readerThemeTileChrome";
import {
  READER_M3_BODY_FONT_PX,
  READER_M3_BODY_LINE_HEIGHT_PX,
  READER_M3_BOTTOM_SHEET_HANDLE_HEIGHT_PX,
  READER_M3_BOTTOM_SHEET_HANDLE_WIDTH_PX,
  READER_M3_BOTTOM_SHEET_RADIUS_PX,
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
  READER_M3_OUTLINE_VARIANT,
  READER_M3_SHEET_TITLE_FONT_PX,
  READER_M3_SHEET_TITLE_LINE_HEIGHT_PX,
  READER_M3_SURFACE_CONTAINER,
  READER_M3_SURFACE_CONTAINER_HIGH,
} from "@/src/features/reader/readerSettingsPanelChrome";
import { READER_MENU_SLIDE_FROM_PX } from "@/src/features/reader/useReaderGestures";

export type ReaderThemePickerSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  bundle: MobileAppThemeBundle;
  insets: { top: number; bottom: number; left: number; right: number };
  isTabletReaderLayout: boolean;
  themeId: MobileAppThemeId;
  setThemeId: (id: MobileAppThemeId) => void;
};

export function ReaderThemePickerSheet({
  isOpen,
  onClose,
  bundle,
  insets,
  isTabletReaderLayout,
  themeId,
  setThemeId,
}: ReaderThemePickerSheetProps) {
  const rc = bundle.reader;
  const rippleColor = bundle.chrome.androidRipple;
  const primary = bundle.chrome.tabTint;
  const { width: screenW } = useWindowDimensions();
  const sheetSlideAnim = useRef(new Animated.Value(0)).current;
  const sheetOpacityAnim = useRef(new Animated.Value(0)).current;

  const scale = isTabletReaderLayout ? 1.35 : 1;
  const useBottomSheet = !isTabletReaderLayout;
  const sheetMaxW = useBottomSheet ? screenW : Math.min(420, screenW - 48);
  const sheetMaxH = Dimensions.get("window").height * (isTabletReaderLayout ? 0.72 : 0.82);
  const padH = 24 * scale;
  const columns = 3;
  const rowGap = 24 * scale;
  const colGap = 16 * scale;
  const contentW = sheetMaxW - padH * 2;
  const cellW = (contentW - colGap * (columns - 1)) / columns;
  const circleSize = Math.min(64 * scale, cellW - 8 * scale);
  const ringSize = circleSize + 8 * scale;

  useEffect(() => {
    if (!isOpen) {
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
  }, [isOpen, sheetOpacityAnim, sheetSlideAnim]);

  const handleSelectTheme = useCallback(
    (id: MobileAppThemeId) => {
      hapticLightImpact();
      setThemeId(id);
      onClose();
    },
    [onClose, setThemeId],
  );

  const slideFrom = useBottomSheet ? 48 : READER_MENU_SLIDE_FROM_PX;

  return (
    <Modal visible={isOpen} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: rc.menuScrim }]}
          onPress={onClose}
          accessibilityLabel="Dismiss theme picker"
        />
        <View
          pointerEvents="box-none"
          style={[
            styles.sheetAnchor,
            {
              justifyContent: useBottomSheet ? "flex-end" : "flex-start",
              paddingTop: useBottomSheet ? 0 : Math.max(insets.top, 12) + 16,
              paddingBottom: 0,
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
                  backgroundColor: rc.popoverSurface,
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
                  paddingBottom: useBottomSheet
                    ? Math.max(insets.bottom, 16) * scale
                    : 16 * scale,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: READER_M3_SHEET_TITLE_FONT_PX * scale,
                    lineHeight: READER_M3_SHEET_TITLE_LINE_HEIGHT_PX * scale,
                    color: READER_M3_ON_SURFACE,
                    marginBottom: 8 * scale,
                  }}
                >
                  Theme
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: READER_M3_BODY_FONT_PX * scale * 0.875,
                    lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale * 0.875,
                    color: READER_M3_ON_SURFACE_VARIANT,
                    marginBottom: 28 * scale,
                  }}
                >
                  Choose a color palette for the reader, journal, and navigation.
                </Text>

                <View style={[styles.grid, { marginBottom: 8 * scale }]}>
                  {mobileAppThemePickerOptions.map((opt, index) => {
                    const selected = opt.id === themeId;
                    const col = index % columns;
                    const row = Math.floor(index / columns);
                    const totalRows = Math.ceil(mobileAppThemePickerOptions.length / columns);
                    const isLastCol = col === columns - 1;
                    const isLastRow = row === totalRows - 1;
                    const onSwatchLabel = readerThemeTileOnSwatchLabel(opt.swatchColor);
                    return (
                      <View
                        key={opt.id}
                        style={{
                          width: cellW,
                          marginRight: isLastCol ? 0 : colGap,
                          marginBottom: isLastRow ? 0 : rowGap,
                          alignItems: "center",
                        }}
                      >
                        <Pressable
                          onPress={() => handleSelectTheme(opt.id)}
                          accessibilityRole="button"
                          accessibilityLabel={opt.label}
                          accessibilityState={{ selected }}
                          android_ripple={
                            Platform.OS === "android" ? { color: rippleColor, borderless: true } : undefined
                          }
                          style={({ pressed }) => ({
                            alignItems: "center",
                            justifyContent: "center",
                            width: ringSize,
                            height: ringSize,
                            borderRadius: ringSize / 2,
                            borderWidth: selected ? 2.5 : 1,
                            borderColor: selected ? primary : READER_M3_OUTLINE_VARIANT,
                            backgroundColor: pressed
                              ? READER_M3_SURFACE_CONTAINER
                              : selected
                                ? READER_M3_SURFACE_CONTAINER_HIGH
                                : "transparent",
                            overflow: "hidden",
                          })}
                        >
                          <View
                            style={{
                              width: circleSize,
                              height: circleSize,
                              borderRadius: circleSize / 2,
                              backgroundColor: opt.swatchColor,
                              alignItems: "center",
                              justifyContent: "center",
                              shadowColor: "#000000",
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.12,
                              shadowRadius: 2,
                              elevation: 2,
                            }}
                          >
                            {selected ? (
                              <View
                                style={{
                                  width: 26 * scale,
                                  height: 26 * scale,
                                  borderRadius: 13 * scale,
                                  backgroundColor: "rgba(255,255,255,0.94)",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <MaterialIcons name="check" size={16 * scale} color={primary} />
                              </View>
                            ) : (
                              <Text
                                style={{
                                  fontFamily: "Inter_600SemiBold",
                                  fontSize: 13 * scale,
                                  color: onSwatchLabel,
                                  opacity: 0.9,
                                }}
                              >
                                Aa
                              </Text>
                            )}
                          </View>
                        </Pressable>
                        <Text
                          numberOfLines={1}
                          style={{
                            marginTop: 10 * scale,
                            fontFamily: selected ? "Inter_600SemiBold" : "Inter_500Medium",
                            fontSize: READER_M3_BODY_FONT_PX * scale * 0.8125,
                            lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale * 0.8125,
                            color: selected ? READER_M3_ON_SURFACE : READER_M3_ON_SURFACE_VARIANT,
                            textAlign: "center",
                            maxWidth: cellW,
                          }}
                        >
                          {opt.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View style={{ marginTop: 24 * scale }}>
                  <M3Button
                    label="Close"
                    variant="text"
                    onPress={() => {
                      hapticLightImpact();
                      onClose();
                    }}
                    bundle={bundle}
                    scale={scale}
                    fullWidth
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
