import { useEffect, useMemo, useRef } from "react";
import {
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type TextInput as TextInputType,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";

export type JournalListSearchBarProps = {
  query: string;
  onChangeQuery: (query: string) => void;
  onClose: () => void;
  autoFocus?: boolean;
};

export function JournalListSearchBar({
  query,
  onChangeQuery,
  onClose,
  autoFocus = false,
}: JournalListSearchBarProps) {
  const { bundle } = useMobileAppTheme();
  const s = bundle.search;
  const j = bundle.journal;
  const chrome = bundle.chrome;
  const isAndroid = Platform.OS === "android";
  const inputRef = useRef<TextInputType | null>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: isAndroid ? chrome.androidIndicator : j.cardBackground,
          borderRadius: isAndroid ? 28 : 999,
          ...(isAndroid
            ? {}
            : {
                borderWidth: 1,
                borderColor: j.panelBorder,
              }),
          paddingLeft: 14,
          paddingRight: 8,
          minHeight: isAndroid ? 48 : 44,
        },
        searchIcon: { marginRight: 10, opacity: isAndroid ? 1 : 0.45 },
        input: {
          flex: 1,
          fontFamily: "Inter_400Regular",
          fontSize: isAndroid ? 16 : 14,
          color: s.primaryText,
          paddingVertical: isAndroid ? 12 : 10,
          paddingRight: 4,
          margin: 0,
          minWidth: 0,
        },
        clearButton: {
          justifyContent: "center",
          alignItems: "center",
          minWidth: 32,
          minHeight: 32,
        },
        closeButton: {
          justifyContent: "center",
          alignItems: "center",
          minWidth: 36,
          minHeight: 36,
          marginLeft: 2,
        },
      }),
    [chrome.androidIndicator, isAndroid, j.cardBackground, j.panelBorder, s.primaryText],
  );

  const showClear = query.length > 0;

  return (
    <View style={styles.row}>
      <MaterialCommunityIcons
        name="magnify"
        size={isAndroid ? 22 : 20}
        color={isAndroid ? s.muted : s.bodyText}
        style={styles.searchIcon}
      />
      <TextInput
        ref={inputRef}
        value={query}
        onChangeText={onChangeQuery}
        placeholder="Search entries, verses, dates…"
        placeholderTextColor={s.placeholder}
        style={styles.input}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        selectionColor={s.tint}
        accessibilityLabel="Search journal entries"
      />
      {showClear ? (
        <TouchableOpacity
          onPress={() => onChangeQuery("")}
          activeOpacity={0.65}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.clearButton}
          accessibilityLabel="Clear search"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="close-circle" size={20} color={s.muted} />
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        onPress={onClose}
        activeOpacity={0.65}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.closeButton}
        accessibilityLabel="Close search"
        accessibilityRole="button"
      >
        <MaterialCommunityIcons name="close" size={22} color={s.muted} />
      </TouchableOpacity>
    </View>
  );
}
