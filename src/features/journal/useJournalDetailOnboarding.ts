import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { InteractionManager, type LayoutRectangle, type View } from "react-native";
import {
  isFeatureOnboardingDone,
  markFeatureOnboardingDone,
} from "@/lib/feature-onboarding-storage";
import {
  JOURNAL_DETAIL_HEADER_ACTION_PX,
  JOURNAL_DETAIL_ONBOARDING_STEP_MS,
  JOURNAL_DETAIL_ONBOARDING_STEPS,
  type JournalDetailOnboardingStepId,
} from "@/src/features/journal/journalDetailOnboardingSteps";

const CONTENT_SETTLE_MS = 360;
const HEADER_ACTION_GAP_PX = 2;

type UseJournalDetailOnboardingArgs = {
  entryReady: boolean;
  targetRefs: Record<JournalDetailOnboardingStepId, RefObject<View | null>>;
  screenW: number;
  screenH: number;
};

function measureViewInWindow(ref: RefObject<View | null>): Promise<LayoutRectangle | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node) {
      resolve(null);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        resolve(null);
        return;
      }
      resolve({ x, y, width, height });
    });
  });
}

function fallbackHeaderAction(indexFromRight: number, screenW: number): LayoutRectangle {
  const x =
    screenW -
    8 -
    JOURNAL_DETAIL_HEADER_ACTION_PX -
    indexFromRight * (JOURNAL_DETAIL_HEADER_ACTION_PX + HEADER_ACTION_GAP_PX);
  return { x, y: 52, width: JOURNAL_DETAIL_HEADER_ACTION_PX, height: JOURNAL_DETAIL_HEADER_ACTION_PX };
}

function fallbackTarget(stepId: JournalDetailOnboardingStepId, screenW: number): LayoutRectangle {
  switch (stepId) {
    case "share-as-image":
      return fallbackHeaderAction(2, screenW);
    case "save-to-library":
      return fallbackHeaderAction(1, screenW);
    case "export-as-pdf":
      return fallbackHeaderAction(0, screenW);
  }
}

export function useJournalDetailOnboarding({
  entryReady,
  targetRefs,
  screenW,
  screenH: _screenH,
}: UseJournalDetailOnboardingArgs) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [presentedStepIndex, setPresentedStepIndex] = useState(0);
  const [stepAnchor, setStepAnchor] = useState<LayoutRectangle | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const storageCheckedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const finishTour = useCallback(() => {
    clearTimer();
    setActive(false);
    void markFeatureOnboardingDone("journalDetail");
  }, [clearTimer]);

  const measureCurrentStep = useCallback(
    async (index: number) => {
      const step = JOURNAL_DETAIL_ONBOARDING_STEPS[index];
      if (!step) return;
      const measured = await measureViewInWindow(targetRefs[step.id]);
      const anchor = measured ?? fallbackTarget(step.id, screenW);
      setStepAnchor(anchor);
      setPresentedStepIndex(index);
    },
    [screenW, targetRefs],
  );

  useEffect(() => {
    if (!entryReady || storageCheckedRef.current) return;
    storageCheckedRef.current = true;

    let cancelled = false;

    const startTimeout = setTimeout(() => {
      void (async () => {
        await new Promise<void>((resolve) => {
          InteractionManager.runAfterInteractions(() => resolve());
        });
        if (cancelled) return;

        const done = await isFeatureOnboardingDone("journalDetail");
        if (cancelled || done) return;

        setStepIndex(0);
        setActive(true);

        intervalRef.current = setInterval(() => {
          setStepIndex((prev) => {
            const next = prev + 1;
            if (next >= JOURNAL_DETAIL_ONBOARDING_STEPS.length) {
              finishTour();
              return prev;
            }
            return next;
          });
        }, JOURNAL_DETAIL_ONBOARDING_STEP_MS);
      })();
    }, CONTENT_SETTLE_MS);

    return () => {
      cancelled = true;
      clearTimeout(startTimeout);
    };
  }, [entryReady, finishTour]);

  useEffect(() => {
    if (!active) return;
    const measureTimeout = setTimeout(() => {
      void measureCurrentStep(stepIndex);
    }, 80);
    return () => clearTimeout(measureTimeout);
  }, [active, measureCurrentStep, stepIndex]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const currentStep = active ? (JOURNAL_DETAIL_ONBOARDING_STEPS[presentedStepIndex] ?? null) : null;
  const showLayer = active && currentStep != null && stepAnchor != null;

  return {
    showLayer,
    currentStep,
    stepAnchor,
    tourActive: active,
  };
}
