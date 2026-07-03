import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Alert,
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
import { CreditsIcon } from "@/components/icons/CreditsIcon";
import { KofiSupportBlock } from "@/components/kofi-support-block";
import { M3SettingsSheetTitle } from "@/src/components/m3/M3SettingsSheetTitle";
import { M3Switch } from "@/components/M3Switch";
import { shareAppLogs } from "@/lib/app-logs";
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
  READER_M3_LIST_ITEM_HEIGHT_PX,
  READER_M3_LIST_TRAILING_ICON_PX,
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
  READER_M3_OUTLINE_VARIANT,
  READER_M3_SURFACE_CONTAINER_HIGH,
  READER_M3_SWITCH_TRACK_HEIGHT_PX,
  READER_M3_SWITCH_TRACK_WIDTH_PX,
} from "@/src/features/reader/readerSettingsPanelChrome";
import { M3Snackbar } from "@/src/components/m3/M3Snackbar";
import { READER_MENU_SLIDE_FROM_PX } from "@/src/features/reader/useReaderGestures";

export type ReaderMoreSettingsSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectCredits: () => void;
  onSelectImportExport: () => void;
  bundle: MobileAppThemeBundle;
  insets: { top: number; bottom: number; left: number; right: number };
  isTabletReaderLayout: boolean;
  settingsMutedTextColor: string;
};

function MoreSettingsTrailingSlot({ scale, children }: { scale: number; children: ReactNode }) {
  return (
    <View
      style={{
        width: READER_M3_SWITCH_TRACK_WIDTH_PX * scale,
        height: READER_M3_SWITCH_TRACK_HEIGHT_PX * scale,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}

function MoreSettingsDivider({ scale }: { scale: number }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: READER_M3_OUTLINE_VARIANT,
        marginLeft: 16 * scale,
      }}
    />
  );
}

type MoreSettingsRowProps = {
  label: string;
  scale: number;
  accessibilityLabel: string;
  trailing: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  busy?: boolean;
  rippleColor?: string;
};

function MoreSettingsRow({
  label,
  scale,
  accessibilityLabel,
  trailing,
  onPress,
  disabled = false,
  busy = false,
  rippleColor,
}: MoreSettingsRowProps) {
  const rowHeight = READER_M3_LIST_ITEM_HEIGHT_PX * scale;
  const rowContent = (
    <View style={[styles.listRow, { minHeight: rowHeight, paddingHorizontal: 16 * scale }]}>
      <Text style={[rowLabelStyle(scale), styles.listRowLabel]}>{label}</Text>
      <MoreSettingsTrailingSlot scale={scale}>{trailing}</MoreSettingsTrailingSlot>
    </View>
  );

  if (!onPress) {
    return rowContent;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, busy }}
      android_ripple={Platform.OS === "android" && rippleColor ? { color: rippleColor } : undefined}
      style={({ pressed }) => ({
        opacity: disabled ? 0.6 : 1,
        backgroundColor: pressed ? READER_M3_SURFACE_CONTAINER_HIGH : "transparent",
      })}
    >
      {rowContent}
    </Pressable>
  );
}

