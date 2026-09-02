import { useEffect, useRef, type RefObject } from "react";
import { StyleSheet } from "react-native";
import {
  EnrichedTextInput,
  type EnrichedTextInputInstance,
  type OnChangeStateEvent,
} from "react-native-enriched-html";
import {
  REFLECTION_LIVE_BODY_FONT_FAMILY,
  REFLECTION_LIVE_BODY_FONT_SIZE,
  REFLECTION_LIVE_BODY_LINE_HEIGHT,
  REFLECTION_LIVE_H1_FONT_SIZE,
} from "@/lib/journal-reflection-live-markdown-style";

type Props = {
  editorRef: RefObject<EnrichedTextInputInstance | null>;
  seedHtml: string;
  /** Cheap text-change event from 0a — plain text, not HTML. Do not attach onChangeHtml. */
  onChangeText: (plainText: string) => void;
  onChangeState?: (state: OnChangeStateEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onStartMention?: (indicator: string) => void;
  onChangeMention?: (event: { indicator: string; text: string }) => void;
  onEndMention?: (indicator: string) => void;
  onPasteImages?: (images: { uri: string; width: number; height: number }[]) => void;
  placeholderTextColor: string;
  cursorColor: string;
  textColor: string;
  linkColor: string;
  mentionColor: string;
  mentionBackgroundColor: string;
  checkboxColor: string;
  backgroundColor: string;
};

/**
 * Phase 3 note-surface editor. Mentions (`@` + setMention attrs), images, and
 * checklists use the 0b-surviving mappings. `autoFocus` stays off.
 */
export function ReflectionEnrichedEditor({
  editorRef,
  seedHtml,
  onChangeText,
  onChangeState,
  onFocus,
  onBlur,
  onStartMention,
  onChangeMention,
  onEndMention,
  onPasteImages,
  placeholderTextColor,
  cursorColor,
  textColor,
  linkColor,
  mentionColor,
  mentionBackgroundColor,
  checkboxColor,
  backgroundColor,
}: Props) {
  const seededRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let frames = 0;
    const trySeed = () => {
      const editor = editorRef.current;
      if (cancelled) return;
      if (!editor) {
        if (frames < 30) {
          frames += 1;
          requestAnimationFrame(trySeed);
        }
        return;
      }
      if (seededRef.current) return;
      seededRef.current = true;
      editor.setValue(seedHtml);
      editor.focus();
    };
    trySeed();
    return () => {
      cancelled = true;
    };
  }, [editorRef, seedHtml]);

  return (
    <EnrichedTextInput
      ref={editorRef}
      autoFocus={false}
      mentionIndicators={["@"]}
      placeholder="Write your reflection…"
      placeholderTextColor={placeholderTextColor}
      cursorColor={cursorColor}
      onChangeText={(event) => onChangeText(event.nativeEvent.value)}
      onChangeState={(event) => onChangeState?.(event.nativeEvent)}
      onFocus={onFocus}
      onBlur={onBlur}
      onStartMention={onStartMention}
      onChangeMention={onChangeMention}
      onEndMention={onEndMention}
      onPasteImages={(event) => {
        const images = event.nativeEvent.images.map((image) => ({
          uri: image.uri,
          width: image.width,
          height: image.height,
        }));
        onPasteImages?.(images);
      }}
      htmlStyle={{
        a: { color: linkColor },
        h1: { fontSize: REFLECTION_LIVE_H1_FONT_SIZE, bold: true },
        h2: { fontSize: 22, bold: true },
        mention: {
          "@": {
            color: mentionColor,
            backgroundColor: mentionBackgroundColor,
            textDecorationLine: "none",
          },
        },
        ulCheckbox: {
          boxColor: checkboxColor,
          boxSize: 18,
          marginLeft: 16,
          gapWidth: 12,
        },
      }}
      style={{
        ...styles.input,
        color: textColor,
        backgroundColor,
      }}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    minHeight: 0,
    fontFamily: REFLECTION_LIVE_BODY_FONT_FAMILY,
    fontSize: REFLECTION_LIVE_BODY_FONT_SIZE,
    lineHeight: REFLECTION_LIVE_BODY_LINE_HEIGHT,
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 19,
  },
});
