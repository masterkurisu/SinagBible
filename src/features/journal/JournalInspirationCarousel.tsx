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
import { LinearGradient } from "expo-linear-gradient";
import { CarouselBackgroundImage } from "@/lib/carousel-background-image";
import type { CarouselImageTheme } from "@/lib/carousel-image-themes";
import {
  isCarouselLightBackgroundTheme,
  usesCarouselPhotoBackground,
} from "@/lib/carousel-image-themes";
import type { CarouselDisplayVerse } from "@/lib/journal-carousel-verses";
import { getCarouselCardGradient } from "@/lib/journal-carousel-verses";
import { useJournalCarouselVerses } from "@/lib/use-journal-carousel-verses";
import {
  getEffectiveCarouselCardSize,
  getCarouselCardSizeWithoutOverride,
  getCarouselSizingBaseWidth,
  hasCarouselCardSizeOverride,
  patchCarouselCardSize,
  removeCarouselCardSize,
  type CarouselCardSize,
} from "@/lib/journal-carousel-card-sizes";
import { useCarouselBackgroundUrls } from "@/lib/use-carousel-background-urls";
import { requestCarouselCardImageRefresh } from "@/lib/pexels-repository";
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
  cardIndex: number;
  cardWidth: number;
  imageUrl: string | null;
  imageTheme: CarouselImageTheme;
  captureRef: (node: View | null) => void;
  onLongPress: (item: CarouselDisplayVerse) => void;
};

