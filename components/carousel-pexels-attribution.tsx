import { Linking, StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";

const PEXELS_URL = "https://www.pexels.com";
const PEXELS_LICENSE_URL = "https://www.pexels.com/license/";

type CarouselPexelsAttributionProps = {
  style?: StyleProp<TextStyle>;
};

export function CarouselPexelsAttribution({ style }: CarouselPexelsAttributionProps) {
  return (
    <Text style={[styles.body, style]} accessibilityRole="text">
      This app uses photos from{" "}
      <Text
        style={styles.link}
        onPress={() => void Linking.openURL(PEXELS_URL)}
        accessibilityRole="link"
        accessibilityLabel="Pexels website"
      >
        Pexels
      </Text>{" "}
      (
      <Text
        style={styles.link}
        onPress={() => void Linking.openURL(PEXELS_URL)}
        accessibilityRole="link"
        accessibilityLabel="pexels.com"
      >
        pexels.com
      </Text>
      ). Pexels provides free stock photos licensed under the{" "}
      <Text
        style={styles.link}
        onPress={() => void Linking.openURL(PEXELS_LICENSE_URL)}
        accessibilityRole="link"
        accessibilityLabel="Pexels License"
      >
        Pexels License
      </Text>
      .
    </Text>
  );
}

const styles = StyleSheet.create({
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 24,
    color: "#3d3428",
  },
  link: {
    fontFamily: "Inter_500Medium",
    textDecorationLine: "underline",
    color: "#3d3428",
  },
});
