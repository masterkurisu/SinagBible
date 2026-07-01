import { useCallback, useState } from "react";
import type { LayoutRectangle } from "react-native";

export type SettingsRowTooltipState = {
  anchor: LayoutRectangle;
  title: string;
  description: string;
};

export function useSettingsRowTooltip() {
  const [tooltip, setTooltip] = useState<SettingsRowTooltipState | null>(null);

  const showTooltip = useCallback((next: SettingsRowTooltipState) => {
    setTooltip(next);
  }, []);

  const dismissTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  return {
    tooltip,
    showTooltip,
    dismissTooltip,
    tooltipVisible: tooltip != null,
  };
}
