import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View, type ViewProps } from "react-native";

/** Matches `bg-parchment-canvas` / root Stack `contentStyle`. */
export const SKELETON_SCREEN_BG = "#f5f2ec";
const BONE = "#e4ddd4";

type ScreenSkeletonProps = {
  /** Number of placeholder rows (list-like screens use 6–10). */
  lines?: number;
  /** Optional caption under the pulsing block (accessibility + clarity). */
  caption?: string;
  testID?: string;
} & Pick<ViewProps, "style">;

/**
 * Full-area loading placeholder with a gentle pulse. Use for initial data loads
 * instead of a lone `ActivityIndicator` so layout feels stable before content arrives.
 */
export function ScreenLoadingSkeleton({
  lines = 8,
  caption,
  testID,
  style,
}: ScreenSkeletonProps) {
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.55,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <View
      style={[styles.screen, style]}
      testID={testID}
      accessibilityLabel={caption ?? "Loading"}
      accessibilityState={{ busy: true }}
    >
      <Animated.View style={[styles.rowsWrap, { opacity }]}>
        {Array.from({ length: lines }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.row,
              {
                width:
                  i % 3 === 0 ? "92%" : i % 3 === 1 ? "72%" : "84%",
              },
            ]}
          />
        ))}
      </Animated.View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SKELETON_SCREEN_BG,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 20,
  },
  rowsWrap: {
    alignSelf: "stretch",
    gap: 12,
  },
  row: {
    alignSelf: "flex-start",
    height: 13,
    borderRadius: 6,
    backgroundColor: BONE,
  },
  caption: {
    alignSelf: "center",
    fontSize: 13,
    color: "#8a7b68",
  },
});
