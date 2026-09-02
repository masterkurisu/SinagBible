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
import { M3_OUTLINE_STROKE } from "@/src/components/m3/M3OutlinedTextField";
import { READER_M3_ERROR } from "@/src/features/reader/readerSettingsPanelChrome";

export type JournalEntryAddTagChipProps = {
  bundle: MobileAppThemeBundle;
  expanded: boolean;
  value: string;
  error?: boolean;
  accentColor: string;
  onExpand: () => void;
  onCollapse: () => void;
  onChangeText: (text: string) => void;
  onCommit: () => void;
};

/**
 * Trailing "Add tag" chip that expands into an inline pill TextInput.
 */
export function JournalEntryAddTagChip({
  bundle,
  expanded,
  value,
  error = false,
  accentColor,
  onExpand,
  onCollapse,
  onChangeText,
  onCommit,
}: JournalEntryAddTagChipProps) {
  const j = bundle.journal;
  const inputRef = useRef<TextInputType>(null);

  useEffect(() => {
    if (expanded) {
      const timer = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [expanded]);

  if (!expanded) {
    return (
      <Pressable
        onPress={onExpand}
        accessibilityRole="button"
        accessibilityLabel="Add tag"
        android_ripple={
          Platform.OS === "android"
            ? { color: bundle.chrome.androidRipple, borderless: false }
            : undefined
        }
        style={[
          styles.chip,
          {
            backgroundColor: j.chipInactiveBackground,
            borderColor: j.chipInactiveBorder,
          },
        ]}
      >
        <MaterialIcons name="add" size={16} color={j.chipInactiveText} style={styles.addIcon} />
        <Text numberOfLines={1} style={[styles.label, { color: j.chipInactiveText }]}>
          Add tag
        </Text>
      </Pressable>
    );
  }

  const borderColor = error ? READER_M3_ERROR : value.length > 0 ? accentColor : M3_OUTLINE_STROKE;

  const handleBlur = () => {
    if (!value.trim()) {
      onCollapse();
      return;
    }
    onCommit();
  };

  return (
    <View style={[styles.chip, styles.chipExpanded, { backgroundColor: j.chipInactiveBackground, borderColor }]}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onBlur={handleBlur}
        onSubmitEditing={onCommit}
        returnKeyType="done"
        blurOnSubmit
        maxLength={24}
        numberOfLines={1}
        placeholder="Tag"
        placeholderTextColor={j.chipInactiveText}
        autoCorrect={false}
        autoCapitalize="words"
        accessibilityLabel="Add a tag"
        style={[styles.input, { color: j.chipInactiveText }]}
      />
      <Pressable
        onPress={onCollapse}
        accessibilityRole="button"
        accessibilityLabel="Cancel adding tag"
        hitSlop={13}
        style={styles.cancelAction}
      >
        <MaterialIcons name="close" size={18} color={j.chipInactiveText} />
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
  },
  chipExpanded: {
    paddingRight: 4,
    minWidth: 120,
  },
  addIcon: {
    marginRight: 4,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 64,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
  },
  cancelAction: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
