import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type KeyboardEvent,
} from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { hapticLightImpact } from "@/lib/haptics";
import { M3Button } from "@/src/components/m3/M3Button";
import { M3OutlinedTextField } from "@/src/components/m3/M3OutlinedTextField";
import { M3SettingsSheetTitle } from "@/src/components/m3/M3SettingsSheetTitle";
import {
  M3_EMPHASIZED_DECELERATE_EASING,
  M3_MOTION_DURATION_SHORT4_MS,
} from "@/src/components/m3/m3-motion";
import { READER_M3_BOTTOM_SHEET_RADIUS_PX } from "@/src/features/reader/readerSettingsPanelChrome";

export type ReaderVerseNoteDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  noteDraft: string;
  onChangeNoteDraft: (text: string) => void;
  /** e.g. "Luke 1:5" */
  verseReference?: string;
  bundle: MobileAppThemeBundle;
  insets: { top: number; bottom: number; left: number; right: number };
  isTabletReaderLayout?: boolean;
};

/** M3 basic dialog — inline verse note editor with keyboard-safe actions. */
export function ReaderVerseNoteDialog({
  isOpen,
  onClose,
  onSave,
  noteDraft,
  onChangeNoteDraft,
  verseReference,
  bundle,
  insets,
  isTabletReaderLayout = false,
}: ReaderVerseNoteDialogProps) {
  const rc = bundle.reader;
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const scale = isTabletReaderLayout ? 1.15 : 1;
  const dialogMaxW = Math.min(400, screenW - 48);
  const pad = 24 * scale;
  const keyboardOpen = keyboardHeight > 0;
  const anchorBottomPad = keyboardOpen ? Math.max(keyboardHeight - insets.bottom, 0) + 16 : 0;
  const dialogMaxH = screenH - Math.max(insets.top, 16) - anchorBottomPad - 16;
  const actionAccent = bundle.ui.brown800;
  const surfaceColor = rc.popoverSurface;

  useEffect(() => {
    if (!isOpen) {
      setKeyboardHeight(0);
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

  useEffect(() => {
    if (!isOpen) return;
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [isOpen]);

  const handleCancel = useCallback(() => {
    hapticLightImpact();
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const handleSave = useCallback(() => {
    hapticLightImpact();
    Keyboard.dismiss();
    onSave();
  }, [onSave]);

  return (
    <Modal visible={isOpen} transparent animationType="none" statusBarTranslucent onRequestClose={handleCancel}>
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: rc.denseModalScrim }]}
          onPress={handleCancel}
          accessibilityLabel="Dismiss verse note"
        />
        <View
          pointerEvents="box-none"
          style={[
            styles.anchor,
            {
              justifyContent: keyboardOpen ? "flex-end" : "center",
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: anchorBottomPad,
              paddingHorizontal: 24,
            },
          ]}
        >
          <Animated.View
            style={{
              width: dialogMaxW,
              maxHeight: dialogMaxH,
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            }}
          >
            <View
              style={[
                styles.dialogCard,
                {
                  backgroundColor: surfaceColor,
                  borderRadius: READER_M3_BOTTOM_SHEET_RADIUS_PX,
                  shadowColor: rc.popoverShadow,
                  padding: pad,
                },
              ]}
            >
              <M3SettingsSheetTitle
                title="Verse note"
                subtitle={verseReference}
                subtitleBold
                scale={scale}
                style={{ marginBottom: 16 * scale }}
              />

              <M3OutlinedTextField
                label="Note"
                value={noteDraft}
                onChangeText={onChangeNoteDraft}
                surfaceColor={surfaceColor}
                accentColor={actionAccent}
                scale={scale}
                multiline
                minHeight={120}
                maxHeight={160}
              />

              <View style={[styles.actionsBar, { marginTop: 20 * scale, gap: 12 * scale }]}>
                <M3Button
                  label="Cancel"
                  variant="text"
                  onPress={handleCancel}
                  bundle={bundle}
                  accentColor={actionAccent}
                  scale={scale}
                />
                <M3Button
                  label="Save"
                  variant="filled"
                  onPress={handleSave}
                  bundle={bundle}
                  accentColor={actionAccent}
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
  anchor: {
    flex: 1,
    alignItems: "center",
  },
  dialogCard: {
    width: "100%",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  actionsBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
});
