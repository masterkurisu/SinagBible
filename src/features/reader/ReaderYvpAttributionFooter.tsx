import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { YvpTranslationAttribution } from "@/lib/yvp-translation-attribution";

export type ReaderYvpAttributionFooterProps = {
  attribution: YvpTranslationAttribution;
  textColor: string;
  linkColor: string;
};

/** Copyright / trademark notice for licensed YVP translations (required when text is shown). */
export function ReaderYvpAttributionFooter({
  attribution,
  textColor,
  linkColor,
}: ReaderYvpAttributionFooterProps) {
  const notice = [attribution.copyrightNotice, attribution.trademarkNotice]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ");

  if (!notice && !attribution.showBiblicaLink) return null;

  return (
    <View style={styles.container}>
      {notice ? (
        <Text style={[styles.notice, { color: textColor }]} selectable>
          {notice}
        </Text>
      ) : null}
      {attribution.showBiblicaLink && attribution.publisherUrl ? (
        <Pressable
          onPress={() => {
            void Linking.openURL(attribution.publisherUrl!);
          }}
          accessibilityRole="link"
          accessibilityLabel="Visit Biblica"
        >
          <Text style={[styles.link, { color: linkColor }]}>Biblica</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  notice: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
  },
  link: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    lineHeight: 18,
    textDecorationLine: "underline",
  },
});
