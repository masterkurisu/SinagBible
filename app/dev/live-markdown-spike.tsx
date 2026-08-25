import { MarkdownTextInput } from "@expensify/react-native-live-markdown";
import { Redirect, Stack } from "expo-router";
import { useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ReflectionFormattedPreview } from "@/components/reflection-formatted-preview";
import { parseReflectionLiveMarkdown } from "@/lib/journal-reflection-live-markdown-parser";
import {
  applyReflectionToolbarAction,
  type ReflectionTextSelection,
  type ReflectionToolbarFormatAction,
} from "@/lib/journal-reflection-markdown-edit";
import {
  createReflectionLiveMarkdownInputStyle,
  createReflectionLiveMarkdownStyle,
} from "@/lib/journal-reflection-live-markdown-style";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";

/**
 * Phase 1–3 spike — style mapping, custom parser, and toolbar-at-caret checks.
 * Route: /dev/live-markdown-spike
 */
const SAMPLE = [
  "# Heading 1",
  "## Heading 2",
  "",
  "GitHub-style **bold** and _italic_ body copy.",
  "",
  "- bullet one",
  "- bullet two",
  "1. ordered item",
  "",
  "- [ ] checklist item",
  "[image:sample-id]",
  "",
  "Link: [Sinag](https://example.com)",
].join("\n");

const TOOLBAR_ACTIONS: { action: ReflectionToolbarFormatAction; label: string }[] = [
  { action: "bold", label: "Bold" },
  { action: "italic", label: "Italic" },
  { action: "heading", label: "H" },
  { action: "bullet", label: "•" },
  { action: "numbered", label: "1." },
  { action: "checklist", label: "☐" },
  { action: "link", label: "Link" },
];

function LiveMarkdownSpikeContent() {
  const inputRef = useRef<ComponentRef<typeof MarkdownTextInput>>(null);
  const selectionRef = useRef<ReflectionTextSelection>({ start: 0, end: 0 });
  const toolbarPressSelectionRef = useRef<ReflectionTextSelection | null>(null);
  const { bundle } = useMobileAppTheme();
  const colors = bundle.ui;
  const [text, setText] = useState(SAMPLE);
  const [selection, setSelection] = useState<ReflectionTextSelection>({ start: 0, end: 0 });
  const [selectionOverride, setSelectionOverride] = useState<ReflectionTextSelection | null>(null);

  const markdownStyle = useMemo(
    () =>
      createReflectionLiveMarkdownStyle({
        gold: colors.gold,
        tan100: colors.tan100,
        brown800: colors.brown800,
      }),
    [colors.gold, colors.tan100, colors.brown800],
  );
  const inputStyle = useMemo(
    () => createReflectionLiveMarkdownInputStyle(colors.brown800),
    [colors.brown800],
  );

  const applyToolbar = (action: ReflectionToolbarFormatAction) => {
    const caret = toolbarPressSelectionRef.current ?? selectionRef.current;
    toolbarPressSelectionRef.current = null;
    const next = applyReflectionToolbarAction(text, caret, action);
    setText(next.text);
    selectionRef.current = next.selection;
    setSelection(next.selection);
    setSelectionOverride(next.selection);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <>
      <Stack.Screen options={{ title: "Live markdown spike" }} />
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="always"
      >
        <Text style={[styles.caption, { color: colors.tan300 }]}>
          Phase 3 — toolbar against MarkdownTextInput. Place the caret (or select
          text), tap a format button, and confirm the markers land at that
          position and paint live without blurring first.
        </Text>
        <View style={styles.toolbarRow}>
          {TOOLBAR_ACTIONS.map(({ action, label }) => (
            <Pressable
              key={action}
              onPressIn={() => {
                toolbarPressSelectionRef.current = selectionRef.current;
              }}
              onPress={() => applyToolbar(action)}
              style={[styles.toolbarBtn, { backgroundColor: colors.brown800 }]}
            >
              <Text style={[styles.buttonLabel, { color: colors.parchment }]}>{label}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => inputRef.current?.focus()}
            style={[styles.toolbarBtn, { backgroundColor: colors.brown800 }]}
          >
            <Text style={[styles.buttonLabel, { color: colors.parchment }]}>Focus</Text>
          </Pressable>
        </View>
        <Text style={[styles.meta, { color: colors.tan200 }]}>
          selection {selection.start}–{selection.end} · {text.length} chars
        </Text>
        <Text style={[styles.sectionLabel, { color: colors.brown800 }]}>
          Live MarkdownTextInput
        </Text>
        <View
          style={[
            styles.inputWrap,
            {
              borderColor: colors.borderSolid,
              backgroundColor: colors.parchment,
            },
          ]}
        >
          <MarkdownTextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            parser={parseReflectionLiveMarkdown}
            markdownStyle={markdownStyle}
            multiline
            autoCorrect
            spellCheck
            selection={selectionOverride ?? undefined}
            onSelectionChange={(event) => {
              if (toolbarPressSelectionRef.current != null) return;
              const next = event.nativeEvent.selection;
              selectionRef.current = next;
              setSelection(next);
              if (selectionOverride != null) setSelectionOverride(null);
            }}
            placeholder="Type markdown…"
            placeholderTextColor={colors.tan200}
            style={[styles.input, inputStyle]}
          />
        </View>
        <Text style={[styles.sectionLabel, { color: colors.brown800 }]}>
          Formatted preview (current editor look)
        </Text>
        <View
          style={[
            styles.previewWrap,
            {
              borderColor: colors.borderSolid,
              backgroundColor: colors.parchment,
            },
          ]}
        >
          <ReflectionFormattedPreview markdown={text} imageMap={{}} />
        </View>
      </ScrollView>
    </>
  );
}

export default function LiveMarkdownSpikeScreen() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <LiveMarkdownSpikeContent />;
}

const styles = StyleSheet.create({
  page: {
    padding: 16,
    gap: 12,
    paddingBottom: 48,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
  },
  toolbarRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  toolbarBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  buttonLabel: {
    fontWeight: "600",
  },
  meta: {
    fontSize: 12,
    fontFamily: "monospace",
  },
  sectionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  inputWrap: {
    minHeight: 240,
    borderWidth: 1,
    borderRadius: 8,
  },
  input: {
    minHeight: 240,
    padding: 12,
  },
  previewWrap: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
});
