import { memo, useCallback, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Linking, StyleSheet, Text, View, type LayoutRectangle, type StyleProp, type TextStyle } from "react-native";
import { Image } from "expo-image";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import type { VerseTagRef } from "@sinag-bible/types";
import { getBookNameFromSlug } from "@sinag-bible/core/bible-meta";
import { formatVerseTagLabel, parseVerseTagFromHtmlAttrs } from "@sinag-bible/core/verse-tags";
import { measureOnboardingTarget } from "@/src/components/feature-onboarding/measureOnboardingTarget";
import { getTranslationDisplayAbbreviation } from "@/lib/translation-display-label";
import {
  decodeHtmlEntities,
  type SavedReflectionBlock,
} from "@/src/features/journal/journalSavedReflectionBlocks";
import { REFLECTION_BLANK_STEP_PX } from "@/lib/journal-reflection-owned-html";
import {
  maskVerseTagHtmlSpans,
  unmaskVerseTagHtmlSpans,
} from "@/lib/journal-reflection-html";
import {
  formatVerseTagChipAccessibilityLabel,
  formatVerseTagTooltipDescription,
  formatVerseTagTooltipTitle,
  type VerseTagPreviewStatus,
} from "@/src/features/verse-tags/verseTagChipCopy";
import { focusVerseTagElement } from "@/src/features/verse-tags/verseTagFocus";
import { VerseTagChip } from "@/src/features/verse-tags/VerseTagChip";
import { VerseTagPreviewTooltip } from "@/src/features/verse-tags/VerseTagPreviewTooltip";
import { openVerseTagInReader } from "@/src/features/verse-tags/openVerseTagInReader";
import { loadVerseTagPreview } from "@/src/features/verse-tags/verseTagPreview";

const SPAN_FONT_ITALIC = String.raw`font-style\s*:\s*(?:italic|oblique)`;
const SPAN_FONT_BOLD = String.raw`font-weight\s*:\s*(?:bold|700|bolder|[6-9]00)`;

