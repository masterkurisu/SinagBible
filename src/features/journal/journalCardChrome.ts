import type { ViewStyle } from "react-native";
import {
  isMobileAppDarkThemeId,
  type MobileAppThemeBundle,
} from "@sinag-bible/tokens";

/** M3 expressive elevated card — medium shape (16dp). */
export const JOURNAL_M3_ELEVATED_CARD_RADIUS_PX = 16;

/** M3 elevated card resting shadow elevation (1dp). */
export const JOURNAL_M3_ELEVATED_CARD_ELEVATION_PX = 1;

type CornerRadiiOverride = Pick<
  ViewStyle,
  "borderTopLeftRadius" | "borderBottomLeftRadius" | "borderTopRightRadius" | "borderBottomRightRadius"
>;

function journalM3ElevatedCardShadow(shadowTint: string): ViewStyle {
  return {
    elevation: JOURNAL_M3_ELEVATED_CARD_ELEVATION_PX,
    shadowColor: shadowTint,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 3,
  };
}

/** Container + tonal shadow for M3 expressive elevated journal list cards. */
export function journalM3ElevatedCardStyle(
  bundle: MobileAppThemeBundle,
  cornerRadii?: CornerRadiiOverride | null,
): ViewStyle {
  return {
    backgroundColor: bundle.journal.cardBackground,
    borderRadius: JOURNAL_M3_ELEVATED_CARD_RADIUS_PX,
    overflow: "hidden",
    ...journalM3ElevatedCardShadow(bundle.ui.brown800),
    ...(cornerRadii ?? {}),
  };
}

/** Inverse floating toast — dark on light themes, light gray on dark themes. */
export function journalToastChrome(bundle: MobileAppThemeBundle): {
  backgroundColor: string;
  textColor: string;
  shadowColor: string;
} {
  const isDark = isMobileAppDarkThemeId(bundle.id);
  return {
    backgroundColor: isDark ? bundle.ui.brown900 : bundle.ui.brown800,
    textColor: isDark ? bundle.ui.parchment : bundle.ui.parchmentMid,
    shadowColor: bundle.reader.popoverShadow,
  };
}
