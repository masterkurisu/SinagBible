import type { FlashListRef } from "@shopify/flash-list";
import type { ReaderVerseFlashItem } from "./useReaderGestures";

/** Unified scroll API for line-by-line FlashList and paragraph ScrollView. */
export type ReaderChapterScrollHandle = {
  scrollToOffset: (args: { offset: number; animated?: boolean }) => void;
  /** Present while the FlashList branch is mounted; null on paragraph ScrollView. */
  getFlashListRef?: () => FlashListRef<ReaderVerseFlashItem> | null;
};
