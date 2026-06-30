import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";

export type JournalM3FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  bundle: MobileAppThemeBundle;
  accessibilityLabel?: string;
};

/** M3 filter chip — 32dp height, 8dp corners, optional checkmark when selected. */
export function JournalM3FilterChip({
  label,
  selected,
  onPress,
  bundle,
  accessibilityLabel,
}: JournalM3FilterChipProps) {
  const j = bundle.journal;
  const rippleColor = bundle.chrome.androidRipple;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      android_ripple={Platform.OS === "android" ? { color: rippleColor } : undefined}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? j.chipActiveBackground : j.chipInactiveBackground,
          borderColor: selected ? j.chipActiveBorder : j.chipInactiveBorder,
        },
      ]}
    >
      {selected ? (
        <MaterialIcons name="check" size={18} color={j.chipActiveText} style={styles.checkIcon} />
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          flexShrink: 1,
          fontFamily: "Inter_500Medium",
          fontSize: 14,
          lineHeight: 18,
          color: selected ? j.chipActiveText : j.chipInactiveText,
        }}
      >
        {label}
      </Text>
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  checkIcon: {
    marginRight: 4,
    marginLeft: -2,
  },
});
