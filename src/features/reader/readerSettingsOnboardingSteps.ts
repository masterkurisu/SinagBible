import { Platform } from "react-native";

export type ReaderSettingsTooltipId =
  | "translation"
  | "study-notes"
  | "font-settings"
  | "themes"
  | "verse-carousel"
  | "more"
  | "delete-my-data";

export type ReaderSettingsTooltipContent = {
  id: ReaderSettingsTooltipId;
  title: string;
  description: string;
};

export const READER_SETTINGS_TOOLTIPS: ReaderSettingsTooltipContent[] = [
  {
    id: "translation",
    title: "Translation",
    description: "Switch between 1,000+ Bible versions in many languages.",
  },
  {
    id: "study-notes",
    title: "Study Notes",
    description: "Read commentary and insights alongside any chapter.",
  },
  {
    id: "font-settings",
    title: "Font Settings",
    description: "Adjust size, spacing, and choose a font that's easy on your eyes.",
  },
  {
    id: "themes",
    title: "Themes",
    description: "Change the reader's look — including dark and night modes.",
  },
  {
    id: "verse-carousel",
    title: "Verse Carousel",
    description:
      "Customize the inspiration carousel on your journal — shuffle order, favorites, and how many verses appear.",
  },
  {
    id: "more",
    title: "More",
    description:
      "Turn haptic feedback on or off, and open credits for translations and attributions.",
  },
  {
    id: "delete-my-data",
    title: "Delete My Data",
    description:
      "Permanently clear your highlights, notes, and journal from this device.",
  },
];

/** Font settings live in the Android app bar, not the settings panel. */
const ANDROID_READER_SETTINGS_TOOLTIPS = READER_SETTINGS_TOOLTIPS.filter(
  (step) => step.id !== "font-settings",
);

export function readerSettingsTooltipsForPlatform(): ReaderSettingsTooltipContent[] {
  if (Platform.OS === "android") {
    return ANDROID_READER_SETTINGS_TOOLTIPS;
  }
  return READER_SETTINGS_TOOLTIPS;
}

const TOOLTIP_BY_ID = new Map(
  READER_SETTINGS_TOOLTIPS.map((entry) => [entry.id, entry] as const),
);

export function getReaderSettingsTooltip(
  id: string,
): Pick<ReaderSettingsTooltipContent, "title" | "description"> | null {
  const entry = TOOLTIP_BY_ID.get(id as ReaderSettingsTooltipId);
  if (!entry) return null;
  return { title: entry.title, description: entry.description };
}

/** @deprecated Use `ReaderSettingsTooltipId`. */
export type ReaderSettingsOnboardingStepId = ReaderSettingsTooltipId;

/** @deprecated Use `READER_SETTINGS_TOOLTIPS`. */
export const READER_SETTINGS_ONBOARDING_STEPS = READER_SETTINGS_TOOLTIPS;

/** @deprecated Use `readerSettingsTooltipsForPlatform`. */
export const readerSettingsOnboardingStepsForPlatform = readerSettingsTooltipsForPlatform;
