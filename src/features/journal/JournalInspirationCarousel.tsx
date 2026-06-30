import { memo, useMemo } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from "react-native";
import { FlatList } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";

/** M3 uncontained carousel — large shape (28dp). */
const CAROUSEL_CARD_RADIUS_PX = 28;
const CAROUSEL_GAP_PX = 12;
const CAROUSEL_VERTICAL_PADDING_PX = 16;

type InspirationVerse = {
  id: string;
  reference: string;
  text: string;
  /** Width as a fraction of the screen (multi-aspect ratio). */
  widthRatio: number;
  gradient: readonly [string, string, string];
};

const INSPIRATION_VERSES: InspirationVerse[] = [
  {
    id: "psalm-119-105",
    reference: "Psalm 119:105",
    text: "Your word is a lamp unto my feet and a light unto my path.",
    widthRatio: 0.58,
    gradient: ["#3d3428", "#2c2416", "#1a160f"],
  },
  {
    id: "psalm-1-2",
    reference: "Psalm 1:2",
    text: "But his delight is in the law of the Lord; and in his law doth he meditate day and night.",
    widthRatio: 0.72,
    gradient: ["#5c4f3a", "#4a3826", "#3d3428"],
  },
  {
    id: "joshua-1-8",
    reference: "Joshua 1:8",
    text: "This book of the law shall not depart out of thy mouth; but thou shalt meditate therein day and night.",
    widthRatio: 0.64,
    gradient: ["#6b5540", "#5c4f3a", "#4a3826"],
  },
];

type CarouselCardProps = {
  item: InspirationVerse;
  cardWidth: number;
};

const CarouselCard = memo(function CarouselCard({ item, cardWidth }: CarouselCardProps) {
  const cardHeight = Math.round(cardWidth * 1.12);

  return (
    <View
      style={[
        styles.cardShell,
        {
          width: cardWidth,
          height: cardHeight,
          borderRadius: CAROUSEL_CARD_RADIUS_PX,
        },
      ]}
    >
      <LinearGradient
        colors={[...item.gradient]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.cardGradient, { borderRadius: CAROUSEL_CARD_RADIUS_PX }]}
      >
        <View style={styles.cardContent}>
          <Text style={styles.cardText} numberOfLines={4}>
            {item.text}
          </Text>
          <Text style={styles.cardReference}>{item.reference}</Text>
        </View>
      </LinearGradient>
    </View>
  );
});

export const JournalInspirationCarousel = memo(function JournalInspirationCarousel() {
  const { width: windowWidth } = useWindowDimensions();

  const cardWidths = useMemo(
    () =>
      INSPIRATION_VERSES.map((verse) =>
        Math.round(windowWidth * verse.widthRatio),
      ),
    [windowWidth],
  );

  const snapOffsets = useMemo(() => {
    const offsets: number[] = [0];
    let running = cardWidths[0]! + CAROUSEL_GAP_PX;
    for (let i = 1; i < INSPIRATION_VERSES.length; i++) {
      offsets.push(running);
      running += cardWidths[i]! + CAROUSEL_GAP_PX;
    }
    return offsets;
  }, [cardWidths]);

  const carouselHeight = useMemo(() => {
    const tallestCard = Math.max(...cardWidths.map((w) => Math.round(w * 1.12)));
    return tallestCard + CAROUSEL_VERTICAL_PADDING_PX * 2;
  }, [cardWidths]);

  const renderItem = useMemo<ListRenderItem<InspirationVerse>>(
    () =>
      ({ item, index }) => (
        <CarouselCard item={item} cardWidth={cardWidths[index]!} />
      ),
    [cardWidths],
  );

  const keyExtractor = (item: InspirationVerse) => item.id;

  return (
    <View style={[styles.root, { height: carouselHeight }]}>
      <FlatList
        data={INSPIRATION_VERSES}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToOffsets={snapOffsets}
        snapToAlignment="start"
        disableIntervalMomentum
        nestedScrollEnabled={Platform.OS === "android"}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={CarouselSeparator}
        accessibilityRole="list"
        accessibilityLabel="Inspirational Bible verses"
      />
    </View>
  );
});

const CarouselSeparator = memo(function CarouselSeparator() {
  return <View style={{ width: CAROUSEL_GAP_PX }} />;
});

const styles = StyleSheet.create({
  root: {
    position: "relative",
    marginHorizontal: -16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: CAROUSEL_VERTICAL_PADDING_PX,
  },
  cardShell: {
    overflow: "hidden",
    ...(Platform.OS === "android"
      ? { elevation: 2 }
      : {
          shadowColor: "#2c2416",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.14,
          shadowRadius: 10,
        }),
  },
  cardGradient: {
    flex: 1,
    justifyContent: "flex-end",
  },
  cardContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 28,
  },
  cardText: {
    fontFamily: "Lora_400Regular",
    fontSize: 16,
    lineHeight: 22,
    color: "#f5f2ec",
    fontStyle: "italic",
  },
  cardReference: {
    marginTop: 10,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    lineHeight: 18,
    color: "#e8dcc8",
    letterSpacing: 0.2,
  },
});
