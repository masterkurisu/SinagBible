import { memo, useCallback, useMemo, useRef, useState, type RefObject } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from "react-native";
import { FlatList, Pressable } from "react-native-gesture-handler";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { CarouselDisplayVerse } from "@/lib/journal-carousel-verses";
import { useJournalCarouselVerses } from "@/lib/use-journal-carousel-verses";
import { useCarouselBackgroundUrls } from "@/lib/use-carousel-background-urls";
import {
  copyCarouselCardImage,
  saveCarouselCardImage,
  shareCarouselCardImage,
} from "@/lib/carousel-card-image-actions";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { hapticLightImpact, hapticWarning } from "@/lib/haptics";
import { JournalCarouselCardContextMenu } from "@/src/features/journal/JournalCarouselCardContextMenu";

/** M3 uncontained carousel — large shape (28dp). */
const CAROUSEL_CARD_RADIUS_PX = 28;
const CAROUSEL_GAP_PX = 12;
const CAROUSEL_VERTICAL_PADDING_PX = 16;

type CarouselCardProps = {
  item: CarouselDisplayVerse;
  cardWidth: number;
  imageUrl: string | null;
  captureRef: (node: View | null) => void;
  onLongPress: (item: CarouselDisplayVerse) => void;
};

const CarouselCard = memo(function CarouselCard({
  item,
  cardWidth,
  imageUrl,
  captureRef,
  onLongPress,
}: CarouselCardProps) {
  const cardHeight = Math.round(cardWidth * 1.12);
  const borderRadius = CAROUSEL_CARD_RADIUS_PX;
  const showImage = Boolean(imageUrl);

  return (
    <Pressable
      onLongPress={() => onLongPress(item)}
      delayLongPress={420}
      accessibilityHint="Long press for share and image options"
      style={[
        styles.cardShell,
        {
          width: cardWidth,
          height: cardHeight,
          borderRadius,
        },
      ]}
    >
      <View
        ref={captureRef}
        collapsable={false}
        style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden" }]}
      >
        <LinearGradient
          colors={[...item.gradient]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {showImage ? (
          <Image
            source={{ uri: imageUrl! }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="disk"
            recyclingKey={imageUrl!}
            transition={0}
            accessibilityIgnoresInvertColors
          />
        ) : null}

        <LinearGradient
          colors={["rgba(26,22,15,0.08)", "rgba(26,22,15,0.52)", "rgba(26,22,15,0.82)"]}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.cardContent}>
          {item.badgeLabel ? (
            <Text style={styles.cardBadge}>{item.badgeLabel}</Text>
          ) : null}
          <Text style={styles.cardText} numberOfLines={4}>
            {item.text}
          </Text>
          <Text style={styles.cardReference}>{item.reference}</Text>
        </View>
      </View>
    </Pressable>
  );
});

type MenuState = {
  item: CarouselDisplayVerse;
};

export const JournalInspirationCarousel = memo(function JournalInspirationCarousel() {
  const { width: windowWidth } = useWindowDimensions();
  const { bundle } = useMobileAppTheme();
  const { displayVerses, removeFavorite } = useJournalCarouselVerses();
  const { getImageUrl } = useCarouselBackgroundUrls(displayVerses);
  const listRef = useRef<FlatList<CarouselDisplayVerse> | null>(null);
  const captureRefs = useRef(new Map<string, View>());
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

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

  const setCaptureRef = useCallback((id: string) => {
    return (node: View | null) => {
      if (node) captureRefs.current.set(id, node);
      else captureRefs.current.delete(id);
    };
  }, []);

  const closeMenu = useCallback(() => {
    if (exportBusy) return;
    setMenuState(null);
  }, [exportBusy]);

  const handleLongPress = useCallback((item: CarouselDisplayVerse) => {
    hapticLightImpact();
    setMenuState({ item });
  }, []);

  const captureRefForMenu = useCallback((): RefObject<View | null> => {
    const node = menuState ? captureRefs.current.get(menuState.item.id) ?? null : null;
    return { current: node };
  }, [menuState]);

  const runImageAction = useCallback(
    async (action: (ref: RefObject<View | null>) => Promise<void>) => {
      if (!menuState || exportBusy) return;
      setExportBusy(true);
      try {
        await action(captureRefForMenu());
      } finally {
        setExportBusy(false);
        setMenuState(null);
      }
    },
    [captureRefForMenu, exportBusy, menuState],
  );

  const handleShare = useCallback(() => {
    if (!menuState) return;
    const title = menuState.item.reference;
    void runImageAction(async (ref) => {
      await shareCarouselCardImage(ref, title);
    });
  }, [menuState, runImageAction]);

  const handleSaveImage = useCallback(() => {
    void runImageAction(async (ref) => {
      await saveCarouselCardImage(ref);
    });
  }, [runImageAction]);

  const handleCopyImage = useCallback(() => {
    void runImageAction(async (ref) => {
      await copyCarouselCardImage(ref);
    });
  }, [runImageAction]);

  const handleRemoveFavorite = useCallback(() => {
    if (!menuState?.item.isUserFavorite || menuState.item.isDailyVerse) return;
    const item = menuState.item;
    closeMenu();
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
  }, [closeMenu, menuState, removeFavorite]);

  const renderItem = useMemo<ListRenderItem<CarouselDisplayVerse>>(
    () =>
      ({ item, index }) => (
        <CarouselCard
          item={item}
          cardWidth={cardWidths[index]!}
          imageUrl={getImageUrl(item)}
          captureRef={setCaptureRef(item.id)}
          onLongPress={handleLongPress}
        />
      ),
    [cardWidths, getImageUrl, handleLongPress, setCaptureRef],
  );

  const keyExtractor = (item: CarouselDisplayVerse) => item.id;

  if (displayVerses.length === 0) {
    return null;
  }

  return (
    <>
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

      <JournalCarouselCardContextMenu
        visible={menuState != null}
        item={menuState?.item ?? null}
        busy={exportBusy}
        bundle={bundle}
        onClose={closeMenu}
        onShare={handleShare}
        onSaveImage={handleSaveImage}
        onCopyImage={handleCopyImage}
        onRemoveFavorite={handleRemoveFavorite}
      />
    </>
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
  cardContent: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 28,
  },
  cardBadge: {
    marginBottom: 8,
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    lineHeight: 14,
    color: "#e8dcc8",
    letterSpacing: 1.4,
    textTransform: "uppercase",
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
