import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { DismissibleModal } from "@/src/components/m3/DismissibleModal";

type FeatureOnboardingModalProps = {
  visible: boolean;
  children: ReactNode;
  pointerEvents?: "auto" | "box-none" | "none";
  animationType?: "none" | "fade" | "slide";
};

/** Full-screen modal so onboarding sits above native stack headers and tab bars. */
export function FeatureOnboardingModal({
  visible,
  children,
  pointerEvents = "auto",
}: FeatureOnboardingModalProps) {
  return (
    <DismissibleModal
      visible={visible}
      onClose={() => {}}
      dismissible={false}
      onRequestClose={() => {}}
    >
      <View style={styles.root} pointerEvents={pointerEvents}>
        {children}
      </View>
    </DismissibleModal>
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
