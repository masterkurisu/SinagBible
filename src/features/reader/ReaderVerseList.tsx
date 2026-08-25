import { useCallback, useMemo, type ComponentProps, type ReactNode, type RefObject } from "react";
import { Animated, Pressable, StyleSheet, type GestureResponderHandlers, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import type { FlashListRef, ListRenderItemInfo } from "@shopify/flash-list";
import {
  READER_ACTION_BAR_SELECTION_CLEARANCE_DEFAULT_PX,
} from "@/src/features/reader/readerActionBarOnboardingSteps";
import {
  READER_FLASH_LIST_DRAW_DISTANCE_PX,
  READER_SCROLL_EVENT_THROTTLE,
} from "@/lib/device-capability";
import { AnimatedReaderChapterFlashList, type ReaderVerseFlashItem } from "./useReaderGestures";
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
  readerScrollRef: RefObject<import("@shopify/flash-list").FlashListRef<ReaderVerseFlashItem> | null>;
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
  listHeader: ReactNode;
  readerChapterFlashListFooter: () => React.ReactElement | null;
  hasVerseSelection: boolean;
  actionBarBottomPx: number;
  onListContentSizeChange?: (width: number, height: number) => void;
  onListLayoutHeight?: (height: number) => void;
  /** Chapter cross-fade — applied on the list shell, not per verse row. */
  readerVersesOpacityAnim?: Animated.Value;
};

export function ReaderVerseList({
  rc,
  readerScrollRef,
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
  listHeader,
  readerChapterFlashListFooter,
  hasVerseSelection,
  actionBarBottomPx,
  onListContentSizeChange,
  onListLayoutHeight,
  readerVersesOpacityAnim,
}: ReaderVerseListProps) {
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

  const readerFlashListLayoutKey = readerTabletLandscapeTwoColumn
    ? `${readerListContentKey}:2col-masonry:${verseFlashListDataForList[0]?.kind ?? "verse"}`
    : `${readerListContentKey}:1col:${verseFlashListDataForList[0]?.kind ?? "verse"}`;

  const selectionPaddingBottom =
    actionBarBottomPx + READER_ACTION_BAR_SELECTION_CLEARANCE_DEFAULT_PX;

  const flashListContentContainerStyle = useMemo(() => {
    if (hasVerseSelection) {
      return {
        flexGrow: 1,
        paddingLeft: 10,
        paddingRight: 15,
        paddingTop: 94,
        paddingBottom: selectionPaddingBottom,
      };
    }
    return {
      flexGrow: 1,
      paddingLeft: 10,
      paddingRight: 15,
      paddingTop: 94,
      paddingBottom: 0,
    };
  }, [
    hasVerseSelection,
    selectionPaddingBottom,
  ]);

  const renderFlashListHeader = useCallback(
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

  const flashList = (
    <AnimatedReaderChapterFlashList
      key={readerFlashListLayoutKey}
      ref={readerScrollRef}
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
      ListHeaderComponent={renderFlashListHeader}
      ListFooterComponent={readerChapterFlashListFooter}
      contentContainerStyle={flashListContentContainerStyle}
    />
  );

  if (readerVersesOpacityAnim == null) {
    return flashList;
  }

  return (
    <Animated.View style={[readerFlashListChromeStyles.list, { opacity: readerVersesOpacityAnim }]}>
      {flashList}
    </Animated.View>
  );
}
