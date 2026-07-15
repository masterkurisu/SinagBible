import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { DismissibleDialog } from "@/src/components/m3/DismissibleDialog";
import { hapticLightImpact } from "@/lib/haptics";
import { M3Button } from "@/src/components/m3/M3Button";
import { M3Snackbar } from "@/src/components/m3/M3Snackbar";
import {
  M3_EMPHASIZED_DECELERATE_EASING,
  M3_MOTION_DURATION_SHORT4_MS,
} from "@/src/components/m3/m3-motion";
import {
  READER_M3_BODY_FONT_PX,
  READER_M3_BODY_LINE_HEIGHT_PX,
  READER_M3_BOTTOM_SHEET_RADIUS_PX,
  READER_M3_ERROR,
  READER_M3_ERROR_CONTAINER,
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
  READER_M3_SHEET_TITLE_FONT_PX,
  READER_M3_SHEET_TITLE_LINE_HEIGHT_PX,
} from "@/src/features/reader/readerSettingsPanelChrome";

export type JournalDeleteEntryDialogProps = {
  visible: boolean;
  onClose: () => void;
  onConfirmDelete: () => Promise<void>;
  bundle: MobileAppThemeBundle;
  isTabletLayout?: boolean;
};

/** M3 basic dialog — destructive confirmation when deleting a journal entry. */
export function JournalDeleteEntryDialog({
  visible,
  onClose,
  onConfirmDelete,
  bundle,
  isTabletLayout = false,
}: JournalDeleteEntryDialogProps) {
  const j = bundle.journal;
  const rc = bundle.reader;
  const { width: screenW } = useWindowDimensions();
  const [deleting, setDeleting] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const scale = isTabletLayout ? 1.15 : 1;
  const dialogMaxW = Math.min(400, screenW - 48);
  const pad = 24 * scale;

  useEffect(() => {
    if (!visible) {
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
  }, [opacityAnim, scaleAnim, visible]);

  const handleDismiss = useCallback(() => {
    if (deleting) return;
    hapticLightImpact();
    onClose();
  }, [deleting, onClose]);

  const handleDelete = useCallback(() => {
    if (deleting) return;
    hapticLightImpact();
    void (async () => {
      setDeleting(true);
      setErrorVisible(false);
      try {
        await onConfirmDelete();
        onClose();
      } catch (e) {
        if (__DEV__) {
          console.error(e);
        }
        setDeleting(false);
        setErrorVisible(true);
      }
    })();
  }, [deleting, onClose, onConfirmDelete]);

  const dismissSnackbar = useCallback(() => {
    setErrorVisible(false);
  }, []);

  return (
    <>
      <DismissibleDialog
        visible={visible}
        onClose={handleDismiss}
        scrimColor={j.newEntryRouteScrim}
        scrimOpacity={opacityAnim}
        accessibilityDismissLabel="Cancel delete journal entry"
        insets={{ top: 0, bottom: 0 }}
      >
        <Animated.View
          pointerEvents="box-none"
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
                  backgroundColor: j.newEntrySheetBackground,
                  borderRadius: READER_M3_BOTTOM_SHEET_RADIUS_PX,
                  borderWidth: 1,
                  borderColor: j.newEntrySheetBorder,
                  shadowColor: rc.popoverShadow,
                  padding: pad,
                },
              ]}
            >
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
                  marginBottom: 8 * scale,
                }}
              >
                Delete entry?
              </Text>

              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: READER_M3_BODY_FONT_PX * scale * 0.875,
                  lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale * 0.875,
                  color: READER_M3_ON_SURFACE_VARIANT,
                }}
              >
                This cannot be undone.
              </Text>

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
                  label="Delete"
                  variant="text"
                  destructive
                  onPress={handleDelete}
                  disabled={deleting}
                  loading={deleting}
                  bundle={bundle}
                  scale={scale}
                />
              </View>
            </View>
        </Animated.View>
      </DismissibleDialog>
      <M3Snackbar
        message="Could not delete. Try again."
        visible={errorVisible}
        onDismiss={dismissSnackbar}
        bottomInset={32}
      />
    </>
  );
}

const styles = StyleSheet.create({
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
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
  },
});
