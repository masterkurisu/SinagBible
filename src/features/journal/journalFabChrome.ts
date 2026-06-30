import { Platform } from "react-native";

/** iOS journal new-entry FAB — gradient circle. */
export const JOURNAL_IOS_FAB_SIZE_PX = 72;

/** M3 expressive medium FAB (80dp). */
export const JOURNAL_M3_FAB_SIZE_PX = 80;

/** M3 FAB resting elevation (6dp). */
export const JOURNAL_M3_FAB_ELEVATION_PX = 6;

/** Gap between the FAB bottom edge and the top of the bottom navigation bar. */
export const JOURNAL_FAB_ABOVE_NAV_BAR_GAP_PX = 20;

export function journalNewEntryFabSizePx(): number {
  return Platform.OS === "android" ? JOURNAL_M3_FAB_SIZE_PX : JOURNAL_IOS_FAB_SIZE_PX;
}

/** Resolved at module load for layout/onboarding anchors. */
export const JOURNAL_NEW_ENTRY_FAB_PX = journalNewEntryFabSizePx();
