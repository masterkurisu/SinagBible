export type BookPickerOnboardingStepId = "view-filter";

export type BookPickerOnboardingStep = {
  id: BookPickerOnboardingStepId;
  title: string;
  description: string;
};

export const BOOK_PICKER_FILTER_ONBOARDING_STEP: BookPickerOnboardingStep = {
  id: "view-filter",
  title: "Switch between grid, A–Z, Old Testament, and New Testament views",
  description: "",
};

export const BOOK_PICKER_ONBOARDING_STEP_MS = 5000;

/** Wait for the sheet enter animation and list layout before measuring the filter button. */
export const BOOK_PICKER_ONBOARDING_SETTLE_MS = 420;
