import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ReflectionFormattedPreview } from "@/components/reflection-formatted-preview";
import { REFLECTION_LIVE_BODY_LINE_HEIGHT } from "@/lib/journal-reflection-live-markdown-style";

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
  accessibilityLabel = "Open reflection note",
}: Props) {
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
            <ReflectionFormattedPreview
              markdown={markdown}
              imageMap={imageMap}
              compact
              emptyText="Tap to write your reflection…"
            />
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
});
