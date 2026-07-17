import { useEffect, useState, type RefObject } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutRectangle,
} from "react-native";
import { measureOnboardingTarget } from "@/src/components/feature-onboarding/measureOnboardingTarget";
import { M3RichTooltipCard } from "@/src/components/m3/M3RichTooltipCard";
import {
  READER_ACTION_BAR_TOOLTIP_AUTO_DISMISS_MS,
  READER_ACTION_BAR_TOOLTIP_PAD_BOTTOM_PX,
  READER_ACTION_BAR_TOOLTIP_PAD_TOP_PX,
  READER_ACTION_BAR_TOOLTIP_WIDTH_PX,
  computeActionBarTooltipPosition,
} from "@/src/features/reader/actionBarTooltipLayout";

export type ReaderActionBarTooltipOverlayProps = {
  visible: boolean;
  buttonAnchor: LayoutRectangle;
  actionBarPillRef: RefObject<View | null>;
  title: string;
  description: string;
  onDismiss: () => void;
  backgroundColor?: string;
  titleColor?: string;
  descriptionColor?: string;
};

type TooltipLayout = {
  left: number;
  top: number;
  width: number;
};

export function ReaderActionBarTooltipOverlay({
  visible,
  buttonAnchor,
  actionBarPillRef,
  title,
  description,
  onDismiss,
  backgroundColor,
  titleColor,
  descriptionColor,
}: ReaderActionBarTooltipOverlayProps) {
  const { width: screenW } = useWindowDimensions();
  const [layout, setLayout] = useState<TooltipLayout | null>(null);

  useEffect(() => {
    if (!visible) {
      setLayout(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const actionBarRect = await measureOnboardingTarget(actionBarPillRef, {
        minWidth: 40,
        minHeight: 20,
      });
      if (cancelled || !actionBarRect) return;
      setLayout(
        computeActionBarTooltipPosition(buttonAnchor, actionBarRect.y, screenW),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [actionBarPillRef, buttonAnchor, screenW, visible]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, READER_ACTION_BAR_TOOLTIP_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [description, onDismiss, title, visible]);

  const resolvedLayout =
    layout ?? computeActionBarTooltipPosition(buttonAnchor, buttonAnchor.y, screenW);

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
              top: resolvedLayout.top,
              left: resolvedLayout.left,
              width: resolvedLayout.width,
              transform: [{ translateY: "-100%" }],
            },
          ]}
        >
          <M3RichTooltipCard
            title={title}
            description={description}
            width={resolvedLayout.width}
            paddingTop={READER_ACTION_BAR_TOOLTIP_PAD_TOP_PX}
            paddingBottom={READER_ACTION_BAR_TOOLTIP_PAD_BOTTOM_PX}
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
