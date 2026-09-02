import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { ReflectionFormattedPreview } from "@/components/reflection-formatted-preview";
import { REFLECTION_LIVE_BODY_LINE_HEIGHT } from "@/lib/journal-reflection-live-markdown-style";
import { parseOwnedReflectionHtml } from "@/src/features/journal/journalSavedReflectionBlocks";
import { JournalSavedReflectionBlock } from "@/src/features/journal/JournalSavedReflectionBlock";

const PREVIEW_LINES = 6;
const PREVIEW_VERTICAL_PAD = 12;
const FADE_HEIGHT = 36;
const PREVIEW_MAX_HEIGHT =
  REFLECTION_LIVE_BODY_LINE_HEIGHT * PREVIEW_LINES + PREVIEW_VERTICAL_PAD * 2;

type Props = {
  markdown: string;
  imageMap: Record<string, string>;
  onPress: () => void;
  fieldBackground: string;
  fieldOutline: string;
  useHtmlPreview?: boolean;
  ownedHtml?: string;
  bundle?: MobileAppThemeBundle;
  translationId?: string;
  bodyColor?: string;
  linkColor?: string;
  accessibilityLabel?: string;
};

/**
 * Tap-to-open compact reflection preview (~6 lines + bottom fade).
 * Default path when `JOURNAL_NOTES_SURFACE_ENABLED` is on.
 */
export function ReflectionCompactPreview({
  markdown,
  imageMap,
  onPress,
  fieldBackground,
  fieldOutline,
  useHtmlPreview = false,
  ownedHtml = "",
  bundle,
  translationId = "KJV",
  bodyColor,
  linkColor,
  accessibilityLabel = "Open reflection note",
}: Props) {
  const htmlBlocks = useMemo(
    () => (useHtmlPreview ? parseOwnedReflectionHtml(ownedHtml) : []),
    [ownedHtml, useHtmlPreview],
  );
  const hasHtmlPreview = useHtmlPreview && htmlBlocks.length > 0;
  const hasMarkdownPreview = !useHtmlPreview && markdown.trim().length > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <View
        className="rounded-2xl overflow-hidden"
        style={[
          styles.shell,
          {
            backgroundColor: fieldBackground,
            borderColor: fieldOutline,
            borderWidth: 1,
          },
        ]}
      >
        <View style={styles.clip}>
          <View style={styles.previewPad}>
            {hasHtmlPreview && bundle && bodyColor && linkColor ? (
              htmlBlocks.map((block) => (
                <JournalSavedReflectionBlock
                  key={block.key}
                  block={block}
                  bodyColor={bodyColor}
                  linkColor={linkColor}
                  bundle={bundle}
                  translationId={translationId}
                  compact
                />
              ))
            ) : hasMarkdownPreview ? (
              <ReflectionFormattedPreview
                markdown={markdown}
                imageMap={imageMap}
                compact
                emptyText="Tap to write your reflection…"
              />
            ) : (
              <Text style={styles.emptyText}>Tap to write your reflection…</Text>
            )}
          </View>
          <LinearGradient
            colors={["transparent", fieldBackground]}
            style={styles.fade}
            pointerEvents="none"
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.92,
  },
  shell: {
    marginTop: 5,
  },
  clip: {
    maxHeight: PREVIEW_MAX_HEIGHT,
    overflow: "hidden",
    position: "relative",
  },
  previewPad: {
    paddingHorizontal: 12,
    paddingTop: PREVIEW_VERTICAL_PAD,
    paddingBottom: PREVIEW_VERTICAL_PAD,
  },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: FADE_HEIGHT,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 24,
    color: "#9c8e78",
    fontStyle: "italic",
  },
});
