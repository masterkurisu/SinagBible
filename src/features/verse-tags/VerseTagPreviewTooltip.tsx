import { useMemo } from "react";
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
import {
  computeM3RichTooltipPosition,
  M3_RICH_TOOLTIP_EST_HEIGHT_PX,
  M3_RICH_TOOLTIP_WIDTH_PX,
} from "@/src/components/m3/m3-rich-tooltip-layout";
import {
  READER_M3_ON_SURFACE_VARIANT,
} from "@/src/features/reader/readerSettingsPanelChrome";

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
  const rc = bundle.reader;

  const layout = useMemo(
    () =>
      computeM3RichTooltipPosition(
        anchor,
        screenW,
        screenH,
        M3_RICH_TOOLTIP_WIDTH_PX,
        M3_RICH_TOOLTIP_EST_HEIGHT_PX + 56,
      ),
    [anchor, screenH, screenW],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.root} pointerEvents="box-none">
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
          <M3RichTooltipCard
            title={title}
            description={description}
            width={layout.width}
            backgroundColor={rc.popoverSurface}
            titleColor={bundle.ui.brown800}
            descriptionColor={READER_M3_ON_SURFACE_VARIANT}
          />
          <View style={styles.actionRow}>
            <M3Button
              label="Open in Reader"
              variant="filled"
              onPress={onOpenInReader}
              bundle={bundle}
              accentColor={bundle.ui.brown800}
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
