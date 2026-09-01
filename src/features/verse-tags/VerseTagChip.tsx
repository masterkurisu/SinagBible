import { type RefObject } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { getReaderSheetChrome } from "@/lib/reader-sheet-chrome";

export type VerseTagChipVariant = "inline" | "inline-pressable" | "input";

export type VerseTagChipProps = {
  label: string;
  bundle: MobileAppThemeBundle;
  accessibilityLabel: string;
  onPress: () => void;
  onLongPress?: () => void;
  variant?: VerseTagChipVariant;
  showBookmark?: boolean;
  textStyle?: StyleProp<TextStyle>;
  chipRef?: RefObject<View | null>;
};

/** Shared verse-tag chip. `inline` nests in Text; `input` is a 32dp stadium Pressable. */
export function VerseTagChip({
  label,
  bundle,
  accessibilityLabel,
  onPress,
  onLongPress,
  variant = "inline",
  showBookmark = false,
  textStyle,
  chipRef,
}: VerseTagChipProps) {
  const chrome = getReaderSheetChrome(bundle);

  if (variant === "inline-pressable") {
    return (
      <Pressable
        ref={chipRef}
        collapsable={false}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={420}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        android_ripple={
          Platform.OS === "android"
            ? { color: chrome.iconRipple, borderless: false, foreground: true }
            : undefined
        }
        style={[styles.inlinePressableChip, { backgroundColor: chrome.secondaryContainer }]}
      >
        {({ pressed }) => (
          <>
            {pressed ? (
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.inlinePressableStateLayer,
                  { backgroundColor: chrome.onSecondaryContainer },
                ]}
              />
            ) : null}
            <Text
              numberOfLines={1}
              style={[styles.inlinePressableLabel, { color: chrome.onSecondaryContainer }]}
            >
              {label}
            </Text>
          </>
        )}
      </Pressable>
    );
  }

  if (variant === "input") {
    return (
      <Pressable
        ref={chipRef}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={420}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        android_ripple={
          Platform.OS === "android"
            ? { color: chrome.iconRipple, borderless: false, foreground: true }
            : undefined
        }
        style={[styles.inputChip, { backgroundColor: chrome.secondaryContainer }]}
      >
        {({ pressed }) => (
          <>
            {pressed ? (
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.inputStateLayer,
                  { backgroundColor: chrome.onSecondaryContainer },
                ]}
              />
            ) : null}
            {showBookmark ? (
              <MaterialIcons
                name="bookmark"
                size={18}
                color={chrome.onSecondaryContainer}
                style={styles.bookmark}
              />
            ) : null}
            <Text
              numberOfLines={1}
              style={[styles.inputLabel, { color: chrome.onSecondaryContainer }]}
            >
              {label}
            </Text>
          </>
        )}
      </Pressable>
    );
  }

  return (
    <Text
      ref={chipRef as RefObject<Text | null>}
      onPress={onPress}
      onLongPress={onLongPress}
      suppressHighlighting
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        textStyle,
        styles.inlineChip,
        {
          color: chrome.onSecondaryContainer,
          backgroundColor: chrome.secondaryContainer,
        },
      ]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  inlineChip: {
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  inlinePressableChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    minHeight: 20,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginHorizontal: 1,
    marginVertical: 1,
    overflow: "hidden",
  },
  inlinePressableStateLayer: {
    opacity: 0.1,
    borderRadius: 999,
  },
  inlinePressableLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 16,
    textAlign: "center",
    ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
  },
  inputChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: "hidden",
  },
  inputStateLayer: {
    opacity: 0.1,
    borderRadius: 16,
  },
  bookmark: {
    marginRight: 4,
  },
  inputLabel: {
    flexShrink: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
});
