export type JournalOnboardingStepId = "create-from-bible" | "swipe-actions";

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
];

export const JOURNAL_ONBOARDING_STEP_MS = 4500;

/** Matches journal list FAB size (`src/features/journal/journalFabChrome.ts`). */
export { JOURNAL_NEW_ENTRY_FAB_PX } from "@/src/features/journal/journalFabChrome";

/** Approximate Y offset for list-area fallbacks (below header block). */
export const JOURNAL_ONBOARDING_LIST_FALLBACK_TOP_PX = 280;
