import { useEffect, type ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Reanimated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { DismissibleModal } from "@/src/components/m3/DismissibleModal";
import { M3SettingsSheetTitle } from "@/src/components/m3/M3SettingsSheetTitle";
import {
  M3_SCRIM_OPACITY,
  animateM3EffectsOpacity,
  animateM3SpatialProgress,
} from "@/src/components/m3/m3-motion";
import {
  READER_M3_BOTTOM_SHEET_HANDLE_HEIGHT_PX,
  READER_M3_BOTTOM_SHEET_HANDLE_WIDTH_PX,
  READER_M3_BOTTOM_SHEET_RADIUS_PX,
  READER_M3_OUTLINE_VARIANT,
  READER_OVERLAY_CONTENT_SCALE,
  readerM3SheetMaxHeightRatio,
  readerM3SheetMaxWidthPx,
  type ReaderM3SheetWidthVariant,
} from "@/src/features/reader/readerSettingsPanelChrome";
import { READER_MENU_SLIDE_FROM_PX } from "@/src/features/reader/useReaderGestures";

export type ReaderM3BottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  bundle: MobileAppThemeBundle;
  insets: { top: number; bottom: number; left: number; right: number };
  isTabletReaderLayout?: boolean;
  title: string;
  subtitle?: string;
  accessibilityDismissLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * Tablet card width: compact for settings controls, reading for long-form copy.
   * Phones always use a full-width bottom sheet.
   */
  widthVariant?: ReaderM3SheetWidthVariant;
  /** When false, children render directly without an inner ScrollView. */
  scrollable?: boolean;
  maxHeightRatio?: number;
  contentPaddingBottom?: number;
  dismissible?: boolean;
  onBackdropPress?: () => void;
};

export function ReaderM3BottomSheet({
  isOpen,
  onClose,
  bundle,
  insets,
  isTabletReaderLayout = false,
  title,
  subtitle,
  accessibilityDismissLabel = "Dismiss sheet",
  children,
  footer,
  widthVariant = "compact",
  scrollable = true,
  maxHeightRatio = 0.82,
  contentPaddingBottom,
  dismissible = true,
  onBackdropPress,
}: ReaderM3BottomSheetProps) {
  const rc = bundle.reader;
  const { width: screenW, height: screenH } = useWindowDimensions();
  const slideProgress = useSharedValue(0);
  const scrimOpacity = useSharedValue(0);
  const sheetOpacity = useSharedValue(0);

  const scale = READER_OVERLAY_CONTENT_SCALE;
  const useBottomSheet = !isTabletReaderLayout;
  const sheetMaxW = readerM3SheetMaxWidthPx(screenW, isTabletReaderLayout, widthVariant);
  const sheetMaxH =
    screenH * readerM3SheetMaxHeightRatio(isTabletReaderLayout, maxHeightRatio, widthVariant);
  const padH = 24 * scale;
  const bottomPad =
    contentPaddingBottom ?? (useBottomSheet ? Math.max(insets.bottom, 16) * scale : 16 * scale);
  const handleBlockHeight = useBottomSheet ? 12 + 4 + READER_M3_BOTTOM_SHEET_HANDLE_HEIGHT_PX : 0;
  const scrollAreaMaxHeight = Math.max(120, sheetMaxH - handleBlockHeight);
  const slideFrom = useBottomSheet ? 48 : READER_MENU_SLIDE_FROM_PX;

  useEffect(() => {
    cancelAnimation(slideProgress);
    cancelAnimation(scrimOpacity);
    cancelAnimation(sheetOpacity);

    if (!isOpen) {
      slideProgress.value = 0;
      scrimOpacity.value = 0;
      sheetOpacity.value = 0;
      return;
    }

    slideProgress.value = 0;
    scrimOpacity.value = 0;
    sheetOpacity.value = 0;

    animateM3SpatialProgress(slideProgress, 1, true);
    animateM3EffectsOpacity(scrimOpacity, M3_SCRIM_OPACITY, true);
    animateM3EffectsOpacity(sheetOpacity, 1, true);
  }, [isOpen, scrimOpacity, sheetOpacity, slideProgress]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.value,
    transform: [{ translateY: slideFrom * (1 - slideProgress.value) }],
  }));

  const body = (
    <>
      <M3SettingsSheetTitle
        title={title}
        subtitle={subtitle}
        scale={scale}
        style={{ marginBottom: (subtitle ? 16 : 12) * scale }}
      />
      {children}
      {footer}
    </>
  );

  return (
    <DismissibleModal
      visible={isOpen}
      onClose={onClose}
      dismissible={dismissible}
      onBackdropPress={onBackdropPress}
      scrimColor="#000000"
      scrimOpacity={scrimOpacity}
      accessibilityDismissLabel={accessibilityDismissLabel}
    >
      <View
        pointerEvents="box-none"
        style={[
          styles.sheetAnchor,
          {
            justifyContent: useBottomSheet ? "flex-end" : "center",
            paddingTop: useBottomSheet ? 0 : Math.max(insets.top, 16),
            paddingBottom: useBottomSheet ? 0 : Math.max(insets.bottom, 16),
            paddingHorizontal: useBottomSheet ? 0 : 24,
          },
        ]}
      >
        <Reanimated.View
          pointerEvents="box-none"
          style={[
            sheetAnimatedStyle,
            { width: sheetMaxW, maxHeight: sheetMaxH, flexShrink: 1 },
          ]}
        >
          <View
            style={[
              styles.sheetCard,
              {
                backgroundColor: rc.popoverSurface,
                borderTopLeftRadius: useBottomSheet ? READER_M3_BOTTOM_SHEET_RADIUS_PX : 28,
                borderTopRightRadius: useBottomSheet ? READER_M3_BOTTOM_SHEET_RADIUS_PX : 28,
                borderBottomLeftRadius: useBottomSheet ? 0 : 28,
                borderBottomRightRadius: useBottomSheet ? 0 : 28,
                shadowColor: rc.popoverShadow,
                maxHeight: sheetMaxH,
              },
            ]}
          >
            {useBottomSheet ? (
              <View style={styles.handleRow}>
                <View
                  style={{
                    width: READER_M3_BOTTOM_SHEET_HANDLE_WIDTH_PX,
                    height: READER_M3_BOTTOM_SHEET_HANDLE_HEIGHT_PX,
                    borderRadius: 2,
                    backgroundColor: READER_M3_OUTLINE_VARIANT,
                  }}
                />
              </View>
            ) : null}

            {scrollable ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                nestedScrollEnabled
                style={{ maxHeight: scrollAreaMaxHeight, flexShrink: 1 }}
                contentContainerStyle={{
                  paddingHorizontal: padH,
                  paddingTop: useBottomSheet ? 4 * scale : 20 * scale,
                  paddingBottom: bottomPad,
                }}
              >
                {body}
              </ScrollView>
            ) : (
              <View
                style={{
                  paddingHorizontal: padH,
                  paddingTop: useBottomSheet ? 4 * scale : 20 * scale,
                  paddingBottom: bottomPad,
                }}
              >
                {body}
              </View>
            )}
          </View>
        </Reanimated.View>
      </View>
    </DismissibleModal>
  );
}

const styles = StyleSheet.create({
  sheetAnchor: {
    flex: 1,
    alignItems: "center",
  },
  sheetCard: {
    overflow: "hidden",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  handleRow: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
  },
});
