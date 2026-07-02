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
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
  type KeyboardEvent,
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
import {
  M3_EMPHASIZED_ACCELERATE_EASING,
  M3_EMPHASIZED_DECELERATE_EASING,
  M3_MOTION_DURATION_MEDIUM2_MS,
  M3_MOTION_DURATION_SHORT3_MS,
  M3_MOTION_DURATION_SHORT4_MS,
} from "@/src/components/m3/m3-motion";

const FAB_SIZE_PX = JOURNAL_NEW_ENTRY_FAB_PX;
const SHEET_GAP_ABOVE_FAB_PX = 12;
/** Minimum breathing room between the sheet top and the top safe area / screen edge. */
const SHEET_TOP_SCREEN_GAP_PX = 20;
const MATERIAL_TOP_RADIUS_PX = 28;
const MATERIAL_HANDLE_WIDTH_PX = 32;
const MATERIAL_HANDLE_HEIGHT_PX = 4;
const DRAG_DISMISS_PX = 96;
const DRAG_VELOCITY_DISMISS = 520;
/** Smallest sheet card height before content measurement lands. */
const SHEET_MIN_HEIGHT_PX = 360;
/** Rough form body height before the first onLayout (passage + title + reflection min + save). */
const SHEET_INITIAL_CONTENT_ESTIMATE_PX = 458;

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
  const [preferredContentHeightPx, setPreferredContentHeightPx] = useState<number | null>(null);
  const [keyboardHeightPx, setKeyboardHeightPx] = useState(0);
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const sheetHeightAnim = useRef(new Animated.Value(SHEET_MIN_HEIGHT_PX)).current;
  const keyboardOffsetAnim = useRef(new Animated.Value(0)).current;
  const keyboardMotionDurationRef = useRef(M3_MOTION_DURATION_MEDIUM2_MS);
  const prevKeyboardLiftRef = useRef(0);
  const openEntrancePlayedRef = useRef(false);
  const closingRef = useRef(false);
  const dragStartYRef = useRef(0);

  const isTablet = isTabletLayout(windowWidth, windowHeight);
  const isAndroidPhone = Platform.OS === "android" && !isTablet;
  const materialBottomSheet = isAndroidPhone;
  const sheetTopClearancePx =
    Math.max(insets.top, Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0) +
    SHEET_TOP_SCREEN_GAP_PX;

  const layout = useMemo((): SheetLayout => {
    if (variant === "journal") {
      if (materialBottomSheet) {
        return {
          bottomPx: 0,
          leftPx: 0,
          widthPx: windowWidth,
          heightPx: windowHeight - sheetTopClearancePx,
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
        heightPx: windowHeight - sheetTopClearancePx,
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
    sheetTopClearancePx,
  ]);

  const sheetFormChromePx = materialBottomSheet ? 52 : 42;
  const sheetMaxHeightPx = layout.heightPx;
  const sheetHeightPx = useMemo(() => {
    if (preferredContentHeightPx == null) {
      const initial = SHEET_INITIAL_CONTENT_ESTIMATE_PX + sheetFormChromePx;
      return Math.max(SHEET_MIN_HEIGHT_PX, Math.min(sheetMaxHeightPx, initial));
    }
    const desired = preferredContentHeightPx + sheetFormChromePx;
    return Math.max(SHEET_MIN_HEIGHT_PX, Math.min(sheetMaxHeightPx, desired));
  }, [preferredContentHeightPx, sheetFormChromePx, sheetMaxHeightPx]);

  const onSheetPreferredHeightChange = useCallback((contentHeightPx: number) => {
    setPreferredContentHeightPx((prev) => (prev === contentHeightPx ? prev : contentHeightPx));
  }, []);

  const sheetTopGutterPx = sheetTopClearancePx;
  const keyboardLiftPx = keyboardHeightPx > 0 ? keyboardHeightPx : 0;
  const sheetBottomPx = layout.bottomPx + keyboardLiftPx;
  const maxAllowedSheetHeightPx = Math.max(
    SHEET_MIN_HEIGHT_PX,
    windowHeight - sheetTopClearancePx - sheetBottomPx,
  );

  const keyboardAwareSheetHeightPx = useMemo(() => {
    if (keyboardLiftPx <= 0) return sheetHeightPx;
    const maxHeightAboveKeyboard = Math.max(
      SHEET_MIN_HEIGHT_PX,
      windowHeight - sheetTopGutterPx - keyboardLiftPx - layout.bottomPx,
    );
    return Math.max(sheetHeightPx, Math.min(sheetMaxHeightPx, maxHeightAboveKeyboard));
  }, [
    keyboardLiftPx,
    sheetHeightPx,
    sheetMaxHeightPx,
    sheetTopGutterPx,
    windowHeight,
    layout.bottomPx,
  ]);

  const resolvedSheetHeightPx = Math.min(keyboardAwareSheetHeightPx, maxAllowedSheetHeightPx);

  const sheetAtMaxCapacity = useMemo(() => {
    if (preferredContentHeightPx == null) return false;
    return preferredContentHeightPx + sheetFormChromePx >= sheetMaxHeightPx - 2;
  }, [preferredContentHeightPx, sheetFormChromePx, sheetMaxHeightPx]);

  /** Pin top clearance when content fills the sheet (e.g. verse preview). */
  const sheetFillMode = sheetAtMaxCapacity;

  const formContentScrollMaxHeightPx = sheetFillMode
    ? maxAllowedSheetHeightPx - sheetFormChromePx
    : resolvedSheetHeightPx - sheetFormChromePx;

  useEffect(() => {
    if (!open) {
      setKeyboardHeightPx(0);
      prevKeyboardLiftRef.current = 0;
      return;
    }
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: KeyboardEvent) => {
      keyboardMotionDurationRef.current = Math.max(
        M3_MOTION_DURATION_SHORT4_MS,
        Math.round(e.duration ?? M3_MOTION_DURATION_MEDIUM2_MS),
      );
      setKeyboardHeightPx(Math.round(e.endCoordinates.height));
    };
    const onHide = (e?: KeyboardEvent) => {
      keyboardMotionDurationRef.current = Math.max(
        M3_MOTION_DURATION_SHORT3_MS,
        Math.round(e?.duration ?? M3_MOTION_DURATION_SHORT4_MS),
      );
      setKeyboardHeightPx(0);
    };
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const prevLift = prevKeyboardLiftRef.current;
    const openingKeyboard = prevLift === 0 && keyboardLiftPx > 0;
    const closingKeyboard = prevLift > 0 && keyboardLiftPx === 0;
    const adjustingWithKeyboard = keyboardLiftPx > 0 && prevLift > 0 && prevLift !== keyboardLiftPx;

    if (!openingKeyboard && !closingKeyboard && !adjustingWithKeyboard) {
      if (!sheetFillMode) {
        sheetHeightAnim.setValue(resolvedSheetHeightPx);
      }
      prevKeyboardLiftRef.current = keyboardLiftPx;
      return;
    }

    const duration = openingKeyboard
      ? keyboardMotionDurationRef.current
      : closingKeyboard
        ? keyboardMotionDurationRef.current
        : M3_MOTION_DURATION_SHORT3_MS;
    const easing =
      openingKeyboard || adjustingWithKeyboard
        ? M3_EMPHASIZED_DECELERATE_EASING
        : M3_EMPHASIZED_ACCELERATE_EASING;

    Animated.timing(keyboardOffsetAnim, {
      toValue: -keyboardLiftPx,
      duration,
      easing,
      useNativeDriver: true,
    }).start();

    if (!sheetFillMode) {
      Animated.timing(sheetHeightAnim, {
        toValue: resolvedSheetHeightPx,
        duration,
        easing,
        useNativeDriver: false,
      }).start();
    }

    prevKeyboardLiftRef.current = keyboardLiftPx;
  }, [
    open,
    keyboardLiftPx,
    resolvedSheetHeightPx,
    sheetFillMode,
    keyboardOffsetAnim,
    sheetHeightAnim,
  ]);

  useEffect(() => {
    if (!open) return;
    if (keyboardLiftPx > 0) return;
    keyboardOffsetAnim.setValue(0);
    if (!sheetFillMode) {
      sheetHeightAnim.setValue(resolvedSheetHeightPx);
    }
  }, [
    open,
    keyboardLiftPx,
    resolvedSheetHeightPx,
    sheetFillMode,
    keyboardOffsetAnim,
    sheetHeightAnim,
  ]);

  const animateClose = useCallback(
    (velocityY = 0, draggedY = 0) => {
      if (closingRef.current) return;
      closingRef.current = true;
      Keyboard.dismiss();

      const targetY = keyboardAwareSheetHeightPx + keyboardLiftPx + 56;
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
        sheetTranslateY.setValue(materialBottomSheet ? sheetMaxHeightPx : 20);
        sheetOpacity.setValue(0);
        onClose();
      });
    },
    [keyboardAwareSheetHeightPx, keyboardLiftPx, materialBottomSheet, onClose, sheetOpacity, sheetTranslateY],
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
      keyboardOffsetAnim.stopAnimation();
      setHasDraft(false);
      setPreferredContentHeightPx(null);
      setKeyboardHeightPx(0);
      openEntrancePlayedRef.current = false;
      return;
    }

    if (openEntrancePlayedRef.current) return;
    openEntrancePlayedRef.current = true;

    closingRef.current = false;
    sheetOpacity.setValue(0);
    sheetHeightAnim.setValue(sheetHeightPx);
    keyboardOffsetAnim.setValue(0);
    prevKeyboardLiftRef.current = 0;

    if (materialBottomSheet) {
      sheetTranslateY.setValue(sheetHeightPx);
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
  }, [
    open,
    sheetKey,
    materialBottomSheet,
    layout.bottomPx,
    sheetHeightPx,
    keyboardOffsetAnim,
    sheetHeightAnim,
    sheetOpacity,
    sheetTranslateY,
  ]);

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
          ...(sheetFillMode
            ? { top: sheetTopClearancePx }
            : { height: sheetHeightAnim, maxHeight: maxAllowedSheetHeightPx }),
        }}
      >
        <Animated.View
          pointerEvents="box-none"
          style={{
            flex: 1,
            transform: [{ translateY: keyboardOffsetAnim }],
          }}
        >
        <Animated.View
          pointerEvents="box-none"
          style={{
            flex: 1,
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
                paddingBottom: 0,
              }}
            >
              <JournalNewEntryForm
                ref={formRef}
                key={sheetKey}
                initialParams={initialParams}
                contentScrollMaxHeight={formContentScrollMaxHeightPx}
                sheetKeyboardLiftPx={keyboardLiftPx}
                onSheetPreferredHeightChange={onSheetPreferredHeightChange}
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
        </Animated.View>
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
