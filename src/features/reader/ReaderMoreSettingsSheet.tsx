import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { KofiSupportBlock } from "@/components/kofi-support-block";
import { M3Switch } from "@/components/M3Switch";
import { CreditsIcon } from "@/components/icons/CreditsIcon";
import { hapticLightImpact } from "@/lib/haptics";
import {
  loadHapticsEnabledPreference,
  setHapticsEnabled,
  subscribeHapticsEnabled,
} from "@/lib/haptics-preference";
import {
  READER_M3_SURFACE_CONTAINER,
} from "@/src/features/reader/readerSettingsPanelChrome";

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
  settingsMutedTextColor,
}: ReaderMoreSettingsSheetProps) {
  const colors = bundle.ui;
  const rc = bundle.reader;
  const { width: screenW } = useWindowDimensions();
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);
  const scale = useSharedValue(0.94);
  const opacity = useSharedValue(0);

  const sheetScale = isTabletReaderLayout ? 1.5 : 1;
  const sheetSideInsetPx = 12 + 30;
  const sheetMaxW = Math.min(isTabletReaderLayout ? 380 : 300, screenW - sheetSideInsetPx * 2);
  const sheetPadH = 16 * sheetScale;
  const sheetPadTop = 16 * sheetScale;
  const sheetPadBottom = 16 * sheetScale;
  const sheetTitleSize = 12 * sheetScale;
  const sheetRowLabelSize = 14 * sheetScale;
  const switchScale = sheetScale;

  useEffect(() => {
    void loadHapticsEnabledPreference().then(setHapticsEnabledState);
    return subscribeHapticsEnabled(setHapticsEnabledState);
  }, []);

  useEffect(() => {
    if (isOpen) {
      scale.value = withSpring(1, { damping: 18, stiffness: 280, mass: 0.8 });
      opacity.value = withTiming(1, { duration: 180 });
    } else {
      scale.value = withSpring(0.94, { damping: 20, stiffness: 300 });
      opacity.value = withTiming(0, { duration: 140 });
    }
  }, [isOpen, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

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

  return (
    <Modal visible={isOpen} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: rc.menuScrim }]}
          onPress={onClose}
          accessibilityLabel="Dismiss more settings"
        />
        <View
          pointerEvents="box-none"
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 12,
          }}
        >
          <Animated.View style={[{ width: sheetMaxW }, animatedStyle]}>
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
                paddingHorizontal: sheetPadH,
                paddingTop: sheetPadTop,
                paddingBottom: sheetPadBottom,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: sheetTitleSize,
                  color: settingsMutedTextColor,
                  marginBottom: 12 * sheetScale,
                }}
              >
                More
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12 * sheetScale,
                  marginBottom: 8 * sheetScale,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontFamily: "Inter_400Regular",
                    fontSize: sheetRowLabelSize,
                    color: colors.brown800,
                  }}
                >
                  Haptic Feedback
                </Text>
                <M3Switch
                  value={hapticsEnabled}
                  onValueChange={toggleHaptics}
                  accessibilityLabel="Haptic Feedback"
                  scale={switchScale}
                  trackColorOn={colors.brown800}
                  trackColorOff={READER_M3_SURFACE_CONTAINER}
                  trackBorderOff={colors.brown800}
                  handleColorOn="#FFFFFF"
                  handleColorOff={colors.brown800}
                />
              </View>
              <Pressable
                onPress={() => {
                  hapticLightImpact();
                  onSelectCredits();
                }}
                accessibilityRole="button"
                accessibilityLabel="Credits"
                style={({ pressed }) => ({
                  width: "100%",
                  paddingVertical: 10 * sheetScale,
                  borderRadius: 12 * sheetScale,
                  backgroundColor: pressed ? colors.parchmentDark : "transparent",
                })}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12 * sheetScale,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: sheetRowLabelSize,
                      color: colors.brown800,
                    }}
                  >
                    Credits
                  </Text>
                  <CreditsIcon size={22 * sheetScale} color={colors.brown800} />
                </View>
              </Pressable>
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: colors.borderSolid,
                  marginVertical: 8 * sheetScale,
                }}
              />
              <KofiSupportBlock
                bodyColor={colors.brown800}
                bodyFontSize={13 * sheetScale}
                bodyLineHeight={19 * sheetScale}
                buttonWidth={168 * sheetScale}
              />
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}
