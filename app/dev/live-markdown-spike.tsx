import { MarkdownTextInput, parseExpensiMark } from "@expensify/react-native-live-markdown";
import { Redirect, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextInput,
  View,
} from "react-native";

/**
 * Throwaway Phase 0 spike — not wired into the journal editor.
 * Route: /dev/live-markdown-spike
 *
 * Confirms MarkdownTextInput builds, live-styles while typing, and behaves like
 * a native TextInput (cursor, selection, backspace, autocorrect).
 */
const SAMPLE = [
  "# Heading",
  "",
  "GitHub-style **bold** and _italic_.",
  "ExpensiMark-style *bold* and _italic_.",
  "",
  "- bullet one",
  "- bullet two",
  "",
  "- [ ] checklist item",
  "[image:sample-id]",
  "",
  "Link: [Sinag](https://example.com)",
].join("\n");

function LiveMarkdownSpikeContent() {
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState(SAMPLE);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [status, setStatus] = useState("mounting");

  useEffect(() => {
    console.log("[live-markdown-spike] mounted");
    setStatus("MarkdownTextInput mounted");
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: "Live markdown spike" }} />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.caption}>
          Phase 0 spike ({status}). Type below — bold/italic/heading should style live
          without blurring. Checklists and [image:id] may stay unstyled (parser finding).
        </Text>
        <Pressable
          onPress={() => inputRef.current?.focus()}
          style={styles.button}
        >
          <Text style={styles.buttonLabel}>Focus input</Text>
        </Pressable>
        <Text style={styles.meta}>
          selection {selection.start}–{selection.end} · {text.length} chars
        </Text>
        <View style={styles.inputWrap}>
          <MarkdownTextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            parser={parseExpensiMark}
            multiline
            autoCorrect
            spellCheck
            onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
            placeholder="Type markdown…"
            style={styles.input}
          />
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
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    color: "#444",
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#333",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  buttonLabel: {
    color: "#fff",
    fontWeight: "600",
  },
  meta: {
    fontSize: 12,
    color: "#666",
    fontFamily: "monospace",
  },
  inputWrap: {
    minHeight: 280,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  input: {
    minHeight: 280,
    padding: 12,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: "top",
  },
});
