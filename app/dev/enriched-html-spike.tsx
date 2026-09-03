import { MarkdownTextInput } from "@expensify/react-native-live-markdown";
import { Redirect, Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  EnrichedTextInput,
  type EnrichedTextInputInstance,
  type OnChangeStateEvent,
} from "react-native-enriched-html";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { htmlToReflectionMarkdown } from "@/lib/journal-reflection-html";
import {
  ACCEPTED_LOSS_FIXTURES,
  ENRICHED_HTML_FIXTURES,
  LONG_JANK_FIXTURE,
  MENTION_DOUBLE_ROUND_TRIP,
  ROUND_TRIP_FIXTURES,
  mentionDoubleRoundTripAttrsSurvive,
} from "@/lib/journal-reflection-enriched-fixtures";
import {
  htmlHasNestedList,
  normalizeReflectionMarkdownForCompare,
  reflectionHtmlNeedsLegacyEditor,
} from "@/lib/journal-reflection-legacy-route";
import { parseReflectionLiveMarkdown } from "@/lib/journal-reflection-live-markdown-parser";
import {
  createReflectionLiveMarkdownInputStyle,
  createReflectionLiveMarkdownStyle,
} from "@/lib/journal-reflection-live-markdown-style";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";

/**
 * Phase 0a/0b spike. Route: /dev/enriched-html-spike
 *
 * Cheap text-change event: `onChangeText` (plain text). Do not attach `onChangeHtml`.
 * Seed with `setValue` then `focus()` — no 120ms timer.
 */

type EditorMode = "enriched" | "baseline";

