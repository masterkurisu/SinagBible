import { useMemo } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutRectangle,
} from "react-native";
import { M3RichTooltipCard } from "@/src/components/m3/M3RichTooltipCard";
import {
  computeM3RichTooltipPosition,
  M3_RICH_TOOLTIP_EST_HEIGHT_PX,
  M3_RICH_TOOLTIP_WIDTH_PX,
} from "@/src/components/m3/m3-rich-tooltip-layout";

export type M3RichTooltipOverlayProps = {
  visible: boolean;
  anchor: LayoutRectangle;
  title: string;
  description: string;
  onDismiss: () => void;
  backgroundColor?: string;
  titleColor?: string;
  descriptionColor?: string;
};

export function M3RichTooltipOverlay({
  visible,
  anchor,
  title,
  description,
  onDismiss,
  backgroundColor,
  titleColor,
  descriptionColor,
}: M3RichTooltipOverlayProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();

  const layout = useMemo(
    () =>
      computeM3RichTooltipPosition(
        anchor,
        screenW,
        screenH,
        M3_RICH_TOOLTIP_WIDTH_PX,
        M3_RICH_TOOLTIP_EST_HEIGHT_PX,
      ),
    [anchor, screenH, screenW],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.root} pointerEvents="box-none">
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss tooltip"
          onPress={onDismiss}
        />
        <View
          pointerEvents="none"
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
            backgroundColor={backgroundColor}
            titleColor={titleColor}
            descriptionColor={descriptionColor}
          />
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
});
