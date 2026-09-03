import { useCallback, useEffect, useMemo, useState, type LayoutChangeEvent } from "react";
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
import {
  canAcceptSuggestionAdd,
  isRenameDraftError,
  isTagDraftAddError,
  MAX_TAGS_PER_ENTRY,
  shouldUseEditableCatalogChip,
} from "@/src/features/journal/journalTagSectionLogic";
import { JournalTagChipActionDialog } from "@/src/features/journal/JournalTagChipActionDialog";

export type JournalTagSectionProps = {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  tagDraft: string;
  onTagDraftChange: (text: string) => void;
  onCommitTagDraft: (raw: string) => boolean;
  bundle: MobileAppThemeBundle;
  surfaceColor: string;
  onTagsSessionStart?: () => void;
  onTagsSessionEnd?: () => void;
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
  onTagsSessionStart,
  onTagsSessionEnd,
}: JournalTagSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [addExpanded, setAddExpanded] = useState(false);
  const [actionTag, setActionTag] = useState<string | null>(null);
  const [rejectedSuggestionTag, setRejectedSuggestionTag] = useState<string | null>(null);

  const expandProgress = useSharedValue(1);
  const panelOpacity = useSharedValue(1);
  const panelContentHeight = useSharedValue(0);

  useEffect(() => {
    animateM3SpatialProgress(expandProgress, expanded ? 1 : 0, expanded);
    animateM3EffectsOpacity(panelOpacity, expanded ? 1 : 0, expanded);
  }, [expanded, expandProgress, panelOpacity]);

  const handleChipsLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!expanded) return;
      const next = event.nativeEvent.layout.height;
      if (next > 0) panelContentHeight.value = next;
    },
    [expanded, panelContentHeight],
  );

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${expandProgress.value * 180}deg` }],
  }));

  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelOpacity.value,
    maxHeight: expandProgress.value * panelContentHeight.value,
    overflow: "hidden" as const,
  }));

  const labelColor = bundle.ui.tan200;

  const customTags = useMemo(
    () => tags.filter((tag) => !(JOURNAL_TAG_SUGGESTIONS as readonly string[]).includes(tag)),
    [tags],
  );

  const actionTagLabel = actionTag ? formatJournalTagLabel(actionTag) : "";

  const cancelRename = useCallback(() => {
    setRenamingTag(null);
    setRenameDraft("");
    onTagsSessionEnd?.();
  }, [onTagsSessionEnd]);

  const collapseAddOnly = useCallback(() => {
    setAddExpanded(false);
    onTagDraftChange("");
  }, [onTagDraftChange]);

  const collapseAdd = useCallback(() => {
    collapseAddOnly();
    onTagsSessionEnd?.();
  }, [collapseAddOnly, onTagsSessionEnd]);

  const closeActionDialog = useCallback(() => {
    setActionTag(null);
  }, []);

  const startRename = useCallback(
    (tag: string) => {
      closeActionDialog();
      collapseAddOnly();
      setRejectedSuggestionTag(null);
      setRenamingTag(tag);
      setRenameDraft(formatJournalTagLabel(tag));
      onTagsSessionStart?.();
    },
    [closeActionDialog, collapseAddOnly, onTagsSessionStart],
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
      if (tags.includes(tag)) {
        hapticSelection();
        setRejectedSuggestionTag(null);
        onTagsChange(tags.filter((item) => item !== tag));
        if (renamingTag === tag) cancelRename();
        if (actionTag === tag) closeActionDialog();
        return;
      }
      if (!canAcceptSuggestionAdd(tags, tag)) {
        setRejectedSuggestionTag(tag);
        return;
      }
      hapticSelection();
      setRejectedSuggestionTag(null);
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

  const renameError = useMemo(
    () => isRenameDraftError(renamingTag, renameDraft, tags),
    [renameDraft, renamingTag, tags],
  );

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
    setRejectedSuggestionTag(null);
    setAddExpanded(true);
    onTagsSessionStart?.();
  }, [cancelRename, closeActionDialog, onTagsSessionStart]);

  const toggleExpanded = useCallback(() => {
    hapticSelection();
    cancelRename();
    collapseAdd();
    closeActionDialog();
    setRejectedSuggestionTag(null);
    setExpanded((prev) => !prev);
  }, [cancelRename, collapseAdd, closeActionDialog]);

  const handleTagDraftChange = useCallback(
    (text: string) => {
      setRejectedSuggestionTag(null);
      if (text.includes(",")) {
        const [head, ...rest] = text.split(",");
        if (onCommitTagDraft(head)) {
          const tail = rest.join(",").replace(/^\s+/, "");
          onTagDraftChange(tail);
          if (!tail.trim()) {
            setAddExpanded(false);
            onTagsSessionEnd?.();
          }
          return;
        }
      }
      onTagDraftChange(text);
    },
    [onCommitTagDraft, onTagDraftChange, onTagsSessionEnd],
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
      onTagsSessionEnd?.();
      return;
    }
    collapseAdd();
  }, [collapseAdd, onCommitTagDraft, onTagDraftChange, onTagsSessionEnd, tagDraft]);

  const addError = useMemo(
    () => isTagDraftAddError(addExpanded, tagDraft, tags),
    [addExpanded, tagDraft, tags],
  );

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

  const renderEditableChip = (tag: string) => (
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
  );

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
        <View style={styles.headerContent}>
          <Text style={[styles.headerLabel, { color: labelColor }]}>Tags (optional)</Text>
          <Animated.View style={chevronStyle}>
            <MaterialIcons name="keyboard-arrow-down" size={22} color={labelColor} />
          </Animated.View>
        </View>
      </Pressable>
      <Animated.View
        style={panelStyle}
        pointerEvents={expanded ? "auto" : "none"}
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
      >
        <View style={styles.chips} onLayout={handleChipsLayout}>
          {JOURNAL_TAG_SUGGESTIONS.map((tag) => {
            if (shouldUseEditableCatalogChip(tag, tags, renamingTag)) {
              return renderEditableChip(tag);
            }
            return (
              <JournalEntryTagChip
                key={tag}
                label={formatJournalTagLabel(tag)}
                selected={false}
                onPress={() => toggleSuggestion(tag)}
                bundle={bundle}
                error={rejectedSuggestionTag === tag}
                accessibilityLabel={`Add tag ${formatJournalTagLabel(tag)}`}
              />
            );
          })}
          {customTags.map((tag) => renderEditableChip(tag))}
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
    alignSelf: "stretch",
    justifyContent: "center",
    marginBottom: 8,
    minHeight: 44,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
  },
  headerLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
