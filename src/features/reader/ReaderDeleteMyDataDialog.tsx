import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { hapticLightImpact } from "@/lib/haptics";
import { M3Button } from "@/src/components/m3/M3Button";
import { M3Snackbar } from "@/src/components/m3/M3Snackbar";
import {
  M3_EMPHASIZED_DECELERATE_EASING,
  M3_MOTION_DURATION_SHORT4_MS,
} from "@/src/components/m3/m3-motion";
import {
  DELETE_MY_DATA_BACKUP_REMINDER_BODY,
  DELETE_MY_DATA_BACKUP_REMINDER_TITLE,
  DELETE_MY_DATA_DIALOG_TITLE,
  DELETE_MY_DATA_ERROR_MESSAGE,
  DELETE_MY_DATA_FOOTNOTE,
  DELETE_MY_DATA_INTRO,
  DELETE_MY_DATA_ITEMS,
} from "@/src/features/reader/deleteMyDataContent";
import {
  READER_M3_BODY_FONT_PX,
  READER_M3_BODY_LINE_HEIGHT_PX,
  READER_M3_BOTTOM_SHEET_RADIUS_PX,
  READER_M3_ERROR,
  READER_M3_ERROR_CONTAINER,
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
  READER_M3_ON_SECONDARY_CONTAINER,
  READER_M3_SECONDARY_CONTAINER,
  READER_M3_SHEET_TITLE_FONT_PX,
  READER_M3_SHEET_TITLE_LINE_HEIGHT_PX,
} from "@/src/features/reader/readerSettingsPanelChrome";

type DeleteDialogStep = "backup-reminder" | "confirm";

export type ReaderDeleteMyDataDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onOpenBackup: () => void;
  onConfirmDelete: () => Promise<void>;
  bundle: MobileAppThemeBundle;
  isTabletReaderLayout?: boolean;
};

/** M3 basic dialog — backup reminder, then destructive confirmation for local data deletion. */
export function ReaderDeleteMyDataDialog({
  isOpen,
  onClose,
  onOpenBackup,
  onConfirmDelete,
  bundle,
  isTabletReaderLayout = false,
}: ReaderDeleteMyDataDialogProps) {
  const rc = bundle.reader;
  const { width: screenW } = useWindowDimensions();
  const [step, setStep] = useState<DeleteDialogStep>("backup-reminder");
  const [deleting, setDeleting] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const scale = isTabletReaderLayout ? 1.15 : 1;
  const dialogMaxW = Math.min(400, screenW - 48);
  const pad = 24 * scale;

  useEffect(() => {
    if (!isOpen) {
      setStep("backup-reminder");
      setDeleting(false);
      setErrorVisible(false);
      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
      return;
    }
    scaleAnim.setValue(0.92);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: M3_MOTION_DURATION_SHORT4_MS,
        easing: M3_EMPHASIZED_DECELERATE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: M3_MOTION_DURATION_SHORT4_MS,
        easing: M3_EMPHASIZED_DECELERATE_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen, opacityAnim, scaleAnim]);

  const handleDismiss = useCallback(() => {
    if (deleting) return;
    hapticLightImpact();
    onClose();
  }, [deleting, onClose]);

  const handleOpenBackup = useCallback(() => {
    if (deleting) return;
    hapticLightImpact();
    onOpenBackup();
  }, [deleting, onOpenBackup]);

  const handleProceedToDelete = useCallback(() => {
    if (deleting) return;
    hapticLightImpact();
    setStep("confirm");
  }, [deleting]);

  const handleDelete = useCallback(() => {
    if (deleting) return;
    hapticLightImpact();
    void (async () => {
      setDeleting(true);
      setErrorVisible(false);
      try {
        await onConfirmDelete();
        onClose();
      } catch {
        setDeleting(false);
        setErrorVisible(true);
      }
    })();
  }, [deleting, onClose, onConfirmDelete]);

  const dismissSnackbar = useCallback(() => {
    setErrorVisible(false);
  }, []);

  return (
    <Modal visible={isOpen} transparent animationType="none" statusBarTranslucent onRequestClose={handleDismiss}>
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: rc.denseModalScrim }]}
          onPress={handleDismiss}
          accessibilityLabel={
            step === "backup-reminder" ? "Dismiss backup reminder" : "Dismiss delete my data dialog"
          }
        />
        <View pointerEvents="box-none" style={styles.centerAnchor}>
          <Animated.View
            style={{
              width: dialogMaxW,
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            }}
          >
            <View
              style={[
                styles.dialogCard,
                {
                  backgroundColor: rc.popoverSurface,
                  borderRadius: READER_M3_BOTTOM_SHEET_RADIUS_PX,
                  shadowColor: rc.popoverShadow,
                  padding: pad,
                },
              ]}
            >
              {step === "backup-reminder" ? (
                <BackupReminderBody scale={scale} />
              ) : (
                <DeleteConfirmBody scale={scale} />
              )}

              {step === "backup-reminder" ? (
                <View style={[styles.actionsRow, { marginTop: 24 * scale, gap: 8 * scale }]}>
                  <M3Button
                    label="No, I want to delete"
                    variant="text"
                    destructive
                    onPress={handleProceedToDelete}
                    bundle={bundle}
                    scale={scale}
                  />
                  <M3Button
                    label="Back up"
                    variant="filled"
                    onPress={handleOpenBackup}
                    bundle={bundle}
                    scale={scale}
                  />
                </View>
              ) : (
                <View style={[styles.actionsRow, { marginTop: 24 * scale, gap: 8 * scale }]}>
                  <M3Button
                    label="Cancel"
                    variant="text"
                    onPress={handleDismiss}
                    disabled={deleting}
                    bundle={bundle}
                    scale={scale}
                  />
                  <M3Button
                    label="Delete my data"
                    variant="text"
                    destructive
                    onPress={handleDelete}
                    disabled={deleting}
                    loading={deleting}
                    bundle={bundle}
                    scale={scale}
                  />
                </View>
              )}
            </View>
          </Animated.View>
        </View>

        <M3Snackbar
          message={DELETE_MY_DATA_ERROR_MESSAGE}
          visible={errorVisible}
          onDismiss={dismissSnackbar}
          bottomInset={32}
        />
      </View>
    </Modal>
  );
}

