import { StyleSheet, View, type LayoutRectangle } from "react-native";

type OnboardingTargetDebugOverlayProps = {
  targets: LayoutRectangle[];
  enabled?: boolean;
};

/** Dev-only overlay — draws red boxes at measured onboarding anchor rects. */
export function OnboardingTargetDebugOverlay({
  targets,
  enabled = __DEV__,
}: OnboardingTargetDebugOverlayProps) {
  if (!enabled || targets.length === 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {targets.map((target, index) => (
        <View
          key={`debug-target-${index}`}
          style={[
            styles.box,
            {
              left: target.x,
              top: target.y,
              width: target.width,
              height: target.height,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#FF3B30",
    backgroundColor: "rgba(255, 59, 48, 0.22)",
  },
});
