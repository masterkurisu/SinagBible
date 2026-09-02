import type { ReactNode } from "react";
import { useEffect } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Ellipsized passage reference, e.g. `John 3:16 · NIV`. */
  passageStrip: string;
  /** Optional one-line verse preview under the strip. */
  versePreview?: string | null;
  editor: ReactNode;
  ribbon: ReactNode;
  verseTagOverlay?: ReactNode;
  parchment: string;
  parchmentDark: string;
  brown800: string;
  tan300: string;
};

/**
 * Phase 2 note-surface chrome: shrink header, editor slot (Enriched or legacy), docked ribbon.
 */
export function ReflectionNoteSurface({
  visible,
  onClose,
  passageStrip,
  versePreview,
  editor,
  ribbon,
  verseTagOverlay,
  parchment,
  brown800,
  tan300,
}: Props) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible || Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose, visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={[styles.root, { backgroundColor: parchment }]} collapsable={false}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
        >
          <SafeAreaView style={styles.flex} edges={["top", "left", "right", "bottom"]}>
            <View style={styles.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Shrink reflection"
                onPress={onClose}
                hitSlop={8}
                style={styles.shrinkBtn}
              >
                <Ionicons name="chevron-down" size={22} color={brown800} />
              </Pressable>
              <View style={styles.headerTextCol}>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[styles.passageStrip, { color: brown800 }]}
                >
                  {passageStrip}
                </Text>
                {versePreview ? (
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[styles.versePreview, { color: tan300 }]}
                  >
                    {versePreview}
                  </Text>
                ) : null}
              </View>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.editorSlot}>{editor}</View>
            {ribbon}
            {verseTagOverlay}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 4,
  },
  shrinkBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  headerSpacer: {
    width: 40,
  },
  passageStrip: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 18,
  },
  versePreview: {
    marginTop: 2,
    fontFamily: "Lora_400Regular",
    fontSize: 12,
    lineHeight: 16,
    fontStyle: "italic",
  },
  editorSlot: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
});
