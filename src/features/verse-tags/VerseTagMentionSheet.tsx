import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import type { VerseTagRef } from "@sinag-bible/types";
import { ReaderM3BottomSheet } from "@/src/components/m3/ReaderM3BottomSheet";
import { M3OutlinedTextField } from "@/src/components/m3/M3OutlinedTextField";
import {
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
} from "@/src/features/reader/readerSettingsPanelChrome";
import {
  searchVerseTagSuggestions,
  type VerseTagSuggestion,
} from "@/src/features/verse-tags/searchVerseTagSuggestions";

export type VerseTagMentionSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  translationId: string;
  bundle: MobileAppThemeBundle;
  insets: { top: number; bottom: number; left: number; right: number };
  isTabletReaderLayout?: boolean;
  onPick: (ref: VerseTagRef) => void;
};

export function VerseTagMentionSheet({
  isOpen,
  onClose,
  initialQuery = "",
  translationId,
  bundle,
  insets,
  isTabletReaderLayout = false,
  onPick,
}: VerseTagMentionSheetProps) {
  const rc = bundle.reader;
  const scale = isTabletReaderLayout ? 1.15 : 1;
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<VerseTagSuggestion[]>([]);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setQuery(initialQuery);
  }, [initialQuery, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSuggestions([]);
      setPending(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setPending(true);
        try {
          const next = await searchVerseTagSuggestions(query, translationId);
          if (!cancelled) setSuggestions(next);
        } finally {
          if (!cancelled) setPending(false);
        }
      })();
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, query, translationId]);

  const handlePick = (item: VerseTagSuggestion) => {
    if (item.kind === "query") {
      setQuery(item.query);
      return;
    }
    onPick(item.ref);
    onClose();
  };

  return (
    <ReaderM3BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      bundle={bundle}
      insets={insets}
      isTabletReaderLayout={isTabletReaderLayout}
      title="Insert verse"
      subtitle="Type a reference like john:3:16 or John 3:16"
      scrollable={false}
      maxHeightRatio={0.55}
    >
      <M3OutlinedTextField
        label="Reference"
        value={query}
        onChangeText={setQuery}
        surfaceColor={rc.popoverSurface}
        accentColor={bundle.ui.brown800}
        scale={scale}
        placeholder="john:3:16"
      />

      <View style={[styles.results, { marginTop: 12 * scale, minHeight: 120 * scale }]}>
        {pending ? (
          <ActivityIndicator color={bundle.ui.brown800} style={styles.loader} />
        ) : suggestions.length === 0 ? (
          <Text style={[styles.empty, { color: READER_M3_ON_SURFACE_VARIANT, fontSize: 14 * scale }]}>
            {query.trim() ? "No matching verses yet." : "Search for a verse reference."}
          </Text>
        ) : (
          suggestions.map((item) => (
            <Pressable
              key={item.kind === "ref" ? item.label : item.query}
              onPress={() => handlePick(item)}
              style={({ pressed }) => [
                styles.row,
                {
                  paddingVertical: 12 * scale,
                  paddingHorizontal: 4 * scale,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Text style={[styles.rowTitle, { color: READER_M3_ON_SURFACE, fontSize: 16 * scale }]}>
                {item.label}
              </Text>
              {item.kind === "ref" && item.preview ? (
                <Text
                  style={[
                    styles.rowPreview,
                    { color: READER_M3_ON_SURFACE_VARIANT, fontSize: 14 * scale },
                  ]}
                  numberOfLines={3}
                >
                  {item.preview}
                </Text>
              ) : item.kind === "query" && item.subtitle ? (
                <Text
                  style={[
                    styles.rowPreview,
                    { color: READER_M3_ON_SURFACE_VARIANT, fontSize: 13 * scale },
                  ]}
                >
                  {item.subtitle}
                </Text>
              ) : null}
            </Pressable>
          ))
        )}
      </View>
    </ReaderM3BottomSheet>
  );
}

const styles = StyleSheet.create({
  results: {
    width: "100%",
  },
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
