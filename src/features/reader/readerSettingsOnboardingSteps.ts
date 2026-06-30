import { Platform } from "react-native";

export type ReaderSettingsOnboardingStepId =
  | "translation"
  | "study-notes"
  | "font-settings"
  | "themes"
  | "delete-my-data";

export type ReaderSettingsOnboardingStep = {
  id: ReaderSettingsOnboardingStepId;
  title: string;
  description: string;
};

export const READER_SETTINGS_ONBOARDING_STEPS: ReaderSettingsOnboardingStep[] = [
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
    id: "delete-my-data",
    title: "Delete My Data",
    description:
      "Permanently clear your highlights, notes, and journal from this device.",
  },
];

/** Settings onboarding steps — font settings live in the Android app bar, not the settings panel. */
export function readerSettingsOnboardingStepsForPlatform(): ReaderSettingsOnboardingStep[] {
  if (Platform.OS === "android") {
    return READER_SETTINGS_ONBOARDING_STEPS.filter((step) => step.id !== "font-settings");
  }
  return READER_SETTINGS_ONBOARDING_STEPS;
}

export const READER_SETTINGS_ONBOARDING_STEP_MS = 3000;