const CarouselCard = memo(function CarouselCard({
  item,
  cardIndex,
  cardWidth,
  imageUrl,
  imageTheme,
  captureRef,
  onLongPress,
}: CarouselCardProps) {
  const cardHeight = Math.round(cardWidth * 1.12);
  const borderRadius = CAROUSEL_CARD_RADIUS_PX;
  const isLightBackground = isCarouselLightBackgroundTheme(imageTheme);
  const showImage =
    Boolean(imageUrl) &&
    imageTheme !== "gradient" &&
    imageTheme !== "light-gradient" &&
    imageTheme !== "simple";
  const showSolidBackground = imageTheme === "simple";
  const cardGradient = useMemo(
    () => getCarouselCardGradient(item.id, cardIndex, imageTheme, item.gradient),
    [cardIndex, imageTheme, item.gradient, item.id],
  );
  const solidColor = cardGradient[1];
  const cardStyle = useMemo(
    () => [styles.cardShell, { width: cardWidth, height: cardHeight, borderRadius }],
    [borderRadius, cardHeight, cardWidth],
  );
  const hairlineStyle = useMemo(
    () => [styles.cardHairline, { borderRadius }],
    [borderRadius],
  );

  return (
    <View ref={captureRef} collapsable={false} style={cardStyle}>
      <Pressable
        onLongPress={() => onLongPress(item)}
        delayLongPress={420}
        accessibilityHint="Long press for share, image, refresh, and size options"
        style={StyleSheet.absoluteFill}
      >
        {showSolidBackground ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: solidColor }]} />
        ) : (
          <LinearGradient
            colors={[...cardGradient]}
            locations={[0, 0.45, 1]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        {showImage ? (
          <CarouselBackgroundImage uri={imageUrl!} recyclingKey={imageUrl!} />
        ) : null}

        {isLightBackground ? null : (
          <LinearGradient
            colors={["rgba(26,22,15,0.08)", "rgba(26,22,15,0.52)", "rgba(26,22,15,0.82)"]}
            locations={[0, 0.45, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        <View style={styles.cardContent}>
          {item.badgeLabel ? (
            <Text style={isLightBackground ? styles.cardBadgeLight : styles.cardBadge}>
              {item.badgeLabel}
            </Text>
          ) : null}
          <Text
            style={isLightBackground ? styles.cardTextLight : styles.cardText}
            numberOfLines={4}
          >
            {item.text}
          </Text>
          <Text style={isLightBackground ? styles.cardReferenceLight : styles.cardReference}>
            {item.reference}
          </Text>
        </View>
      </Pressable>

      <View pointerEvents="none" style={hairlineStyle} />
    </View>
  );
});

type MenuState = {
  item: CarouselDisplayVerse;
};

export const JournalInspirationCarousel = memo(function JournalInspirationCarousel() {
  const { width: windowWidth } = useWindowDimensions();
  const { bundle } = useMobileAppTheme();
  const { displayVerses, settings, cardSizeOverrides, removeFavorite } = useJournalCarouselVerses();
  const { getImageUrl, imageTheme } = useCarouselBackgroundUrls(displayVerses);
  const listRef = useRef<FlatList<CarouselDisplayVerse> | null>(null);
  const captureRefs = useRef(new Map<string, View>());
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  const sizingBaseWidth = useMemo(() => getCarouselSizingBaseWidth(windowWidth), [windowWidth]);

  const cardWidths = useMemo(
    () => displayVerses.map((verse) => Math.round(sizingBaseWidth * verse.widthRatio)),
    [displayVerses, sizingBaseWidth],
  );

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

  const handleRefreshImage = useCallback(() => {
    if (!menuState) return;
    const item = menuState.item;
    closeMenu();
    hapticLightImpact();
    void requestCarouselCardImageRefresh(
      { id: item.id, imageCategory: item.imageCategory },
      imageTheme,
    );
  }, [closeMenu, imageTheme, menuState]);

  const menuCardIndex = useMemo(() => {
    if (!menuState) return -1;
    return displayVerses.findIndex((verse) => verse.id === menuState.item.id);
  }, [displayVerses, menuState]);

  const menuCardSize = useMemo((): CarouselCardSize | null => {
    if (!menuState || menuCardIndex < 0) return null;
    return getEffectiveCarouselCardSize(
      menuState.item.id,
      menuCardIndex,
      cardSizeOverrides,
      settings.defaultCardSize,
    );
  }, [cardSizeOverrides, menuCardIndex, menuState, settings.defaultCardSize]);

  const menuHasCardSizeOverride = useMemo(() => {
    if (!menuState) return false;
    return hasCarouselCardSizeOverride(menuState.item.id, cardSizeOverrides);
  }, [cardSizeOverrides, menuState]);

  const handleSelectCardSize = useCallback(
    (size: CarouselCardSize) => {
      if (!menuState) return;
      const item = menuState.item;
      const cardIndex = displayVerses.findIndex((verse) => verse.id === item.id);
      if (cardIndex < 0) return;
      closeMenu();
      hapticLightImpact();

      const defaultSize = getCarouselCardSizeWithoutOverride(
        item.id,
        cardIndex,
        settings.defaultCardSize,
      );

      if (size === defaultSize) {
        if (hasCarouselCardSizeOverride(item.id, cardSizeOverrides)) {
          void removeCarouselCardSize(item.id);
        }
        return;
      }

      void patchCarouselCardSize(item.id, size);
    },
    [cardSizeOverrides, closeMenu, displayVerses, menuState, settings.defaultCardSize],
  );

  const handleResetCardSize = useCallback(() => {
    if (!menuState) return;
    const item = menuState.item;
    closeMenu();
    hapticLightImpact();
    void removeCarouselCardSize(item.id);
  }, [closeMenu, menuState]);

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

  const carouselSizingKey = useMemo(
    () =>
      `${settings.defaultCardSize}:${Object.keys(cardSizeOverrides)
        .sort()
        .map((id) => `${id}=${cardSizeOverrides[id]}`)
        .join(",")}`,
    [cardSizeOverrides, settings.defaultCardSize],
  );

  const renderItem = useMemo<ListRenderItem<CarouselDisplayVerse>>(
    () =>
      ({ item, index }) => (
        <CarouselCard
          item={item}
          cardIndex={index}
          cardWidth={cardWidths[index]!}
          imageUrl={getImageUrl(item)}
          imageTheme={imageTheme}
          captureRef={setCaptureRef(item.id)}
          onLongPress={handleLongPress}
        />
      ),
    [cardWidths, getImageUrl, handleLongPress, imageTheme, setCaptureRef],
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
          extraData={carouselSizingKey}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="normal"
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
        showRefreshImage={usesCarouselPhotoBackground(imageTheme)}
        onClose={closeMenu}
        onShare={handleShare}
        onSaveImage={handleSaveImage}
        onCopyImage={handleCopyImage}
        onRefreshImage={handleRefreshImage}
        cardSize={menuCardSize}
        hasCardSizeOverride={menuHasCardSizeOverride}
        onSelectCardSize={handleSelectCardSize}
        onResetCardSize={handleResetCardSize}
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
    borderCurve: "continuous",
  },
  cardHairline: {
    ...StyleSheet.absoluteFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.20)",
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
  cardBadgeLight: {
    marginBottom: 8,
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    lineHeight: 14,
    color: "#5c4a32",
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
  cardTextLight: {
    fontFamily: "Lora_400Regular",
    fontSize: 16,
    lineHeight: 22,
    color: "#2c2416",
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
  cardReferenceLight: {
    marginTop: 10,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    lineHeight: 18,
    color: "#5c4a32",
    letterSpacing: 0.2,
  },
});
