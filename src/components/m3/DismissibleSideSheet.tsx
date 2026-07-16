import { useCallback, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  DismissibleScrimLayer,
  type ScrimOpacitySource,
} from "@/src/components/m3/dismissible-scrim-opacity";

export type DismissibleSideSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  dismissible?: boolean;
  onBackdropPress?: () => void;
  onRequestClose?: () => void;
  /** Scrim opacity — RN Animated or Reanimated SharedValue. */
  scrimOpacity: ScrimOpacitySource;
  scrimColor?: string;
  accessibilityDismissLabel?: string;
  rootStyle?: StyleProp<ViewStyle>;
  onRootLayout?: () => void;
};

/**
 * Side-drawer modal shell — scrim inside Pressable (reliable on Android for partial-width panels).
 */
export function DismissibleSideSheet({
  visible,
  onClose,
  children,
  dismissible = true,
  onBackdropPress,
  onRequestClose,
  scrimOpacity,
  scrimColor = "#000000",
  accessibilityDismissLabel = "Dismiss",
  rootStyle,
  onRootLayout,
}: DismissibleSideSheetProps) {
  const handleBackdropPress = useCallback(() => {
    if (!dismissible) return;
    if (onBackdropPress) {
      onBackdropPress();
      return;
    }
    onClose();
  }, [dismissible, onBackdropPress, onClose]);

  const handleRequestClose = onRequestClose ?? (dismissible ? handleBackdropPress : () => {});

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleRequestClose}
    >
      <View
        style={[styles.root, rootStyle]}
        pointerEvents="box-none"
        onLayout={onRootLayout}
      >
        {dismissible ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel={accessibilityDismissLabel}
            onPress={handleBackdropPress}
          >
            <DismissibleScrimLayer scrimColor={scrimColor} scrimOpacity={scrimOpacity} />
          </Pressable>
        ) : null}
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
});
