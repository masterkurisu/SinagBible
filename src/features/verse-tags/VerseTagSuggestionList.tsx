import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { getReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import type { VerseTagSuggestion } from "@/src/features/verse-tags/searchVerseTagSuggestions";
import { READER_OVERLAY_CONTENT_SCALE } from "@/src/features/reader/readerSettingsPanelChrome";

export type VerseTagSuggestionListProps = {
  suggestions: VerseTagSuggestion[];
  pending: boolean;
  query: string;
  selectedIndex: number;
  bundle: MobileAppThemeBundle;
  scale?: number;
  onSelect: (item: VerseTagSuggestion) => void;
  onSelectStart?: () => void;
};

export function VerseTagSuggestionList({
  suggestions,
  pending,
  query,
  selectedIndex,
  bundle,
  scale = READER_OVERLAY_CONTENT_SCALE,
  onSelect,
  onSelectStart,
}: VerseTagSuggestionListProps) {
  const chrome = getReaderSheetChrome(bundle);

  if (pending && suggestions.length === 0) {
    return <ActivityIndicator color={chrome.onSurface} style={styles.loader} />;
  }

  if (suggestions.length === 0) {
    return (
      <Text style={[styles.empty, { color: chrome.onSurfaceVariant, fontSize: 14 * scale }]}>
        {query.trim() ? "No matching verses yet." : "Search for a verse reference."}
      </Text>
    );
  }

  return (
    <View accessibilityRole="list" accessibilityLabel="Verse reference suggestions">
      {suggestions.map((item, index) => {
        const selected = index === selectedIndex;
        return (
          <Pressable
            key={item.kind === "ref" ? `${item.label}-${index}` : `${item.query}-${index}`}
            onPress={() => onSelect(item)}
            onPressIn={onSelectStart}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.row,
              {
                paddingVertical: 12 * scale,
                paddingHorizontal: 4 * scale,
                backgroundColor: selected ? chrome.secondaryContainer : "transparent",
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.rowTitle,
                {
                  color: selected ? chrome.onSecondaryContainer : chrome.onSurface,
                  fontSize: 16 * scale,
                },
              ]}
            >
              {item.label}
            </Text>
            {item.kind === "ref" && item.preview ? (
              <Text
                style={[
                  styles.rowPreview,
                  { color: chrome.onSurfaceVariant, fontSize: 14 * scale },
                ]}
                numberOfLines={3}
              >
                {item.preview}
              </Text>
            ) : item.kind === "query" && item.subtitle ? (
              <Text
                style={[
                  styles.rowPreview,
                  { color: chrome.onSurfaceVariant, fontSize: 13 * scale },
                ]}
              >
                {item.subtitle}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: 24,
  },
  empty: {
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    paddingTop: 8,
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(121, 116, 126, 0.28)",
    borderRadius: 8,
  },
  rowTitle: {
    fontFamily: "Inter_600SemiBold",
    lineHeight: 22,
  },
  rowPreview: {
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginTop: 4,
  },
});
