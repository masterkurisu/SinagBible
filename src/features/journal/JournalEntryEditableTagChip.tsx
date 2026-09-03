import { useEffect, useRef } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInput as TextInputType,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { READER_M3_ERROR } from "@/src/features/reader/readerSettingsPanelChrome";
import { useChipLongPress } from "@/src/features/journal/useChipLongPress";

const ICON_SIZE = 18;
const HIT_SLOP = 13;

export type JournalEntryEditableTagChipProps = {
  label: string;
  bundle: MobileAppThemeBundle;
  editing: boolean;
  editValue: string;
  error?: boolean;
  onStartEdit: () => void;
  onEditValueChange: (text: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onRemove: () => void;
  onLongPress?: () => void;
};

/**
 * Custom applied journal tag — same 32dp pill as catalog chips, small trailing remove.
 */
export function JournalEntryEditableTagChip({
  label,
  bundle,
  editing,
  editValue,
  error = false,
  onStartEdit,
  onEditValueChange,
  onCommitEdit,
  onCancelEdit,
  onRemove,
  onLongPress,
}: JournalEntryEditableTagChipProps) {
  const j = bundle.journal;
  const inputRef = useRef<TextInputType>(null);
  const skipChipPressRef = useRef(false);
  const backgroundColor = j.chipActiveBackground;
  const borderColor = error ? READER_M3_ERROR : j.chipActiveBorder;
  const textColor = j.chipActiveText;
  const longPress = useChipLongPress(editing ? undefined : onLongPress);

  useEffect(() => {
    if (editing) {
      const timer = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [editing]);

  const handleBlur = () => {
    if (error) {
      onCancelEdit();
      return;
    }
    onCommitEdit();
  };

  const handleChipPress = () => {
    if (skipChipPressRef.current) {
      skipChipPressRef.current = false;
      return;
    }
    if (longPress.shouldSkipPress()) return;
    onStartEdit();
  };

  const handleTrailingPress = () => {
    skipChipPressRef.current = true;
    if (editing) onCancelEdit();
    else onRemove();
  };

  return (
    <Pressable
      onPress={editing ? undefined : handleChipPress}
      onPressIn={editing ? undefined : longPress.onPressIn}
      onPressOut={editing ? undefined : longPress.onPressOut}
      disabled={editing}
      accessibilityRole="button"
      accessibilityLabel={`Tag ${label}`}
      accessibilityHint={editing ? undefined : "Tap to rename. Long press for more actions."}
      android_ripple={
        editing || Platform.OS !== "android"
          ? undefined
          : { color: bundle.chrome.androidRipple, borderless: false, foreground: true }
      }
      style={[styles.chip, { backgroundColor, borderColor }]}
    >
      {editing ? (
        <TextInput
          ref={inputRef}
          value={editValue}
          onChangeText={onEditValueChange}
          onBlur={handleBlur}
          onSubmitEditing={onCommitEdit}
          returnKeyType="done"
          blurOnSubmit
          maxLength={24}
          numberOfLines={1}
          autoCorrect={false}
          autoCapitalize="words"
          accessibilityLabel={`Rename tag ${label}`}
          style={[styles.input, { color: textColor }]}
        />
      ) : (
        <Text numberOfLines={1} style={[styles.label, { color: textColor }]}>
          {label}
        </Text>
      )}
      <Pressable
        onPress={handleTrailingPress}
        accessibilityRole="button"
        accessibilityLabel={editing ? `Cancel renaming ${label}` : `Remove tag ${label}`}
        hitSlop={HIT_SLOP}
        style={styles.trailingAction}
      >
        <MaterialIcons name="close" size={ICON_SIZE} color={textColor} />
      </Pressable>
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
    paddingLeft: 16,
    paddingRight: 8,
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
  input: {
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 48,
    maxWidth: "100%",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
  },
  trailingAction: {
    marginLeft: 2,
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
});
