import { useMemo } from "react";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";

/** M3 sheet / settings surface colors derived from the active app theme. */
export type ReaderSheetChrome = {
  onSurface: string;
  onSurfaceVariant: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  settingsPanelBackground: string;
  outlineVariant: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  iconRipple: string;
};

export function getReaderSheetChrome(bundle: MobileAppThemeBundle): ReaderSheetChrome {
  const { ui, reader, journal, chrome } = bundle;
  return {
    onSurface: ui.brown800,
    onSurfaceVariant: ui.brown500,
    surfaceContainer: reader.popoverRow,
    surfaceContainerHigh: ui.parchmentDeep,
    settingsPanelBackground: reader.popoverSurface,
    outlineVariant: ui.border,
    secondaryContainer: journal.chipActiveBackground,
    onSecondaryContainer: journal.chipActiveText,
    iconRipple: chrome.androidRipple,
  };
}

export function useReaderSheetChrome(): ReaderSheetChrome {
  const { bundle } = useMobileAppTheme();
  return useMemo(() => getReaderSheetChrome(bundle), [bundle]);
}
