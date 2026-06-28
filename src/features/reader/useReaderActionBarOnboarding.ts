import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { type LayoutRectangle, type View } from "react-native";
import {
  isFeatureOnboardingDone,
  markFeatureOnboardingDone,
} from "@/lib/feature-onboarding-storage";
import { measureOnboardingTarget } from "@/src/components/feature-onboarding/measureOnboardingTarget";
import { adjustAnchorForOnboardingModal } from "@/src/components/feature-onboarding/onboardingOverlayCoords";
import {
  READER_ACTION_BAR_BUTTON_GAP_PX,
  READER_ACTION_BAR_BUTTON_INDEX,
  READER_ACTION_BAR_BUTTON_PX,
  READER_ACTION_BAR_ONBOARDING_STEP_MS,
  READER_ACTION_BAR_ONBOARDING_STEPS,
  READER_ACTION_BAR_PILL_PAD_H_PX,
  READER_ACTION_BAR_PILL_PAD_V_DEFAULT_PX,
  type ReaderActionBarOnboardingStepId,
} from "@/src/features/reader/readerActionBarOnboardingSteps";

const SELECTION_SETTLE_MS = 320;

type UseReaderActionBarOnboardingArgs = {
  hasVerseSelection: boolean;
  actionBarMode: "default" | "highlight";
  readerOverlayOpen: boolean;
  readerFeatureOnboardingActive: boolean;
  buttonRefs: Record<ReaderActionBarOnboardingStepId, RefObject<View | null>>;
  screenW: number;
  actionBarBottomPx: number;
};

function fallbackActionBarButtonTarget(
  stepId: ReaderActionBarOnboardingStepId,
  screenW: number,
  actionBarBottomPx: number,
): LayoutRectangle {
  const buttonIndex = READER_ACTION_BAR_BUTTON_INDEX[stepId];
  const barWidth =
    READER_ACTION_BAR_PILL_PAD_H_PX * 2 +
    READER_ACTION_BAR_BUTTON_PX * 5 +
    READER_ACTION_BAR_BUTTON_GAP_PX * 4;
  const barLeft = (screenW - barWidth) / 2;
  const x =
    barLeft +
    READER_ACTION_BAR_PILL_PAD_H_PX +
    buttonIndex * (READER_ACTION_BAR_BUTTON_PX + READER_ACTION_BAR_BUTTON_GAP_PX);
  const y = actionBarBottomPx + READER_ACTION_BAR_PILL_PAD_V_DEFAULT_PX;
  return { x, y, width: READER_ACTION_BAR_BUTTON_PX, height: READER_ACTION_BAR_BUTTON_PX };
}

export function useReaderActionBarOnboarding({
  hasVerseSelection,
  actionBarMode,
  readerOverlayOpen,
  readerFeatureOnboardingActive,
  buttonRefs,
  screenW,
  actionBarBottomPx,
}: UseReaderActionBarOnboardingArgs) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [presentedStepIndex, setPresentedStepIndex] = useState(0);
  const [buttonAnchor, setButtonAnchor] = useState<LayoutRectangle | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tourStartedForSelectionRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resetTour = useCallback(() => {
    clearTimer();
    tourStartedForSelectionRef.current = false;
    setActive(false);
    setStepIndex(0);
    setPresentedStepIndex(0);
    setButtonAnchor(null);
  }, [clearTimer]);

  const finishTour = useCallback(() => {
    clearTimer();
    setActive(false);
    void markFeatureOnboardingDone("readerActionBar");
  }, [clearTimer]);

  const measureCurrentStep = useCallback(
    async (index: number) => {
      const step = READER_ACTION_BAR_ONBOARDING_STEPS[index];
      if (!step) return;
      const measured = await measureOnboardingTarget(buttonRefs[step.id], {
        minWidth: 20,
        minHeight: 20,
      });
      const anchor = adjustAnchorForOnboardingModal(
        measured ?? fallbackActionBarButtonTarget(step.id, screenW, actionBarBottomPx),
      );
      setButtonAnchor(anchor);
      setPresentedStepIndex(index);
    },
    [actionBarBottomPx, buttonRefs, screenW],
  );

  useEffect(() => {
    if (!active || !hasVerseSelection || actionBarMode !== "default") return;
    void measureCurrentStep(stepIndex);
  }, [active, actionBarMode, hasVerseSelection, measureCurrentStep, stepIndex]);

  useEffect(() => {
    if (!hasVerseSelection) {
      resetTour();
      return;
    }

    const canStart =
      actionBarMode === "default" && !readerOverlayOpen && !readerFeatureOnboardingActive;

    if (!canStart) {
      if (readerFeatureOnboardingActive || readerOverlayOpen) {
        resetTour();
      }
      return;
    }

    if (tourStartedForSelectionRef.current) return;

    let cancelled = false;

    const startTimeout = setTimeout(() => {
      void (async () => {
        const readerDone = await isFeatureOnboardingDone("reader");
        if (cancelled || !readerDone) return;

        const actionBarDone = await isFeatureOnboardingDone("readerActionBar");
        if (cancelled || actionBarDone) return;

        tourStartedForSelectionRef.current = true;
        setStepIndex(0);
        setActive(true);

        intervalRef.current = setInterval(() => {
          setStepIndex((prev) => {
            const next = prev + 1;
            if (next >= READER_ACTION_BAR_ONBOARDING_STEPS.length) {
              finishTour();
              return prev;
            }
            return next;
          });
        }, READER_ACTION_BAR_ONBOARDING_STEP_MS);
      })();
    }, SELECTION_SETTLE_MS);

    return () => {
      cancelled = true;
      clearTimeout(startTimeout);
    };
  }, [
    actionBarMode,
    finishTour,
    hasVerseSelection,
    readerFeatureOnboardingActive,
    readerOverlayOpen,
    resetTour,
  ]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const currentStep = active ? (READER_ACTION_BAR_ONBOARDING_STEPS[presentedStepIndex] ?? null) : null;
  const showLayer =
    active &&
    hasVerseSelection &&
    actionBarMode === "default" &&
    !readerOverlayOpen &&
    currentStep != null &&
    buttonAnchor != null;

  return {
    showLayer,
    currentStep,
    buttonAnchor,
  };
}
