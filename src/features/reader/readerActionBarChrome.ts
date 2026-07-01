import { Platform, type ViewStyle } from "react-native";
import {
  READER_M3_APP_BAR_ICON_BUTTON_PX,
  READER_M3_SURFACE_CONTAINER,
  READER_M3_SURFACE_CONTAINER_HIGH,
} from "@/src/features/reader/readerSettingsPanelChrome";

/** M3 expressive floating toolbar resting elevation (3dp). */
export const READER_M3_FLOATING_TOOLBAR_ELEVATION_PX = 3;

/** M3 floating toolbar internal horizontal padding. */
export const READER_M3_FLOATING_TOOLBAR_PAD_H_PX = 8;

/** M3 floating toolbar internal vertical padding. */
export const READER_M3_FLOATING_TOOLBAR_PAD_V_PX = 8;

/** Gap between icon buttons inside the floating toolbar. */
export const READER_M3_FLOATING_TOOLBAR_BUTTON_GAP_PX = 4;

/** Trailing journal action — filled circular primary button inside the pill. */
export const READER_M3_FLOATING_TOOLBAR_JOURNAL_BUTTON_PX = READER_M3_APP_BAR_ICON_BUTTON_PX;

export function readerM3FloatingToolbarPillStyle(
  backgroundColor: string,
  iosFallbackBackground: string,
): ViewStyle {
  const bg = Platform.OS === "android" ? backgroundColor : iosFallbackBackground;
  return {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    rowGap: READER_M3_FLOATING_TOOLBAR_BUTTON_GAP_PX,
    columnGap: READER_M3_FLOATING_TOOLBAR_BUTTON_GAP_PX,
    backgroundColor: bg,
    borderRadius: 999,
    paddingHorizontal: READER_M3_FLOATING_TOOLBAR_PAD_H_PX,
    paddingVertical: READER_M3_FLOATING_TOOLBAR_PAD_V_PX,
    maxWidth: "100%",
    ...Platform.select({
      android: {
        elevation: READER_M3_FLOATING_TOOLBAR_ELEVATION_PX,
      },
      ios: {
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.06)",
        shadowColor: "#242423",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      default: {},
    }),
  };
}

export const READER_M3_FLOATING_TOOLBAR_CONTAINER = READER_M3_SURFACE_CONTAINER_HIGH;
