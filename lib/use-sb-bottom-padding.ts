import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  nativeTabJournalListPaddingBottomPx,
  nativeTabScrollPaddingBottomPx,
} from "@/lib/native-tab-chrome";

/** Bottom padding for tab scroll content (docked native tab bar). */
export function useSbTabScreenPadding(extraPx = 28): number {
  return nativeTabScrollPaddingBottomPx(extraPx);
}

/** Journal tab list — FAB + native tab bar clearance */
export function useSbJournalTabPadding(): number {
  const { bottom } = useSafeAreaInsets();
  return nativeTabJournalListPaddingBottomPx(bottom);
}
