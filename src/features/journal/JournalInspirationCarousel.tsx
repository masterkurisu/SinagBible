import { memo, useCallback, useMemo, useRef } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import { FlatList, Pressable } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import type { CarouselDisplayVerse } from "@/lib/journal-carousel-verses";
import { useJournalCarouselVerses } from "@/lib/use-journal-carousel-verses";
import { hapticLightImpact, hapticWarning } from "@/lib/haptics";

/** M3 uncontained carousel — large shape (28dp). */
const CAROUSEL_CARD_RADIUS_PX = 28;
const CAROUSEL_GAP_PX = 12;
const CAROUSEL_VERTICAL_PADDING_PX = 16;

type CarouselCardProps = {
  item: CarouselDisplayVerse;
  cardWidth: number;
  onLongPressFavorite?: (item: CarouselDisplayVerse) => void;
};

const CarouselCard = memo(function CarouselCard({
  item,
  cardWidth,
  onLongPressFavorite,
}: CarouselCardProps) {
  const cardHeight = Math.round(cardWidth * 1.12);

  return (
    <Pressable
      onLongPress={
        item.isUserFavorite && onLongPressFavorite
          ? () => onLongPressFavorite(item)
          : undefined
      }
      delayLongPress={420}
      accessibilityHint={
        item.isUserFavorite ? "Long press to remove from carousel favorites" : undefined
      }
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
    </Pressable>
  );
});

export const JournalInspirationCarousel = memo(function JournalInspirationCarousel() {
  const { width: windowWidth } = useWindowDimensions();
  const { displayVerses, reload, removeFavorite } = useJournalCarouselVerses();
  const listRef = useRef<FlatList<CarouselDisplayVerse> | null>(null);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const cardWidths = useMemo(
    () => displayVerses.map((verse) => Math.round(windowWidth * verse.widthRatio)),
    [displayVerses, windowWidth],
  );

  const snapOffsets = useMemo(() => {
    const offsets: number[] = [0];
    let running = cardWidths[0]! + CAROUSEL_GAP_PX;
    for (let i = 1; i < displayVerses.length; i++) {
      offsets.push(running);
      running += cardWidths[i]! + CAROUSEL_GAP_PX;
    }
    return offsets;
  }, [cardWidths, displayVerses.length]);

  const carouselHeight = useMemo(() => {
    if (cardWidths.length === 0) return 0;
    const tallestCard = Math.max(...cardWidths.map((w) => Math.round(w * 1.12)));
    return tallestCard + CAROUSEL_VERTICAL_PADDING_PX * 2;
  }, [cardWidths]);

  const handleRemoveFavorite = useCallback(
    (item: CarouselDisplayVerse) => {
      if (!item.isUserFavorite) return;
      hapticWarning();
      Alert.alert(
        "Remove from carousel?",
        `${item.reference} will be removed from your journal carousel favorites.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => {
              hapticLightImpact();
              void removeFavorite(item.id);
            },
          },
        ],
      );
    },
    [removeFavorite],
  );

  const renderItem = useMemo<ListRenderItem<CarouselDisplayVerse>>(
    () =>
      ({ item, index }) => (
        <CarouselCard
          item={item}
          cardWidth={cardWidths[index]!}
          onLongPressFavorite={handleRemoveFavorite}
        />
      ),
    [cardWidths, handleRemoveFavorite],
  );

  const keyExtractor = (item: CarouselDisplayVerse) => item.id;

  if (displayVerses.length === 0) {
    return null;
  }

  return (
    <View style={[styles.root, { height: carouselHeight }]}>
      <FlatList
        ref={listRef}
        data={displayVerses}
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
