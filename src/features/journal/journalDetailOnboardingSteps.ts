export type JournalDetailOnboardingStepId = "share-as-image" | "save-to-library" | "export-as-pdf";

export type JournalDetailOnboardingStep = {
  id: JournalDetailOnboardingStepId;
  title: string;
  description: string;
};

export const JOURNAL_DETAIL_ONBOARDING_STEPS: JournalDetailOnboardingStep[] = [
  {
    id: "share-as-image",
    title: "Share as image",
    description: "Turn your reflection into a shareable image.",
  },
  {
    id: "save-to-library",
    title: "Save to library",
    description: "Save the image directly to your photo library.",
  },
  {
    id: "export-as-pdf",
    title: "Export as PDF",
    description: "Export your entry as a PDF to save or share.",
  },
];

export const JOURNAL_DETAIL_ONBOARDING_STEP_MS = 4500;

/** Approximate header action button size on the journal detail screen. */
export const JOURNAL_DETAIL_HEADER_ACTION_PX = 40;
