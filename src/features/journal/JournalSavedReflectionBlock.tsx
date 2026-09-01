import { memo, type ReactNode } from "react";
import { Linking, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import {
  decodeHtmlEntities,
  type SavedReflectionBlock,
} from "@/src/features/journal/journalSavedReflectionBlocks";

const SPAN_FONT_ITALIC = String.raw`font-style\s*:\s*(?:italic|oblique)`;
const SPAN_FONT_BOLD = String.raw`font-weight\s*:\s*(?:bold|700|bolder|[6-9]00)`;

function normalizeStyleSpansForInline(html: string): string {
  let s = html;
  for (let n = 0; n < 20; n++) {
    const prev = s;
    s = s
      .replace(
        new RegExp(
          `<span\\b[^>]*\\b${SPAN_FONT_ITALIC}[^>]*\\b${SPAN_FONT_BOLD}[^>]*>([\\s\\S]*?)<\\/span>`,
          "gi",
        ),
        "<strong><em>$1</em></strong>",
      )
      .replace(
        new RegExp(
          `<span\\b[^>]*\\b${SPAN_FONT_BOLD}[^>]*\\b${SPAN_FONT_ITALIC}[^>]*>([\\s\\S]*?)<\\/span>`,
          "gi",
        ),
        "<strong><em>$1</em></strong>",
      )
      .replace(
        new RegExp(`<span\\b[^>]*\\b${SPAN_FONT_BOLD}[^>]*>([\\s\\S]*?)<\\/span>`, "gi"),
        "<strong>$1</strong>",
      )
      .replace(
        new RegExp(`<span\\b[^>]*\\b${SPAN_FONT_ITALIC}[^>]*>([\\s\\S]*?)<\\/span>`, "gi"),
        "<em>$1</em>",
      );
    if (s === prev) break;
  }
  return s;
}

export function renderJournalReflectionInline(input: string, linkColor: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const styleStack: ("strong" | "em")[] = [];
  const hrefStack: string[] = [];
  const normalized = normalizeStyleSpansForInline(input)
    .replace(/<(\/?)b(\s[^>]*)?>/gi, "<$1strong$2>")
    .replace(/<(\/?)i(\s[^>]*)?>/gi, "<$1em$2>");
  const tokenRegex =
    /<a\s+href=(["'])([^"']*)\1[^>]*>|<\/a>|<\/?strong(?:\s[^>]*)?>|<\/?em(?:\s[^>]*)?>|<br\s*\/?>/gi;
  let last = 0;
  let part = 0;

  const pushText = (text: string) => {
    if (!text) return;
    const hasStrong = styleStack.includes("strong");
    const hasEm = styleStack.includes("em");
    let fontFamily = "Lora_400Regular";
    if (hasStrong && hasEm) fontFamily = "Lora_700Bold_Italic";
    else if (hasStrong) fontFamily = "Lora_700Bold";
    else if (hasEm) fontFamily = "Lora_400Regular_Italic";
    const href = hrefStack[hrefStack.length - 1];
    nodes.push(
      <Text
        key={`t-${part++}`}
        style={
          href
            ? { fontFamily, color: linkColor, textDecorationLine: "underline" as const }
            : { fontFamily }
        }
        {...(href
          ? {
              suppressHighlighting: true,
              onPress: () => {
                void Linking.openURL(href).catch(() => {});
              },
            }
          : null)}
      >
        {decodeHtmlEntities(text)}
      </Text>,
    );
  };

  for (const match of normalized.matchAll(tokenRegex)) {
    const idx = match.index ?? 0;
    const raw = normalized
      .slice(last, idx)
      .replace(/<\/?(?:p|div|span|font|u)\b[^>]*>/gi, "");
    pushText(raw);
    const tok = match[0] ?? "";
    if (/^<a\b/i.test(tok)) {
      hrefStack.push(decodeHtmlEntities(match[2] ?? ""));
    } else if (/^<\/a>/i.test(tok)) {
      hrefStack.pop();
    } else if (/^<strong\b/i.test(tok)) styleStack.push("strong");
    else if (/^<\/strong\b/i.test(tok)) {
      const i = styleStack.lastIndexOf("strong");
      if (i >= 0) styleStack.splice(i, 1);
    } else if (/^<em\b/i.test(tok)) styleStack.push("em");
    else if (/^<\/em\b/i.test(tok)) {
      const i = styleStack.lastIndexOf("em");
      if (i >= 0) styleStack.splice(i, 1);
    } else {
      nodes.push(
        <Text key={`br-${part++}`}>
          {"\n"}
        </Text>,
      );
    }
    last = idx + (match[0]?.length ?? 0);
  }

  pushText(normalized.slice(last).replace(/<\/?(?:p|div|span|font|u)\b[^>]*>/gi, ""));
  return nodes;
}

export const journalSavedReflectionStyles = StyleSheet.create({
  paragraph: {
    fontFamily: "Lora_400Regular",
    fontSize: 17,
    lineHeight: 32,
    marginBottom: 8,
  },
  listItem: {
    fontFamily: "Lora_400Regular",
    fontSize: 17,
    lineHeight: 32,
  },
  heading1: {
    fontFamily: "Lora_400Regular",
    fontSize: 26,
    lineHeight: 32,
    marginBottom: 6,
  },
  heading2: {
    fontFamily: "Lora_700Bold",
    fontSize: 20,
    lineHeight: 27,
    marginBottom: 4,
  },
  image: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.35)",
    marginBottom: 12,
  },
});

type JournalSavedReflectionBlockProps = {
  block: SavedReflectionBlock;
  bodyColor: string;
  linkColor: string;
};

export const JournalSavedReflectionBlock = memo(function JournalSavedReflectionBlock({
  block,
  bodyColor,
  linkColor,
}: JournalSavedReflectionBlockProps) {
  if (block.kind === "image") {
    return (
      <Image
        source={{ uri: block.uri }}
        placeholder="L6PZfSi_.AyE_3t7t7R**0o#DgR4"
        style={journalSavedReflectionStyles.image}
        contentFit="contain"
      />
    );
  }

  if (block.kind === "heading1") {
    return (
      <Text
        style={[
          journalSavedReflectionStyles.heading1,
          { marginTop: block.isFirst ? 0 : 10, color: bodyColor },
        ]}
      >
        {renderJournalReflectionInline(block.html, linkColor)}
      </Text>
    );
  }

  if (block.kind === "heading2") {
    return (
      <Text
        style={[
          journalSavedReflectionStyles.heading2,
          { marginTop: block.isFirst ? 0 : 8, color: bodyColor },
        ]}
      >
        {renderJournalReflectionInline(block.html, linkColor)}
      </Text>
    );
  }

  if (block.kind === "list-item") {
    return (
      <Text
        style={[
          journalSavedReflectionStyles.listItem,
          {
            marginBottom: block.isLastInList ? 0 : 4,
            color: bodyColor,
            opacity: block.checked ? 0.6 : 1,
            textDecorationLine: block.checked ? "line-through" : "none",
          },
        ]}
      >
        {block.marker}
        {renderJournalReflectionInline(block.html, linkColor)}
      </Text>
    );
  }

  return (
    <Text style={[journalSavedReflectionStyles.paragraph, { color: bodyColor }]}>
      {renderJournalReflectionInline(block.html, linkColor)}
    </Text>
  );
});
