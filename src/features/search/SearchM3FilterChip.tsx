import { Platform, Pressable, StyleSheet, Text } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { SearchOverlayChrome } from "@/src/features/search/searchOverlayChrome";

export type SearchM3FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  chrome: SearchOverlayChrome;
  accessibilityLabel?: string;
};

/**
 * Pill-shaped filter chip — fully rounded ends, ~32dp tall.
 * Unselected: outline-variant stroke, transparent fill.
 * Selected: secondary-container fill, leading check, no stroke.
 *
 * Mirrors the proven layout of `JournalM3FilterChip`: chrome (background,
 * border, ripple clip) lives on the single `Pressable`, sized with
 * `minHeight` + vertical padding rather than a fixed height, so the row
 * never has to fight its own content box.
 */
export function SearchM3FilterChip({
  label,
  selected,
  onPress,
  chrome,
  accessibilityLabel,
}: SearchM3FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      android_ripple={
        Platform.OS === "android" ? { color: chrome.iconRipple, borderless: false } : undefined
      }
      style={[
        styles.chip,
        selected ? styles.chipSelected : null,
        {
          // A literal "transparent" fill leaves Android with no background
          // drawable to derive a rounded clip mask from, so the ripple falls
          // back to a plain rectangle. Filling with the chip's own resting
          // surface color (which is visually identical against the sheet)
          // gives Android something real to clip the ripple against.
          backgroundColor: selected ? chrome.secondaryContainer : chrome.surfaceContainerLow,
          borderColor: selected ? "transparent" : chrome.outlineVariant,
        },
      ]}
    >
      {selected ? (
        <MaterialIcons name="check" size={16} color={chrome.onSecondaryContainer} style={styles.checkIcon} />
      ) : null}
      <Text
        numberOfLines={1}
        style={[styles.label, { color: selected ? chrome.onSecondaryContainer : chrome.onSurfaceVariant }]}
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
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
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
