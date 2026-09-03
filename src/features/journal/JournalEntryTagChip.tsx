import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";

export type JournalEntryTagChipProps = {
  label: string;
  selected: boolean;
  bundle: MobileAppThemeBundle;
  /** Omit for read-only saved/preview chips (active fill, no press). */
  onPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * Pill-shaped journal entry tag — ~32dp tall, fully rounded ends.
 * Selected catalog chips keep the same size and change fill color only.
 *
 * Chrome lives on a static Pressable style (not a style function). Android
 * ripple + a style callback drops the rounded background drawable, which
 * made these chips render as plain text. `borderRadius: 20` (not 999) is the
 * clip mask Android can actually use, so tap highlight stays pill-shaped.
 *
 * Do not reuse JournalM3FilterChip here — list filters stay 8dp corners.
 */
export function JournalEntryTagChip({
  label,
  selected,
  bundle,
  onPress,
  accessibilityLabel,
}: JournalEntryTagChipProps) {
  const j = bundle.journal;
  const interactive = onPress != null;
  const filled = selected || !interactive;
  const backgroundColor = filled ? j.chipActiveBackground : j.chipInactiveBackground;
  const borderColor = filled ? j.chipActiveBorder : j.chipInactiveBorder;
  const textColor = filled ? j.chipActiveText : j.chipInactiveText;

  const labelNode = (
    <Text numberOfLines={1} style={[styles.label, { color: textColor }]}>
      {label}
    </Text>
  );

  if (!interactive) {
    return (
      <View
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel ?? label}
        style={[styles.chip, { backgroundColor, borderColor }]}
      >
        {labelNode}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      android_ripple={
        Platform.OS === "android"
          ? { color: bundle.chrome.androidRipple, borderless: false, foreground: true }
          : undefined
      }
      style={[styles.chip, { backgroundColor, borderColor }]}
    >
      {labelNode}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    minHeight: 32,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  label: {
    flexShrink: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
});
