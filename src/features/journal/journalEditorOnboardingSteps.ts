export type JournalEditorOnboardingStepId =
  | "passage-anchoring"
  | "optional-title"
  | "rich-text-toolbar"
  | "photo-attachment"
  | "fullscreen-mode";

export type JournalEditorOnboardingStep = {
  id: JournalEditorOnboardingStepId;
  title: string;
  description: string;
};

export const JOURNAL_EDITOR_ONBOARDING_STEPS: JournalEditorOnboardingStep[] = [
  {
    id: "passage-anchoring",
    title: "Passage anchoring",
    description:
      "Link your entry to a specific book, chapter, and verse — with a live Scripture preview.",
  },
  {
    id: "optional-title",
    title: "Optional title",
    description: "Add a title, or leave it blank and let your passage speak.",
  },
  {
    id: "rich-text-toolbar",
    title: "Rich-text toolbar",
    description: "Format your reflection with bold, italic, lists, and more.",
  },
  {
    id: "photo-attachment",
    title: "Photo attachment",
    description: "Attach a photo from your library to go with your entry.",
  },
  {
    id: "fullscreen-mode",
    title: "Fullscreen mode",
    description: "Go fullscreen for a distraction-free writing space.",
  },
];

export const JOURNAL_EDITOR_ONBOARDING_STEP_MS = 4500;

/** Applied to every new-entry coachmark so arrows sit above measured targets. */
const EDITOR_COACHMARK_GLOBAL_SHIFT_UP_PX = 40;

const BASE_COACHMARK_VERTICAL_OFFSET_PX = 40;

const EXTRA_COACHMARK_VERTICAL_OFFSET_PX: Partial<Record<JournalEditorOnboardingStepId, number>> = {
  "optional-title": 40,
};

const READER_EXTRA_COACHMARK_VERTICAL_OFFSET_PX: Partial<Record<JournalEditorOnboardingStepId, number>> = {
  "rich-text-toolbar": 12,
  "photo-attachment": 12,
  "fullscreen-mode": 12,
};

/** Full-height phone bottom sheet (journal + reader): toolbar sits lower in the taller layout. */
const PHONE_SHEET_EXTRA_COACHMARK_VERTICAL_OFFSET_PX: Partial<
  Record<JournalEditorOnboardingStepId, number>
> = {
  "passage-anchoring": 8,
  "optional-title": 16,
  "rich-text-toolbar": -8,
  "photo-attachment": -8,
  "fullscreen-mode": -8,
};

/** Per-step upward nudge on top of the global shift (positive = move coachmark up). */
const STEP_COACHMARK_EXTRA_SHIFT_UP_PX: Partial<Record<JournalEditorOnboardingStepId, number>> = {
  "optional-title": 40,
  "rich-text-toolbar": 30,
  "photo-attachment": 30,
  "fullscreen-mode": 30,
};

/** Total downward shift applied to the coachmark arrow (see ActionBarOnboardingOverlay). */
export function journalEditorCoachmarkVerticalOffsetPx(
  stepId: JournalEditorOnboardingStepId,
  isReaderNewEntry: boolean,
  isPhoneSheetForm = false,
): number {
  let offset = BASE_COACHMARK_VERTICAL_OFFSET_PX;
  offset += EXTRA_COACHMARK_VERTICAL_OFFSET_PX[stepId] ?? 0;
  if (isPhoneSheetForm) {
    offset += PHONE_SHEET_EXTRA_COACHMARK_VERTICAL_OFFSET_PX[stepId] ?? 0;
  }
  if (isReaderNewEntry) {
    offset += READER_EXTRA_COACHMARK_VERTICAL_OFFSET_PX[stepId] ?? 0;
  }
  return (
    offset -
    EDITOR_COACHMARK_GLOBAL_SHIFT_UP_PX -
    (STEP_COACHMARK_EXTRA_SHIFT_UP_PX[stepId] ?? 0)
  );
}
