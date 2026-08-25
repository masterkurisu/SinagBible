import type { MarkdownStyle } from "@expensify/react-native-live-markdown";
import type { TextStyle } from "react-native";

/**
 * Live-markdown presentation for the journal reflection editor.
 *
 * Maps the formatted-preview look (`components/reflection-formatted-preview.tsx`)
 * onto `@expensify/react-native-live-markdown`'s limited `markdownStyle` API.
 *
 * Library constraints (confirmed Phase 1):
 * - `markdownStyle` can set syntax color, link color, and h1 fontSize only.
 *   Bold/italic are native weight/italic on the TextInput's `fontFamily`.
 *   Links are always underlined by the native formatter.
 * - There is no h2, list, checklist, or custom-token style slot. Those must be
 *   approximated by a custom parser mapping onto `h1` / `bold` / `syntax`.
 * - Native h1 always applies bold weight (iOS `RCTFont` weight "bold"; Android
 *   `MarkdownBoldSpan`). App heading1 is `Lora_400Regular` at 26 — the live
 *   input will look slightly heavier for `# ` headings.
 */

/** Body size/leading — matches the reflection field in the journal form. */
export const REFLECTION_LIVE_BODY_FONT_SIZE = 17;
export const REFLECTION_LIVE_BODY_LINE_HEIGHT = 28;

/** Non-compact heading1 in the formatted preview. */
export const REFLECTION_LIVE_H1_FONT_SIZE = 26;

export const REFLECTION_LIVE_BODY_FONT_FAMILY = "Lora_400Regular";

export type ReflectionLiveMarkdownColors = {
  gold: string;
  tan100: string;
  brown800: string;
};

export function createReflectionLiveMarkdownStyle(
  colors: ReflectionLiveMarkdownColors,
): MarkdownStyle {
  return {
    syntax: {
      color: colors.tan100,
    },
    link: {
      color: colors.gold,
    },
    h1: {
      fontSize: REFLECTION_LIVE_H1_FONT_SIZE,
    },
  };
}

export function createReflectionLiveMarkdownInputStyle(textColor: string): TextStyle {
  return {
    fontFamily: REFLECTION_LIVE_BODY_FONT_FAMILY,
    fontSize: REFLECTION_LIVE_BODY_FONT_SIZE,
    lineHeight: REFLECTION_LIVE_BODY_LINE_HEIGHT,
    color: textColor,
    textAlignVertical: "top",
  };
}