function BackupReminderBody({ scale }: { scale: number }) {
  return (
    <>
      <View
        style={[
          styles.iconBadge,
          {
            width: 40 * scale,
            height: 40 * scale,
            borderRadius: 20 * scale,
            marginBottom: 16 * scale,
            backgroundColor: READER_M3_SECONDARY_CONTAINER,
          },
        ]}
      >
        <MaterialIcons name="backup" size={22 * scale} color={READER_M3_ON_SECONDARY_CONTAINER} />
      </View>

      <Text
        style={{
          fontFamily: "Inter_500Medium",
          fontSize: READER_M3_SHEET_TITLE_FONT_PX * scale,
          lineHeight: READER_M3_SHEET_TITLE_LINE_HEIGHT_PX * scale,
          color: READER_M3_ON_SURFACE,
          marginBottom: 12 * scale,
        }}
      >
        {DELETE_MY_DATA_BACKUP_REMINDER_TITLE}
      </Text>

      <Text style={bodyStyle(scale, READER_M3_ON_SURFACE_VARIANT)}>{DELETE_MY_DATA_BACKUP_REMINDER_BODY}</Text>
    </>
  );
}

function DeleteConfirmBody({ scale }: { scale: number }) {
  return (
    <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View
        style={[
          styles.iconBadge,
          {
            width: 40 * scale,
            height: 40 * scale,
            borderRadius: 20 * scale,
            marginBottom: 16 * scale,
          },
        ]}
      >
        <MaterialIcons name="delete-outline" size={22 * scale} color={READER_M3_ERROR} />
      </View>

      <Text
        style={{
          fontFamily: "Inter_500Medium",
          fontSize: READER_M3_SHEET_TITLE_FONT_PX * scale,
          lineHeight: READER_M3_SHEET_TITLE_LINE_HEIGHT_PX * scale,
          color: READER_M3_ON_SURFACE,
          marginBottom: 12 * scale,
        }}
      >
        {DELETE_MY_DATA_DIALOG_TITLE}
      </Text>

      <Text style={bodyStyle(scale, READER_M3_ON_SURFACE_VARIANT)}>{DELETE_MY_DATA_INTRO}</Text>

      <View style={{ marginTop: 8 * scale, marginBottom: 12 * scale, gap: 4 * scale }}>
        {DELETE_MY_DATA_ITEMS.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Text style={[bodyStyle(scale, READER_M3_ON_SURFACE_VARIANT), styles.bulletDot]}>•</Text>
            <Text style={[bodyStyle(scale, READER_M3_ON_SURFACE_VARIANT), styles.bulletText]}>{item}</Text>
          </View>
        ))}
      </View>

      <Text style={bodyStyle(scale, READER_M3_ON_SURFACE_VARIANT)}>{DELETE_MY_DATA_FOOTNOTE}</Text>
    </ScrollView>
  );
}

function bodyStyle(scale: number, color: string) {
  return {
    fontFamily: "Inter_400Regular" as const,
    fontSize: READER_M3_BODY_FONT_PX * scale * 0.875,
    lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale * 0.875,
    color,
  };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centerAnchor: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  dialogCard: {
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  iconBadge: {
    backgroundColor: READER_M3_ERROR_CONTAINER,
    alignItems: "center",
    justifyContent: "center",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletDot: {
    width: 12,
    textAlign: "center",
  },
  bulletText: {
    flex: 1,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
});
