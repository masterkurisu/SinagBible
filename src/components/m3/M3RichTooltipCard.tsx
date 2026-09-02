import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import {
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
  READER_M3_SURFACE_CONTAINER_HIGH,
} from "@/src/features/reader/readerSettingsPanelChrome";

/** M3 expressive rich tooltip — rounded container, title + supporting text + optional footer. */
export type M3RichTooltipCardProps = {
  title: string;
  description: string;
  width?: number;
  height?: number;
  maxHeight?: number;
  descriptionMaxHeight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingRight?: number;
  backgroundColor?: string;
  titleColor?: string;
  descriptionColor?: string;
  borderColor?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function M3RichTooltipCard({
  title,
  description,
  width,
  height,
  maxHeight,
  descriptionMaxHeight,
  paddingTop,
  paddingBottom,
  paddingRight,
  backgroundColor = READER_M3_SURFACE_CONTAINER_HIGH,
  titleColor = READER_M3_ON_SURFACE,
  descriptionColor = READER_M3_ON_SURFACE_VARIANT,
  borderColor,
  children,
  style,
}: M3RichTooltipCardProps) {
  const descriptionText = (
    <Text style={[styles.description, { color: descriptionColor }]}>{description}</Text>
  );

  return (
    <View
      style={[
        styles.card,
        width != null ? { width, maxWidth: width } : null,
        height != null ? { height } : null,
        maxHeight != null ? { maxHeight } : null,
        paddingTop != null ? { paddingTop } : null,
        paddingBottom != null ? { paddingBottom } : null,
        paddingRight != null ? { paddingRight } : null,
        { backgroundColor },
        borderColor ? { borderWidth: 1, borderColor } : null,
        style,
      ]}
    >
      <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      {descriptionMaxHeight != null ? (
        <ScrollView
          style={{ maxHeight: descriptionMaxHeight }}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {descriptionText}
        </ScrollView>
      ) : (
        descriptionText
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    maxWidth: 320,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.15,
  },
  description: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.25,
    marginTop: 4,
    flexShrink: 1,
  },
});
