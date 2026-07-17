import { useCallback, useMemo, useRef, useState, type RefObject } from "react";
import {
  Text,
  type LayoutRectangle,
  type StyleProp,
  type TextStyle,
  type View,
} from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import type { VerseTagRef } from "@sinag-bible/types";
import { getBookNameFromSlug } from "@sinag-bible/core/bible-meta";
import { formatVerseTagLabel, splitTextWithVerseTags } from "@sinag-bible/core";
import { measureOnboardingTarget } from "@/src/components/feature-onboarding/measureOnboardingTarget";
import {
  getJournalVersePreview,
  resolveJournalPassageBookSlug,
} from "@/lib/journal-verse-preview";
import { VerseTagChip } from "@/src/features/verse-tags/VerseTagChip";
import { VerseTagPreviewTooltip } from "@/src/features/verse-tags/VerseTagPreviewTooltip";
import { openVerseTagInReader } from "@/src/features/verse-tags/openVerseTagInReader";

export type VerseTaggedTextProps = {
  text: string;
  textStyle: StyleProp<TextStyle>;
  textColor: string;
  chipBackgroundColor: string;
  chipBorderColor: string;
  chipTextColor: string;
  translationId: string;
  bundle: MobileAppThemeBundle;
};

type ActiveTagState = {
  ref: VerseTagRef;
  label: string;
  anchor: LayoutRectangle;
};

export function VerseTaggedText({
  text,
  textStyle,
  textColor,
  chipBackgroundColor,
  chipBorderColor,
  chipTextColor,
  translationId,
  bundle,
}: VerseTaggedTextProps) {
  const segments = useMemo(() => splitTextWithVerseTags(text), [text]);
  const chipRefs = useRef(new Map<string, React.RefObject<Text | null>>());
  const [activeTag, setActiveTag] = useState<ActiveTagState | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewPending, setPreviewPending] = useState(false);

  const getChipRef = useCallback((key: string) => {
    const existing = chipRefs.current.get(key);
    if (existing) return existing;
    const next = { current: null } as React.RefObject<Text | null>;
    chipRefs.current.set(key, next);
    return next;
  }, []);

  const loadPreview = useCallback(
    async (ref: VerseTagRef) => {
      setPreviewPending(true);
      setPreviewText(null);
      try {
        const canonicalBook = await resolveJournalPassageBookSlug(translationId, ref.book);
        if (!canonicalBook) {
          setPreviewText(null);
          return;
        }
        const preview = await getJournalVersePreview(
          translationId,
          canonicalBook,
          ref.chapter,
          ref.verseStart,
          ref.verseEnd ?? null,
        );
        setPreviewText(preview);
      } finally {
        setPreviewPending(false);
      }
    },
    [translationId],
  );

  const openTooltip = useCallback(
    async (ref: VerseTagRef, label: string, key: string) => {
      const chipRef = getChipRef(key);
      const anchor = await measureOnboardingTarget(chipRef as RefObject<View | null>, {
        waitForInteractions: false,
        retries: 2,
      });
      if (!anchor) return;
      setActiveTag({ ref, label, anchor });
      void loadPreview(ref);
    },
    [getChipRef, loadPreview],
  );

  const dismissTooltip = useCallback(() => {
    setActiveTag(null);
    setPreviewText(null);
    setPreviewPending(false);
  }, []);

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

  const chipStyle = useMemo(
    () => ({
      color: chipTextColor,
      backgroundColor: chipBackgroundColor,
      borderColor: chipBorderColor,
      borderWidth: 1,
      borderRadius: 999,
      overflow: "hidden" as const,
      paddingHorizontal: 8,
      paddingVertical: 1,
      fontFamily: "Inter_500Medium",
      fontSize: 13,
      lineHeight: 18,
    }),
    [chipBackgroundColor, chipBorderColor, chipTextColor],
  );

  return (
    <>
      <Text style={textStyle}>
        {segments.map((segment, index) => {
          if (segment.kind === "text") {
            return (
              <Text key={`text-${index}`} style={{ color: textColor }}>
                {segment.value}
              </Text>
            );
          }

          if (!segment.ref) {
            return (
              <Text key={`raw-${index}`} style={{ color: textColor }}>
                {segment.raw}
              </Text>
            );
          }

          const bookLabel = getBookNameFromSlug(segment.ref.book);
          const label = formatVerseTagLabel(segment.ref, bookLabel ?? undefined);
          const key = `${segment.raw}-${index}`;
          const chipRef = getChipRef(key);

          return (
            <VerseTagChip
              key={key}
              chipRef={chipRef}
              label={label}
              textStyle={textStyle}
              chipStyle={chipStyle}
              accessibilityLabel={`${label}, opens verse preview`}
              onPress={() => {
                void openTooltip(segment.ref!, label, key);
              }}
              onLongPress={() => handleLongPress(segment.ref!)}
            />
          );
        })}
      </Text>

      <VerseTagPreviewTooltip
        visible={activeTag != null}
        anchor={activeTag?.anchor ?? { x: 0, y: 0, width: 0, height: 0 }}
        title={activeTag?.label ?? ""}
        description={
          previewPending
            ? "Loading verse..."
            : previewText?.trim()
              ? previewText
              : "Verse not found"
        }
        canOpenInReader={Boolean(previewText?.trim()) && !previewPending}
        bundle={bundle}
        onDismiss={dismissTooltip}
        onOpenInReader={handleOpenInReader}
      />
    </>
  );
}
