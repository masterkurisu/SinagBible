import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef, type ReactNode, type RefObject } from "react";
import {
  Alert,
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import type {
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  JournalNewEntryForm,
  type JournalNewEntryFormHandle,
  type JournalNewEntryInitialParams,
} from "@/components/journal-new-entry-form";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import {
  nativeFloatingTabBarTopReservePx,
} from "@/lib/native-tab-chrome";
import { isTabletLayout, TABLET_NEW_ENTRY_SHEET_MAX_WIDTH_PX } from "@/lib/tablet-layout";

import { JOURNAL_NEW_ENTRY_FAB_PX } from "@/src/features/journal/journalFabChrome";

const FAB_SIZE_PX = JOURNAL_NEW_ENTRY_FAB_PX;
const SHEET_GAP_ABOVE_FAB_PX = 12;
/** Android Material sheets: fixed clearance below the status bar / top of screen. */
const MATERIAL_SHEET_TOP_GAP_PX = 50;
const MATERIAL_TOP_RADIUS_PX = 28;
const MATERIAL_HANDLE_WIDTH_PX = 32;
const MATERIAL_HANDLE_HEIGHT_PX = 4;
const DRAG_DISMISS_PX = 96;
const DRAG_VELOCITY_DISMISS = 520;

export type JournalNewEntrySheetVariant = "journal" | "reader";

export type JournalNewEntrySheetProps = {
  open: boolean;
  onClose: () => void;
  sheetKey: number;
  variant: JournalNewEntrySheetVariant;
  formRef: RefObject<JournalNewEntryFormHandle | null>;
  onDirtyChange?: (dirty: boolean) => void;
  initialParams?: JournalNewEntryInitialParams;
  onAfterSave?: () => void;
  onSaveToast?: (message: string) => void;
  /** Journal iOS: positions the floating card above the FAB. */
  journalFabBottomPx?: number;
  /** Reader: extra gap above the native tab bar. */
  readerBottomLiftPx?: number;
};

type SheetLayout = {
  bottomPx: number;
  leftPx: number;
  widthPx: number;
  heightPx: number;
  materialBottomSheet: boolean;
  borderRadiusPx: number;
  useModalOverlay: boolean;
};

function JournalNewEntrySheetWindowOverlay({
  visible,
  onRequestClose,
  useModalOverlay,
  children,
}: {
  visible: boolean;
  onRequestClose: () => void;
  useModalOverlay: boolean;
  children: ReactNode;
}) {
  if (!useModalOverlay) return <>{children}</>;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      {children}
    </Modal>
  );
}

export type JournalNewEntrySheetHandle = {
  requestClose: () => void;
};

