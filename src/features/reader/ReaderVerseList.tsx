import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderHandlers,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import type { FlashListRef, ListRenderItemInfo } from "@shopify/flash-list";
import {
  READER_ACTION_BAR_SELECTION_CLEARANCE_DEFAULT_PX,
} from "@/src/features/reader/readerActionBarOnboardingSteps";
import {
  READER_FLASH_LIST_DRAW_DISTANCE_PX,
  READER_SCROLL_EVENT_THROTTLE,
} from "@/lib/device-capability";
import type { ReaderVerseLayout } from "@/src/features/reader/useReaderPreferences";
import type { ReaderChapterScrollHandle } from "@/src/features/reader/readerChapterScrollRef";
import {
  AnimatedReaderChapterFlashList,
  AnimatedReaderChapterScrollView,
  type ReaderVerseFlashItem,
} from "./useReaderGestures";
import {
  findFlashListIndexForVerseNumber,
  readerVerseFlashListColumnProps,
} from "./readerVerseFlashListData";

export {
  buildReaderVerseFlashListData,
  findFlashListIndexForVerseNumber,
  splitVerseIndexForBalancedColumns,
} from "./readerVerseFlashListData";

export const READER_TABLET_TWO_COLUMN_GAP = 18;

/** Static styles for FlashList chrome (header/footer) — avoids NativeWind resolution during scroll. */
export const readerFlashListChromeStyles = StyleSheet.create({
  list: { flex: 1 },
  pageHeading: { marginBottom: 12 },
  pageHeadingTranslation: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  pageHeadingChapter: {
    fontSize: 14,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 2,
  },
});

/** FlashList v2 auto-measures cells; this matches a typical single-line verse row (Lora line + number + padding). */
export function readerVerseEstimatedFlashListItemSizePx(lineHeightPx: number): number {
  return Math.max(48, Math.round(lineHeightPx + 36));
}

/** Place a verse row near the vertical center when opening from search / deep links. */
export function scrollReaderFlashListToVerseCentered(
  listRef: FlashListRef<ReaderVerseFlashItem> | null | undefined,
  items: ReaderVerseFlashItem[],
  verseNumber: number,
  estimatedItemSize: number,
  options?: { animated?: boolean },
): boolean {
  const listIndex = findFlashListIndexForVerseNumber(items, verseNumber);
  if (listIndex == null || listRef == null) return false;

  const animated = options?.animated ?? true;
  const item = items[listIndex];
  const indexInParagraph =
    item?.kind === "paragraph"
      ? Math.max(0, item.verses.findIndex((verse) => verse.verseIndex === verseNumber - 1))
      : 0;
  const viewOffset =
    item?.kind === "paragraph" ? indexInParagraph * estimatedItemSize : 0;
  const viewPosition = item?.kind === "paragraph" ? 0 : 0.5;

  void listRef
    .scrollToIndex({
      index: listIndex,
      animated,
      viewPosition,
      viewOffset: item?.kind === "paragraph" ? -viewOffset : 0,
    })
    .catch(() => {
      const viewportHeight = listRef.getWindowSize().height;
      const itemStart = listIndex * estimatedItemSize;
      const targetY = itemStart + viewOffset;
      const offset = Math.max(0, targetY - viewportHeight / 2 + estimatedItemSize / 2);
      listRef.scrollToOffset({ offset, animated });
    });
  return true;
}

type ReaderVerseListProps = {
  rc: { sceneSurface: string };
  readerScrollRef: RefObject<ReaderChapterScrollHandle | null>;
  verseLayout: ReaderVerseLayout;
  chapterSwipePanHandlers: GestureResponderHandlers;
  readerVerseEstimatedItemSize: number;
  /** Book:chapter:translation — remounts the list when chapter content changes. */
  readerListContentKey: string;
  readerVerseFontSize: number;
  readerVerseLineHeight: number;
  onScroll: NonNullable<ComponentProps<typeof AnimatedReaderChapterFlashList>["onScroll"]>;
  onScrollBeginDrag: () => void;
  onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd?: () => void;
  dismissReaderChromeFromBackgroundPress: () => void;
  verseFlashListDataForList: ReaderVerseFlashItem[];
  renderReaderVerseFlashItem: (info: ListRenderItemInfo<ReaderVerseFlashItem>) => React.ReactElement | null;
  readerVerseFlashKeyExtractor: (item: ReaderVerseFlashItem) => string;
  flashListExtraData: unknown;
  readerTabletLandscapeTwoColumn: boolean;
  /** Paragraph body for single-column ScrollView (selection layer supplies highlighted block). */
  renderParagraphContent?: () => ReactNode;
  listHeader: ReactNode;
  readerChapterFlashListFooter: () => React.ReactElement | null;
  hasVerseSelection: boolean;
  actionBarBottomPx: number;
  onListContentSizeChange?: (width: number, height: number) => void;
  onListLayoutHeight?: (height: number) => void;
  /** Chapter cross-fade — applied on the list shell, not per verse row. */
  readerVersesOpacityAnim?: Animated.Value;
  /**
   * Android FlashList cells paint above a transparent Modal. Unmount the list
   * while the book selector is open so verse text cannot show through the sheet.
   */
  androidHideVerseList?: boolean;
  /** Scroll Y to restore after `androidHideVerseList` turns off. */
  androidRestoreScrollY?: number;
};

