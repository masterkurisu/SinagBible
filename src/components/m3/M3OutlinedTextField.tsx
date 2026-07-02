import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import {
  READER_M3_BODY_FONT_PX,
  READER_M3_BODY_LINE_HEIGHT_PX,
  READER_M3_LABEL_FONT_PX,
  READER_M3_LABEL_LETTER_SPACING,
  READER_M3_LABEL_LINE_HEIGHT_PX,
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
} from "@/src/features/reader/readerSettingsPanelChrome";

const M3_OUTLINE_STROKE = "#79747E";

export type M3OutlinedTextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Surface behind the floating label notch (match parent card background). */
  surfaceColor: string;
  accentColor?: string;
  scale?: number;
  multiline?: boolean;
  minHeight?: number;
  maxHeight?: number;
  style?: ViewStyle;
} & Pick<TextInputProps, "accessibilityLabel" | "onFocus" | "onBlur">;

/** M3 outlined text field — floating label on the top border. */
export function M3OutlinedTextField({
  label,
  value,
  onChangeText,
  surfaceColor,
  accentColor = M3_OUTLINE_STROKE,
  scale = 1,
  multiline = false,
  minHeight = 56,
  maxHeight,
  style,
  accessibilityLabel,
  onFocus,
  onBlur,
}: M3OutlinedTextFieldProps) {
  const [focused, setFocused] = useState(false);
  const floated = focused || value.length > 0;
  const borderColor = focused ? accentColor : M3_OUTLINE_STROKE;
  const labelColor = focused ? accentColor : READER_M3_ON_SURFACE_VARIANT;
  const fieldMinHeight = minHeight * scale;

  return (
    <View style={[styles.wrap, style]}>
      <View
        style={[
          styles.field,
          {
            minHeight: fieldMinHeight,
            maxHeight: maxHeight != null ? maxHeight * scale : undefined,
            borderColor,
            borderRadius: 4 * scale,
            paddingHorizontal: 16 * scale,
            paddingTop: (floated ? 16 : 12) * scale,
            paddingBottom: 12 * scale,
          },
        ]}
      >
        {floated ? (
          <View
            pointerEvents="none"
            style={[
              styles.labelNotch,
              {
                top: -8 * scale,
                left: 12 * scale,
                paddingHorizontal: 4 * scale,
                backgroundColor: surfaceColor,
              },
            ]}
          >
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: READER_M3_LABEL_FONT_PX * scale,
                lineHeight: READER_M3_LABEL_LINE_HEIGHT_PX * scale,
                letterSpacing: READER_M3_LABEL_LETTER_SPACING,
                color: labelColor,
              }}
            >
              {label}
            </Text>
          </View>
        ) : null}

        <TextInput
          multiline={multiline}
          value={value}
          onChangeText={onChangeText}
          placeholder={floated ? undefined : label}
          placeholderTextColor={READER_M3_ON_SURFACE_VARIANT}
          textAlignVertical={multiline ? "top" : "center"}
          accessibilityLabel={accessibilityLabel ?? label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={{
            minHeight: multiline ? (fieldMinHeight - 28 * scale) : undefined,
            maxHeight: multiline && maxHeight != null ? maxHeight * scale - 28 * scale : undefined,
            padding: 0,
            margin: 0,
            fontFamily: "Inter_400Regular",
            fontSize: READER_M3_BODY_FONT_PX * scale,
            lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale,
            color: READER_M3_ON_SURFACE,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  field: {
    borderWidth: 1,
    justifyContent: "flex-start",
  },
  labelNotch: {
    position: "absolute",
    zIndex: 1,
  },
});
