import { Animated, StyleSheet } from "react-native";
import Reanimated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

export type LegacyScrimOpacity =
  | Animated.Value
  | Animated.AnimatedInterpolation<number>;

/** Scrim opacity driven by RN Animated or Reanimated SharedValue. */
export type ScrimOpacitySource = LegacyScrimOpacity | SharedValue<number>;

export function isLegacyScrimOpacity(
  opacity: ScrimOpacitySource,
): opacity is LegacyScrimOpacity {
  return (
    typeof opacity === "object" &&
    opacity !== null &&
    ("interpolate" in opacity || "setValue" in opacity || "stopAnimation" in opacity)
  );
}

type DismissibleScrimLayerProps = {
  scrimColor: string;
  scrimOpacity: ScrimOpacitySource;
};

/** Visual-only scrim — picks Animated.View or Reanimated.View from the opacity source. */
export function DismissibleScrimLayer({ scrimColor, scrimOpacity }: DismissibleScrimLayerProps) {
  if (isLegacyScrimOpacity(scrimOpacity)) {
    return (
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: scrimColor, opacity: scrimOpacity }]}
      />
    );
  }

  return <ReanimatedScrimLayer scrimColor={scrimColor} scrimOpacity={scrimOpacity} />;
}

function ReanimatedScrimLayer({
  scrimColor,
  scrimOpacity,
}: {
  scrimColor: string;
  scrimOpacity: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFill,
    backgroundColor: scrimColor,
    opacity: scrimOpacity.value,
  }));

  return <Reanimated.View pointerEvents="none" style={style} />;
}
