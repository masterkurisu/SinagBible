import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import {
  READER_M3_BODY_FONT_PX,
  READER_M3_BODY_LINE_HEIGHT_PX,
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
  READER_M3_SETTINGS_SHEET_TITLE_FONT,
  READER_M3_SETTINGS_SHEET_TITLE_FONT_PX,
  READER_M3_SETTINGS_SHEET_TITLE_LINE_HEIGHT_PX,
} from "@/src/features/reader/readerSettingsPanelChrome";

export type M3SettingsSheetTitleProps = {
  title: string;
  subtitle?: string;
  scale?: number;
  style?: ViewStyle;
  titleColor?: string;
  subtitleColor?: string;
};

/** Lora sheet heading — shared across reader/journal settings modals. */
export function M3SettingsSheetTitle({
  title,
  subtitle,
  scale = 1,
  style,
  titleColor = READER_M3_ON_SURFACE,
  subtitleColor = READER_M3_ON_SURFACE_VARIANT,
}: M3SettingsSheetTitleProps) {
  return (
    <View style={[styles.wrap, style]}>
      <Text style={titleStyle(scale, titleColor)}>{title}</Text>
      {subtitle ? <Text style={subtitleStyle(scale, subtitleColor)}>{subtitle}</Text> : null}
    </View>
  );
}

export function m3SettingsSheetTitleStyle(scale: number, color = READER_M3_ON_SURFACE): TextStyle {
  return titleStyle(scale, color);
}

function titleStyle(scale: number, color: string): TextStyle {
  return {
    fontFamily: READER_M3_SETTINGS_SHEET_TITLE_FONT,
    fontSize: READER_M3_SETTINGS_SHEET_TITLE_FONT_PX * scale,
    lineHeight: READER_M3_SETTINGS_SHEET_TITLE_LINE_HEIGHT_PX * scale,
    color,
  };
}

function subtitleStyle(scale: number, color: string): TextStyle {
  return {
    marginTop: 6 * scale,
    fontFamily: "Inter_400Regular",
    fontSize: READER_M3_BODY_FONT_PX * scale * 0.875,
    lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale * 0.875,
    color,
  };
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 8,
  },
});
