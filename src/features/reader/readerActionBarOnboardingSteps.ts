export type ReaderActionBarOnboardingStepId =
  | "highlight"
  | "note"
  | "copy"
  | "journal"
  | "study-notes"
  | "favorite";

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
    id: "favorite",
    title: "Favorite",
    description: "Pin a verse to your carousel",
  },
  {
    id: "journal",
    title: "Journal",
    description: "Start a journal entry anchored to the selected passage.",
  },
];

export const READER_ACTION_BAR_ONBOARDING_STEP_MS = 3000;

/** Left-to-right index of each button in the default action bar (favorite sits before journal). */
export const READER_ACTION_BAR_BUTTON_INDEX: Record<ReaderActionBarOnboardingStepId, number> = {
  "study-notes": 0,
  highlight: 1,
  copy: 2,
  note: 3,
  favorite: 4,
  journal: 5,
};

/** Number of icon buttons before the trailing journal action. */
export const READER_ACTION_BAR_ICON_BUTTON_COUNT = 5;

/** Reader verse-selection M3 floating toolbar layout. */
export const READER_ACTION_BAR_BUTTON_PX = 48;
export const READER_ACTION_BAR_BUTTON_GAP_PX = 4;
export const READER_ACTION_BAR_PILL_PAD_H_PX = 8;
export const READER_ACTION_BAR_PILL_PAD_H_HIGHLIGHT_PX = 12;
export const READER_ACTION_BAR_PILL_PAD_V_DEFAULT_PX = 8;
export const READER_ACTION_BAR_PILL_PAD_V_HIGHLIGHT_PX = 8;
export const READER_ACTION_BAR_ICON_BOX_PX = 24;
export const READER_ACTION_BAR_ICON_SIZE_PX = 24;
export const READER_ACTION_BAR_ROW_GAP_PX = 4;
export const READER_ACTION_BAR_SELECTION_CLEARANCE_DEFAULT_PX = 96;
export const READER_ACTION_BAR_SELECTION_CLEARANCE_HIGHLIGHT_PX = 112;
