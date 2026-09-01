import { useCallback, useMemo, useRef, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  type LayoutRectangle,
  type StyleProp,
  type TextStyle,
} from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import type { VerseTagRef } from "@sinag-bible/types";
import { getBookNameFromSlug } from "@sinag-bible/core/bible-meta";
import { formatVerseTagLabel, splitTextWithVerseTags } from "@sinag-bible/core";
import { measureOnboardingTarget } from "@/src/components/feature-onboarding/measureOnboardingTarget";
import { getTranslationDisplayAbbreviation } from "@/lib/translation-display-label";
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

export type VerseTaggedTextProps = {
  text: string;
  textStyle: StyleProp<TextStyle>;
  textColor: string;
  translationId: string;
  bundle: MobileAppThemeBundle;
};

type ActiveTagState = {
  key: string;
  ref: VerseTagRef;
  title: string;
  anchor: LayoutRectangle;
};

export function VerseTaggedText({
  text,
  textStyle,
  textColor,
  translationId,
  bundle,
}: VerseTaggedTextProps) {
  const segments = useMemo(() => splitTextWithVerseTags(text), [text]);
  const chipRefs = useRef(new Map<string, React.RefObject<View | null>>());
  const [activeTag, setActiveTag] = useState<ActiveTagState | null>(null);
  const [previewStatus, setPreviewStatus] = useState<VerseTagPreviewStatus>({ kind: "not-found" });
  const versionAbbreviation = useMemo(
    () => getTranslationDisplayAbbreviation(translationId),
    [translationId],
  );

  const getChipRef = useCallback((key: string) => {
    const existing = chipRefs.current.get(key);
    if (existing) return existing;
    const next = { current: null } as React.RefObject<View | null>;
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

  return (
    <>
      <View style={styles.inlineFlow}>
        {segments.map((segment, index) => {
          if (segment.kind === "text") {
            return (
              <Text key={`text-${index}`} style={[textStyle, { color: textColor }]}>
                {segment.value}
              </Text>
            );
          }

          if (!segment.ref) {
            return (
              <Text key={`raw-${index}`} style={[textStyle, { color: textColor }]}>
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
              variant="inline-pressable"
              bundle={bundle}
              chipRef={chipRef}
              label={label}
              textStyle={textStyle}
              accessibilityLabel={formatVerseTagChipAccessibilityLabel(
                segment.ref,
                bookLabel ?? undefined,
              )}
              onPress={() => {
                void openTooltip(segment.ref!, label, key);
              }}
              onLongPress={() => handleLongPress(segment.ref!)}
            />
          );
        })}
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

const styles = StyleSheet.create({
  inlineFlow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
  },
});
