/** @deprecated Import from `@/lib/reader-tab-bar-visibility-context` instead. */
export {
  ReaderTabBarVisibilityProvider as ReaderTabBarCoverProvider,
  useSetReaderTabBarCoverFromReaderMenu,
  ReaderTabBarVisibilityProvider,
  useReaderTabBarScrollHidden,
  useReaderTabBarHideProgress,
  useSetReaderTabBarScrollHidden,
} from "@/lib/reader-tab-bar-visibility-context";

/** @deprecated Overlays are rendered by ReaderTabBarVisibilityProvider. */
export function ReaderTabBarSlideCover() {
  return null;
}
