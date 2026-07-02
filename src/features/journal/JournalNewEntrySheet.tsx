import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef, type ReactNode, type RefObject } from "react";
import {
  BackHandler,
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
import { JournalDraftCloseDialog } from "@/src/features/journal/JournalDraftCloseDialog";

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
      onRequestClose={onRequestClose}
      transparent
      animationType="none"
      statusBarTranslucent
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
  const [draftCloseDialogOpen, setDraftCloseDialogOpen] = useState(false);
  const [preferredContentHeightPx, setPreferredContentHeightPx] = useState<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [dragOffsetY, setDragOffsetY] = useState(0);
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
    setPreferredContentHeightPx((prev) => {
      if (prev != null && contentHeightPx <= prev + 4) return prev;
      return contentHeightPx;
    });
  }, []);

  const maxAllowedSheetHeightPx = Math.max(
    SHEET_MIN_HEIGHT_PX,
    windowHeight - sheetTopClearancePx - layout.bottomPx,
  );
  const resolvedSheetHeightPx = Math.min(sheetHeightPx, maxAllowedSheetHeightPx);

  const sheetAtMaxCapacity = useMemo(() => {
    if (preferredContentHeightPx == null) return false;
    return preferredContentHeightPx + sheetFormChromePx >= sheetMaxHeightPx - 2;
  }, [preferredContentHeightPx, sheetFormChromePx, sheetMaxHeightPx]);

  /** Keep form height stable while the keyboard is open — layout reflow steals TextInput/WebView focus. */
  const formContentScrollMaxHeightPx = resolvedSheetHeightPx - sheetFormChromePx;

  const keyboardBottomInsetPx =
    sheetAtMaxCapacity && keyboardHeight > 0 ? keyboardHeight : 0;

  /**
   * Lift the sheet with translateY so layout dimensions stay fixed (non-max sheets).
   * Max-capacity sheets are already top-pinned — shrink via bottom inset instead.
   */
  const keyboardLiftPx = useMemo(() => {
    if (keyboardHeight <= 0 || sheetAtMaxCapacity) return 0;
    const sheetTopY = windowHeight - layout.bottomPx - resolvedSheetHeightPx;
    const maxLift = Math.max(0, sheetTopY - sheetTopClearancePx);
    return Math.min(keyboardHeight, maxLift);
  }, [
    keyboardHeight,
    sheetAtMaxCapacity,
    windowHeight,
    layout.bottomPx,
    resolvedSheetHeightPx,
    sheetTopClearancePx,
  ]);

  const finishClose = useCallback(() => {
    closingRef.current = false;
    setDragOffsetY(0);
    dragStartYRef.current = 0;
    onClose();
  }, [onClose]);

  const animateClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Keyboard.dismiss();
    finishClose();
  }, [finishClose]);

  const confirmDraftClose = useCallback(() => {
    Keyboard.dismiss();
    setDraftCloseDialogOpen(true);
  }, []);

  const handleKeepEditingDraft = useCallback(() => {
    setDraftCloseDialogOpen(false);
  }, []);

  const handleSaveDraft = useCallback(() => {
    setDraftCloseDialogOpen(false);
    formRef.current?.save();
  }, [formRef]);

  const handleDiscardDraft = useCallback(() => {
    setDraftCloseDialogOpen(false);
    animateClose();
  }, [animateClose]);

  const requestClose = useCallback(() => {
    if (!hasDraft) {
      animateClose();
      return;
    }
    confirmDraftClose();
  }, [animateClose, confirmDraftClose, hasDraft]);

  useImperativeHandle(ref, () => ({ requestClose }), [requestClose]);

  useEffect(() => {
    if (!open) {
      closingRef.current = false;
      setHasDraft(false);
      setDraftCloseDialogOpen(false);
      setPreferredContentHeightPx(null);
      setKeyboardHeight(0);
      setDragOffsetY(0);
      dragStartYRef.current = 0;
      return;
    }
    closingRef.current = false;
  }, [open, sheetKey]);

  useEffect(() => {
    if (!open) return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: KeyboardEvent) => {
      setKeyboardHeight(e.endCoordinates.height);
    };
    const onHide = () => {
      setKeyboardHeight(0);
    };
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !layout.useModalOverlay) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (draftCloseDialogOpen) {
        setDraftCloseDialogOpen(false);
        return true;
      }
      requestClose();
      return true;
    });
    return () => sub.remove();
  }, [draftCloseDialogOpen, open, layout.useModalOverlay, requestClose]);

  const onDismissGestureEvent = useCallback((e: PanGestureHandlerGestureEvent) => {
    if (closingRef.current) return;
    const ty = e.nativeEvent.translationY;
    setDragOffsetY(Math.max(0, dragStartYRef.current + ty));
  }, []);

  const onDismissGestureStateChange = useCallback(
    (e: PanGestureHandlerStateChangeEvent) => {
      const { state, oldState, velocityY, translationY } = e.nativeEvent;
      if (state === State.ACTIVE && oldState !== State.ACTIVE) {
        dragStartYRef.current = dragOffsetY;
      }
      if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
        if (!open || closingRef.current) return;
        const ty = translationY ?? 0;
        const dragY = Math.max(0, dragStartYRef.current + ty);
        const vyPxPerS = Math.abs(velocityY ?? 0);
        const shouldClose = dragY > DRAG_DISMISS_PX || vyPxPerS > DRAG_VELOCITY_DISMISS;
        if (shouldClose) {
          if (hasDraft) {
            setDragOffsetY(0);
            dragStartYRef.current = 0;
            confirmDraftClose();
            return;
          }
          animateClose();
          return;
        }
        setDragOffsetY(0);
        dragStartYRef.current = 0;
      }
    },
    [animateClose, confirmDraftClose, dragOffsetY, hasDraft, open],
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
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss new entry"
          onPress={requestClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: j.newEntryRouteScrim }]}
        />
      </View>
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: layout.leftPx,
          width: layout.widthPx,
          ...(sheetAtMaxCapacity
            ? {
                top: sheetTopClearancePx,
                bottom: layout.bottomPx + keyboardBottomInsetPx,
              }
            : {
                bottom: layout.bottomPx,
                height: resolvedSheetHeightPx,
                maxHeight: maxAllowedSheetHeightPx,
              }),
        }}
      >
        <View
          pointerEvents="box-none"
          style={{
            flex: 1,
            transform: [{ translateY: dragOffsetY - keyboardLiftPx }],
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
                  onSheetPreferredHeightChange={onSheetPreferredHeightChange}
                  sheetKeyboardLiftPx={materialBottomSheet ? keyboardLiftPx : undefined}
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
        </View>
      </View>
    </View>
  );

  return (
    <>
    <JournalNewEntrySheetWindowOverlay
      visible={open}
      onRequestClose={requestClose}
      useModalOverlay={layout.useModalOverlay}
    >
      {content}
    </JournalNewEntrySheetWindowOverlay>
    <JournalDraftCloseDialog
      visible={draftCloseDialogOpen}
      onKeepEditing={handleKeepEditingDraft}
      onSave={handleSaveDraft}
      onDiscard={handleDiscardDraft}
      bundle={bundle}
      isTabletLayout={isTablet}
    />
    </>
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
