export type JournalOnboardingStepId =
  | "create-from-bible"
  | "swipe-actions"
  | "date-grouping"
  | "filters"
  | "sort";

export type JournalOnboardingStep = {
  id: JournalOnboardingStepId;
  title: string;
  description: string;
};

export const JOURNAL_ONBOARDING_STEPS: JournalOnboardingStep[] = [
  {
    id: "create-from-bible",
    title: "Create from Bible",
    description:
      "Start a reflection directly from any verse in the Bible tab — your passage comes pre-filled.",
  },
  {
    id: "swipe-actions",
    title: "Swipe actions",
    description: "Swipe an entry to favorite or delete it.",
  },
  {
    id: "date-grouping",
    title: "Date grouping",
    description: "Your entries are grouped by date for easy browsing.",
  },
  {
    id: "filters",
    title: "Filters",
    description: "Filter by All, Old Testament, New Testament, or your Favorites.",
  },
  {
    id: "sort",
    title: "Sort",
    description: "Sort entries by newest, oldest, or Bible book order.",
  },
];

export const JOURNAL_ONBOARDING_STEP_MS = 4500;

/** Matches journal list FAB size (`app/(tabs)/journal/index.tsx`). */
export const JOURNAL_NEW_ENTRY_FAB_PX = 72;

/** Approximate Y offset for list-area fallbacks (below header block). */
export const JOURNAL_ONBOARDING_LIST_FALLBACK_TOP_PX = 280;
