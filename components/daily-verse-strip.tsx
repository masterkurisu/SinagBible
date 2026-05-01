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

const CARD_BG = "#FFFFFF";
const VERSE_BODY = "#5A4E3E";
const MUTED = "#9A8E7E";

/** KJV — index by day-of-year for the verse strip (no network). */
export const DAILY_VERSES = [
  {
    ref: "PSALM 119:105",
    text: "Thy word is a lamp unto my feet, and a light unto my path.",
  },
  {
    ref: "PROVERBS 3:5–6",
    text: "Trust in the Lord with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.",
  },
  {
    ref: "ISAIAH 41:10",
    text: "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.",
  },
  {
    ref: "ROMANS 8:28",
    text: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose.",
  },
  {
    ref: "PHILIPPIANS 4:6–7",
    text: "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.",
  },
  {
    ref: "JOSHUA 1:9",
    text: "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the Lord thy God is with thee whithersoever thou goest.",
  },
] as const;

export type DailyVerseEntry = (typeof DAILY_VERSES)[number];

export function dayOfYear(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const y = new Date(Date.UTC(d.getFullYear(), 0, 0));
  return Math.floor((t.getTime() - y.getTime()) / 86400000);
}

export function getDailyVerse(date: Date = new Date()): DailyVerseEntry {
  return DAILY_VERSES[dayOfYear(date) % DAILY_VERSES.length];
}

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
      <Text style={styles.verseRef}>{dailyVerse.ref}</Text>
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
