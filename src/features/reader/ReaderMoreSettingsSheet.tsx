import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { CreditsIcon } from "@/components/icons/CreditsIcon";
import { KofiSupportBlock } from "@/components/kofi-support-block";
import { M3Switch } from "@/components/M3Switch";
import { ReaderM3BottomSheet } from "@/src/components/m3/ReaderM3BottomSheet";
import { M3Snackbar } from "@/src/components/m3/M3Snackbar";
import { saveAppLogsToDevice } from "@/lib/app-logs";
import { hapticLightImpact } from "@/lib/haptics";
import { getReaderSheetChrome, useReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import {
  loadHapticsEnabledPreference,
  setHapticsEnabled,
  subscribeHapticsEnabled,
} from "@/lib/haptics-preference";
import {
  READER_M3_BODY_FONT_PX,
  READER_M3_BODY_LINE_HEIGHT_PX,
  READER_M3_LIST_ITEM_HEIGHT_PX,
  READER_M3_LIST_TRAILING_ICON_PX,
  READER_M3_SWITCH_TRACK_HEIGHT_PX,
  READER_M3_SWITCH_TRACK_WIDTH_PX,
} from "@/src/features/reader/readerSettingsPanelChrome";

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
  const sheetChrome = useReaderSheetChrome();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: sheetChrome.outlineVariant,
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
  const sheetChrome = useReaderSheetChrome();
  const rowHeight = READER_M3_LIST_ITEM_HEIGHT_PX * scale;
  const rowContent = (
    <View style={[styles.listRow, { minHeight: rowHeight, paddingHorizontal: 16 * scale }]}>
      <Text style={[rowLabelStyle(scale, sheetChrome.onSurface), styles.listRowLabel]}>{label}</Text>
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
        backgroundColor: pressed ? sheetChrome.surfaceContainerHigh : "transparent",
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
  const sheetChrome = useMemo(() => getReaderSheetChrome(bundle), [bundle]);
  const rippleColor = bundle.chrome.androidRipple;
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);
  const [logsExportBusy, setLogsExportBusy] = useState(false);
  const [logsSnackbar, setLogsSnackbar] = useState<string | null>(null);

  const scale = isTabletReaderLayout ? 1.35 : 1;
  const useBottomSheet = !isTabletReaderLayout;
  const trailingIconSize = READER_M3_LIST_TRAILING_ICON_PX * scale;
  const switchScale = scale;

  useEffect(() => {
    void loadHapticsEnabledPreference().then(setHapticsEnabledState);
    return subscribeHapticsEnabled(setHapticsEnabledState);
  }, []);

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

  const dismissLogsSnackbar = useCallback(() => {
    setLogsSnackbar(null);
  }, []);

  const runAfterSheetDismiss = useCallback(async () => {
    onClose();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 320);
    });
  }, [onClose]);

  const handleSaveLogsToDevice = useCallback(() => {
    if (logsExportBusy) return;
    hapticLightImpact();
    setLogsExportBusy(true);
    void (async () => {
      try {
        await runAfterSheetDismiss();
        const result = await saveAppLogsToDevice();
        if (result === "saved") {
          setLogsSnackbar(
            Platform.OS === "android"
              ? "Logs saved to Downloads"
              : "Logs saved in Files → Sinag Bible → logs",
          );
          return;
        }
        if (result === "cancelled") return;
        Alert.alert("Could not save logs", "Something went wrong. Try again.");
      } finally {
        setLogsExportBusy(false);
      }
    })();
  }, [logsExportBusy, runAfterSheetDismiss]);

  const handleImportExport = useCallback(() => {
    hapticLightImpact();
    onSelectImportExport();
  }, [onSelectImportExport]);

  const handleCredits = useCallback(() => {
    hapticLightImpact();
    onSelectCredits();
  }, [onSelectCredits]);

  return (
    <>
      <ReaderM3BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        bundle={bundle}
        insets={insets}
        isTabletReaderLayout={isTabletReaderLayout}
        title="More"
        accessibilityDismissLabel="Dismiss more settings"
        contentPaddingBottom={24 * scale + (useBottomSheet ? insets.bottom : 0)}
      >
        <View
          style={[
            styles.listBlock,
            {
              marginTop: 12 * scale,
              borderRadius: 12 * scale,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: sheetChrome.outlineVariant,
              overflow: "hidden",
            },
          ]}
        >
          <MoreSettingsRow
            label="Save logs"
            scale={scale}
            accessibilityLabel="Save logs"
            onPress={handleSaveLogsToDevice}
            disabled={logsExportBusy}
            busy={logsExportBusy}
            rippleColor={rippleColor}
            trailing={
              <MaterialIcons
                name="download"
                size={trailingIconSize}
                color={sheetChrome.onSurfaceVariant}
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
                trackColorOff={sheetChrome.surfaceContainerHigh}
                trackBorderOff={sheetChrome.onSurfaceVariant}
                handleColorOn="#FFFFFF"
                handleColorOff={sheetChrome.onSurfaceVariant}
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
              <CreditsIcon size={trailingIconSize} color={sheetChrome.onSurfaceVariant} />
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
                color={sheetChrome.onSurfaceVariant}
              />
            }
          />
        </View>

        <View style={{ marginTop: 20 * scale }}>
          <KofiSupportBlock
            bodyColor={sheetChrome.onSurfaceVariant}
            bodyFontSize={READER_M3_BODY_FONT_PX * scale * 0.875}
            bodyLineHeight={READER_M3_BODY_LINE_HEIGHT_PX * scale * 0.875}
            buttonWidth={168 * scale}
          />
        </View>
      </ReaderM3BottomSheet>
      <M3Snackbar
        message={logsSnackbar ?? ""}
        visible={logsSnackbar != null}
        onDismiss={dismissLogsSnackbar}
        bottomInset={insets.bottom + 16}
        icon="check-circle"
        actionLabel="Dismiss"
        onAction={dismissLogsSnackbar}
      />
    </>
  );
}

function rowLabelStyle(scale: number, color: string) {
  return {
    fontFamily: "Inter_500Medium" as const,
    fontSize: READER_M3_BODY_FONT_PX * scale,
    lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale,
    color,
  };
}

const styles = StyleSheet.create({
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
