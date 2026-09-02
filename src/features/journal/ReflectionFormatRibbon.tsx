import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

export type ReflectionFormatRibbonVariant = "floating-pill" | "docked";

type Props = {
  variant: ReflectionFormatRibbonVariant;
  children: ReactNode;
  /** Required for `floating-pill` — matches reader M3 pill chrome. */
  pillStyle?: StyleProp<ViewStyle>;
  borderColor?: string;
  backgroundColor?: string;
};

/**
 * Horizontally scrollable format toolbar. Phase 1: docked layout sibling in the note
 * surface; legacy path keeps the floating pill variant above the keyboard.
 */
export function ReflectionFormatRibbon({
  variant,
  children,
  pillStyle,
  borderColor,
  backgroundColor,
}: Props) {
  const scroll = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      contentContainerStyle={styles.scrollContent}
    >
      {children}
    </ScrollView>
  );

  if (variant === "floating-pill") {
    return <View style={pillStyle}>{scroll}</View>;
  }

  return (
    <View
      style={[
        styles.docked,
        {
          borderTopColor: borderColor,
          backgroundColor,
        },
      ]}
    >
      {scroll}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  docked: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 4,
  },
});
