import { useEffect } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import {
  READER_M3_ON_SURFACE_VARIANT,
  READER_M3_SURFACE_CONTAINER,
} from "@/src/features/reader/readerSettingsPanelChrome";

const M3_LOADING_ROTATION_MS = 1330;

/** Scalloped M3 expressive loading shape (12-lobe wavy circle). */
function buildM3WavyLoadingPath(size: number): string {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.38;
  const innerR = size * 0.3;
  const lobes = 12;
  const points: string[] = [];

  for (let i = 0; i < lobes * 2; i++) {
    const angle = (i * Math.PI) / lobes - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
  }

  return `${points.join(" ")} Z`;
}

export type M3ContainedLoadingIndicatorProps = {
  size?: number;
  color?: string;
  containerColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function M3ContainedLoadingIndicator({
  size = 48,
  color = "#6750A4",
  containerColor = READER_M3_SURFACE_CONTAINER,
  style,
}: M3ContainedLoadingIndicatorProps) {
  const rotation = useSharedValue(0);
  const containerSize = Math.round(size * 1.75);
  const wavyPath = buildM3WavyLoadingPath(size);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: M3_LOADING_ROTATION_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View
      style={[
        {
          width: containerSize,
          height: containerSize,
          borderRadius: containerSize / 2,
          backgroundColor: containerColor,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Animated.View style={animatedStyle}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Path d={wavyPath} fill={color} />
        </Svg>
      </Animated.View>
    </View>
  );
}

export const M3_LOADING_LABEL_COLOR = READER_M3_ON_SURFACE_VARIANT;
