import { useCallback, useEffect, useRef, useState } from "react";
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
import { KofiSupportBlock } from "@/components/kofi-support-block";
import { M3Switch } from "@/components/M3Switch";
import { nativeTabSheetBottomInsetPx } from "@/lib/native-tab-chrome";
import { hapticLightImpact } from "@/lib/haptics";
import {
  loadHapticsEnabledPreference,
  setHapticsEnabled,
  subscribeHapticsEnabled,
} from "@/lib/haptics-preference";
import {
  M3_EMPHASIZED_DECELERATE_EASING,
  M3_MOTION_DURATION_SHORT4_MS,
} from "@/src/components/m3/m3-motion";
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
} from "@/src/features/reader/readerSettingsPanelChrome";
import { READER_MENU_SLIDE_FROM_PX } from "@/src/features/reader/useReaderGestures";

export type ReaderMoreSettingsSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectCredits: () => void;
  bundle: MobileAppThemeBundle;
  insets: { top: number; bottom: number; left: number; right: number };
  isTabletReaderLayout: boolean;
  settingsMutedTextColor: string;
};

export function ReaderMoreSettingsSheet({
  isOpen,
  onClose,
  onSelectCredits,
  bundle,
  insets,
  isTabletReaderLayout,
  settingsMutedTextColor: _settingsMutedTextColor,
}: ReaderMoreSettingsSheetProps) {
  const colors = bundle.ui;
  const rc = bundle.reader;
  const rippleColor = bundle.chrome.androidRipple;
  const { width: screenW } = useWindowDimensions();
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);
  const sheetSlideAnim = useRef(new Animated.Value(0)).current;
  const sheetOpacityAnim = useRef(new Animated.Value(0)).current;

  const scale = isTabletReaderLayout ? 1.35 : 1;
  const useBottomSheet = !isTabletReaderLayout;
  const sheetMaxW = useBottomSheet ? screenW : Math.min(420, screenW - 48);
  const sheetMaxH = Dimensions.get("window").height * (isTabletReaderLayout ? 0.72 : 0.82);
  const padH = 24 * scale;
  const rowMinHeight = 56 * scale;
  const switchScale = scale;

  useEffect(() => {
    void loadHapticsEnabledPreference().then(setHapticsEnabledState);
    return subscribeHapticsEnabled(setHapticsEnabledState);
  }, []);

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
  }, [isOpen, sheetSlideAnim, sheetOpacityAnim]);

  const toggleHaptics = useCallback(() => {
    void (async () => {
      const next = !hapticsEnabled;
      if (hapticsEnabled) {
        hapticLightImpact();
      }
      await setHapticsEnabled(next);
      if (next) {
        hapticLightImpact();
      }
    })();
  }, [hapticsEnabled]);

  const slideFrom = useBottomSheet ? 48 : READER_MENU_SLIDE_FROM_PX;

  return (
    <Modal visible={isOpen} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: rc.menuScrim }]}
          onPress={onClose}
          accessibilityLabel="Dismiss more settings"
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
                  paddingBottom: 24 * scale,
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
                  More
                </Text>

                <View style={[styles.listBlock, { marginTop: 4 * scale }]}>
                  <View
                    style={[
                      styles.listRow,
                      {
                        minHeight: rowMinHeight,
                        paddingVertical: 8 * scale,
                      },
                    ]}
                  >
                    <Text style={[rowLabelStyle(scale), styles.listRowLabel]}>Haptic feedback</Text>
                    <M3Switch
                      value={hapticsEnabled}
                      onValueChange={toggleHaptics}
                      accessibilityLabel="Haptic feedback"
                      scale={switchScale}
                      trackColorOn={colors.brown800}
                      trackColorOff={READER_M3_SURFACE_CONTAINER}
                      trackBorderOff={READER_M3_ON_SURFACE_VARIANT}
                      handleColorOn="#FFFFFF"
                      handleColorOff={READER_M3_ON_SURFACE_VARIANT}
                    />
                  </View>

                  <Pressable
                    onPress={() => {
                      hapticLightImpact();
                      onSelectCredits();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Credits"
                    android_ripple={Platform.OS === "android" ? { color: rippleColor } : undefined}
                    style={({ pressed }) => ({
                      width: "100%",
                      minHeight: rowMinHeight,
                      paddingVertical: 12 * scale,
                      backgroundColor: pressed ? READER_M3_SURFACE_CONTAINER : "transparent",
                    })}
                  >
                    <View style={styles.listRow}>
                      <Text style={[rowLabelStyle(scale), styles.listRowLabel]}>Credits</Text>
                      <MaterialIcons
                        name="chevron-right"
                        size={24 * scale}
                        color={READER_M3_ON_SURFACE_VARIANT}
                      />
                    </View>
                  </Pressable>
                </View>

                <View style={{ marginTop: 20 * scale }}>
                <KofiSupportBlock
                  bodyColor={READER_M3_ON_SURFACE_VARIANT}
                  bodyFontSize={READER_M3_BODY_FONT_PX * scale * 0.875}
                  bodyLineHeight={READER_M3_BODY_LINE_HEIGHT_PX * scale * 0.875}
                  buttonWidth={168 * scale}
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

function rowLabelStyle(scale: number) {
  return {
    fontFamily: "Inter_400Regular" as const,
    fontSize: READER_M3_BODY_FONT_PX * scale,
    lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale,
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
  listBlock: {
    width: "100%",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  listRowLabel: {
    flex: 1,
    flexShrink: 1,
  },
});
