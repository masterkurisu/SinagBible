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

export type DismissibleModalProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** When false, backdrop taps and hardware back are no-ops unless onRequestClose is set. */
  dismissible?: boolean;
  /** Overrides default backdrop behavior (e.g. keyboard-then-close, keep-editing). */
  onBackdropPress?: () => void;
  /** Overrides Modal onRequestClose; defaults to backdrop handler when dismissible. */
  onRequestClose?: () => void;
  scrimColor?: string;
  /** Scrim opacity — RN Animated or Reanimated SharedValue. */
  scrimOpacity?: ScrimOpacitySource;
  accessibilityDismissLabel?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/**
 * Modal shell with Android-safe outside-tap dismiss.
 * Splits visual scrim (non-interactive) from the touch Pressable so backdrop
 * taps register reliably on Android when sheet content sits in a flex sibling.
 */
export function DismissibleModal({
  visible,
  onClose,
  children,
  dismissible = true,
  onBackdropPress,
  onRequestClose,
  scrimColor,
  scrimOpacity,
  accessibilityDismissLabel = "Dismiss",
  contentContainerStyle,
}: DismissibleModalProps) {
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
      <View style={styles.root} pointerEvents="box-none">
        {dismissible && scrimColor != null ? (
          scrimOpacity != null ? (
            <DismissibleScrimLayer scrimColor={scrimColor} scrimOpacity={scrimOpacity} />
          ) : (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: scrimColor }]}
            />
          )
        ) : null}
        {dismissible ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleBackdropPress}
            accessibilityRole="button"
            accessibilityLabel={accessibilityDismissLabel}
          />
        ) : null}
        <View pointerEvents="box-none" style={[styles.content, contentContainerStyle]}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
