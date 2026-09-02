import { useEffect, useRef } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInput as TextInputType,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { READER_M3_ERROR } from "@/src/features/reader/readerSettingsPanelChrome";

const ICON_SIZE = 18;
const TOUCH_TARGET = 44;
const HIT_SLOP = (TOUCH_TARGET - ICON_SIZE) / 2;

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
};

/**
 * Applied journal tag — M3 input chip with trailing remove and tap-to-rename body.
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
}: JournalEntryEditableTagChipProps) {
  const j = bundle.journal;
  const inputRef = useRef<TextInputType>(null);
  const backgroundColor = j.chipActiveBackground;
  const borderColor = error ? READER_M3_ERROR : j.chipActiveBorder;
  const textColor = j.chipActiveText;

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

  return (
    <View
      accessibilityRole="none"
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
        <Pressable
          onPress={onStartEdit}
          accessibilityRole="button"
          accessibilityLabel={`Rename tag ${label}`}
          android_ripple={
            Platform.OS === "android"
              ? { color: bundle.chrome.androidRipple, borderless: false }
              : undefined
          }
          style={styles.bodyPressable}
        >
          <Text numberOfLines={1} style={[styles.label, { color: textColor }]}>
            {label}
          </Text>
        </Pressable>
      )}
      <Pressable
        onPress={editing ? onCancelEdit : onRemove}
        accessibilityRole="button"
        accessibilityLabel={editing ? `Cancel renaming ${label}` : `Remove tag ${label}`}
        hitSlop={HIT_SLOP}
        style={styles.trailingAction}
      >
        <MaterialIcons name="close" size={ICON_SIZE} color={textColor} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    minHeight: 32,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
  },
  bodyPressable: {
    flexShrink: 1,
    minWidth: 0,
    justifyContent: "center",
    minHeight: 24,
    paddingRight: 4,
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
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
});
