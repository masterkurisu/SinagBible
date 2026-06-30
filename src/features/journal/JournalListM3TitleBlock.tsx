import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import {
  JOURNAL_M3_LARGE_APP_BAR_HEADLINE_FONT_PX,
  JOURNAL_M3_LARGE_APP_BAR_HEADLINE_LINE_HEIGHT_PX,
  JOURNAL_M3_LARGE_APP_BAR_SUBTITLE_FONT_PX,
  JOURNAL_M3_LARGE_APP_BAR_SUBTITLE_LINE_HEIGHT_PX,
  JOURNAL_M3_LARGE_APP_BAR_TITLE_BLOCK_HEIGHT_PX,
  JOURNAL_SUBTITLE_TAGLINE,
} from "@/src/features/journal/journalListChrome";

export type JournalListM3TitleBlockProps = {
  headline?: string;
  subtitle?: string;
};

/** M3 large top app bar title region — headline with supporting subtitle. */
export const JournalListM3TitleBlock = memo(function JournalListM3TitleBlock({
  headline = "Journal",
  subtitle = JOURNAL_SUBTITLE_TAGLINE,
}: JournalListM3TitleBlockProps) {
  const { bundle } = useMobileAppTheme();
  const colors = bundle.ui;
  const j = bundle.journal;

  return (
    <View style={styles.root}>
      <Text
        style={[
          styles.headline,
          {
            color: colors.brown800,
          },
        ]}
        accessibilityRole="header"
      >
        {headline}
      </Text>
      <Text
        style={[
          styles.subtitle,
          {
            color: j.subtitleQuote,
          },
        ]}
        numberOfLines={2}
      >
        {subtitle}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    height: JOURNAL_M3_LARGE_APP_BAR_TITLE_BLOCK_HEIGHT_PX,
    justifyContent: "flex-end",
    paddingBottom: 12,
  },
  headline: {
    fontFamily: "Lora_400Regular",
    fontSize: JOURNAL_M3_LARGE_APP_BAR_HEADLINE_FONT_PX,
    lineHeight: JOURNAL_M3_LARGE_APP_BAR_HEADLINE_LINE_HEIGHT_PX,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: "Inter_400Regular",
    fontSize: JOURNAL_M3_LARGE_APP_BAR_SUBTITLE_FONT_PX,
    lineHeight: JOURNAL_M3_LARGE_APP_BAR_SUBTITLE_LINE_HEIGHT_PX,
  },
});
