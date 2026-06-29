import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { HapticFeedbackToggle } from "@/components/HapticFeedbackToggle";
import { hapticLightImpact } from "@/lib/haptics";
import {
  loadHapticsEnabledPreference,
  setHapticsEnabled,
  subscribeHapticsEnabled,
} from "@/lib/haptics-preference";

export type ReaderMoreSettingsSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  bundle: MobileAppThemeBundle;
  insets: { top: number; bottom: number; left: number; right: number };
  isTabletReaderLayout: boolean;
  settingsMutedTextColor: string;
};

export function ReaderMoreSettingsSheet({
  isOpen,
  onClose,
  bundle,
  insets,
  isTabletReaderLayout,
  settingsMutedTextColor,
}: ReaderMoreSettingsSheetProps) {
  const colors = bundle.ui;
  const rc = bundle.reader;
  const { width: screenW } = useWindowDimensions();
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);
  const popupSlideAnim = useRef(new Animated.Value(0)).current;
  const popupOpacityAnim = useRef(new Animated.Value(0)).current;

  const sheetScale = isTabletReaderLayout ? 1.5 : 1;
  const sheetSideInsetPx = 12 + 30;
  const sheetMaxW = Math.min(isTabletReaderLayout ? 360 : 280, screenW - sheetSideInsetPx * 2);
  const sheetPadH = 16 * sheetScale;
  const sheetPadTop = 16 * sheetScale;
  const sheetPadBottom = 16 * sheetScale;
  const sheetTitleSize = 12 * sheetScale;
  const sheetRowLabelSize = 14 * sheetScale;
  const toggleSize = 40 * sheetScale * 1.5;

  useEffect(() => {
    void loadHapticsEnabledPreference().then(setHapticsEnabledState);
    return subscribeHapticsEnabled(setHapticsEnabledState);
  }, []);

  useEffect(() => {
    if (!isOpen) {
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
          <Animated.View
            style={{
              width: sheetMaxW,
              opacity: popupOpacityAnim,
              transform: [
                {
                  scale: popupSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1],
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
                <HapticFeedbackToggle
                  enabled={hapticsEnabled}
                  onToggle={toggleHaptics}
                  size={toggleSize}
                  color={colors.brown800}
                />
              </View>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}
