import { Platform } from "react-native";
import type { ComponentProps } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { getTabTint } from "@sinag-bible/tokens";

/** M3 Navigation bar: icons only — no text labels under destinations. */
export const ANDROID_NAV_LABEL_VISIBILITY_MODE = "unlabeled" as const;

/** M3 label medium — 12sp, same weight for active and inactive (Expressive spec). */
export const ANDROID_NAV_LABEL_FONT_SIZE = 12;
export const ANDROID_NAV_LABEL_FONT_WEIGHT = "500" as const;

/** M3 navigation bar body height (icon-only row); excludes gesture inset. */
export const ANDROID_NAV_BAR_BODY_PX = 56;

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];
type MaterialCommunityIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export type AndroidNavTabIcon = {
  default: MaterialIconName;
  selected: MaterialIconName;
};

export type IosNavTabIcon = {
  default: MaterialCommunityIconName;
  selected: MaterialCommunityIconName;
};

export type NavTabDefinition = {
  name: "index" | "reader" | "journal";
  label: string;
  tabIndex: number;
  androidIcon: AndroidNavTabIcon;
  iosIcon: IosNavTabIcon;
};

/** Bottom nav lays out one slot per trigger; the FAB overlays the fourth. */
export const BOTTOM_NAV_SLOT_COUNT = 4;

/** Reserved fourth slot for the overlaid search FAB — not a navigable destination. */
export const NAV_SEARCH_FAB_SLOT = {
  name: "search",
  tabIndex: 3,
} as const;

export const NAV_TAB_SF = {
  index: { default: "house", selected: "house.fill" },
  reader: { default: "book.closed", selected: "book.closed.fill" },
  journal: { default: "square.and.pencil", selected: "square.and.pencil" },
} as const;

export const NAV_TAB_DEFINITIONS: readonly NavTabDefinition[] = [
  {
    name: "index",
    label: "Home",
    tabIndex: 0,
    androidIcon: { default: "home", selected: "home-filled" },
    iosIcon: { default: "home-outline", selected: "home" },
  },
  {
    name: "reader",
    label: "Bible",
    tabIndex: 1,
    androidIcon: { default: "menu-book", selected: "menu-book" },
    iosIcon: { default: "book-outline", selected: "book" },
  },
  {
    name: "journal",
    label: "Journal",
    tabIndex: 2,
    androidIcon: { default: "edit-note", selected: "edit-note" },
    iosIcon: { default: "square-edit-outline", selected: "square-edit-outline" },
  },
];

/** M3 uses one primary accent for every tab on Android; iOS keeps per-tab tints when configured. */
export function getNavTabSelectedAccent(
  chrome: MobileAppThemeBundle["chrome"],
  tabIndex: number,
): string {
  if (Platform.OS === "android") return chrome.tabTint;
  return getTabTint(chrome, tabIndex);
}