export const JournalNewEntrySheet = forwardRef<JournalNewEntrySheetHandle, JournalNewEntrySheetProps>(
  function JournalNewEntrySheet(
    {
      open,
      onClose,
      sheetKey,
      variant,
      formRef,
      onDirtyChange,
      initialParams,
      onAfterSave,
      onSaveToast,
      journalFabBottomPx = 0,
      readerBottomLiftPx = 50,
    },
    ref,
  ) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { bundle } = useMobileAppTheme();
  const j = bundle.journal;

  const [hasDraft, setHasDraft] = useState(false);
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);
  const dragStartYRef = useRef(0);

  const isTablet = isTabletLayout(windowWidth, windowHeight);
  const isAndroidPhone = Platform.OS === "android" && !isTablet;
  const materialBottomSheet = isAndroidPhone;

  const layout = useMemo((): SheetLayout => {
    if (variant === "journal") {
      if (materialBottomSheet) {
        return {
          bottomPx: 0,
          leftPx: 0,
          widthPx: windowWidth,
          heightPx: windowHeight - MATERIAL_SHEET_TOP_GAP_PX,
          materialBottomSheet: true,
          borderRadiusPx: MATERIAL_TOP_RADIUS_PX,
          useModalOverlay: true,
        };
      }

      const cardBottom = journalFabBottomPx + FAB_SIZE_PX + SHEET_GAP_ABOVE_FAB_PX;
      const sheetHorizontalInset = insets.left + 2;
      const sheetWidth = Math.min(
        windowWidth - sheetHorizontalInset * 2,
        isTablet ? TABLET_NEW_ENTRY_SHEET_MAX_WIDTH_PX : windowWidth - sheetHorizontalInset * 2,
      );
      const sheetLeft = Math.max(sheetHorizontalInset, (windowWidth - sheetWidth) / 2);
      const sheetTopGutter =
        12 +
        nativeFloatingTabBarTopReservePx(windowWidth > windowHeight, isTablet);
      const sheetMaxHeight = Math.max(
        280,
        Math.min(
          600,
          windowHeight * 0.72 + 80,
          Math.max(280, windowHeight - cardBottom - insets.top - sheetTopGutter),
        ),
      );
      return {
        bottomPx: cardBottom,
        leftPx: sheetLeft,
        widthPx: sheetWidth,
        heightPx: sheetMaxHeight,
        materialBottomSheet: false,
        borderRadiusPx: 24,
        useModalOverlay: false,
      };
    }

    if (materialBottomSheet) {
      return {
        bottomPx: 0,
        leftPx: 0,
        widthPx: windowWidth,
        heightPx: windowHeight - MATERIAL_SHEET_TOP_GAP_PX,
        materialBottomSheet: true,
        borderRadiusPx: MATERIAL_TOP_RADIUS_PX,
        useModalOverlay: true,
      };
    }

    const bottomPx = insets.bottom + readerBottomLiftPx;
    const topGutterPx = insets.top + 8;
    const targetHeightPx = Math.max(320, windowHeight - topGutterPx - bottomPx);

    const horizontalInset = insets.left + 2;
    const widthPx = Math.min(
      windowWidth - horizontalInset * 2,
      isTablet ? TABLET_NEW_ENTRY_SHEET_MAX_WIDTH_PX : windowWidth - horizontalInset * 2,
    );
    const leftPx = Math.max(horizontalInset, (windowWidth - widthPx) / 2);
    return {
      bottomPx,
      leftPx,
      widthPx,
      heightPx: targetHeightPx,
      materialBottomSheet: false,
      borderRadiusPx: 24,
      useModalOverlay: true,
    };
  }, [
    variant,
    materialBottomSheet,
    insets.bottom,
    insets.left,
    insets.top,
    isTablet,
    journalFabBottomPx,
    readerBottomLiftPx,
    windowHeight,
    windowWidth,
  ]);

  const animateClose = useCallback(
    (velocityY = 0, draggedY = 0) => {
      if (closingRef.current) return;
      closingRef.current = true;
      Keyboard.dismiss();

      const targetY = layout.heightPx + 56;
      const clampedDragY = Math.max(0, draggedY);
      const vel = Math.max(0, velocityY);
      const duration = Math.max(
        150,
        Math.min(320, Math.round(280 - Math.min(1.85, vel) * 90)),
      );

      if (clampedDragY > 0) {
        sheetTranslateY.setValue(clampedDragY);
      }

      Animated.parallel([
        Animated.timing(sheetTranslateY, {
          toValue: targetY,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheetOpacity, {
          toValue: 0,
          duration: Math.max(180, duration + 90),
          delay: materialBottomSheet ? 0 : 80,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        closingRef.current = false;
        sheetTranslateY.setValue(materialBottomSheet ? layout.heightPx : 20);
        sheetOpacity.setValue(0);
        onClose();
      });
    },
    [layout.heightPx, materialBottomSheet, onClose, sheetOpacity, sheetTranslateY],
  );

  const springOpen = useCallback(() => {
    Animated.parallel([
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        friction: 9,
        tension: 75,
        useNativeDriver: true,
      }),
      Animated.timing(sheetOpacity, {
        toValue: 1,
        duration: 170,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [sheetOpacity, sheetTranslateY]);

  const confirmDraftClose = useCallback(() => {
    Alert.alert("Save or discard?", "You have unsaved text in this draft.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Save", onPress: () => formRef.current?.save() },
      { text: "Discard", style: "destructive", onPress: () => animateClose(0.45, 0) },
    ]);
  }, [animateClose, formRef]);

  const requestClose = useCallback(() => {
    if (!hasDraft) {
      animateClose(0.45, 0);
      return;
    }
    confirmDraftClose();
  }, [animateClose, confirmDraftClose, hasDraft]);

  useImperativeHandle(ref, () => ({ requestClose }), [requestClose]);

  useEffect(() => {
    if (!open) {
      closingRef.current = false;
      sheetTranslateY.stopAnimation();
      sheetOpacity.stopAnimation();
      setHasDraft(false);
      return;
    }

    closingRef.current = false;
    sheetOpacity.setValue(0);

    if (materialBottomSheet) {
      sheetTranslateY.setValue(layout.heightPx);
      Animated.parallel([
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheetOpacity, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    sheetTranslateY.setValue(20);
    Animated.parallel([
      Animated.timing(sheetOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();
  }, [open, layout.heightPx, materialBottomSheet, sheetOpacity, sheetTranslateY]);

  useEffect(() => {
    if (!open || !layout.useModalOverlay) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      requestClose();
      return true;
    });
    return () => sub.remove();
  }, [open, layout.useModalOverlay, requestClose]);

  const onDismissGestureEvent = useCallback(
    (e: PanGestureHandlerGestureEvent) => {
      if (closingRef.current) return;
      const ty = e.nativeEvent.translationY;
      const dragY = Math.max(0, dragStartYRef.current + ty);
      sheetTranslateY.setValue(dragY);
      if (!materialBottomSheet) {
        sheetOpacity.setValue(Math.max(0.82, 1 - dragY / 900));
      }
    },
    [materialBottomSheet, sheetOpacity, sheetTranslateY],
  );

  const onDismissGestureStateChange = useCallback(
    (e: PanGestureHandlerStateChangeEvent) => {
      const { state, oldState, velocityY, translationY } = e.nativeEvent;
      if (state === State.ACTIVE && oldState !== State.ACTIVE) {
        sheetTranslateY.stopAnimation((value: number) => {
          dragStartYRef.current = value;
        });
      }
      if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
        if (!open || closingRef.current) return;
        const ty = translationY ?? 0;
        const dragY = Math.max(0, dragStartYRef.current + ty);
        const vyPxPerS = Math.abs(velocityY ?? 0);
        const velForCloseAnim = Math.min(1.85, vyPxPerS / DRAG_VELOCITY_DISMISS);
        const shouldClose = dragY > DRAG_DISMISS_PX || vyPxPerS > DRAG_VELOCITY_DISMISS;
        if (shouldClose) {
          if (hasDraft) {
            springOpen();
            confirmDraftClose();
            return;
          }
          animateClose(velForCloseAnim, dragY);
          return;
        }
        Animated.parallel([
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            velocity: Math.max(0, (velocityY ?? 0) / 1000),
            friction: 9,
            tension: 75,
            useNativeDriver: true,
          }),
          Animated.timing(sheetOpacity, {
            toValue: 1,
            duration: 170,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start();
      }
    },
    [animateClose, confirmDraftClose, hasDraft, open, sheetOpacity, sheetTranslateY, springOpen],
  );

  const handleDirtyChange = useCallback(
    (dirty: boolean) => {
      setHasDraft(dirty);
      onDirtyChange?.(dirty);
    },
    [onDirtyChange],
  );

  const formReaderBottomLiftPx =
    variant === "reader" && materialBottomSheet ? 0 : readerBottomLiftPx;

  if (!open) return null;

  const sheetCardStyle = materialBottomSheet
    ? {
        borderTopLeftRadius: layout.borderRadiusPx,
        borderTopRightRadius: layout.borderRadiusPx,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderWidth: 0,
      }
    : {
        borderRadius: layout.borderRadiusPx,
        borderWidth: 1,
        borderColor: j.newEntrySheetBorder,
      };

  const handleStyle = materialBottomSheet
    ? {
        width: MATERIAL_HANDLE_WIDTH_PX,
        height: MATERIAL_HANDLE_HEIGHT_PX,
        borderRadius: 2,
        backgroundColor: "rgba(0,0,0,0.28)",
      }
    : {
        width: 56,
        height: 6,
        borderRadius: 999,
        backgroundColor: "rgba(123,106,86,0.35)",
      };

  const content = (
    <View
      pointerEvents="box-none"
      style={[
        layout.useModalOverlay ? styles.modalRoot : styles.embeddedRoot,
        layout.useModalOverlay ? undefined : { zIndex: 2 },
      ]}
    >
      <Animated.View
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, { opacity: sheetOpacity }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss new entry"
          onPress={requestClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: j.newEntryRouteScrim }]}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: layout.leftPx,
          width: layout.widthPx,
          bottom: layout.bottomPx,
          height: layout.heightPx,
          maxHeight: layout.heightPx,
          opacity: sheetOpacity,
          transform: [{ translateY: sheetTranslateY }],
        }}
      >
        <View style={styles.sheetKeyboardView}>
          <View
            style={[
              styles.sheetCard,
              sheetCardStyle,
              {
                backgroundColor: j.newEntrySheetBackground,
                shadowColor: bundle.reader.popoverShadow,
              },
            ]}
          >
            <PanGestureHandler
              onGestureEvent={onDismissGestureEvent}
              onHandlerStateChange={onDismissGestureStateChange}
              activeOffsetY={8}
              failOffsetX={[-32, 32]}
            >
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  paddingTop: materialBottomSheet ? 12 : 6,
                  paddingBottom: materialBottomSheet ? 8 : 4,
                  backgroundColor: j.newEntryDragAreaBackground,
                }}
              >
                <View style={handleStyle} />
              </View>
            </PanGestureHandler>
            <View
              style={{
                flex: 1,
                minHeight: 0,
                paddingHorizontal: 0,
                paddingTop: 4,
                paddingBottom: 8,
              }}
            >
              <JournalNewEntryForm
                ref={formRef}
                key={sheetKey}
                initialParams={initialParams}
                contentScrollMaxHeight={layout.heightPx - (materialBottomSheet ? 52 : 42)}
                contentHorizontalPadding={10}
                readerNewEntryScrollable={variant === "reader"}
                readerCardBottomLiftPx={formReaderBottomLiftPx}
                onDirtyChange={handleDirtyChange}
                onSaveToast={onSaveToast}
                onAfterSave={onAfterSave}
              />
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );

  return (
    <JournalNewEntrySheetWindowOverlay
      visible={open}
      onRequestClose={requestClose}
      useModalOverlay={layout.useModalOverlay}
    >
      {content}
    </JournalNewEntrySheetWindowOverlay>
  );
},
);

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  embeddedRoot: {
    ...StyleSheet.absoluteFill,
  },
  sheetKeyboardView: {
    flex: 1,
    maxHeight: "100%",
  },
  sheetCard: {
    flex: 1,
    minHeight: 280,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 10,
  },
});
