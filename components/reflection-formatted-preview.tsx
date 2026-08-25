import type { ReactNode } from "react";
import { View, Text, Linking } from "react-native";
import { Image } from "expo-image";
import { colors } from "@sinag-bible/ui";
import { computeReflectionBlocks, type ReflectionBlock } from "@/lib/journal-reflection-blocks";

type Props = {
  markdown: string;
  imageMap: Record<string, string>;
  compact?: boolean;
  emptyText?: string;
};

/**
 * Read-only formatted rendering of reflection markdown — bold/italic/headings/lists/
 * checklists/links/images, not raw syntax. Used by the live-markdown spike
 * (`/dev/live-markdown-spike`) as a side-by-side check against `MarkdownTextInput`.
 * Journal list tiles use `stripHtmlPreview` instead; the live editor no longer swaps
 * to this view. Mirrors the markdown subset `journal-local.ts` converts to HTML on
 * save: **bold**, _italic_, `# `/`## ` headings, `- ` / `1. ` / `- [ ]` lists,
 * `[text](url)` links, and `[image:id]` tokens.
 */
export function ReflectionFormattedPreview({
  markdown,
  imageMap,
  compact = false,
  emptyText = "Formatted preview appears as you type…",
}: Props) {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return (
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: compact ? 15 : 12,
          lineHeight: compact ? 24 : 16,
          color: colors.tan100,
          fontStyle: "italic",
        }}
      >
        {emptyText}
      </Text>
    );
  }

  const blocks = computeReflectionBlocks(trimmed);

  return (
    <View style={{ gap: 10 }}>
      {blocks.map((block, i) => (
        <View key={i}>{renderReflectionBlockContent(block, imageMap, compact)}</View>
      ))}
    </View>
  );
}

type PreviewListItem = {
  text: string;
  listType: "bullet" | "ordered" | "checklist";
  ordinal?: number;
  checked?: boolean;
};

function parseListItems(block: ReflectionBlock): PreviewListItem[] {
  return block.text
    .split("\n")
    .map((rawLine) => {
      const line = rawLine.trim();
      const checklist = /^-\s\[([ xX])\]\s(.*)$/.exec(line);
      if (checklist) {
        return {
          text: checklist[2] ?? "",
          listType: "checklist" as const,
          checked: (checklist[1] ?? "").toLowerCase() === "x",
        };
      }
      const ordered = /^(\d+)\.\s(.*)$/.exec(line);
      if (ordered) {
        return {
          text: ordered[2] ?? "",
          listType: "ordered" as const,
          ordinal: parseInt(ordered[1] ?? "0", 10),
        };
      }
      const bullet = /^-\s(.*)$/.exec(line);
      return { text: bullet?.[1] ?? line, listType: "bullet" as const };
    });
}

/**
 * Renders exactly one block's formatted content (no outer gap wrapper).
 */
function renderReflectionBlockContent(
  block: ReflectionBlock,
  imageMap: Record<string, string>,
  compact = false,
): ReactNode {
  const bodyFontSize = compact ? 15 : 17;
  const bodyLineHeight = compact ? 24 : 28;

  if (block.kind === "image") {
    const imageId = /^\[image:([^\]]+)\]$/.exec(block.text.trim())?.[1] ?? "";
    const uri = imageMap[imageId];
    if (!uri) return null;
    return (
      <Image
        source={{ uri }}
        placeholder="L6PZfSi_.AyE_3t7t7R**0o#DgR4"
        style={{
          width: "100%",
          height: compact ? 120 : 140,
          borderRadius: 10,
          backgroundColor: "rgba(255,255,255,0.35)",
        }}
        contentFit="contain"
      />
    );
  }

  if (block.kind === "heading1" || block.kind === "heading2") {
    const text = block.text.replace(/^#{1,2}\s+/, "");
    return (
      <Text
        style={{
          fontFamily: block.kind === "heading1" ? "Lora_400Regular" : "Lora_700Bold",
          fontSize: block.kind === "heading1" ? (compact ? 22 : 26) : compact ? 18 : 20,
          lineHeight: block.kind === "heading1" ? (compact ? 28 : 32) : compact ? 24 : 27,
          color: colors.brown800,
        }}
      >
        {formatInline(text)}
      </Text>
    );
  }

  if (block.kind === "bullet" || block.kind === "ordered" || block.kind === "checklist") {
    const items = parseListItems(block);
    return (
      <View style={{ gap: 4 }}>
        {items.map((item, j) => (
          <View key={j} style={{ flexDirection: "row" }}>
            <Text
              style={{
                fontFamily: "Lora_400Regular",
                fontSize: bodyFontSize,
                lineHeight: bodyLineHeight,
                color: colors.brown800,
                width: item.listType === "checklist" ? 22 : 20,
              }}
            >
              {item.listType === "ordered"
                ? `${item.ordinal}.`
                : item.listType === "checklist"
                  ? item.checked
                    ? "☑"
                    : "☐"
                  : "•"}
            </Text>
            <Text
              style={{
                flex: 1,
                fontFamily: "Lora_400Regular",
                fontSize: bodyFontSize,
                lineHeight: bodyLineHeight,
                color: colors.brown800,
                opacity: item.checked ? 0.6 : 1,
                textDecorationLine: item.checked ? "line-through" : "none",
              }}
            >
              {formatInline(item.text)}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <Text
      style={{
        fontFamily: "Lora_400Regular",
        fontSize: bodyFontSize,
        lineHeight: bodyLineHeight,
        color: colors.brown800,
      }}
    >
      {inlineFormatted(block.text)}
    </Text>
  );
}

function inlineFormatted(block: string): ReactNode {
  const lines = block.split("\n");
  return lines.map((line, lineIdx) => (
    <Text key={lineIdx}>
      {lineIdx > 0 ? "\n" : null}
      {formatInline(line)}
    </Text>
  ));
}

const LINK_COLOR = colors.gold;

function formatInline(line: string): ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*|_[^_]+_|\[[^\]]*\]\([^)\s]+\))/g);
  return parts.map((p, j) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      return (
        <Text key={j} style={{ fontFamily: "Lora_700Bold" }}>
          {formatInline(p.slice(2, -2))}
        </Text>
      );
    }
    if (/^_[^_]+_$/.test(p)) {
      return (
        <Text key={j} style={{ fontStyle: "italic" }}>
          {formatInline(p.slice(1, -1))}
        </Text>
      );
    }
    const linkMatch = /^\[([^\]]*)\]\(([^)\s]+)\)$/.exec(p);
    if (linkMatch) {
      const text = linkMatch[1] || linkMatch[2];
      const href = linkMatch[2] ?? "";
      return (
        <Text
          key={j}
          style={{ color: LINK_COLOR, textDecorationLine: "underline" }}
          onPress={() => {
            void Linking.openURL(href).catch(() => {});
          }}
          suppressHighlighting
        >
          {text}
        </Text>
      );
    }
    return p;
  });
}
