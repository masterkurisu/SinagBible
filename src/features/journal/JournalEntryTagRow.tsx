import { StyleSheet, View } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { formatJournalTagLabel } from "@/lib/journal-tags";
import { JournalEntryTagChip } from "@/src/features/journal/JournalEntryTagChip";

export type JournalEntryTagRowProps = {
  tags: readonly string[];
  bundle: MobileAppThemeBundle;
};

/** Read-only pill tags on saved detail and the morph preview. */
export function JournalEntryTagRow({ tags, bundle }: JournalEntryTagRowProps) {
  if (tags.length === 0) return null;
  return (
    <View style={styles.row}>
      {tags.map((tag) => (
        <JournalEntryTagChip
          key={tag}
          label={formatJournalTagLabel(tag)}
          selected
          bundle={bundle}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
});
