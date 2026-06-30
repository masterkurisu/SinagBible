import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { type LayoutRectangle, type View } from "react-native";
import {
  isFeatureOnboardingDone,
  markFeatureOnboardingDone,
} from "@/lib/feature-onboarding-storage";
import { measureOnboardingTarget } from "@/src/components/feature-onboarding/measureOnboardingTarget";
import { adjustAnchorForOnboardingModal } from "@/src/components/feature-onboarding/onboardingOverlayCoords";
import {
  JOURNAL_EDITOR_ONBOARDING_STEP_MS,
  JOURNAL_EDITOR_ONBOARDING_STEPS,
  journalEditorCoachmarkVerticalOffsetPx,
  type JournalEditorOnboardingStepId,
} from "@/src/features/journal/journalEditorOnboardingSteps";

const CONTENT_SETTLE_MS = 320;
const TOOLBAR_BTN_PX = 40;

type UseJournalEditorOnboardingArgs = {
  enabled: boolean;
  isReaderNewEntry: boolean;
  isPhoneSheetForm: boolean;
  targetRefs: Record<JournalEditorOnboardingStepId, RefObject<View | null>>;
  screenW: number;
  screenH: number;
};

function fallbackTarget(
  stepId: JournalEditorOnboardingStepId,
  screenW: number,
  screenH: number,
  isPhoneSheetForm: boolean,
): LayoutRectangle {
  const sheetTopPx = isPhoneSheetForm ? 50 : 0;
  const passageY = sheetTopPx + 32;
  const titleY = sheetTopPx + 68;
  const toolbarY = isPhoneSheetForm ? sheetTopPx + 178 : screenH * 0.52 - 70;
  const toolbarRightX = screenW - 16 - TOOLBAR_BTN_PX;

  switch (stepId) {
    case "passage-anchoring":
      return { x: 24, y: passageY, width: screenW - 48, height: 44 };
    case "optional-title":
      return { x: 24, y: titleY, width: screenW - 48, height: 44 };
    case "rich-text-toolbar":
      return { x: toolbarRightX - TOOLBAR_BTN_PX * 2 - 20, y: toolbarY, width: TOOLBAR_BTN_PX, height: TOOLBAR_BTN_PX };
    case "photo-attachment":
      return { x: toolbarRightX, y: toolbarY, width: TOOLBAR_BTN_PX, height: TOOLBAR_BTN_PX };
    case "fullscreen-mode":
      return { x: 20, y: toolbarY, width: TOOLBAR_BTN_PX, height: TOOLBAR_BTN_PX };
  }
}

/** Bakes vertical offset into anchor y (equivalent to ActionBarOnboardingOverlay `verticalOffsetPx`). */
function anchorWithCoachmarkVerticalOffset(anchor: LayoutRectangle, offsetPx: number): LayoutRectangle {
  return { ...anchor, y: anchor.y + offsetPx };
}

export function useJournalEditorOnboarding({
  enabled,
  isReaderNewEntry,
  isPhoneSheetForm,
  targetRefs,
  screenW,
  screenH,
}: UseJournalEditorOnboardingArgs) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [presentedStepIndex, setPresentedStepIndex] = useState(0);
  const [stepAnchor, setStepAnchor] = useState<LayoutRectangle | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionTokenRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resetSession = useCallback(() => {
    clearTimer();
    setActive(false);
    setStepIndex(0);
    setPresentedStepIndex(0);
    setStepAnchor(null);
  }, [clearTimer]);

  const finishTour = useCallback(() => {
    sessionTokenRef.current += 1;
    resetSession();
    void markFeatureOnboardingDone("journalEditor");
  }, [resetSession]);

  const measureCurrentStep = useCallback(
    async (index: number, token: number) => {
      const step = JOURNAL_EDITOR_ONBOARDING_STEPS[index];
      if (!step) return;

      const measured = await measureOnboardingTarget(targetRefs[step.id], {
        minWidth: 20,
        minHeight: 20,
      });
      if (token !== sessionTokenRef.current) return;

      const rawAnchor = measured ?? fallbackTarget(step.id, screenW, screenH, isPhoneSheetForm);
      const modalAnchor = adjustAnchorForOnboardingModal(rawAnchor);
      const offsetPx = journalEditorCoachmarkVerticalOffsetPx(step.id, isReaderNewEntry, isPhoneSheetForm);
      const anchor = anchorWithCoachmarkVerticalOffset(modalAnchor, offsetPx);

      setStepAnchor(anchor);
      setPresentedStepIndex(index);
    },
    [isPhoneSheetForm, isReaderNewEntry, screenH, screenW, targetRefs],
  );

  useEffect(() => {
    if (!enabled) {
      sessionTokenRef.current += 1;
      resetSession();
      return;
    }

    const token = ++sessionTokenRef.current;
    resetSession();

    const startTimeout = setTimeout(() => {
      void (async () => {
        const done = await isFeatureOnboardingDone("journalEditor");
        if (token !== sessionTokenRef.current) return;
        if (done) return;

        setActive(true);

        intervalRef.current = setInterval(() => {
          setStepIndex((prev) => {
            const next = prev + 1;
            if (next >= JOURNAL_EDITOR_ONBOARDING_STEPS.length) {
              finishTour();
              return prev;
            }
            return next;
          });
        }, JOURNAL_EDITOR_ONBOARDING_STEP_MS);
      })();
    }, CONTENT_SETTLE_MS);

    return () => {
      clearTimeout(startTimeout);
    };
  }, [enabled, finishTour, resetSession]);

  useEffect(() => {
    if (!active) return;
    const token = sessionTokenRef.current;
    void measureCurrentStep(stepIndex, token);
  }, [active, measureCurrentStep, stepIndex]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const currentStep = active ? (JOURNAL_EDITOR_ONBOARDING_STEPS[presentedStepIndex] ?? null) : null;
  const showLayer = active && currentStep != null && stepAnchor != null;

  return {
    showLayer,
    currentStep,
    stepAnchor,
    tourActive: active,
  };
}
