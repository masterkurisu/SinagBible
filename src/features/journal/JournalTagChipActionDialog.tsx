import { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { DismissibleDialog } from "@/src/components/m3/DismissibleDialog";
import { hapticLightImpact } from "@/lib/haptics";
import { M3Button } from "@/src/components/m3/M3Button";
import {
  M3_EMPHASIZED_DECELERATE_EASING,
  M3_MOTION_DURATION_SHORT4_MS,
} from "@/src/components/m3/m3-motion";
import {
  READER_M3_BOTTOM_SHEET_RADIUS_PX,
  READER_OVERLAY_CONTENT_SCALE,
} from "@/src/features/reader/readerSettingsPanelChrome";

export type JournalTagChipActionDialogProps = {
  visible: boolean;
  tagLabel: string;
  bundle: MobileAppThemeBundle;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
};

/** M3 basic dialog — edit or delete an applied journal tag. */
export function JournalTagChipActionDialog({
  visible,
  tagLabel,
  bundle,
  onEdit,
  onDelete,
  onClose,
}: JournalTagChipActionDialogProps) {
  const j = bundle.journal;
  const rc = bundle.reader;
  const accentColor = bundle.ui.brown800;
  const { width: screenW } = useWindowDimensions();
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const scale = READER_OVERLAY_CONTENT_SCALE;
  const dialogMaxW = Math.min(400, screenW - 48);
  const pad = 24 * scale;

  useEffect(() => {
    if (!visible) {
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

  const handleClose = useCallback(() => {
    hapticLightImpact();
    onClose();
  }, [onClose]);

  const handleEdit = useCallback(() => {
    hapticLightImpact();
    onEdit();
  }, [onEdit]);

  const handleDelete = useCallback(() => {
    hapticLightImpact();
    onDelete();
  }, [onDelete]);

  return (
    <DismissibleDialog
      visible={visible}
      onClose={handleClose}
      onBackdropPress={handleClose}
      onRequestClose={handleClose}
      scrimColor={j.newEntryRouteScrim}
      scrimOpacity={opacityAnim}
      accessibilityDismissLabel="Close tag actions"
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
          <Text
            numberOfLines={2}
            style={{
              fontFamily: "Lora_400Regular",
              fontSize: 20 * scale,
              lineHeight: 26 * scale,
              color: accentColor,
              marginBottom: 20 * scale,
            }}
          >
            {tagLabel}
          </Text>
          <View style={[styles.actionsRow, { gap: 8 * scale }]}>
            <M3Button
              label="Edit"
              variant="text"
              onPress={handleEdit}
              bundle={bundle}
              accentColor={accentColor}
              scale={scale}
            />
            <M3Button
              label="Delete"
              variant="text"
              destructive
              onPress={handleDelete}
              bundle={bundle}
              scale={scale}
            />
          </View>
        </View>
      </Animated.View>
    </DismissibleDialog>
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
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
  },
});
