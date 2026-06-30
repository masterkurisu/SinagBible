/**
 * Rotating KJV verse by day-of-year (no network). Extracted from Search for reuse.
 * Import `DailyVerseStrip` for the UI, or `getDailyVerse` / `DAILY_VERSES` for data only.
 */
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  useFonts,
  Inter_500Medium,
} from "@expo-google-fonts/inter";
import { Lora_400Regular_Italic } from "@expo-google-fonts/lora";
import { getDailyVerse } from "@/lib/daily-verse";

const CARD_BG = "#FFFFFF";
const VERSE_BODY = "#5A4E3E";
const MUTED = "#9A8E7E";

export { DAILY_VERSES, dayOfYear, formatDailyVerseReference, getDailyVerse } from "@/lib/daily-verse";
export type { DailyVerseEntry } from "@/lib/daily-verse";

export function DailyVerseStrip() {
  const [fontsLoaded] = useFonts({
    Inter_500Medium,
    Lora_400Regular_Italic,
  });

  const dailyVerse = useMemo(() => getDailyVerse(new Date()), []);

  if (!fontsLoaded) {
    return <View style={styles.verseStrip} />;
  }

  return (
    <View style={styles.verseStrip}>
      <Text style={styles.verseBody}>{dailyVerse.text}</Text>
      <Text style={styles.verseRef}>{dailyVerse.reference}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  verseStrip: {
    marginBottom: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    overflow: "hidden",
  },
  verseBody: {
    fontFamily: "Lora_400Regular_Italic",
    fontSize: 13,
    lineHeight: 21.45,
    color: VERSE_BODY,
  },
  verseRef: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: MUTED,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 8,
  },
});
