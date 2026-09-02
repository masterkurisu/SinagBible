import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { hapticSelection } from "@/lib/haptics";
import {
  formatJournalTagLabel,
  JOURNAL_TAG_SUGGESTIONS,
  normalizeJournalTag,
  normalizeJournalTags,
} from "@/lib/journal-tags";
import { JournalEntryAddTagChip } from "@/src/features/journal/JournalEntryAddTagChip";
import { JournalEntryEditableTagChip } from "@/src/features/journal/JournalEntryEditableTagChip";
import { JournalEntryTagChip } from "@/src/features/journal/JournalEntryTagChip";
import { READER_M3_ON_SURFACE_VARIANT } from "@/src/features/reader/readerSettingsPanelChrome";

const MAX_TAGS_PER_ENTRY = 8;

export type JournalTagSectionProps = {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  tagDraft: string;
  onTagDraftChange: (text: string) => void;
  onCommitTagDraft: (raw: string) => boolean;
  bundle: MobileAppThemeBundle;
  surfaceColor: string;
};

/**
 * Journal form tag row: disclosure header, suggestion chips, editable applied tags, add chip.
 */
export function JournalTagSection({
  tags,
  onTagsChange,
  tagDraft,
  onTagDraftChange,
  onCommitTagDraft,
  bundle,
  surfaceColor,
}: JournalTagSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [addExpanded, setAddExpanded] = useState(false);

  const unselectedSuggestions = useMemo(
    () => JOURNAL_TAG_SUGGESTIONS.filter((tag) => !tags.includes(tag)),
    [tags],
  );

  const cancelRename = useCallback(() => {
    setRenamingTag(null);
    setRenameDraft("");
  }, []);

  const collapseAdd = useCallback(() => {
    setAddExpanded(false);
    onTagDraftChange("");
  }, [onTagDraftChange]);

  const startRename = useCallback(
    (tag: string) => {
      collapseAdd();
      setRenamingTag(tag);
      setRenameDraft(formatJournalTagLabel(tag));
    },
    [collapseAdd],
  );

  const removeTag = useCallback(
    (tag: string) => {
      hapticSelection();
      onTagsChange(tags.filter((item) => item !== tag));
      if (renamingTag === tag) cancelRename();
    },
    [cancelRename, onTagsChange, renamingTag, tags],
  );

  const addSuggestion = useCallback(
    (tag: string) => {
      hapticSelection();
      onTagsChange(normalizeJournalTags([...tags, tag]));
    },
    [onTagsChange, tags],
  );

  const renameError = useMemo(() => {
    if (!renamingTag) return false;
    const trimmed = renameDraft.trim();
    if (!trimmed) return false;
    const normalized = normalizeJournalTag(renameDraft);
    if (!normalized) return true;
    return tags.some((tag) => tag !== renamingTag && tag === normalized);
  }, [renameDraft, renamingTag, tags]);

  const commitRename = useCallback(() => {
    if (!renamingTag) return;
    if (renameError) {
      cancelRename();
      return;
    }
    const normalized = normalizeJournalTag(renameDraft);
    if (!normalized || normalized === renamingTag) {
      cancelRename();
      return;
    }
    hapticSelection();
    onTagsChange(tags.map((tag) => (tag === renamingTag ? normalized : tag)));
    cancelRename();
  }, [cancelRename, onTagsChange, renameDraft, renameError, renamingTag, tags]);

  const expandAdd = useCallback(() => {
    cancelRename();
    setAddExpanded(true);
  }, [cancelRename]);

  const handleTagDraftChange = useCallback(
    (text: string) => {
      if (text.includes(",")) {
        const [head, ...rest] = text.split(",");
        if (onCommitTagDraft(head)) {
          const tail = rest.join(",").replace(/^\s+/, "");
          onTagDraftChange(tail);
          if (!tail.trim()) setAddExpanded(false);
          return;
        }
      }
      onTagDraftChange(text);
    },
    [onCommitTagDraft, onTagDraftChange],
  );

  const commitAddDraft = useCallback(() => {
    if (!tagDraft.trim()) {
      collapseAdd();
      return;
    }
    if (onCommitTagDraft(tagDraft)) {
      hapticSelection();
      onTagDraftChange("");
      setAddExpanded(false);
      return;
    }
    collapseAdd();
  }, [collapseAdd, onCommitTagDraft, onTagDraftChange, tagDraft]);

  const addError = useMemo(() => {
    if (!addExpanded || !tagDraft.trim()) return false;
    return normalizeJournalTag(tagDraft) == null;
  }, [addExpanded, tagDraft]);

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
        <View style={styles.chips}>
          {unselectedSuggestions.map((tag) => (
            <JournalEntryTagChip
              key={tag}
              label={formatJournalTagLabel(tag)}
              selected={false}
              onPress={() => addSuggestion(tag)}
              bundle={bundle}
              accessibilityLabel={`Add tag ${formatJournalTagLabel(tag)}`}
            />
          ))}
          {tags.map((tag) => (
            <JournalEntryEditableTagChip
              key={tag}
              label={formatJournalTagLabel(tag)}
              bundle={bundle}
              editing={renamingTag === tag}
              editValue={renamingTag === tag ? renameDraft : formatJournalTagLabel(tag)}
              error={renamingTag === tag && renameError}
              onStartEdit={() => startRename(tag)}
              onEditValueChange={setRenameDraft}
              onCommitEdit={commitRename}
              onCancelEdit={cancelRename}
              onRemove={() => removeTag(tag)}
            />
          ))}
          {tags.length < MAX_TAGS_PER_ENTRY ? (
            <JournalEntryAddTagChip
              bundle={bundle}
              expanded={addExpanded}
              value={tagDraft}
              error={addError}
              onExpand={expandAdd}
              onCollapse={collapseAdd}
              onChangeText={handleTagDraftChange}
              onCommit={commitAddDraft}
            />
          ) : null}
        </View>
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
});
