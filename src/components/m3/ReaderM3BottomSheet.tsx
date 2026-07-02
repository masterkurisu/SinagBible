import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { M3SettingsSheetTitle } from "@/src/components/m3/M3SettingsSheetTitle";
import {
  M3_EMPHASIZED_DECELERATE_EASING,
  M3_MOTION_DURATION_SHORT4_MS,
} from "@/src/components/m3/m3-motion";
import {
  READER_M3_BOTTOM_SHEET_HANDLE_HEIGHT_PX,
  READER_M3_BOTTOM_SHEET_HANDLE_WIDTH_PX,
  READER_M3_BOTTOM_SHEET_RADIUS_PX,
  READER_M3_OUTLINE_VARIANT,
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
  /** When false, children render directly without an inner ScrollView. */
  scrollable?: boolean;
  maxHeightRatio?: number;
  contentPaddingBottom?: number;
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
  scrollable = true,
  maxHeightRatio = 0.82,
  contentPaddingBottom,
}: ReaderM3BottomSheetProps) {
  const rc = bundle.reader;
  const { width: screenW } = useWindowDimensions();
  const sheetSlideAnim = useRef(new Animated.Value(0)).current;
  const sheetOpacityAnim = useRef(new Animated.Value(0)).current;

  const scale = isTabletReaderLayout ? 1.35 : 1;
  const useBottomSheet = !isTabletReaderLayout;
  const sheetMaxW = useBottomSheet ? screenW : Math.min(420, screenW - 48);
  const sheetMaxH = Dimensions.get("window").height * (isTabletReaderLayout ? 0.72 : maxHeightRatio);
  const padH = 24 * scale;
  const bottomPad =
    contentPaddingBottom ?? (useBottomSheet ? Math.max(insets.bottom, 16) * scale : 16 * scale);

  useEffect(() => {
    if (!isOpen) {
      sheetSlideAnim.setValue(0);
      sheetOpacityAnim.setValue(0);
      return;
    }
    sheetSlideAnim.setValue(0);
    sheetOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(sheetSlideAnim, {
        toValue: 1,
        duration: M3_MOTION_DURATION_SHORT4_MS + 80,
        easing: M3_EMPHASIZED_DECELERATE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(sheetOpacityAnim, {
        toValue: 1,
        duration: M3_MOTION_DURATION_SHORT4_MS,
        easing: M3_EMPHASIZED_DECELERATE_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen, sheetOpacityAnim, sheetSlideAnim]);

  const slideFrom = useBottomSheet ? 48 : READER_MENU_SLIDE_FROM_PX;

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
    <Modal visible={isOpen} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: rc.menuScrim }]}
          onPress={onClose}
          accessibilityLabel={accessibilityDismissLabel}
        />
        <View
          pointerEvents="box-none"
          style={[
            styles.sheetAnchor,
            {
              justifyContent: useBottomSheet ? "flex-end" : "flex-start",
              paddingTop: useBottomSheet ? 0 : Math.max(insets.top, 12) + 16,
              paddingBottom: 0,
              paddingHorizontal: useBottomSheet ? 0 : 12,
            },
          ]}
        >
          <Animated.View
            style={{
              width: sheetMaxW,
              maxHeight: sheetMaxH,
              opacity: sheetOpacityAnim,
              transform: [
                {
                  translateY: sheetSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [slideFrom, 0],
                  }),
                },
              ],
            }}
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
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  {body}
                </View>
              )}
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
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
