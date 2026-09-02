import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";

export type JournalEntryTagChipProps = {
  label: string;
  selected: boolean;
  bundle: MobileAppThemeBundle;
  /** Omit for read-only saved/preview chips (active fill, no check, no press). */
  onPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * Pill-shaped journal entry tag — ~32dp tall, fully rounded ends.
 * Interactive chips use journal `chip*` tokens (check when selected).
 * Read-only chips keep the selected fill so form and saved view match.
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
  const showCheck = interactive && selected;
  const backgroundColor = filled ? j.chipActiveBackground : j.chipInactiveBackground;
  const borderColor = filled ? j.chipActiveBorder : j.chipInactiveBorder;
  const textColor = filled ? j.chipActiveText : j.chipInactiveText;

  const content = (
    <>
      {showCheck ? (
        <MaterialIcons name="check" size={16} color={textColor} style={styles.checkIcon} />
      ) : null}
      <Text numberOfLines={1} style={[styles.label, { color: textColor }]}>
        {label}
      </Text>
    </>
  );

  if (!interactive) {
    return (
      <View
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel ?? label}
        style={[styles.chip, { backgroundColor, borderColor }]}
      >
        {content}
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
        Platform.OS === "android" ? { color: bundle.chrome.androidRipple, borderless: false } : undefined
      }
      style={[
        styles.chip,
        showCheck ? styles.chipSelected : null,
        { backgroundColor, borderColor },
      ]}
    >
      {content}
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
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
  },
  chipSelected: {
    paddingLeft: 10,
  },
  checkIcon: {
    marginRight: 6,
  },
  label: {
    flexShrink: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
});
