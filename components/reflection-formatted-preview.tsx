import type { ReactNode } from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { colors } from "@sinag-bible/ui";

type Props = {
  markdown: string;
  imageMap: Record<string, string>;
  compact?: boolean;
  emptyText?: string;
};

/**
 * Read-only “how it will look” rendering for the reflection editor.
 * React Native TextInput cannot show bold/italic visually; this preview reflects **…** and _…_.
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

  const segments = trimmed.split(/(\[image:[^\]]+\])/g);

  return (
    <View style={{ gap: 10 }}>
      {segments.map((seg, i) => {
        const imgMatch = /^\[image:([^\]]+)\]$/.exec(seg);
        if (imgMatch) {
          const uri = imageMap[imgMatch[1] ?? ""];
          if (!uri) return null;
          return (
            <Image
              key={i}
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
        if (!seg) return null;
        return (
          <Text
            key={i}
            style={{
              fontFamily: "Lora_400Regular",
              fontSize: 15,
              lineHeight: 24,
              color: colors.brown800,
            }}
          >
            {inlineFormatted(seg)}
          </Text>
        );
      })}
    </View>
  );
}

function inlineFormatted(block: string): ReactNode {
  const lines = block.split("\n");
  return lines.map((line, lineIdx) => (
    <Text key={lineIdx}>
      {lineIdx > 0 ? "\n" : null}
      {formatLine(line)}
    </Text>
  ));
}

function formatLine(line: string): ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((p, j) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      return (
        <Text key={j} style={{ fontFamily: "Lora_700Bold" }}>
          {p.slice(2, -2)}
        </Text>
      );
    }
    if (/^_[^_]+_$/.test(p)) {
      return (
        <Text key={j} style={{ fontStyle: "italic" }}>
          {p.slice(1, -1)}
        </Text>
      );
    }
    return p;
  });
}
