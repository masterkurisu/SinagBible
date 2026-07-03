import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import { useReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import {
  READER_M3_BODY_FONT_PX,
  READER_M3_BODY_LINE_HEIGHT_PX,
  READER_M3_SETTINGS_SHEET_TITLE_FONT,
  READER_M3_SETTINGS_SHEET_TITLE_FONT_PX,
  READER_M3_SETTINGS_SHEET_TITLE_LINE_HEIGHT_PX,
} from "@/src/features/reader/readerSettingsPanelChrome";

export type M3SettingsSheetTitleProps = {
  title: string;
  subtitle?: string;
  subtitleBold?: boolean;
  scale?: number;
  style?: ViewStyle;
  titleColor?: string;
  subtitleColor?: string;
};

/** Lora sheet heading — shared across reader/journal settings modals. */
export function M3SettingsSheetTitle({
  title,
  subtitle,
  subtitleBold = false,
  scale = 1,
  style,
  titleColor,
  subtitleColor,
}: M3SettingsSheetTitleProps) {
  const sheetChrome = useReaderSheetChrome();
  const resolvedTitleColor = titleColor ?? sheetChrome.onSurface;
  const resolvedSubtitleColor = subtitleColor ?? sheetChrome.onSurfaceVariant;

  return (
    <View style={[styles.wrap, style]}>
      <Text style={titleStyle(scale, resolvedTitleColor)}>{title}</Text>
      {subtitle ? (
        <Text style={subtitleStyle(scale, resolvedSubtitleColor, subtitleBold)}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function m3SettingsSheetTitleStyle(scale: number, color?: string): TextStyle {
  return titleStyle(scale, color ?? "#1C1B1F");
}

function titleStyle(scale: number, color: string): TextStyle {
  return {
    fontFamily: READER_M3_SETTINGS_SHEET_TITLE_FONT,
    fontSize: READER_M3_SETTINGS_SHEET_TITLE_FONT_PX * scale,
    lineHeight: READER_M3_SETTINGS_SHEET_TITLE_LINE_HEIGHT_PX * scale,
    color,
  };
}

function subtitleStyle(scale: number, color: string, bold: boolean): TextStyle {
  return {
    marginTop: 6 * scale,
    fontFamily: bold ? "Inter_600SemiBold" : "Inter_400Regular",
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