export function ReaderVerseList({
  rc,
  readerScrollRef,
  verseLayout,
  chapterSwipePanHandlers,
  readerVerseEstimatedItemSize,
  readerListContentKey,
  readerVerseFontSize,
  readerVerseLineHeight,
  onScroll,
  onScrollBeginDrag,
  onScrollEndDrag,
  onMomentumScrollEnd,
  dismissReaderChromeFromBackgroundPress,
  verseFlashListDataForList,
  renderReaderVerseFlashItem,
  readerVerseFlashKeyExtractor,
  flashListExtraData,
  readerTabletLandscapeTwoColumn,
  renderParagraphContent,
  listHeader,
  readerChapterFlashListFooter,
  hasVerseSelection,
  actionBarBottomPx,
  onListContentSizeChange,
  onListLayoutHeight,
  readerVersesOpacityAnim,
  androidHideVerseList = false,
  androidRestoreScrollY = 0,
}: ReaderVerseListProps) {
  const flashListRef = useRef<FlashListRef<ReaderVerseFlashItem> | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const pendingRestoreYRef = useRef<number | null>(null);
  const wasHiddenRef = useRef(false);

  const useParagraphScrollView = verseLayout === "paragraph";

  useImperativeHandle(
    readerScrollRef,
    (): ReaderChapterScrollHandle => ({
      scrollToOffset: ({ offset, animated = true }) => {
        if (useParagraphScrollView) {
          scrollViewRef.current?.scrollTo({ y: offset, animated });
          return;
        }
        flashListRef.current?.scrollToOffset({ offset, animated });
      },
      getFlashListRef: () => (useParagraphScrollView ? null : flashListRef.current),
    }),
    [useParagraphScrollView],
  );

  useEffect(() => {
    if (androidHideVerseList) {
      wasHiddenRef.current = true;
      pendingRestoreYRef.current = androidRestoreScrollY;
      return;
    }
    if (!wasHiddenRef.current) return;
    wasHiddenRef.current = false;
    const offset = pendingRestoreYRef.current ?? androidRestoreScrollY;
    if (offset <= 0) {
      pendingRestoreYRef.current = null;
      return;
    }
    const frame = requestAnimationFrame(() => {
      readerScrollRef.current?.scrollToOffset({ offset, animated: false });
      pendingRestoreYRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [androidHideVerseList, androidRestoreScrollY, readerScrollRef]);

  const readerVerseFlashGetItemType = useCallback(
    (item: ReaderVerseFlashItem) => {
      if (item.kind === "empty") return "empty";
      if (item.kind === "paragraph") {
        return `paragraph-fs${Math.round(readerVerseFontSize * 10)}-lh${Math.round(readerVerseLineHeight * 10)}`;
      }
      return `verse-fs${Math.round(readerVerseFontSize * 10)}-lh${Math.round(readerVerseLineHeight * 10)}`;
    },
    [readerVerseFontSize, readerVerseLineHeight],
  );

  const readerScrollLayoutKey = useParagraphScrollView
    ? `${readerListContentKey}:paragraph-scroll`
    : readerTabletLandscapeTwoColumn
      ? `${readerListContentKey}:2col-masonry:${verseFlashListDataForList[0]?.kind ?? "verse"}`
      : `${readerListContentKey}:1col:${verseFlashListDataForList[0]?.kind ?? "verse"}`;

  const selectionPaddingBottom =
    actionBarBottomPx + READER_ACTION_BAR_SELECTION_CLEARANCE_DEFAULT_PX;

  const scrollContentContainerStyle = useMemo(() => {
    const base = {
      paddingLeft: 10,
      paddingRight: 15,
      paddingTop: 94,
      paddingBottom: hasVerseSelection ? selectionPaddingBottom : 0,
    };
    if (useParagraphScrollView) {
      // flexGrow on ScrollView content caps scroll extent on some devices — avoid for paragraph.
      return base;
    }
    return {
      flexGrow: 1,
      ...base,
    };
  }, [hasVerseSelection, selectionPaddingBottom, useParagraphScrollView]);

  const listHeaderNode = useMemo(
    () => (
      <Pressable
        onPress={dismissReaderChromeFromBackgroundPress}
        android_ripple={null}
        accessible={false}
      >
        {listHeader}
      </Pressable>
    ),
    [dismissReaderChromeFromBackgroundPress, listHeader],
  );

  const listStyle = useMemo(
    () => ({ ...readerFlashListChromeStyles.list, backgroundColor: rc.sceneSurface }),
    [rc.sceneSurface],
  );

  const columnLayout = readerVerseFlashListColumnProps(readerTabletLandscapeTwoColumn);

  const estimatedItemSize =
    verseFlashListDataForList[0]?.kind === "paragraph"
      ? Math.max(
          readerVerseEstimatedItemSize,
          readerVerseEstimatedItemSize * (verseFlashListDataForList[0].verses.length || 1),
        )
      : readerVerseEstimatedItemSize;

  const paragraphScrollView = (
    <View style={listStyle} {...chapterSwipePanHandlers}>
      <AnimatedReaderChapterScrollView
        key={readerScrollLayoutKey}
        ref={scrollViewRef}
        style={readerFlashListChromeStyles.list}
        scrollEventThrottle={READER_SCROLL_EVENT_THROTTLE}
        onScroll={
          onScroll as NonNullable<ComponentProps<typeof AnimatedReaderChapterScrollView>["onScroll"]>
        }
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onContentSizeChange={onListContentSizeChange}
        onLayout={
          onListLayoutHeight
            ? (event) => onListLayoutHeight(event.nativeEvent.layout.height)
            : undefined
        }
        contentContainerStyle={scrollContentContainerStyle}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator
        nestedScrollEnabled
      >
        {listHeaderNode}
        {renderParagraphContent?.()}
        {readerChapterFlashListFooter()}
      </AnimatedReaderChapterScrollView>
    </View>
  );

  const flashList = (
    <AnimatedReaderChapterFlashList
      key={readerScrollLayoutKey}
      ref={flashListRef}
      {...chapterSwipePanHandlers}
      {...({ estimatedItemSize } as Record<string, unknown>)}
      style={listStyle}
      scrollEventThrottle={READER_SCROLL_EVENT_THROTTLE}
      drawDistance={READER_FLASH_LIST_DRAW_DISTANCE_PX}
      onScroll={onScroll}
      onScrollBeginDrag={onScrollBeginDrag}
      onScrollEndDrag={onScrollEndDrag}
      onMomentumScrollEnd={onMomentumScrollEnd}
      onContentSizeChange={onListContentSizeChange}
      onLayout={
        onListLayoutHeight
          ? (event) => onListLayoutHeight(event.nativeEvent.layout.height)
          : undefined
      }
      data={verseFlashListDataForList}
      renderItem={renderReaderVerseFlashItem}
      keyExtractor={readerVerseFlashKeyExtractor}
      extraData={flashListExtraData}
      getItemType={readerVerseFlashGetItemType}
      numColumns={columnLayout.numColumns}
      masonry={columnLayout.masonry}
      optimizeItemArrangement={columnLayout.optimizeItemArrangement}
      ListHeaderComponent={() => listHeaderNode}
      ListFooterComponent={readerChapterFlashListFooter}
      contentContainerStyle={scrollContentContainerStyle}
    />
  );

  const scrollSurface = useParagraphScrollView ? paragraphScrollView : flashList;

  if (androidHideVerseList) {
    return (
      <View
        style={[readerFlashListChromeStyles.list, { backgroundColor: rc.sceneSurface }]}
        pointerEvents="none"
      />
    );
  }

  if (readerVersesOpacityAnim == null) {
    return scrollSurface;
  }

  return (
    <Animated.View style={[readerFlashListChromeStyles.list, { opacity: readerVersesOpacityAnim }]}>
      {scrollSurface}
    </Animated.View>
  );
}