export function ReaderMoreSettingsSheet({
  isOpen,
  onClose,
  onSelectCredits,
  onSelectImportExport,
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
  const [saveLogsBusy, setSaveLogsBusy] = useState(false);
  const [saveLogsSnackbar, setSaveLogsSnackbar] = useState<string | null>(null);
  const sheetSlideAnim = useRef(new Animated.Value(0)).current;
  const sheetOpacityAnim = useRef(new Animated.Value(0)).current;

  const scale = isTabletReaderLayout ? 1.35 : 1;
  const useBottomSheet = !isTabletReaderLayout;
  const sheetMaxW = useBottomSheet ? screenW : Math.min(420, screenW - 48);
  const sheetMaxH = Dimensions.get("window").height * (isTabletReaderLayout ? 0.72 : 0.82);
  const padH = 24 * scale;
  const trailingIconSize = READER_M3_LIST_TRAILING_ICON_PX * scale;
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

  const handleSaveLogs = useCallback(() => {
    if (saveLogsBusy) return;
    hapticLightImpact();
    setSaveLogsBusy(true);
    void (async () => {
      try {
        const result = await shareAppLogs();
        if (result === "shared") {
          setSaveLogsSnackbar("Logs ready to save or share");
          return;
        }
        if (result === "unavailable") {
          Alert.alert(
            "Sharing unavailable",
            "Sharing is not available on this device. Try again on a physical device.",
          );
          return;
        }
        Alert.alert("Could not save logs", "Something went wrong. Try again.");
      } finally {
        setSaveLogsBusy(false);
      }
    })();
  }, [saveLogsBusy]);

  const handleImportExport = useCallback(() => {
    hapticLightImpact();
    onSelectImportExport();
  }, [onSelectImportExport]);

  const handleCredits = useCallback(() => {
    hapticLightImpact();
    onSelectCredits();
  }, [onSelectCredits]);

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
                  paddingBottom: 24 * scale + (useBottomSheet ? insets.bottom : 0),
                }}
              >
                <M3SettingsSheetTitle title="More" scale={scale} />

                <View
                  style={[
                    styles.listBlock,
                    {
                      marginTop: 12 * scale,
                      borderRadius: 12 * scale,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: READER_M3_OUTLINE_VARIANT,
                      overflow: "hidden",
                    },
                  ]}
                >
                  <MoreSettingsRow
                    label="Save logs"
                    scale={scale}
                    accessibilityLabel="Save logs"
                    onPress={handleSaveLogs}
                    disabled={saveLogsBusy}
                    busy={saveLogsBusy}
                    rippleColor={rippleColor}
                    trailing={
                      <MaterialIcons
                        name="ios-share"
                        size={trailingIconSize}
                        color={READER_M3_ON_SURFACE_VARIANT}
                      />
                    }
                  />

                  <MoreSettingsDivider scale={scale} />

                  <MoreSettingsRow
                    label="Haptic feedback"
                    scale={scale}
                    accessibilityLabel="Haptic feedback"
                    trailing={
                      <M3Switch
                        value={hapticsEnabled}
                        onValueChange={toggleHaptics}
                        accessibilityLabel="Haptic feedback"
                        scale={switchScale}
                        trackColorOn={colors.brown800}
                        trackColorOff={READER_M3_SURFACE_CONTAINER_HIGH}
                        trackBorderOff={READER_M3_ON_SURFACE_VARIANT}
                        handleColorOn="#FFFFFF"
                        handleColorOff={READER_M3_ON_SURFACE_VARIANT}
                      />
                    }
                  />

                  <MoreSettingsDivider scale={scale} />

                  <MoreSettingsRow
                    label="Credits"
                    scale={scale}
                    accessibilityLabel="Credits"
                    onPress={handleCredits}
                    rippleColor={rippleColor}
                    trailing={
                      <CreditsIcon size={trailingIconSize} color={READER_M3_ON_SURFACE_VARIANT} />
                    }
                  />

                  <MoreSettingsDivider scale={scale} />

                  <MoreSettingsRow
                    label="Import / Export"
                    scale={scale}
                    accessibilityLabel="Import or export your data"
                    onPress={handleImportExport}
                    rippleColor={rippleColor}
                    trailing={
                      <MaterialIcons
                        name="import-export"
                        size={trailingIconSize}
                        color={READER_M3_ON_SURFACE_VARIANT}
                      />
                    }
                  />
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
        <M3Snackbar
          message={saveLogsSnackbar ?? ""}
          visible={saveLogsSnackbar != null}
          onDismiss={() => setSaveLogsSnackbar(null)}
          bottomInset={insets.bottom + 16}
        />
      </View>
    </Modal>
  );
}

function rowLabelStyle(scale: number) {
  return {
    fontFamily: "Inter_500Medium" as const,
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
    gap: 16,
  },
  listRowLabel: {
    flex: 1,
    flexShrink: 1,
  },
});
