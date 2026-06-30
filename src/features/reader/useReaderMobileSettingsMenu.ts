import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import { hapticLightImpact } from "@/lib/haptics";
import { useRegisterReaderSettingsSlideProgress } from "@/lib/reader-tab-bar-visibility-context";
import {
  READER_SETTINGS_MENU_SPRING_CLOSE,
  READER_SETTINGS_MENU_SPRING_OPEN,
} from "@/lib/reader-settings-menu-motion";
import { isTabletLayout } from "@/lib/tablet-layout";
import { readerExpandedNavRailWidthPx } from "@/src/features/reader/readerSettingsPanelChrome";

/** Present follow-up sheets after the settings strip finishes sliding away. */
export const READER_MOBILE_MENU_CLOSE_MS = 260;

const READER_MOBILE_SETTINGS_TABLET_PORTRAIT_SLIDE_RATIO = 0.28;
const READER_MOBILE_SETTINGS_TABLET_LANDSCAPE_SLIDE_RATIO = 0.2;

export type UseReaderMobileSettingsMenuArgs = {
  windowWidth: number;
  windowHeight: number;
  /** When false, slide progress is not registered for tab bar tint (e.g. inactive tab). */
  enabled?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
};

export function useReaderMobileSettingsMenu({
  windowWidth,
  windowHeight,
  enabled = true,
  onOpen,
  onClose,
}: UseReaderMobileSettingsMenuArgs) {
  const isTabletReaderLayout = isTabletLayout(windowWidth, windowHeight);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const mobileSettingsFollowUpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readerSettingsSlideProgress = useRef(new Animated.Value(0)).current;
  const readerSettingsMenuDragStartProgressRef = useRef(1);
  const readerSettingsMenuDragLastProgressRef = useRef(1);

  const readerMobileSettingsSlidePx = useMemo(() => {
    if (isTabletReaderLayout) {
      const ratio =
        windowWidth > windowHeight
          ? READER_MOBILE_SETTINGS_TABLET_LANDSCAPE_SLIDE_RATIO
          : READER_MOBILE_SETTINGS_TABLET_PORTRAIT_SLIDE_RATIO;
      return windowWidth * ratio;
    }
    return readerExpandedNavRailWidthPx(windowWidth);
  }, [isTabletReaderLayout, windowWidth, windowHeight]);

  const readerMobileSettingsSlideTranslateX = useMemo(
    () =>
      readerSettingsSlideProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, readerMobileSettingsSlidePx],
      }),
    [readerSettingsSlideProgress, readerMobileSettingsSlidePx],
  );

  useEffect(() => {
    if (!enabled) return;
    readerSettingsSlideProgress.stopAnimation();
    Animated.spring(readerSettingsSlideProgress, {
      ...(toolsMenuOpen ? READER_SETTINGS_MENU_SPRING_OPEN : READER_SETTINGS_MENU_SPRING_CLOSE),
      toValue: toolsMenuOpen ? 1 : 0,
    }).start();
  }, [enabled, toolsMenuOpen, readerSettingsSlideProgress]);

  useRegisterReaderSettingsSlideProgress(readerSettingsSlideProgress, enabled);

  const readerMenuSlidePxWhileOpenRef = useRef<number | null>(null);
  useEffect(() => {
    if (!toolsMenuOpen) {
      readerMenuSlidePxWhileOpenRef.current = null;
      return;
    }
    const prev = readerMenuSlidePxWhileOpenRef.current;
    readerMenuSlidePxWhileOpenRef.current = readerMobileSettingsSlidePx;
    if (prev != null && prev !== readerMobileSettingsSlidePx) {
      readerSettingsSlideProgress.setValue(1);
    }
  }, [toolsMenuOpen, readerMobileSettingsSlidePx, readerSettingsSlideProgress]);

  useEffect(() => {
    return () => {
      if (mobileSettingsFollowUpTimeoutRef.current != null) {
        clearTimeout(mobileSettingsFollowUpTimeoutRef.current);
      }
    };
  }, []);

  const clearMobileSettingsFollowUp = useCallback(() => {
    if (mobileSettingsFollowUpTimeoutRef.current != null) {
      clearTimeout(mobileSettingsFollowUpTimeoutRef.current);
      mobileSettingsFollowUpTimeoutRef.current = null;
    }
  }, []);

  const scheduleAfterMobileReaderMenuClose = useCallback(
    (fn: () => void) => {
      clearMobileSettingsFollowUp();
      mobileSettingsFollowUpTimeoutRef.current = setTimeout(() => {
        mobileSettingsFollowUpTimeoutRef.current = null;
        fn();
      }, READER_MOBILE_MENU_CLOSE_MS);
    },
    [clearMobileSettingsFollowUp],
  );

  const closeToolsMenu = useCallback(() => {
    clearMobileSettingsFollowUp();
    setToolsMenuOpen(false);
    onClose?.();
  }, [clearMobileSettingsFollowUp, onClose]);

  const toggleToolsMenu = useCallback(() => {
    hapticLightImpact();
    setToolsMenuOpen((open) => {
      if (open) {
        onClose?.();
        return false;
      }
      clearMobileSettingsFollowUp();
      onOpen?.();
      return true;
    });
  }, [clearMobileSettingsFollowUp, onClose, onOpen]);

  const readerSettingsMenuPanResponder = useMemo(() => {
    const maxSlide = readerMobileSettingsSlidePx;
    const finishDrag = (g: PanResponderGestureState, menuOpen: boolean) => {
      if (!menuOpen) return;
      const p = readerSettingsMenuDragLastProgressRef.current;
      const shouldClose = p < 0.38 || (g.vx < -0.45 && p < 0.72);
      if (shouldClose) {
        closeToolsMenu();
      } else {
        Animated.spring(readerSettingsSlideProgress, {
          ...READER_SETTINGS_MENU_SPRING_OPEN,
          toValue: 1,
        }).start();
      }
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_e: GestureResponderEvent, gestureState) => {
        if (!toolsMenuOpen) return false;
        const { dx, dy } = gestureState;
        return dx < -10 && Math.abs(dx) > Math.abs(dy) * 1.15;
      },
      onMoveShouldSetPanResponder: (_e: GestureResponderEvent, gestureState) => {
        if (!toolsMenuOpen) return false;
        const { dx, dy } = gestureState;
        return dx < -10 && Math.abs(dx) > Math.abs(dy) * 1.15;
      },
      onPanResponderGrant: () => {
        readerSettingsSlideProgress.stopAnimation((v: number) => {
          readerSettingsMenuDragStartProgressRef.current = v;
          readerSettingsMenuDragLastProgressRef.current = v;
        });
      },
      onPanResponderMove: (_e: GestureResponderEvent, gestureState) => {
        if (!toolsMenuOpen) return;
        const start = readerSettingsMenuDragStartProgressRef.current;
        const p = Math.min(1, Math.max(0, start + gestureState.dx / maxSlide));
        readerSettingsMenuDragLastProgressRef.current = p;
        readerSettingsSlideProgress.setValue(p);
      },
      onPanResponderRelease: (_e: GestureResponderEvent, gestureState) => {
        finishDrag(gestureState, toolsMenuOpen);
      },
      onPanResponderTerminate: (_e: GestureResponderEvent, gestureState) => {
        finishDrag(gestureState, toolsMenuOpen);
      },
      onPanResponderTerminationRequest: () => true,
    });
  }, [closeToolsMenu, readerMobileSettingsSlidePx, readerSettingsSlideProgress, toolsMenuOpen]);

  useEffect(() => {
    if (!enabled || !toolsMenuOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeToolsMenu();
      return true;
    });
    return () => sub.remove();
  }, [closeToolsMenu, enabled, toolsMenuOpen]);

  return {
    isTabletReaderLayout,
    toolsMenuOpen,
    setToolsMenuOpen,
    toggleToolsMenu,
    closeToolsMenu,
    clearMobileSettingsFollowUp,
    scheduleAfterMobileReaderMenuClose,
    readerMobileSettingsSlidePx,
    readerMobileSettingsSlideTranslateX,
    readerSettingsMenuPanHandlers: readerSettingsMenuPanResponder.panHandlers,
  };
}
