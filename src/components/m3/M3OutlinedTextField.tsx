import { useCallback, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import {
  M3_EMPHASIZED_ACCELERATE_EASING,
  M3_EMPHASIZED_DECELERATE_EASING,
} from "@/src/components/m3/m3-motion";
import {
  READER_M3_BODY_FONT_PX,
  READER_M3_BODY_LINE_HEIGHT_PX,
  READER_M3_LABEL_FONT_PX,
  READER_M3_LABEL_LETTER_SPACING,
  READER_M3_LABEL_LINE_HEIGHT_PX,
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
} from "@/src/features/reader/readerSettingsPanelChrome";

/** M3 outline stroke — literal used in defaults to avoid Hermes TDZ issues. */
const OUTLINE_STROKE_COLOR = "#79747E";

export const M3_OUTLINE_STROKE = OUTLINE_STROKE_COLOR;

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
  /** Pill-shaped field ends (half the field height). */
  roundedEnds?: boolean;
  /** Subtle outline jiggle when the field receives focus. */
  focusJiggle?: boolean;
  placeholder?: string;
  inputFontFamily?: string;
  style?: ViewStyle;
} & Pick<
  TextInputProps,
  "accessibilityLabel" | "onFocus" | "onBlur" | "returnKeyType" | "onSubmitEditing" | "blurOnSubmit"
>;

/** M3 outlined text field — floating label on the top border. */
export function M3OutlinedTextField({
  label,
  value,
  onChangeText,
  surfaceColor,
  accentColor = OUTLINE_STROKE_COLOR,
  scale = 1,
  multiline = false,
  minHeight = 56,
  maxHeight,
  roundedEnds = false,
  focusJiggle = true,
  placeholder,
  inputFontFamily = "Inter_400Regular",
  style,
  accessibilityLabel,
  onFocus,
  onBlur,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
}: M3OutlinedTextFieldProps) {
  const [focused, setFocused] = useState(false);
  const focusJiggleAnim = useRef(new Animated.Value(0)).current;
  const floated = focused || value.length > 0;
  const borderColor = focused ? accentColor : OUTLINE_STROKE_COLOR;
  const labelColor = focused ? accentColor : READER_M3_ON_SURFACE_VARIANT;
  const fieldMinHeight = minHeight * scale;
  const borderRadius = roundedEnds ? fieldMinHeight / 2 : 4 * scale;
  const placeholderText = placeholder ?? (floated ? undefined : label);

  const playFocusJiggle = useCallback(() => {
    if (!focusJiggle) return;
    focusJiggleAnim.setValue(0);
    Animated.sequence([
      Animated.timing(focusJiggleAnim, {
        toValue: 1,
        duration: 52,
        easing: M3_EMPHASIZED_DECELERATE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(focusJiggleAnim, {
        toValue: -0.82,
        duration: 52,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(focusJiggleAnim, {
        toValue: 0.38,
        duration: 46,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(focusJiggleAnim, {
        toValue: 0,
        duration: 46,
        easing: M3_EMPHASIZED_ACCELERATE_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focusJiggle, focusJiggleAnim]);

  const jiggleTranslateX = focusJiggleAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-2.5 * scale, 0, 2.5 * scale],
  });
  const jiggleRotate = focusJiggleAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-0.55deg", "0deg", "0.55deg"],
  });

  return (
    <View style={[styles.wrap, style]}>
      <Animated.View
        style={[
          styles.field,
          {
            minHeight: fieldMinHeight,
            maxHeight: maxHeight != null ? maxHeight * scale : undefined,
            borderColor,
            borderRadius,
            paddingHorizontal: 16 * scale,
            paddingTop: (floated ? 16 : 12) * scale,
            paddingBottom: 12 * scale,
            transform: [{ translateX: jiggleTranslateX }, { rotate: jiggleRotate }],
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
          placeholder={placeholderText}
          placeholderTextColor={READER_M3_ON_SURFACE_VARIANT}
          textAlignVertical={multiline ? "top" : "center"}
          accessibilityLabel={accessibilityLabel ?? label}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          onFocus={(e) => {
            setFocused(true);
            playFocusJiggle();
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
            fontFamily: inputFontFamily,
            fontSize: READER_M3_BODY_FONT_PX * scale,
            lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale,
            color: READER_M3_ON_SURFACE,
          }}
        />
      </Animated.View>
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
