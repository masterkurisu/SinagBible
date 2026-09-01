import { useEffect, useMemo, useRef } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutRectangle,
} from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { M3RichTooltipCard } from "@/src/components/m3/M3RichTooltipCard";
import { M3Button } from "@/src/components/m3/M3Button";
import { getReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import { focusVerseTagElement } from "@/src/features/verse-tags/verseTagFocus";
import {
  computeVerseTagTooltipPosition,
  VERSE_TAG_TOOLTIP_EST_HEIGHT_PX,
  VERSE_TAG_TOOLTIP_WIDTH_PX,
} from "@/src/features/verse-tags/verseTagTooltipLayout";

export type VerseTagPreviewTooltipProps = {
  visible: boolean;
  anchor: LayoutRectangle;
  title: string;
  description: string;
  canOpenInReader: boolean;
  bundle: MobileAppThemeBundle;
  onDismiss: () => void;
  onOpenInReader: () => void;
};

export function VerseTagPreviewTooltip({
  visible,
  anchor,
  title,
  description,
  canOpenInReader,
  bundle,
  onDismiss,
  onOpenInReader,
}: VerseTagPreviewTooltipProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const cardRef = useRef<View | null>(null);
  const chrome = getReaderSheetChrome(bundle);
  const rc = bundle.reader;

  const layout = useMemo(
    () =>
      computeVerseTagTooltipPosition(
        anchor,
        screenW,
        screenH,
        VERSE_TAG_TOOLTIP_WIDTH_PX,
        VERSE_TAG_TOOLTIP_EST_HEIGHT_PX,
      ),
    [anchor, screenH, screenW],
  );

  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => {
      focusVerseTagElement(cardRef);
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, title, description]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.root} pointerEvents="box-none" accessibilityViewIsModal>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss verse preview"
          onPress={onDismiss}
        />
        <View
          style={[
            styles.tooltipWrap,
            {
              top: layout.top,
              left: layout.left,
              width: layout.width,
            },
          ]}
        >
          <View
            ref={cardRef}
            accessible
            accessibilityRole="summary"
            accessibilityLabel={`${title}. ${description}`}
            accessibilityLiveRegion="polite"
          >
            <M3RichTooltipCard
              title={title}
              description={description}
              width={layout.width}
              backgroundColor={rc.popoverSurface}
              titleColor={chrome.onSurface}
              descriptionColor={chrome.onSurfaceVariant}
            />
          </View>
          <View style={styles.actionRow}>
            <M3Button
              label="Open in Reader"
              variant="filled"
              onPress={onOpenInReader}
              bundle={bundle}
              accentColor={chrome.onSurface}
              disabled={!canOpenInReader}
              fullWidth
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tooltipWrap: {
    position: "absolute",
  },
  actionRow: {
    marginTop: 8,
    width: "100%",
  },
});
