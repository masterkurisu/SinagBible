import type { ReactNode } from "react";
import { Modal, Platform, StyleSheet, View } from "react-native";

type FeatureOnboardingModalProps = {
  visible: boolean;
  children: ReactNode;
};

/** Full-screen modal so onboarding sits above native stack headers and tab bars. */
export function FeatureOnboardingModal({ visible, children }: FeatureOnboardingModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
      presentationStyle="overFullScreen"
    >
      <View style={styles.root} pointerEvents="auto">
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    ...Platform.select({
      android: { elevation: 9999 },
      default: {},
    }),
  },
});
