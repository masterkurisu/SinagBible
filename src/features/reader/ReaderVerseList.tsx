import { useCallback, useMemo, type ComponentProps, type ReactNode, type RefObject } from "react";
import { Animated, Pressable, StyleSheet, type GestureResponderHandlers } from "react-native";
import type { ListRenderItemInfo } from "@shopify/flash-list";
import type { BibleVerseInlineItem } from "@sinag-bible/types";
import {
  READER_ACTION_BAR_SELECTION_CLEARANCE_DEFAULT_PX,
  READER_ACTION_BAR_SELECTION_CLEARANCE_HIGHLIGHT_PX,
} from "@/src/features/reader/readerActionBarOnboardingSteps";
import { AnimatedReaderChapterFlashList, type ReaderVerseFlashItem } from "./useReaderGestures";

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
  footerNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 32,
    gap: 12,
  },
  footerNavSpacer: { flex: 1 },
  footerNavButton: {
    flex: 1,
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
});

/** FlashList v2 auto-measures cells; this matches a typical single-line verse row (Lora line + number + padding). */
export function readerVerseEstimatedFlashListItemSizePx(lineHeightPx: number): number {
  return Math.max(48, Math.round(lineHeightPx + 36));
}

function verseFlashInlineAt(
  verseInlineContent: readonly BibleVerseInlineItem[][] | undefined,
  verseIndex: number,
): BibleVerseInlineItem[] | undefined {
  const row = verseInlineContent?.[verseIndex];
  return row && row.length > 0 ? [...row] : undefined;
}

export function buildReaderVerseFlashListData(
  verses: readonly string[],
  twoColumn: boolean,
  splitIndex: number,
  verseInlineContent?: readonly BibleVerseInlineItem[][] | undefined,
): ReaderVerseFlashItem[] {
  if (!twoColumn) {
    return verses.map((text, i) => ({
      kind: "verse" as const,
      verseIndex: i,
      verseText: text,
      verseInlineContent: verseFlashInlineAt(verseInlineContent, i),
    }));
  }
  const leftLen = splitIndex;
  const rightLen = Math.max(0, verses.length - splitIndex);
  const rows = Math.max(leftLen, rightLen);
  const out: ReaderVerseFlashItem[] = [];
  for (let r = 0; r < rows; r++) {
    if (r < leftLen) {
      out.push({
        kind: "verse",
        verseIndex: r,
        verseText: verses[r] ?? "",
        verseInlineContent: verseFlashInlineAt(verseInlineContent, r),
      });
    } else {
      out.push({ kind: "empty", side: "left", row: r });
    }
    if (r < rightLen) {
      const vi = splitIndex + r;
      out.push({
        kind: "verse",
        verseIndex: vi,
        verseText: verses[vi] ?? "",
        verseInlineContent: verseFlashInlineAt(verseInlineContent, vi),
      });
    } else {
      out.push({ kind: "empty", side: "right", row: r });
    }
  }
  return out;
}

/** FlashList row index for a 1-based verse number (handles two-column interleaving). */
export function findFlashListIndexForVerseNumber(
  items: ReaderVerseFlashItem[],
  verseNumber: number,
): number | null {
  const targetIndex = verseNumber - 1;
  const idx = items.findIndex(
    (item) => item.kind === "verse" && item.verseIndex === targetIndex,
  );
  return idx >= 0 ? idx : null;
}

/** Index of first verse in the right column; left column is verse indices [0, index). */
export function splitVerseIndexForBalancedColumns(verses: readonly string[]): number {
  const n = verses.length;
  if (n <= 1) return n;
  let total = 0;
  const lengths = verses.map((v) => v.length);
  for (const l of lengths) total += l;
  if (total === 0) return Math.ceil(n / 2);
  const target = total / 2;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += lengths[i] ?? 0;
    if (acc >= target && i < n - 1) {
      return i + 1;
    }
  }
  return Math.ceil(n / 2);
}

type ReaderVerseListProps = {
  rc: { sceneSurface: string };
  readerScrollRef: RefObject<import("@shopify/flash-list").FlashListRef<ReaderVerseFlashItem> | null>;
  chapterSwipePanHandlers: GestureResponderHandlers;
  readerVerseEstimatedItemSize: number;
  onScroll: NonNullable<ComponentProps<typeof AnimatedReaderChapterFlashList>["onScroll"]>;
  onScrollBeginDrag: () => void;
  onScrollEndDrag?: () => void;
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
  actionBarMode: "default" | "highlight";
  actionBarBottomPx: number;
  tabBarHideProgress?: Animated.Value | null;
  androidListPaddingBottomHidden?: number;
  onListContentSizeChange?: (width: number, height: number) => void;
  onListLayoutHeight?: (height: number) => void;
};

export function ReaderVerseList({
  rc,
  readerScrollRef,
  chapterSwipePanHandlers,
  readerVerseEstimatedItemSize,
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
  actionBarMode,
  actionBarBottomPx,
  tabBarHideProgress,
  androidListPaddingBottomHidden,
  onListContentSizeChange,
  onListLayoutHeight,
}: ReaderVerseListProps) {
  const readerVerseFlashGetItemType = useCallback((item: ReaderVerseFlashItem) => item.kind, []);

  const selectionPaddingBottom =
    actionBarBottomPx +
    (actionBarMode === "highlight"
      ? READER_ACTION_BAR_SELECTION_CLEARANCE_HIGHLIGHT_PX
      : READER_ACTION_BAR_SELECTION_CLEARANCE_DEFAULT_PX);

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
    if (tabBarHideProgress != null && androidListPaddingBottomHidden != null) {
      return {
        flexGrow: 1,
        paddingLeft: 10,
        paddingRight: 15,
        paddingTop: 94,
        paddingBottom: tabBarHideProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [40, androidListPaddingBottomHidden],
        }),
      };
    }
    return {
      flexGrow: 1,
      paddingLeft: 10,
      paddingRight: 15,
      paddingTop: 94,
      paddingBottom: 40,
    };
  }, [
    hasVerseSelection,
    selectionPaddingBottom,
    tabBarHideProgress,
    androidListPaddingBottomHidden,
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

  return (
    <AnimatedReaderChapterFlashList
      key={readerTabletLandscapeTwoColumn ? "reader-verse-2col" : "reader-verse-1col"}
      ref={readerScrollRef}
      {...chapterSwipePanHandlers}
      {...({ estimatedItemSize: readerVerseEstimatedItemSize } as Record<string, unknown>)}
      style={{ ...readerFlashListChromeStyles.list, backgroundColor: rc.sceneSurface }}
      scrollEventThrottle={16}
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
      numColumns={readerTabletLandscapeTwoColumn ? 2 : 1}
      ListHeaderComponent={renderFlashListHeader}
      ListFooterComponent={readerChapterFlashListFooter}
      contentContainerStyle={flashListContentContainerStyle}
    />
  );
}
