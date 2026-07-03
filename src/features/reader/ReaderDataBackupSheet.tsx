import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { M3Button } from "@/src/components/m3/M3Button";
import { M3Snackbar } from "@/src/components/m3/M3Snackbar";
import { ReaderM3BottomSheet } from "@/src/components/m3/ReaderM3BottomSheet";
import { hapticLightImpact } from "@/lib/haptics";
import {
  applyImportBackupFromUri,
  ImportBackupInvalidError,
  pickImportBackupFile,
  saveUserDataToDevice,
  shareUserData,
} from "@/lib/user-data-backup";
import {
  beginReaderDataImportPicking,
  endReaderDataImportPicking,
  runReaderDataImportWithAnimation,
  waitForReaderDataImportUiSettled,
  yieldForReaderDataImportPaint,
} from "@/lib/reader-data-import-sync";
import {
  READER_M3_BODY_FONT_PX,
  READER_M3_BODY_LINE_HEIGHT_PX,
  READER_M3_ERROR,
  READER_M3_ERROR_CONTAINER,
  READER_M3_LIST_TRAILING_ICON_PX,
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
  READER_M3_OUTLINE_VARIANT,
  READER_M3_SECONDARY_CONTAINER,
  READER_M3_SURFACE_CONTAINER_HIGH,
} from "@/src/features/reader/readerSettingsPanelChrome";

export type ReaderDataBackupSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  bundle: MobileAppThemeBundle;
  insets: { top: number; bottom: number; left: number; right: number };
  isTabletReaderLayout?: boolean;
};

type SheetStep = "menu" | "import-confirm";

/** M3 two-line list item height for action rows with supporting text. */
const BACKUP_ACTION_ROW_MIN_HEIGHT_PX = 72;

type BackupActionRowProps = {
  label: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  scale: number;
  rippleColor: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

function BackupActionRow({
  label,
  description,
  icon,
  scale,
  rippleColor,
  onPress,
  disabled = false,
  destructive = false,
}: BackupActionRowProps) {
  const iconSize = READER_M3_LIST_TRAILING_ICON_PX * scale;
  const rowMinHeight = BACKUP_ACTION_ROW_MIN_HEIGHT_PX * scale;
  const rowPadV = 14 * scale;
  const labelColor = destructive ? READER_M3_ERROR : READER_M3_ON_SURFACE;
  const iconColor = destructive ? READER_M3_ERROR : READER_M3_ON_SURFACE_VARIANT;
  const iconBadgeBg = destructive ? READER_M3_ERROR_CONTAINER : READER_M3_SECONDARY_CONTAINER;

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        hapticLightImpact();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      android_ripple={Platform.OS === "android" ? { color: rippleColor } : undefined}
      style={({ pressed }) => ({
        opacity: disabled ? 0.6 : 1,
        backgroundColor: pressed ? READER_M3_SURFACE_CONTAINER_HIGH : "transparent",
      })}
    >
      <View
        style={[
          styles.actionRow,
          {
            minHeight: rowMinHeight,
            paddingHorizontal: 16 * scale,
            paddingVertical: rowPadV,
            gap: 16 * scale,
          },
        ]}
      >
        <View
          style={[
            styles.leadingIconBadge,
            {
              width: 40 * scale,
              height: 40 * scale,
              borderRadius: 20 * scale,
              backgroundColor: iconBadgeBg,
            },
          ]}
        >
          <MaterialIcons name={icon} size={iconSize} color={iconColor} />
        </View>
        <View style={styles.actionText}>
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: READER_M3_BODY_FONT_PX * scale,
              lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale,
              color: labelColor,
            }}
          >
            {label}
          </Text>
          <Text
            style={{
              marginTop: 6 * scale,
              fontFamily: "Inter_400Regular",
              fontSize: READER_M3_BODY_FONT_PX * scale * 0.875,
              lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale * 0.9375,
              color: READER_M3_ON_SURFACE_VARIANT,
            }}
          >
            {description}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={iconSize} color={READER_M3_ON_SURFACE_VARIANT} />
      </View>
    </Pressable>
  );
}

function BackupMenuDivider({ scale }: { scale: number }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: READER_M3_OUTLINE_VARIANT,
        marginLeft: 72 * scale,
      }}
    />
  );
}

