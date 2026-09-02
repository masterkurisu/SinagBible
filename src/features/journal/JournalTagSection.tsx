import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import {
  formatJournalTagLabel,
  JOURNAL_TAG_SUGGESTIONS,
} from "@/lib/journal-tags";
import { M3OutlinedTextField } from "@/src/components/m3/M3OutlinedTextField";
import { JournalEntryTagChip } from "@/src/features/journal/JournalEntryTagChip";
import { READER_M3_ON_SURFACE_VARIANT } from "@/src/features/reader/readerSettingsPanelChrome";

const MAX_TAGS_PER_ENTRY = 8;

export type JournalTagSectionProps = {
  tags: string[];
  tagDraft: string;
  onTagDraftChange: (text: string) => void;
  onToggleTag: (tag: string) => void;
  onCommitTagDraft: (raw: string) => boolean;
  bundle: MobileAppThemeBundle;
  surfaceColor: string;
  accentColor: string;
};

/**
 * Journal form tag row: disclosure header (default expanded), pill chips, add field.
 * Phase 1 keeps tap-to-toggle and the outlined add field; Phase 2 replaces those.
 */
export function JournalTagSection({
  tags,
  tagDraft,
  onTagDraftChange,
  onToggleTag,
  onCommitTagDraft,
  bundle,
  surfaceColor,
  accentColor,
}: JournalTagSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const customTags = tags.filter(
    (tag) => !(JOURNAL_TAG_SUGGESTIONS as readonly string[]).includes(tag),
  );

  return (
    <View collapsable={false} style={{ backgroundColor: surfaceColor, marginTop: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tags (optional)"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((prev) => !prev)}
        style={styles.header}
      >
        <Text style={styles.headerLabel}>Tags (optional)</Text>
        <MaterialIcons
          name={expanded ? "expand_less" : "expand_more"}
          size={22}
          color={READER_M3_ON_SURFACE_VARIANT}
        />
      </Pressable>
      {expanded ? (
        <>
          <View style={styles.chips}>
            {JOURNAL_TAG_SUGGESTIONS.map((tag) => (
              <JournalEntryTagChip
                key={tag}
                label={formatJournalTagLabel(tag)}
                selected={tags.includes(tag)}
                onPress={() => onToggleTag(tag)}
                bundle={bundle}
              />
            ))}
            {customTags.map((tag) => (
              <JournalEntryTagChip
                key={tag}
                label={formatJournalTagLabel(tag)}
                selected
                onPress={() => onToggleTag(tag)}
                bundle={bundle}
                accessibilityLabel={`Remove tag ${formatJournalTagLabel(tag)}`}
              />
            ))}
          </View>
          {tags.length < MAX_TAGS_PER_ENTRY ? (
            <View style={styles.addField}>
              <M3OutlinedTextField
                label="Add a tag"
                value={tagDraft}
                onChangeText={(text) => {
                  if (text.includes(",")) {
                    const [head, ...rest] = text.split(",");
                    if (onCommitTagDraft(head)) {
                      onTagDraftChange(rest.join(",").replace(/^\s+/, ""));
                      return;
                    }
                  }
                  onTagDraftChange(text);
                }}
                surfaceColor={surfaceColor}
                accentColor={accentColor}
                roundedEnds
                minHeight={52}
                inputFontFamily="Inter_400Regular"
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={() => {
                  if (onCommitTagDraft(tagDraft)) onTagDraftChange("");
                }}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    minHeight: 32,
  },
  headerLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: READER_M3_ON_SURFACE_VARIANT,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  addField: {
    marginTop: 8,
  },
});
