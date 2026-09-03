import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { hapticMediumImpact, hapticSelection } from "@/lib/haptics";
import {
  formatJournalTagLabel,
  JOURNAL_TAG_SUGGESTIONS,
  normalizeJournalTag,
  normalizeJournalTags,
} from "@/lib/journal-tags";
import { animateM3EffectsOpacity, animateM3SpatialProgress } from "@/src/components/m3/m3-motion";
import { JournalEntryAddTagChip } from "@/src/features/journal/JournalEntryAddTagChip";
import { JournalEntryEditableTagChip } from "@/src/features/journal/JournalEntryEditableTagChip";
import { JournalEntryTagChip } from "@/src/features/journal/JournalEntryTagChip";
import { JournalTagChipActionDialog } from "@/src/features/journal/JournalTagChipActionDialog";
import { READER_M3_ON_SURFACE_VARIANT } from "@/src/features/reader/readerSettingsPanelChrome";

const MAX_TAGS_PER_ENTRY = 8;
const PANEL_MAX_HEIGHT = 320;

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
  const [actionTag, setActionTag] = useState<string | null>(null);

  const expandProgress = useSharedValue(1);
  const panelOpacity = useSharedValue(1);

  useEffect(() => {
    animateM3SpatialProgress(expandProgress, expanded ? 1 : 0, expanded);
    animateM3EffectsOpacity(panelOpacity, expanded ? 1 : 0, expanded);
  }, [expanded, expandProgress, panelOpacity]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${expandProgress.value * 180}deg` }],
  }));

  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelOpacity.value,
    maxHeight: expandProgress.value * PANEL_MAX_HEIGHT,
    overflow: "hidden" as const,
  }));

  const customTags = useMemo(
    () => tags.filter((tag) => !(JOURNAL_TAG_SUGGESTIONS as readonly string[]).includes(tag)),
    [tags],
  );

  const actionTagLabel = actionTag ? formatJournalTagLabel(actionTag) : "";

  const cancelRename = useCallback(() => {
    setRenamingTag(null);
    setRenameDraft("");
  }, []);

  const collapseAdd = useCallback(() => {
    setAddExpanded(false);
    onTagDraftChange("");
  }, [onTagDraftChange]);

  const closeActionDialog = useCallback(() => {
    setActionTag(null);
  }, []);

  const startRename = useCallback(
    (tag: string) => {
      closeActionDialog();
      collapseAdd();
      setRenamingTag(tag);
      setRenameDraft(formatJournalTagLabel(tag));
    },
    [closeActionDialog, collapseAdd],
  );

  const removeTag = useCallback(
    (tag: string) => {
      hapticSelection();
      onTagsChange(tags.filter((item) => item !== tag));
      if (renamingTag === tag) cancelRename();
      if (actionTag === tag) closeActionDialog();
    },
    [actionTag, cancelRename, closeActionDialog, onTagsChange, renamingTag, tags],
  );

  const toggleSuggestion = useCallback(
    (tag: string) => {
      hapticSelection();
      if (tags.includes(tag)) {
        onTagsChange(tags.filter((item) => item !== tag));
        if (renamingTag === tag) cancelRename();
        if (actionTag === tag) closeActionDialog();
        return;
      }
      onTagsChange(normalizeJournalTags([...tags, tag]));
    },
    [actionTag, cancelRename, closeActionDialog, onTagsChange, renamingTag, tags],
  );

  const openTagActions = useCallback(
    (tag: string) => {
      if (renamingTag || addExpanded) return;
      hapticMediumImpact();
      setActionTag(tag);
    },
    [addExpanded, renamingTag],
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
    closeActionDialog();
    setAddExpanded(true);
  }, [cancelRename, closeActionDialog]);

  const toggleExpanded = useCallback(() => {
    hapticSelection();
    setExpanded((prev) => !prev);
  }, []);

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

  const handleEditFromDialog = useCallback(() => {
    if (!actionTag) return;
    startRename(actionTag);
  }, [actionTag, startRename]);

  const handleDeleteFromDialog = useCallback(() => {
    if (!actionTag) return;
    const tag = actionTag;
    closeActionDialog();
    removeTag(tag);
  }, [actionTag, closeActionDialog, removeTag]);

  return (
    <View collapsable={false} style={{ backgroundColor: surfaceColor, marginTop: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Tags (optional), ${expanded ? "expanded" : "collapsed"}`}
        accessibilityState={{ expanded }}
        accessibilityHint="Shows or hides tag chips"
        onPress={toggleExpanded}
        style={styles.header}
      >
        <Text style={styles.headerLabel}>Tags (optional)</Text>
        <Animated.View style={chevronStyle}>
          <MaterialIcons name="keyboard-arrow-down" size={22} color={READER_M3_ON_SURFACE_VARIANT} />
        </Animated.View>
      </Pressable>
      <Animated.View
        style={panelStyle}
        pointerEvents={expanded ? "auto" : "none"}
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
      >
        <View style={styles.chips}>
          {JOURNAL_TAG_SUGGESTIONS.map((tag) => {
            const selected = tags.includes(tag);
            if (renamingTag === tag) {
              return (
                <JournalEntryEditableTagChip
                  key={tag}
                  label={formatJournalTagLabel(tag)}
                  bundle={bundle}
                  editing
                  editValue={renameDraft}
                  error={renameError}
                  onStartEdit={() => startRename(tag)}
                  onEditValueChange={setRenameDraft}
                  onCommitEdit={commitRename}
                  onCancelEdit={cancelRename}
                  onRemove={() => removeTag(tag)}
                />
              );
            }
            return (
              <JournalEntryTagChip
                key={tag}
                label={formatJournalTagLabel(tag)}
                selected={selected}
                onPress={() => toggleSuggestion(tag)}
                bundle={bundle}
                accessibilityLabel={
                  selected
                    ? `Selected tag ${formatJournalTagLabel(tag)}`
                    : `Add tag ${formatJournalTagLabel(tag)}`
                }
              />
            );
          })}
          {customTags.map((tag) => (
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
              onLongPress={() => openTagActions(tag)}
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
      </Animated.View>
      <JournalTagChipActionDialog
        visible={actionTag != null}
        tagLabel={actionTagLabel}
        bundle={bundle}
        onEdit={handleEditFromDialog}
        onDelete={handleDeleteFromDialog}
        onClose={closeActionDialog}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
    minHeight: 32,
    alignSelf: "flex-start",
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
