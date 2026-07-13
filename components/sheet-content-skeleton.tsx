import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type SheetContentSkeletonProps = {
  boneColor: string;
  rows?: number;
  rowHeight?: number;
  gap?: number;
  /** Compact square cells for chapter grids. */
  variant?: "list" | "grid";
  columns?: number;
  cellSize?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * Lightweight placeholder for sheet list bodies during the open slide.
 * Keeps layout stable without mounting the full list tree.
 */
export function SheetContentSkeleton({
  boneColor,
  rows = 8,
  rowHeight = 48,
  gap = 8,
  variant = "list",
  columns = 5,
  cellSize = 48,
  style,
  accessibilityLabel = "Loading list",
}: SheetContentSkeletonProps) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 600, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  if (variant === "grid") {
    const cellCount = columns * 3;
    return (
      <Animated.View
        style={[styles.gridWrap, { gap, opacity }, style]}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ busy: true }}
      >
        {Array.from({ length: cellCount }).map((_, i) => (
          <View
            key={i}
            style={{
              width: cellSize,
              height: cellSize,
              borderRadius: 12,
              backgroundColor: boneColor,
            }}
          />
        ))}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[styles.listWrap, { gap, opacity }, style]}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={{
            height: rowHeight,
            borderRadius: 12,
            backgroundColor: boneColor,
            width: i % 3 === 0 ? "100%" : i % 3 === 1 ? "88%" : "94%",
          }}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  listWrap: {
    paddingVertical: 4,
  },
  gridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: 4,
  },
});