const VERSE_TAG_SPAN_RE =
  /^<span\b[^>]*\bdata-verse-ref=(["'])([^"']+)\1[^>]*>[\s\S]*<\/span>$/i;

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

function parseVerseTagSpan(html: string): { ref: VerseTagRef; label: string } | null {
  const refMatch = /\bdata-verse-ref=(["'])([^"']+)\1/i.exec(html);
  if (!refMatch) return null;
  const translation = /\bdata-translation=(["'])([^"']+)\1/i.exec(html)?.[2] ?? null;
  const ref = parseVerseTagFromHtmlAttrs(refMatch[2] ?? "", translation);
  if (!ref) return null;
  const inner = html.replace(/^<span\b[^>]*>/i, "").replace(/<\/span>$/i, "");
  const label =
    decodeHtmlEntities(inner.replace(/<[^>]*>/g, "").trim()) ||
    formatVerseTagLabel(ref, getBookNameFromSlug(ref.book) ?? undefined);
  return { ref, label };
}

type ActiveTagState = {
  key: string;
  ref: VerseTagRef;
  title: string;
  anchor: LayoutRectangle;
};

type JournalReflectionInlineOptions = {
  linkColor: string;
  bundle: MobileAppThemeBundle;
  textStyle?: StyleProp<TextStyle>;
  getChipRef: (key: string) => RefObject<View | null>;
  onVerseTagPress: (ref: VerseTagRef, label: string, key: string) => void;
  onVerseTagLongPress: (ref: VerseTagRef) => void;
};

export function renderJournalReflectionInline(
  input: string,
  options: JournalReflectionInlineOptions,
): ReactNode[] {
  const { linkColor, bundle, textStyle, getChipRef, onVerseTagPress, onVerseTagLongPress } = options;

  const nodes: ReactNode[] = [];
  const styleStack: ("strong" | "em")[] = [];
  const hrefStack: string[] = [];
  const masked = maskVerseTagHtmlSpans(input);
  const normalized = unmaskVerseTagHtmlSpans(
    normalizeStyleSpansForInline(masked.html)
      .replace(/<(\/?)b(\s[^>]*)?>/gi, "<$1strong$2>")
      .replace(/<(\/?)i(\s[^>]*)?>/gi, "<$1em$2>"),
    masked.spans,
  );
  const tokenRegex =
    /<span\b[^>]*\bdata-verse-ref=(["'])([^"']+)\1[^>]*>[\s\S]*?<\/span>|<a\s+href=(["'])([^"']*)\3[^>]*>|<\/a>|<\/?strong(?:\s[^>]*)?>|<\/?em(?:\s[^>]*)?>|<br\s*\/?>/gi;
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
            ? [textStyle, { fontFamily, color: linkColor, textDecorationLine: "underline" as const }]
            : [textStyle, { fontFamily }]
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
    if (VERSE_TAG_SPAN_RE.test(tok)) {
      VERSE_TAG_SPAN_RE.lastIndex = 0;
      const parsed = parseVerseTagSpan(tok);
      if (parsed) {
        const bookLabel = getBookNameFromSlug(parsed.ref.book);
        const label =
          parsed.label || formatVerseTagLabel(parsed.ref, bookLabel ?? undefined);
        const key = `verse-${part++}`;
        const chipRef = getChipRef(key);
        nodes.push(
          <VerseTagChip
            key={key}
            variant="inline-pressable"
            bundle={bundle}
            chipRef={chipRef}
            label={label}
            textStyle={textStyle}
            accessibilityLabel={formatVerseTagChipAccessibilityLabel(
              parsed.ref,
              bookLabel ?? undefined,
            )}
            onPress={() => onVerseTagPress(parsed.ref, label, key)}
            onLongPress={() => onVerseTagLongPress(parsed.ref)}
          />,
        );
      } else {
        pushText(tok.replace(/<[^>]*>/g, ""));
      }
    } else if (/^<a\b/i.test(tok)) {
      const href = /href=(["'])([^"']*)\1/i.exec(tok)?.[2] ?? "";
      hrefStack.push(decodeHtmlEntities(href));
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
      nodes.push(<View key={`br-${part++}`} style={journalSavedReflectionStyles.lineBreak} />);
    }
    last = idx + (match[0]?.length ?? 0);
  }

  pushText(normalized.slice(last).replace(/<\/?(?:p|div|span|font|u)\b[^>]*>/gi, ""));
  return nodes;
}

function JournalReflectionRichText({
  html,
  style,
  linkColor,
  bundle,
  translationId,
  leading,
}: {
  html: string;
  style: StyleProp<TextStyle>;
  linkColor: string;
  bundle: MobileAppThemeBundle;
  translationId: string;
  leading?: string;
}) {
  const chipRefs = useRef(new Map<string, RefObject<View | null>>());
  const [activeTag, setActiveTag] = useState<ActiveTagState | null>(null);
  const [previewStatus, setPreviewStatus] = useState<VerseTagPreviewStatus>({ kind: "not-found" });
  const versionAbbreviation = useMemo(
    () => getTranslationDisplayAbbreviation(translationId),
    [translationId],
  );

  const getChipRef = useCallback((key: string) => {
    const existing = chipRefs.current.get(key);
    if (existing) return existing;
    const next = { current: null } as RefObject<View | null>;
    chipRefs.current.set(key, next);
    return next;
  }, []);

  const loadPreview = useCallback(
    async (ref: VerseTagRef) => {
      setPreviewStatus({ kind: "loading" });
      setPreviewStatus(await loadVerseTagPreview(translationId, ref));
    },
    [translationId],
  );

  const openTooltip = useCallback(
    async (ref: VerseTagRef, label: string, key: string) => {
      const chipRef = getChipRef(key);
      const anchor = await measureOnboardingTarget(chipRef, {
        waitForInteractions: false,
        retries: 2,
      });
      if (!anchor) return;
      setActiveTag({
        key,
        ref,
        title: formatVerseTagTooltipTitle(label, versionAbbreviation),
        anchor,
      });
      void loadPreview(ref);
    },
    [getChipRef, loadPreview, versionAbbreviation],
  );

  const dismissTooltip = useCallback(() => {
    const chipRef = activeTag ? chipRefs.current.get(activeTag.key) : undefined;
    setActiveTag(null);
    setPreviewStatus({ kind: "not-found" });
    requestAnimationFrame(() => {
      focusVerseTagElement(chipRef);
    });
  }, [activeTag]);

  const handleOpenInReader = useCallback(() => {
    if (!activeTag) return;
    openVerseTagInReader(activeTag.ref, translationId);
    dismissTooltip();
  }, [activeTag, dismissTooltip, translationId]);

  const handleLongPress = useCallback(
    (ref: VerseTagRef) => {
      openVerseTagInReader(ref, translationId);
    },
    [translationId],
  );

  const nodes = renderJournalReflectionInline(html, {
    linkColor,
    bundle,
    textStyle: style,
    getChipRef,
    onVerseTagPress: (ref, label, key) => {
      void openTooltip(ref, label, key);
    },
    onVerseTagLongPress: handleLongPress,
  });

  return (
    <>
      <View style={[journalSavedReflectionStyles.inlineFlow, style]}>
        {leading ? <Text style={style}>{leading}</Text> : null}
        {nodes}
      </View>
      <VerseTagPreviewTooltip
        visible={activeTag != null}
        anchor={activeTag?.anchor ?? { x: 0, y: 0, width: 0, height: 0 }}
        title={activeTag?.title ?? ""}
        description={formatVerseTagTooltipDescription(previewStatus)}
        canOpenInReader={previewStatus.kind === "ready"}
        bundle={bundle}
        onDismiss={dismissTooltip}
        onOpenInReader={handleOpenInReader}
      />
    </>
  );
}

export const journalSavedReflectionStyles = StyleSheet.create({
  inlineFlow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
  },
  lineBreak: {
    width: "100%",
    height: 0,
  },
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
  imageCompact: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.35)",
    marginBottom: 8,
  },
  paragraphCompact: {
    fontFamily: "Lora_400Regular",
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 8,
  },
  listItemCompact: {
    fontFamily: "Lora_400Regular",
    fontSize: 15,
    lineHeight: 24,
  },
  heading1Compact: {
    fontFamily: "Lora_400Regular",
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 6,
  },
  heading2Compact: {
    fontFamily: "Lora_700Bold",
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 4,
  },
});

type JournalSavedReflectionBlockProps = {
  block: SavedReflectionBlock;
  bodyColor: string;
  linkColor: string;
  bundle: MobileAppThemeBundle;
  translationId: string;
  compact?: boolean;
};

function reflectionBlankMarginTop(leadingBlankCount: number | undefined): number {
  return (leadingBlankCount ?? 0) * REFLECTION_BLANK_STEP_PX;
}

export const JournalSavedReflectionBlock = memo(function JournalSavedReflectionBlock({
  block,
  bodyColor,
  linkColor,
  bundle,
  translationId,
  compact = false,
}: JournalSavedReflectionBlockProps) {
  const blankMarginTop = reflectionBlankMarginTop(block.leadingBlankCount);
  const paragraphStyle = compact ? journalSavedReflectionStyles.paragraphCompact : journalSavedReflectionStyles.paragraph;
  const heading1Style = compact ? journalSavedReflectionStyles.heading1Compact : journalSavedReflectionStyles.heading1;
  const heading2Style = compact ? journalSavedReflectionStyles.heading2Compact : journalSavedReflectionStyles.heading2;
  const listItemStyle = compact ? journalSavedReflectionStyles.listItemCompact : journalSavedReflectionStyles.listItem;
  const imageStyle = compact ? journalSavedReflectionStyles.imageCompact : journalSavedReflectionStyles.image;

  if (block.kind === "image") {
    return (
      <Image
        source={{ uri: block.uri }}
        placeholder="L6PZfSi_.AyE_3t7t7R**0o#DgR4"
        style={[imageStyle, { marginTop: blankMarginTop }]}
        contentFit="contain"
      />
    );
  }

  if (block.kind === "heading1") {
    return (
      <JournalReflectionRichText
        html={block.html}
        style={[
          heading1Style,
          {
            marginTop: (block.isFirst ? 0 : 10) + blankMarginTop,
            color: bodyColor,
          },
        ]}
        linkColor={linkColor}
        bundle={bundle}
        translationId={translationId}
      />
    );
  }

  if (block.kind === "heading2") {
    return (
      <JournalReflectionRichText
        html={block.html}
        style={[
          heading2Style,
          {
            marginTop: (block.isFirst ? 0 : 8) + blankMarginTop,
            color: bodyColor,
          },
        ]}
        linkColor={linkColor}
        bundle={bundle}
        translationId={translationId}
      />
    );
  }

  if (block.kind === "list-item") {
    return (
      <JournalReflectionRichText
        html={block.html}
        leading={block.marker}
        style={[
          listItemStyle,
          {
            marginTop: blankMarginTop,
            marginBottom: block.isLastInList ? 0 : 4,
            color: bodyColor,
            opacity: block.checked ? 0.6 : 1,
            textDecorationLine: block.checked ? "line-through" : "none",
          },
        ]}
        linkColor={linkColor}
        bundle={bundle}
        translationId={translationId}
      />
    );
  }

  return (
    <JournalReflectionRichText
      html={block.html}
      style={[paragraphStyle, { marginTop: blankMarginTop, color: bodyColor }]}
      linkColor={linkColor}
      bundle={bundle}
      translationId={translationId}
    />
  );
});
