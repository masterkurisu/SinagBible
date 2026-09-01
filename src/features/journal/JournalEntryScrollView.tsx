import { useCallback, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, { useSharedValue } from "react-native-reanimated";
import { FlashList, type FlashListRef, type ListRenderItemInfo } from "@shopify/flash-list";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { UpCircleIcon } from "@/components/icons/UpCircleIcon";
import { formatJournalTagLabel } from "@/lib/journal-tags";
import { READER_FLASH_LIST_DRAW_DISTANCE_PX } from "@/lib/device-capability";
import {
  AnimatedHighRefreshScrollView,
  SCROLL_EVENT_THROTTLE,
  useHighRefreshScrollHandler,
} from "@/lib/high-refresh-scroll";
import { JournalSavedReflectionBlock } from "@/src/features/journal/JournalSavedReflectionBlock";
import {
  splitSavedReflectionHtml,
  shouldVirtualizeJournalReflection,
  type SavedReflectionBlock,
} from "@/src/features/journal/journalSavedReflectionBlocks";
import { useJournalDetailScrollToTopFab } from "@/src/features/journal/useJournalDetailScrollToTopFab";

const JOURNAL_TITLE_BOTTOM_MARGIN_PX = 10;
const JOURNAL_DATE_BOTTOM_MARGIN_PX = 10;
const JOURNAL_PASSAGE_LABEL_BOTTOM_MARGIN_PX = 5;
const JOURNAL_PASSAGE_REF_BOTTOM_MARGIN_PX = 5;
/** Italic 16/24 passage block — reserved so late `verseText` does not grow the document under the finger. */
export const JOURNAL_VERSE_TEXT_FONT_SIZE_PX = 16;
export const JOURNAL_VERSE_TEXT_LINE_HEIGHT_PX = 24;
const JOURNAL_VERSE_TEXT_BOTTOM_MARGIN_PX = 32;
const JOURNAL_REFLECTION_ESTIMATED_ITEM_SIZE_PX = 72;

const AnimatedJournalReflectionFlashList = Animated.createAnimatedComponent(
  FlashList,
) as typeof FlashList<SavedReflectionBlock>;

export type JournalEntryScrollViewProps = {
  title: string;
  dateLine: string;
  tags: readonly string[] | null | undefined;
  passageLine: { refBold: string } | null;
  bibleTranslationDisplay: string;
  hasBibleTranslation: boolean;
  verseText: string | null;
  /** True when a passage exists so the 16/24 verse slot stays reserved while text loads. */
  reserveVerseSlot: boolean;
  contentHtml: string | null | undefined;
  capturePass: boolean;
  shareCaptureRef: RefObject<View | null>;
  onCaptureTreeReady?: () => void;
  colors: { brown800: string; gold: string; tan200: string };
  pageBackgroundColor: string;
  bundle: MobileAppThemeBundle;
  /** Live reader translation for chip tooltips (not the entry's stored version). */
  activeTranslationId: string;
};

function JournalEntryHeader({
  title,
  dateLine,
  tags,
  passageLine,
  bibleTranslationDisplay,
  hasBibleTranslation,
  verseText,
  reserveVerseSlot,
  colors,
}: {
  title: string;
  dateLine: string;
  tags: readonly string[] | null | undefined;
  passageLine: { refBold: string } | null;
  bibleTranslationDisplay: string;
  hasBibleTranslation: boolean;
  verseText: string | null;
  reserveVerseSlot: boolean;
  colors: { brown800: string; gold: string; tan200: string };
}) {
  const showPassage = passageLine != null || verseText != null || reserveVerseSlot;
  return (
    <>
      {title ? (
        <Text style={[styles.title, { color: colors.brown800 }]}>{title}</Text>
      ) : null}
      {dateLine ? (
        <Text style={[styles.date, { color: colors.tan200 }]}>{dateLine}</Text>
      ) : null}
      {tags && tags.length > 0 ? (
        <View style={styles.tagsRow}>
          {tags.map((tag) => (
            <View key={tag} style={[styles.tagChip, { borderColor: colors.tan200 }]}>
              <Text style={[styles.tagLabel, { color: colors.tan200 }]}>
                {formatJournalTagLabel(tag)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {showPassage ? (
        <>
          <Text style={[styles.sectionLabel, { color: colors.gold }]}>Passage</Text>
          {passageLine ? (
            <Text style={[styles.passageRef, { color: colors.brown800 }]}>
              <Text style={styles.passageRefBold}>{passageLine.refBold}</Text>
              {hasBibleTranslation ? ` (${bibleTranslationDisplay})` : ""}
            </Text>
          ) : null}
          <View
            style={[
              styles.verseSlot,
              !verseText ? { minHeight: JOURNAL_VERSE_TEXT_LINE_HEIGHT_PX } : null,
            ]}
          >
            {verseText ? (
              <Text style={[styles.verseText, { color: colors.brown800 }]}>{verseText}</Text>
            ) : null}
          </View>
        </>
      ) : null}
      <Text style={[styles.reflectionLabel, { color: colors.gold }]}>Reflection</Text>
    </>
  );
}

function JournalEntryCaptureDocument({
  header,
  blocks,
  bodyColor,
  linkColor,
  bundle,
  translationId,
  captureRef,
  collapsable,
  backgroundColor,
}: {
  header: ReactNode;
  blocks: SavedReflectionBlock[];
  bodyColor: string;
  linkColor: string;
  bundle: MobileAppThemeBundle;
  translationId: string;
  captureRef: RefObject<View | null>;
  collapsable?: boolean;
  backgroundColor: string;
}) {
  return (
    <View
      ref={captureRef}
      collapsable={collapsable}
      style={[styles.capture, { backgroundColor }]}
    >
      {header}
      {blocks.map((block) => (
        <JournalSavedReflectionBlock
          key={block.key}
          block={block}
          bodyColor={bodyColor}
          linkColor={linkColor}
          bundle={bundle}
          translationId={translationId}
        />
      ))}
    </View>
  );
}

export function JournalEntryScrollView({
  title,
  dateLine,
  tags,
  passageLine,
  bibleTranslationDisplay,
  hasBibleTranslation,
  verseText,
  reserveVerseSlot,
  contentHtml,
  capturePass,
  shareCaptureRef,
  onCaptureTreeReady,
  colors,
  pageBackgroundColor,
  bundle,
  activeTranslationId,
}: JournalEntryScrollViewProps) {
  const { width: screenW } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const flashListRef = useRef<FlashListRef<SavedReflectionBlock>>(null);
  const scrollY = useSharedValue(0);
  const onScroll = useHighRefreshScrollHandler({ scrollY });
  const {
    fabAnimatedStyle,
    pointerEventsEnabled,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
    notifyScrolledToTop,
  } = useJournalDetailScrollToTopFab(scrollY);

  const reflectionBlocks = useMemo(() => {
    try {
      return splitSavedReflectionHtml(contentHtml);
    } catch {
      const raw = typeof contentHtml === "string" ? contentHtml : "";
      return [{ key: "fallback", kind: "fallback" as const, html: raw }];
    }
  }, [contentHtml]);

  const contentLength = typeof contentHtml === "string" ? contentHtml.length : 0;
  const shouldVirtualize = shouldVirtualizeJournalReflection(
    reflectionBlocks.length,
    contentLength,
  );

  const header = useMemo(
    () => (
      <JournalEntryHeader
        title={title}
        dateLine={dateLine}
        tags={tags}
        passageLine={passageLine}
        bibleTranslationDisplay={bibleTranslationDisplay}
        hasBibleTranslation={hasBibleTranslation}
        verseText={verseText}
        reserveVerseSlot={reserveVerseSlot}
        colors={colors}
      />
    ),
    [
      title,
      dateLine,
      tags,
      passageLine,
      bibleTranslationDisplay,
      hasBibleTranslation,
      verseText,
      reserveVerseSlot,
      colors,
    ],
  );

  const listHeader = useMemo(
    () => <View style={styles.flashHeader}>{header}</View>,
    [header],
  );

  useLayoutEffect(() => {
    if (!capturePass) return;
    onCaptureTreeReady?.();
  }, [capturePass, onCaptureTreeReady, reflectionBlocks, verseText]);

  const renderBlock = useCallback(
    ({ item }: ListRenderItemInfo<SavedReflectionBlock>) => (
      <JournalSavedReflectionBlock
        block={item}
        bodyColor={colors.brown800}
        linkColor={colors.gold}
        bundle={bundle}
        translationId={activeTranslationId}
      />
    ),
    [colors.brown800, colors.gold, bundle, activeTranslationId],
  );

  const scrollToTop = useCallback(() => {
    flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    notifyScrolledToTop();
  }, [notifyScrolledToTop]);

  const onEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScrollEndDrag(event);
    },
    [onScrollEndDrag],
  );

  const listStyle = useMemo(
    () => ({ ...styles.scroll, backgroundColor: pageBackgroundColor }),
    [pageBackgroundColor],
  );

  return (
    <View style={styles.host}>
      {shouldVirtualize ? (
        <AnimatedJournalReflectionFlashList
          ref={flashListRef}
          style={listStyle}
          contentContainerStyle={styles.flashContent}
          data={reflectionBlocks}
          renderItem={renderBlock}
          keyExtractor={(item) => item.key}
          ListHeaderComponent={listHeader}
          {...({ estimatedItemSize: JOURNAL_REFLECTION_ESTIMATED_ITEM_SIZE_PX } as Record<
            string,
            unknown
          >)}
          drawDistance={READER_FLASH_LIST_DRAW_DISTANCE_PX}
          scrollEventThrottle={SCROLL_EVENT_THROTTLE}
          onScroll={onScroll}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onEndDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
          removeClippedSubviews={false}
          showsVerticalScrollIndicator
        />
      ) : (
        <AnimatedHighRefreshScrollView
          ref={scrollRef}
          style={listStyle}
          contentContainerStyle={styles.scrollContent}
          scrollEventThrottle={SCROLL_EVENT_THROTTLE}
          onScroll={onScroll}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onEndDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
          showsVerticalScrollIndicator
        >
          <JournalEntryCaptureDocument
            header={header}
            blocks={reflectionBlocks}
            bodyColor={colors.brown800}
            linkColor={colors.gold}
            bundle={bundle}
            translationId={activeTranslationId}
            captureRef={shareCaptureRef}
            collapsable={capturePass ? false : undefined}
            backgroundColor={pageBackgroundColor}
          />
        </AnimatedHighRefreshScrollView>
      )}

      {capturePass && shouldVirtualize ? (
        <View
          pointerEvents="none"
          style={[styles.offscreenCapture, { width: screenW }]}
        >
          <JournalEntryCaptureDocument
            header={header}
            blocks={reflectionBlocks}
            bodyColor={colors.brown800}
            linkColor={colors.gold}
            bundle={bundle}
            translationId={activeTranslationId}
            captureRef={shareCaptureRef}
            collapsable={false}
            backgroundColor={pageBackgroundColor}
          />
        </View>
      ) : null}

      <Animated.View
        pointerEvents={pointerEventsEnabled ? "auto" : "none"}
        style={[styles.scrollToTopSlot, fabAnimatedStyle]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back to top"
          onPress={scrollToTop}
          activeOpacity={0.85}
          style={styles.scrollToTopHit}
        >
          <UpCircleIcon size={29} color={colors.brown800} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 4,
    paddingBottom: 144,
  },
  flashContent: {
    paddingTop: 4,
    paddingBottom: 144,
    paddingHorizontal: 20,
  },
  flashHeader: {
    paddingTop: 20,
  },
  capture: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    marginBottom: 4,
  },
  offscreenCapture: {
    position: "absolute",
    left: 0,
    top: 0,
    opacity: 0.02,
    zIndex: -1,
  },
  title: {
    fontFamily: "Lora_400Regular",
    marginBottom: JOURNAL_TITLE_BOTTOM_MARGIN_PX,
    fontSize: 36,
    lineHeight: 42,
  },
  date: {
    fontFamily: "Inter_400Regular",
    marginBottom: JOURNAL_DATE_BOTTOM_MARGIN_PX,
    fontSize: 14,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  tagChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  sectionLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: JOURNAL_PASSAGE_LABEL_BOTTOM_MARGIN_PX,
  },
  passageRef: {
    fontFamily: "Lora_400Regular",
    fontWeight: "500",
    marginBottom: JOURNAL_PASSAGE_REF_BOTTOM_MARGIN_PX,
    fontSize: 17,
    lineHeight: 28,
  },
  passageRefBold: {
    fontFamily: "Lora_700Bold",
  },
  verseSlot: {
    marginBottom: JOURNAL_VERSE_TEXT_BOTTOM_MARGIN_PX,
  },
  verseText: {
    fontFamily: "Lora_400Regular_Italic",
    fontSize: JOURNAL_VERSE_TEXT_FONT_SIZE_PX,
    lineHeight: JOURNAL_VERSE_TEXT_LINE_HEIGHT_PX,
  },
  reflectionLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  scrollToTopSlot: {
    position: "absolute",
    bottom: 92,
    right: 24,
    zIndex: 10,
  },
  scrollToTopHit: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
});
