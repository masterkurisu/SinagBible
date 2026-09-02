import { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type LayoutRectangle,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { M3RichTooltipCard } from "@/src/components/m3/M3RichTooltipCard";
import { getReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import { hapticLightImpact } from "@/lib/haptics";
import { getVerseTagTooltipColors } from "@/src/features/verse-tags/verseTagTooltipChrome";
import { focusVerseTagElement } from "@/src/features/verse-tags/verseTagFocus";
import {
  computeVerseTagTooltipPosition,
  estimateVerseTagTooltipHeight,
  VERSE_TAG_TOOLTIP_EST_HEIGHT_PX,
} from "@/src/features/verse-tags/verseTagTooltipLayout";
import {
  computeVerseTagTooltipWidth,
  VERSE_TAG_TOOLTIP_ACTION_INSET_PX,
  VERSE_TAG_TOOLTIP_ACTION_SIZE_PX,
  VERSE_TAG_TOOLTIP_MAX_BODY_HEIGHT_PX,
} from "@/src/features/verse-tags/verseTagPreviewLimits";

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

function onPrimaryIconColor(background: string): string {
  const hex = background.replace("#", "");
  if (hex.length !== 6) return "#FFFFFF";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#1C1B1F" : "#FFFFFF";
}

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
  const insets = useSafeAreaInsets();
  const cardRef = useRef<View | null>(null);
  const chrome = getReaderSheetChrome(bundle);
  const tooltipColors = useMemo(() => getVerseTagTooltipColors(bundle), [bundle]);
  const [measuredHeight, setMeasuredHeight] = useState(VERSE_TAG_TOOLTIP_EST_HEIGHT_PX);

  const tooltipWidth = useMemo(
    () => computeVerseTagTooltipWidth(description.length, screenW),
    [description.length, screenW],
  );
  const estimatedHeight = Math.max(measuredHeight, estimateVerseTagTooltipHeight(description));
  const actionReserve = VERSE_TAG_TOOLTIP_ACTION_SIZE_PX + VERSE_TAG_TOOLTIP_ACTION_INSET_PX;

  const layout = useMemo(
    () =>
      computeVerseTagTooltipPosition(
        anchor,
        screenW,
        screenH,
        tooltipWidth,
        estimatedHeight,
        {
          top: insets.top,
          bottom: insets.bottom,
          left: insets.left,
          right: insets.right,
        },
      ),
    [anchor, estimatedHeight, insets.bottom, insets.left, insets.right, insets.top, screenH, screenW, tooltipWidth],
  );

  const bodyMaxHeight = Math.max(
    40,
    Math.min(VERSE_TAG_TOOLTIP_MAX_BODY_HEIGHT_PX, layout.maxHeight - 48 - actionReserve),
  );

  useEffect(() => {
    if (!visible) {
      setMeasuredHeight(VERSE_TAG_TOOLTIP_EST_HEIGHT_PX);
      return;
    }
    const frame = requestAnimationFrame(() => {
      focusVerseTagElement(cardRef);
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, title, description]);

  const handleCardLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setMeasuredHeight((prev) => (Math.abs(prev - nextHeight) < 2 ? prev : nextHeight));
  };

  const actionBackground = chrome.onSurface;
  const actionIconColor = onPrimaryIconColor(actionBackground);

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
          onLayout={handleCardLayout}
          style={[
            styles.tooltipWrap,
            {
              top: layout.top,
              left: layout.left,
              width: layout.width,
              maxHeight: layout.maxHeight,
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
              maxHeight={layout.maxHeight}
              descriptionMaxHeight={bodyMaxHeight}
              paddingBottom={16 + 8}
              paddingRight={16 + actionReserve}
              backgroundColor={tooltipColors.backgroundColor}
              titleColor={tooltipColors.titleColor}
              descriptionColor={tooltipColors.descriptionColor}
              borderColor={tooltipColors.borderColor}
            >
              <Pressable
                onPress={() => {
                  if (!canOpenInReader) return;
                  hapticLightImpact();
                  onOpenInReader();
                }}
                disabled={!canOpenInReader}
                accessibilityRole="button"
                accessibilityLabel="Open in Reader"
                accessibilityState={{ disabled: !canOpenInReader }}
                android_ripple={
                  Platform.OS === "android"
                    ? { color: "rgba(255,255,255,0.18)", borderless: true, radius: VERSE_TAG_TOOLTIP_ACTION_SIZE_PX / 2 }
                    : undefined
                }
                style={({ pressed }) => [
                  styles.actionButton,
                  {
                    backgroundColor: actionBackground,
                    opacity: !canOpenInReader ? 0.38 : pressed ? 0.88 : 1,
                  },
                ]}
              >
                <MaterialIcons name="menu-book" size={20} color={actionIconColor} />
              </Pressable>
            </M3RichTooltipCard>
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
  actionButton: {
    position: "absolute",
    right: VERSE_TAG_TOOLTIP_ACTION_INSET_PX,
    bottom: VERSE_TAG_TOOLTIP_ACTION_INSET_PX,
    width: VERSE_TAG_TOOLTIP_ACTION_SIZE_PX,
    height: VERSE_TAG_TOOLTIP_ACTION_SIZE_PX,
    borderRadius: VERSE_TAG_TOOLTIP_ACTION_SIZE_PX / 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
