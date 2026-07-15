import { useCallback, type ReactNode } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { DismissibleModal } from "@/src/components/m3/DismissibleModal";

export type DismissibleDialogProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  dismissible?: boolean;
  onBackdropPress?: () => void;
  onRequestClose?: () => void;
  scrimColor: string;
  scrimOpacity?: Animated.Value | Animated.AnimatedInterpolation<number>;
  accessibilityDismissLabel?: string;
  insets: { top: number; bottom: number };
  /** Extra bottom padding when keyboard is open. */
  anchorBottomPad?: number;
  anchorStyle?: StyleProp<ViewStyle>;
  justifyContent?: "center" | "flex-end";
};

/** Centered (or keyboard-lifted) dialog shell over DismissibleModal. */
export function DismissibleDialog({
  visible,
  onClose,
  children,
  dismissible = true,
  onBackdropPress,
  onRequestClose,
  scrimColor,
  scrimOpacity,
  accessibilityDismissLabel = "Dismiss dialog",
  insets,
  anchorBottomPad = 0,
  anchorStyle,
  justifyContent = "center",
}: DismissibleDialogProps) {
  const handleBackdropPress = useCallback(() => {
    if (onBackdropPress) {
      onBackdropPress();
      return;
    }
    onClose();
  }, [onBackdropPress, onClose]);

  return (
    <DismissibleModal
      visible={visible}
      onClose={onClose}
      dismissible={dismissible}
      onBackdropPress={handleBackdropPress}
      onRequestClose={onRequestClose}
      scrimColor={scrimColor}
      scrimOpacity={scrimOpacity}
      accessibilityDismissLabel={accessibilityDismissLabel}
    >
      <View
        pointerEvents="box-none"
        style={[
          styles.anchor,
          {
            justifyContent,
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: anchorBottomPad,
            paddingHorizontal: 24,
          },
          anchorStyle,
        ]}
      >
        {children}
      </View>
    </DismissibleModal>
  );
}

const styles = StyleSheet.create({
  anchor: {
    flex: 1,
    alignItems: "center",
  },
});
