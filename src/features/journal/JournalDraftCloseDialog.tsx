import { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { hapticLightImpact } from "@/lib/haptics";
import { M3Button } from "@/src/components/m3/M3Button";
import {
  M3_EMPHASIZED_DECELERATE_EASING,
  M3_MOTION_DURATION_SHORT4_MS,
} from "@/src/components/m3/m3-motion";
import {
  READER_M3_BODY_FONT_PX,
  READER_M3_BODY_LINE_HEIGHT_PX,
  READER_M3_BOTTOM_SHEET_RADIUS_PX,
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
  READER_M3_SHEET_TITLE_FONT_PX,
  READER_M3_SHEET_TITLE_LINE_HEIGHT_PX,
} from "@/src/features/reader/readerSettingsPanelChrome";

export type JournalDraftCloseDialogProps = {
  visible: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  onSave?: () => void;
  bundle: MobileAppThemeBundle;
  title?: string;
  message?: string;
  isTabletLayout?: boolean;
};

/** M3 basic dialog — unsaved journal draft confirmation when closing the new-entry form. */
export function JournalDraftCloseDialog({
  visible,
  onKeepEditing,
  onDiscard,
  onSave,
  bundle,
  title = "Save or discard?",
  message = "You have unsaved text in this draft.",
  isTabletLayout = false,
}: JournalDraftCloseDialogProps) {
  const j = bundle.journal;
  const rc = bundle.reader;
  const accentColor = bundle.ui.brown800;
  const { width: screenW } = useWindowDimensions();
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const scale = isTabletLayout ? 1.15 : 1;
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

  const handleKeepEditing = useCallback(() => {
    hapticLightImpact();
    onKeepEditing();
  }, [onKeepEditing]);

  const handleSave = useCallback(() => {
    hapticLightImpact();
    onSave?.();
  }, [onSave]);

  const handleDiscard = useCallback(() => {
    hapticLightImpact();
    onDiscard();
  }, [onDiscard]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleKeepEditing}
    >
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: j.newEntryRouteScrim }]}
          onPress={handleKeepEditing}
          accessibilityRole="button"
          accessibilityLabel="Keep editing journal entry"
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
                style={{
                  fontFamily: "Lora_400Regular",
                  fontSize: READER_M3_SHEET_TITLE_FONT_PX * scale,
                  lineHeight: READER_M3_SHEET_TITLE_LINE_HEIGHT_PX * scale,
                  color: READER_M3_ON_SURFACE,
                  marginBottom: 8 * scale,
                }}
              >
                {title}
              </Text>

              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: READER_M3_BODY_FONT_PX * scale * 0.875,
                  lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale * 0.875,
                  color: READER_M3_ON_SURFACE_VARIANT,
                }}
              >
                {message}
              </Text>

              <View style={[styles.actionsRow, { marginTop: 24 * scale, gap: 8 * scale }]}>
                <M3Button
                  label="Keep editing"
                  variant="text"
                  onPress={handleKeepEditing}
                  bundle={bundle}
                  accentColor={accentColor}
                  scale={scale}
                />
                {onSave ? (
                  <M3Button
                    label="Save"
                    variant="text"
                    onPress={handleSave}
                    bundle={bundle}
                    accentColor={accentColor}
                    scale={scale}
                  />
                ) : null}
                <M3Button
                  label="Discard"
                  variant="text"
                  destructive
                  onPress={handleDiscard}
                  bundle={bundle}
                  scale={scale}
                />
              </View>
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
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
  },
});
