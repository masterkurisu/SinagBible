import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { hapticLightImpact } from "@/lib/haptics";
import { isTabletLayout } from "@/lib/tablet-layout";
import { readerSettingsSideSheetWidthPx } from "@/src/features/reader/readerSettingsPanelChrome";

/** Present follow-up sheets after the settings side sheet finishes closing. */
export const READER_MOBILE_MENU_CLOSE_MS = 260;

const READER_MOBILE_SETTINGS_TABLET_PORTRAIT_SLIDE_RATIO = 0.28;
const READER_MOBILE_SETTINGS_TABLET_LANDSCAPE_SLIDE_RATIO = 0.2;

export type UseReaderMobileSettingsMenuArgs = {
  windowWidth: number;
  windowHeight: number;
  /** When false, back-handler wiring is skipped (e.g. inactive tab). */
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

  const settingsSideSheetWidthPx = useMemo(() => {
    if (isTabletReaderLayout) {
      const ratio =
        windowWidth > windowHeight
          ? READER_MOBILE_SETTINGS_TABLET_LANDSCAPE_SLIDE_RATIO
          : READER_MOBILE_SETTINGS_TABLET_PORTRAIT_SLIDE_RATIO;
      return windowWidth * ratio;
    }
    return readerSettingsSideSheetWidthPx(windowWidth);
  }, [isTabletReaderLayout, windowWidth, windowHeight]);

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
    settingsSideSheetWidthPx,
  };
}
