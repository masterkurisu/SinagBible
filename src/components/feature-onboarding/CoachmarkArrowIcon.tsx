import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

type CoachmarkArrowIconProps = {
  name: ComponentProps<typeof Ionicons>["name"];
  size: number;
  color: string;
};

/** Ionicons arrow with 3px drop shadow for coachmark contrast. */
export function CoachmarkArrowIcon({ name, size, color }: CoachmarkArrowIconProps) {
  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <Ionicons name={name} size={size} color={color} style={styles.shadow} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  shadow: {
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 3,
  },
});
