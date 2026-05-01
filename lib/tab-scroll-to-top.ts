type ScrollToOffsetLike = {
  scrollToOffset: (args: { offset: number; animated?: boolean }) => void;
};

export type TabKey = "index" | "reader" | "journal" | "search";

const tabScrollRegistry = new Map<TabKey, ScrollToOffsetLike>();

export function registerTabScrollRef(tab: TabKey, ref: ScrollToOffsetLike): () => void {
  tabScrollRegistry.set(tab, ref);
  return () => {
    const current = tabScrollRegistry.get(tab);
    if (current === ref) {
      tabScrollRegistry.delete(tab);
    }
  };
}

export function scrollActiveTabToTop(tab: TabKey): void {
  tabScrollRegistry.get(tab)?.scrollToOffset({ offset: 0, animated: true });
}