export function ReaderDataBackupSheet({
  isOpen,
  onClose,
  bundle,
  insets,
  isTabletReaderLayout = false,
}: ReaderDataBackupSheetProps) {
  const rippleColor = bundle.chrome.androidRipple;
  const scale = isTabletReaderLayout ? 1.35 : 1;
  const useBottomSheet = !isTabletReaderLayout;
  const [step, setStep] = useState<SheetStep>("menu");
  const [busy, setBusy] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const dismissSnackbar = useCallback(() => {
    setSnackbar(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setStep("menu");
      setBusy(false);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (busy) return;
    if (step === "import-confirm") {
      setStep("menu");
      return;
    }
    onClose();
  }, [busy, onClose, step]);

  const handleSaveToDevice = useCallback(() => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        const result = await saveUserDataToDevice();
        if (result === "saved") {
          setSnackbar(
            Platform.OS === "android"
              ? "Backup saved to Downloads"
              : "Backup saved in Files → Sinag Bible → backups",
          );
          onClose();
          return;
        }
        if (result === "cancelled") return;
        Alert.alert("Could not save backup", "Something went wrong. Try again.");
      } finally {
        setBusy(false);
      }
    })();
  }, [busy, onClose]);

  const handleShareBackup = useCallback(() => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        const result = await shareUserData();
        if (result === "shared") {
          setSnackbar("Backup ready to share");
          onClose();
          return;
        }
        if (result === "unavailable") {
          Alert.alert(
            "Sharing unavailable",
            "Sharing is not available on this device. Try again on a physical device.",
          );
          return;
        }
        Alert.alert("Could not share backup", "Something went wrong. Try again.");
      } finally {
        setBusy(false);
      }
    })();
  }, [busy, onClose]);

  const handleConfirmImport = useCallback(() => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        onClose();
        await yieldForReaderDataImportPaint();

        beginReaderDataImportPicking();
        await yieldForReaderDataImportPaint();

        const pickResult = await pickImportBackupFile();
        if (pickResult.status === "cancelled") {
          endReaderDataImportPicking();
          return;
        }

        await runReaderDataImportWithAnimation(async () => {
          await applyImportBackupFromUri(pickResult.uri);
        });
        await waitForReaderDataImportUiSettled();
        setSnackbar("Your data was imported");
      } catch (error) {
        endReaderDataImportPicking();
        if (error instanceof ImportBackupInvalidError) {
          Alert.alert("Invalid backup file", "Choose a JSON file exported from Sinag Bible.");
          return;
        }
        Alert.alert("Could not import", "Something went wrong. Try again.");
      } finally {
        setBusy(false);
      }
    })();
  }, [busy, onClose]);

  const menuBody = (
    <View
      style={[
        styles.listBlock,
        {
          marginTop: 8 * scale,
          borderRadius: 12 * scale,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: READER_M3_OUTLINE_VARIANT,
          overflow: "hidden",
        },
      ]}
    >
      <BackupActionRow
        label="Save to device"
        description="Write a backup JSON file to your device"
        icon="download"
        scale={scale}
        rippleColor={rippleColor}
        onPress={handleSaveToDevice}
        disabled={busy}
      />
      <BackupMenuDivider scale={scale} />
      <BackupActionRow
        label="Share backup"
        description="Send your backup to another app"
        icon="ios-share"
        scale={scale}
        rippleColor={rippleColor}
        onPress={handleShareBackup}
        disabled={busy}
      />
      <BackupMenuDivider scale={scale} />
      <BackupActionRow
        label="Import backup"
        description="Replace journal, favorites, highlights, and notes"
        icon="upload-file"
        scale={scale}
        rippleColor={rippleColor}
        onPress={() => setStep("import-confirm")}
        disabled={busy}
        destructive
      />
    </View>
  );

  const importConfirmBody = (
    <View style={{ paddingTop: 4 * scale }}>
      <View
        style={[
          styles.warningBadge,
          {
            width: 40 * scale,
            height: 40 * scale,
            borderRadius: 20 * scale,
            marginBottom: 20 * scale,
          },
        ]}
      >
        <MaterialIcons name="warning-amber" size={22 * scale} color={READER_M3_ERROR} />
      </View>
      <Text
        style={{
          fontFamily: "Inter_500Medium",
          fontSize: READER_M3_BODY_FONT_PX * scale,
          lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale,
          color: READER_M3_ON_SURFACE,
          marginBottom: 12 * scale,
        }}
      >
        Replace your data?
      </Text>
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: READER_M3_BODY_FONT_PX * scale * 0.875,
          lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale * 0.9375,
          color: READER_M3_ON_SURFACE_VARIANT,
        }}
      >
        Importing will replace your journal entries, favorite verses, highlights, and notes with the
        contents of the backup file. This cannot be undone.
      </Text>
      <View style={[styles.confirmActions, { marginTop: 28 * scale, gap: 12 * scale }]}>
        <M3Button
          label="Cancel"
          variant="text"
          onPress={() => setStep("menu")}
          disabled={busy}
          bundle={bundle}
          scale={scale}
        />
        <M3Button
          label="Choose file"
          variant="text"
          destructive
          onPress={handleConfirmImport}
          disabled={busy}
          loading={busy}
          bundle={bundle}
          scale={scale}
        />
      </View>
    </View>
  );

  return (
    <>
      <ReaderM3BottomSheet
        isOpen={isOpen}
        onClose={handleClose}
        bundle={bundle}
        insets={insets}
        isTabletReaderLayout={isTabletReaderLayout}
        title="Import / Export"
        subtitle={
          step === "menu"
            ? "Back up or restore your journal, favorite verses, highlights, and notes."
            : "Choose a backup file to restore your journal, favorites, highlights, and notes."
        }
        accessibilityDismissLabel="Dismiss import and export"
        scrollable
        maxHeightRatio={0.68}
        contentPaddingBottom={(useBottomSheet ? Math.max(insets.bottom, 20) : 20) * scale}
      >
        {step === "menu" ? menuBody : importConfirmBody}
      </ReaderM3BottomSheet>
      <M3Snackbar
        message={snackbar ?? ""}
        visible={snackbar != null}
        onDismiss={dismissSnackbar}
        bottomInset={insets.bottom + 16}
        icon="check-circle"
        actionLabel="Dismiss"
        onAction={dismissSnackbar}
      />
    </>
  );
}

const styles = StyleSheet.create({
  listBlock: {
    width: "100%",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  leadingIconBadge: {
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    flex: 1,
    minWidth: 0,
  },
  warningBadge: {
    backgroundColor: READER_M3_ERROR_CONTAINER,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
});
