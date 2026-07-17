import { type RefObject } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";

export type VerseTagChipProps = {
  label: string;
  textStyle?: StyleProp<TextStyle>;
  chipStyle?: StyleProp<TextStyle>;
  accessibilityLabel: string;
  onPress: () => void;
  onLongPress: () => void;
  chipRef?: RefObject<Text | null>;
};

/** Inline verse-tag chip — must be Text-based for nesting inside parent Text. */
export function VerseTagChip({
  label,
  textStyle,
  chipStyle,
  accessibilityLabel,
  onPress,
  onLongPress,
  chipRef,
}: VerseTagChipProps) {
  return (
    <Text
      ref={chipRef}
      onPress={onPress}
      onLongPress={onLongPress}
      suppressHighlighting
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[textStyle, chipStyle]}
    >
      {label}
    </Text>
  );
}
