import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type KeyboardEvent,
} from "react-native";
import Reanimated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { isMobileAppDarkThemeId, type MobileAppThemeBundle } from "@sinag-bible/tokens";
import { DismissibleModal } from "@/src/components/m3/DismissibleModal";
import { M3SettingsSheetTitle } from "@/src/components/m3/M3SettingsSheetTitle";
import { computeReaderM3SheetKeyboardMetrics } from "@/src/components/m3/readerM3SheetKeyboard";
import { useAndroidSheetBackdropSnapshot } from "@/lib/use-android-sheet-backdrop-snapshot";
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

/** Ignore a hide event while focus moves from the parent field into this sheet. */
const IGNORE_KEYBOARD_HIDE_AFTER_OPEN_MS = 450;

function readKeyboardHeight(): number {
  return Math.max(0, Keyboard.metrics()?.height ?? 0);
}

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
  /** Blur whatever's behind the sheet instead of a flat scrim. */
  blurBackdrop?: boolean;
  /**
   * Dock the sheet just above the IME and shrink it to the remaining space.
   * Tracks live keyboard height so different IMEs / suggestion bars stay clear of the field.
   */
  avoidKeyboard?: boolean;
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
  blurBackdrop = false,
  avoidKeyboard = false,
}: ReaderM3BottomSheetProps) {
  const rc = bundle.reader;
  const { width: screenW, height: screenH } = useWindowDimensions();
  const slideProgress = useSharedValue(0);
  const scrimOpacity = useSharedValue(0);
  const sheetOpacity = useSharedValue(0);
  const isDark = isMobileAppDarkThemeId(bundle.id);
  const androidBackdropUri = useAndroidSheetBackdropSnapshot(blurBackdrop && isOpen);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const lastKeyboardHeightRef = useRef(0);
  const openedAtRef = useRef(0);

  const scale = READER_OVERLAY_CONTENT_SCALE;
  const useBottomSheet = !isTabletReaderLayout;
  const sheetMaxW = readerM3SheetMaxWidthPx(screenW, isTabletReaderLayout, widthVariant);
  const unconstrainedMaxH =
    screenH * readerM3SheetMaxHeightRatio(isTabletReaderLayout, maxHeightRatio, widthVariant);
  const keyboardMetrics = avoidKeyboard
    ? computeReaderM3SheetKeyboardMetrics({
        screenHeight: screenH,
        keyboardHeight,
        statusBarInset: insets.top,
        maxHeight: unconstrainedMaxH,
      })
    : { bottomInset: 0, maxHeight: unconstrainedMaxH, floating: false };
  const sheetMaxH = keyboardMetrics.maxHeight;
  const padH = 24 * scale;
  const bottomPad =
    contentPaddingBottom ??
    (keyboardMetrics.floating
      ? 12 * scale
      : useBottomSheet
        ? Math.max(insets.bottom, 16) * scale
        : 16 * scale);
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

  useEffect(() => {
    if (!avoidKeyboard) {
      setKeyboardHeight(0);
      return;
    }

    const applyHeight = (height: number) => {
      const next = Math.max(0, height);
      if (next > 0) lastKeyboardHeightRef.current = next;
      if (isOpen) setKeyboardHeight(next);
    };

    if (isOpen) {
      openedAtRef.current = Date.now();
      applyHeight(readKeyboardHeight() || lastKeyboardHeightRef.current);
    } else {
      setKeyboardHeight(0);
    }

    const onShow = (e: KeyboardEvent) => applyHeight(e.endCoordinates.height);
    let hideCheck: ReturnType<typeof setTimeout> | undefined;
    const onHide = () => {
      const remaining =
        IGNORE_KEYBOARD_HIDE_AFTER_OPEN_MS - (Date.now() - openedAtRef.current);
      if (isOpen && remaining > 0) {
        if (hideCheck) clearTimeout(hideCheck);
        hideCheck = setTimeout(() => {
          const stillOpen = readKeyboardHeight();
          if (stillOpen > 0) applyHeight(stillOpen);
          else setKeyboardHeight(0);
        }, remaining);
        return;
      }
      if (isOpen) setKeyboardHeight(0);
    };
    const onFrame = (e: KeyboardEvent) => {
      const height = e.endCoordinates.height;
      if (height <= 0 || height >= screenH * 0.72) return;
      applyHeight(height);
    };

    const showSubs = [
      Keyboard.addListener("keyboardWillShow", onShow),
      Keyboard.addListener("keyboardDidShow", onShow),
    ];
    if (Platform.OS === "android") {
      showSubs.push(Keyboard.addListener("keyboardDidChangeFrame", onFrame));
    }
    const hideSubs = [
      Keyboard.addListener("keyboardWillHide", onHide),
      Keyboard.addListener("keyboardDidHide", onHide),
    ];
    return () => {
      if (hideCheck) clearTimeout(hideCheck);
      showSubs.forEach((sub) => sub.remove());
      hideSubs.forEach((sub) => sub.remove());
    };
  }, [avoidKeyboard, isOpen, screenH]);

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
      blurBackdrop={blurBackdrop ? { isDark, androidBackdropUri } : undefined}
    >
      <View
        pointerEvents="box-none"
        style={[
          styles.sheetAnchor,
          {
            justifyContent: useBottomSheet || keyboardMetrics.floating ? "flex-end" : "center",
            paddingTop: useBottomSheet ? 0 : Math.max(insets.top, 16),
            paddingBottom: keyboardMetrics.floating
              ? keyboardMetrics.bottomInset
              : useBottomSheet
                ? 0
                : Math.max(insets.bottom, 16),
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
                borderBottomLeftRadius:
                  useBottomSheet && !keyboardMetrics.floating ? 0 : 28,
                borderBottomRightRadius:
                  useBottomSheet && !keyboardMetrics.floating ? 0 : 28,
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
                  flexShrink: 1,
                  minHeight: 0,
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
