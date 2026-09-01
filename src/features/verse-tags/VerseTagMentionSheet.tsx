import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import type { VerseTagRef } from "@sinag-bible/types";
import { ReaderM3BottomSheet } from "@/src/components/m3/ReaderM3BottomSheet";
import { M3OutlinedTextField } from "@/src/components/m3/M3OutlinedTextField";
import { READER_OVERLAY_CONTENT_SCALE } from "@/src/features/reader/readerSettingsPanelChrome";
import {
  searchVerseTagSuggestions,
  type VerseTagSuggestion,
} from "@/src/features/verse-tags/searchVerseTagSuggestions";
import { VerseTagSuggestionList } from "@/src/features/verse-tags/VerseTagSuggestionList";

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
  const scale = READER_OVERLAY_CONTENT_SCALE;
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
        <VerseTagSuggestionList
          suggestions={suggestions}
          pending={pending}
          query={query}
          selectedIndex={0}
          bundle={bundle}
          scale={scale}
          onSelect={handlePick}
        />
      </View>
    </ReaderM3BottomSheet>
  );
}

const styles = StyleSheet.create({
  results: {
    width: "100%",
  },
});