function EnrichedHtmlSpikeContent() {
  const enrichedRef = useRef<EnrichedTextInputInstance>(null);
  const { bundle } = useMobileAppTheme();
  const colors = bundle.ui;
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<EditorMode>("enriched");
  const [baselineText, setBaselineText] = useState(LONG_JANK_FIXTURE.markdown);
  const [log, setLog] = useState("Ready. Cheap event: onChangeText.");
  const [lastPlainText, setLastPlainText] = useState("");
  const [pollEnabled, setPollEnabled] = useState(false);
  const [kavOpen, setKavOpen] = useState(false);
  const [styleState, setStyleState] = useState<OnChangeStateEvent | null>(null);
  const lastPolledHtmlRef = useRef<string | null>(null);

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

  const appendLog = useCallback((line: string) => {
    setLog((prev) => `${line}\n${prev}`.slice(0, 8000));
  }, []);

  const seedAndFocus = useCallback(
    (html: string, label: string) => {
      enrichedRef.current?.setValue(html);
      enrichedRef.current?.focus();
      appendLog(`${label}: setValue + focus()`);
    },
    [appendLog],
  );

  useEffect(() => {
    if (!pollEnabled || mode !== "enriched") return;
    const id = setInterval(() => {
      void (async () => {
        const html = await enrichedRef.current?.getHTML();
        if (html == null) return;
        if (html === lastPolledHtmlRef.current) return;
        lastPolledHtmlRef.current = html;
        appendLog(`poll getHTML changed (${html.length} chars)`);
      })();
    }, 2000);
    return () => clearInterval(id);
  }, [appendLog, mode, pollEnabled]);

  const runFixtureGate = useCallback(async () => {
    const editor = enrichedRef.current;
    if (!editor) {
      appendLog("fixture gate: no editor ref");
      return;
    }
    const lines: string[] = [];
    for (const fixture of ENRICHED_HTML_FIXTURES) {
      editor.setValue(fixture.html);
      await new Promise((resolve) => setTimeout(resolve, 80));
      const html = await editor.getHTML();
      const actual = normalizeReflectionMarkdownForCompare(
        htmlToReflectionMarkdown(html, { ...fixture.images }),
      );
      const expected = normalizeReflectionMarkdownForCompare(fixture.markdown);
      const equal = actual === expected;
      const precheck = reflectionHtmlNeedsLegacyEditor(fixture.html);
      if (fixture.kind === "round-trip") {
        lines.push(`${equal ? "PASS" : "FAIL"} ${fixture.id} round-trip${equal ? "" : ` got ${JSON.stringify(actual).slice(0, 80)}`}`);
      } else {
        const droppedNesting = !htmlHasNestedList(html);
        const dual = !equal && precheck;
        lines.push(
          `${dual ? "PASS" : "FAIL"} ${fixture.id} accepted-loss (precheck=${precheck} equal=${equal} nestedDropped=${droppedNesting})`,
        );
      }
    }
    appendLog(lines.join("\n"));
    editor.focus();
  }, [appendLog]);

  const runMentionDoubleRoundTrip = useCallback(async () => {
    const editor = enrichedRef.current;
    if (!editor) return;
    editor.setValue("<p></p>");
    editor.focus();
    editor.startMention(MENTION_DOUBLE_ROUND_TRIP.indicator);
    editor.setMention(
      MENTION_DOUBLE_ROUND_TRIP.indicator,
      MENTION_DOUBLE_ROUND_TRIP.text,
      { ...MENTION_DOUBLE_ROUND_TRIP.attributes },
    );
    await new Promise((resolve) => setTimeout(resolve, 80));
    const first = await editor.getHTML();
    editor.setValue(first);
    await new Promise((resolve) => setTimeout(resolve, 80));
    const second = await editor.getHTML();
    editor.setValue(second);
    await new Promise((resolve) => setTimeout(resolve, 80));
    const third = await editor.getHTML();
    const ok =
      mentionDoubleRoundTripAttrsSurvive(first) &&
      mentionDoubleRoundTripAttrsSurvive(second) &&
      mentionDoubleRoundTripAttrsSurvive(third);
    appendLog(
      `${ok ? "PASS" : "FAIL"} mention double round-trip\n1: ${first}\n2: ${second}\n3: ${third}`,
    );
    editor.focus();
  }, [appendLog]);

  const dumpHtml = useCallback(async () => {
    const html = await enrichedRef.current?.getHTML();
    appendLog(`getHTML: ${html ?? "(null)"}`);
  }, [appendLog]);

  return (
    <>
      <Stack.Screen options={{ title: "Enriched HTML spike" }} />
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="always"
      >
        <Text style={[styles.caption, { color: colors.tan300 }]}>
          0a: WYSIWYG (no **markers**), lists, checkbox, link, setImage, @,
          setValue/getHTML, focus() after setValue. Paste from Notes / Docs /
          a browser here — mangled structure fails 0a. IME: Tagalog Gboard
          (Korean/Spanish if present). Jank: seed long fixture, 60s typing,
          then{" "}
          {`adb shell dumpsys gfxinfo com.sinagbible.app.dev framestats`}.
          Baseline first (MarkdownTextInput), then Enriched. Poll on = re-run
          jank with the 2s getHTML loop.
        </Text>

        <View style={styles.toolbarRow}>
          {(["enriched", "baseline"] as const).map((next) => (
            <Pressable
              key={next}
              onPress={() => setMode(next)}
              style={[
                styles.toolbarBtn,
                { backgroundColor: mode === next ? colors.gold : colors.brown800 },
              ]}
            >
              <Text style={[styles.buttonLabel, { color: colors.parchment }]}>
                {next === "enriched" ? "Enriched" : "Baseline MD"}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === "enriched" ? (
          <View style={styles.toolbarRow}>
            {(
              [
                ["B", () => enrichedRef.current?.toggleBold()],
                ["I", () => enrichedRef.current?.toggleItalic()],
                ["•", () => enrichedRef.current?.toggleUnorderedList()],
                ["1.", () => enrichedRef.current?.toggleOrderedList()],
                ["☐", () => enrichedRef.current?.toggleCheckboxList(false)],
                [
                  "Link",
                  () => enrichedRef.current?.setLink(0, 0, "Sinag", "https://example.com"),
                ],
                [
                  "Img",
                  () =>
                    enrichedRef.current?.setImage("https://placehold.co/80x80.png", 80, 80),
                ],
                ["@", () => enrichedRef.current?.startMention("@")],
                ["Focus", () => enrichedRef.current?.focus()],
                ["HTML", () => void dumpHtml()],
              ] as const
            ).map(([label, onPress]) => (
              <Pressable
                key={label}
                onPress={onPress}
                style={[styles.toolbarBtn, { backgroundColor: colors.brown800 }]}
              >
                <Text style={[styles.buttonLabel, { color: colors.parchment }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.toolbarRow}>
          <Pressable
            onPress={() => seedAndFocus("<p>Hello from setValue.</p>", "hello")}
            style={[styles.toolbarBtn, { backgroundColor: colors.brown800 }]}
          >
            <Text style={[styles.buttonLabel, { color: colors.parchment }]}>Seed hello</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (mode === "baseline") setBaselineText(LONG_JANK_FIXTURE.markdown);
              else seedAndFocus(LONG_JANK_FIXTURE.html, "long");
            }}
            style={[styles.toolbarBtn, { backgroundColor: colors.brown800 }]}
          >
            <Text style={[styles.buttonLabel, { color: colors.parchment }]}>Seed long</Text>
          </Pressable>
          <Pressable
            onPress={() => void runFixtureGate()}
            style={[styles.toolbarBtn, { backgroundColor: colors.brown800 }]}
          >
            <Text style={[styles.buttonLabel, { color: colors.parchment }]}>0b fixtures</Text>
          </Pressable>
          <Pressable
            onPress={() => void runMentionDoubleRoundTrip()}
            style={[styles.toolbarBtn, { backgroundColor: colors.brown800 }]}
          >
            <Text style={[styles.buttonLabel, { color: colors.parchment }]}>0b mentions</Text>
          </Pressable>
          <Pressable
            onPress={() => setPollEnabled((value) => !value)}
            style={[styles.toolbarBtn, { backgroundColor: pollEnabled ? colors.gold : colors.brown800 }]}
          >
            <Text style={[styles.buttonLabel, { color: colors.parchment }]}>
              Poll {pollEnabled ? "on" : "off"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setKavOpen(true)}
            style={[styles.toolbarBtn, { backgroundColor: colors.brown800 }]}
          >
            <Text style={[styles.buttonLabel, { color: colors.parchment }]}>KAV modal</Text>
          </Pressable>
        </View>

        <Text style={[styles.meta, { color: colors.tan200 }]}>
          onChangeText: {lastPlainText.length} chars
          {styleState?.bold.isActive ? " · bold" : ""}
          {styleState?.unorderedList.isActive ? " · ul" : ""}
          {styleState?.checkboxList.isActive ? " · box" : ""}
          {" · "}
          {ROUND_TRIP_FIXTURES.length} round-trip / {ACCEPTED_LOSS_FIXTURES.length} accepted-loss
        </Text>

        <View
          style={[
            styles.inputWrap,
            { borderColor: colors.borderSolid, backgroundColor: colors.parchment },
          ]}
        >
          {mode === "enriched" ? (
            <EnrichedTextInput
              ref={enrichedRef}
              mentionIndicators={["@"]}
              placeholder="Type — markers should not be visible"
              placeholderTextColor={colors.tan200}
              cursorColor={colors.brown800}
              onChangeText={(event) => setLastPlainText(event.nativeEvent.value)}
              onChangeState={(event) => setStyleState(event.nativeEvent)}
              onStartMention={(indicator) => {
                if (indicator !== "@") return;
                enrichedRef.current?.setMention(
                  MENTION_DOUBLE_ROUND_TRIP.indicator,
                  MENTION_DOUBLE_ROUND_TRIP.text,
                  { ...MENTION_DOUBLE_ROUND_TRIP.attributes },
                );
              }}
              style={styles.input}
            />
          ) : (
            <MarkdownTextInput
              value={baselineText}
              onChangeText={setBaselineText}
              parser={parseReflectionLiveMarkdown}
              markdownStyle={markdownStyle}
              multiline
              placeholder="Baseline live-markdown (markers stay in the string)"
              placeholderTextColor={colors.tan200}
              style={[styles.input, inputStyle]}
            />
          )}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.brown800 }]}>Log</Text>
        <Text style={[styles.log, { color: colors.tan300 }]}>{log}</Text>
      </ScrollView>

      <Modal
        visible={kavOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setKavOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.parchment, paddingTop: insets.top }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
          >
            <View style={{ paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: "Inter_500Medium", color: colors.brown800 }}>
                KAV-in-Modal probe
              </Text>
              <Pressable onPress={() => setKavOpen(false)}>
                <Text style={{ color: colors.brown800 }}>Close</Text>
              </Pressable>
            </View>
            <Text style={{ paddingHorizontal: 16, color: colors.tan300, marginBottom: 8 }}>
              Fail if the caret sits under the keyboard. Pass if KAV keeps the
              field above it — then Phase 1 can skip keyboard-controller.
            </Text>
            <KavModalEditor placeholderColor={colors.tan200} />
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

function KavModalEditor({ placeholderColor }: { placeholderColor: string }) {
  const ref = useRef<EnrichedTextInputInstance>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <EnrichedTextInput
      ref={ref}
      placeholder="Type in the modal"
      placeholderTextColor={placeholderColor}
      style={{ flex: 1, marginHorizontal: 16, marginBottom: 16 }}
    />
  );
}

export default function EnrichedHtmlSpikeScreen() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  return <EnrichedHtmlSpikeContent />;
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
    minHeight: 280,
    borderWidth: 1,
    borderRadius: 8,
  },
  input: {
    minHeight: 280,
    padding: 12,
  },
  log: {
    fontSize: 12,
    fontFamily: "monospace",
    lineHeight: 18,
  },
});
