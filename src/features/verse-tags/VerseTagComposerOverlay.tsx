import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { getReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import { formatVerseTagComposerError } from "@/src/features/verse-tags/verseTagChipCopy";
import type { VerseTagComposerError } from "@/src/features/verse-tags/verseTagComposer";
import type { VerseTagSuggestion } from "@/src/features/verse-tags/searchVerseTagSuggestions";
import { VerseTagSuggestionList } from "@/src/features/verse-tags/VerseTagSuggestionList";
import { computeVerseTagOverlayMetrics } from "@/src/features/verse-tags/verseTagOverlayLayout";
import { READER_M3_ERROR, READER_OVERLAY_CONTENT_SCALE } from "@/src/features/reader/readerSettingsPanelChrome";

export type VerseTagComposerOverlayProps = {
  visible: boolean;
  query: string;
  error: VerseTagComposerError | null;
  suggestions: VerseTagSuggestion[];
  pending: boolean;
  selectedIndex: number;
  bundle: MobileAppThemeBundle;
  insets: { top: number; bottom: number };
  keyboardHeight: number;
  /** Inline under a field (notes dialog). Absolute docks above the keyboard. */
  placement?: "inline" | "absolute";
  onSelect: (item: VerseTagSuggestion) => void;
  onDismiss: () => void;
  onSelectStart?: () => void;
};

export function VerseTagComposerOverlay({
  visible,
  query,
  error,
  suggestions,
  pending,
  selectedIndex,
  bundle,
  insets,
  keyboardHeight,
  placement = "absolute",
  onSelect,
  onDismiss,
  onSelectStart,
}: VerseTagComposerOverlayProps) {
  const { height: screenH } = useWindowDimensions();
  const chrome = getReaderSheetChrome(bundle);
  const scale = READER_OVERLAY_CONTENT_SCALE;
  const metrics = computeVerseTagOverlayMetrics({
    screenHeight: screenH,
    keyboardHeight: placement === "inline" ? 0 : keyboardHeight,
    statusBarInset: insets.top,
  });

  if (!visible) return null;

  const list = (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: chrome.settingsPanelBackground,
          maxHeight: metrics.maxHeight,
          borderColor: error ? READER_M3_ERROR : chrome.outlineVariant,
        },
      ]}
    >
      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={[styles.error, { color: READER_M3_ERROR, fontSize: 13 * scale }]}
        >
          {formatVerseTagComposerError(error)}
        </Text>
      ) : null}
      <VerseTagSuggestionList
        suggestions={suggestions}
        pending={pending}
        query={query}
        selectedIndex={selectedIndex}
        bundle={bundle}
        scale={scale}
        onSelect={onSelect}
        onSelectStart={onSelectStart}
      />
    </View>
  );

  if (placement === "inline") {
    return list;
  }

  return (
    <View style={styles.absoluteRoot} pointerEvents="box-none">
      <Pressable
        style={styles.dismissHit}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss verse suggestions"
      />
      <View style={{ marginBottom: metrics.bottom }}>{list}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteRoot: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    zIndex: 60,
    elevation: 60,
  },
  dismissHit: {
    flex: 1,
  },
  panel: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  error: {
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
});
