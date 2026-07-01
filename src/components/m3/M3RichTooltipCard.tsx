import { StyleSheet, Text, View } from "react-native";
import {
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
  READER_M3_SURFACE_CONTAINER_HIGH,
} from "@/src/features/reader/readerSettingsPanelChrome";

/** M3 expressive rich tooltip — rounded container, title + supporting text. */
export type M3RichTooltipCardProps = {
  title: string;
  description: string;
  width?: number;
  backgroundColor?: string;
  titleColor?: string;
  descriptionColor?: string;
};

export function M3RichTooltipCard({
  title,
  description,
  width,
  backgroundColor = READER_M3_SURFACE_CONTAINER_HIGH,
  titleColor = READER_M3_ON_SURFACE,
  descriptionColor = READER_M3_ON_SURFACE_VARIANT,
}: M3RichTooltipCardProps) {
  return (
    <View
      style={[
        styles.card,
        width != null ? { width } : null,
        { backgroundColor },
      ]}
    >
      <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      <Text style={[styles.description, { color: descriptionColor }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
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
  },
});
