export type ReaderActionBarOnboardingStepId =
  | "highlight"
  | "note"
  | "copy"
  | "journal"
  | "study-notes";

export type ReaderActionBarOnboardingStep = {
  id: ReaderActionBarOnboardingStepId;
  title: string;
  description: string;
};

export const READER_ACTION_BAR_ONBOARDING_STEPS: ReaderActionBarOnboardingStep[] = [
  {
    id: "study-notes",
    title: "Study notes",
    description: "Open study notes for the selection or chapter.",
  },
  {
    id: "highlight",
    title: "Highlight",
    description: "Highlight in 5 colors — yellow, blue, pink, green, and purple.",
  },
  {
    id: "copy",
    title: "Copy",
    description: "Copy selected verse(s) with translation and reference to the clipboard.",
  },
  {
    id: "note",
    title: "Inline notes",
    description: "Add inline notes displayed beneath the verse.",
  },
  {
    id: "journal",
    title: "Journal",
    description: "Start a journal entry anchored to the selected passage.",
  },
];

export const READER_ACTION_BAR_ONBOARDING_STEP_MS = 3000;

/** Left-to-right index of each button in the default action bar. */
export const READER_ACTION_BAR_BUTTON_INDEX: Record<ReaderActionBarOnboardingStepId, number> = {
  "study-notes": 0,
  highlight: 1,
  copy: 2,
  note: 3,
  journal: 4,
};

export const READER_ACTION_BAR_BUTTON_PX = 47;
export const READER_ACTION_BAR_BUTTON_GAP_PX = 6;
export const READER_ACTION_BAR_PILL_PAD_H_PX = 10;
