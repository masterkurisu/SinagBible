import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { InteractionManager, type LayoutRectangle, type View } from "react-native";
import {
  isFeatureOnboardingDone,
  markFeatureOnboardingDone,
} from "@/lib/feature-onboarding-storage";
import {
  JOURNAL_NEW_ENTRY_FAB_PX,
  JOURNAL_ONBOARDING_LIST_FALLBACK_TOP_PX,
  JOURNAL_ONBOARDING_STEP_MS,
  JOURNAL_ONBOARDING_STEPS,
  type JournalOnboardingStepId,
} from "@/src/features/journal/journalOnboardingSteps";

const CONTENT_SETTLE_MS = 320;
const MENU_OPEN_SETTLE_MS = 360;

type UseJournalOnboardingArgs = {
  journalContentReady: boolean;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  targetRefs: Record<JournalOnboardingStepId, RefObject<View | null>>;
  screenW: number;
  screenH: number;
  newEntryFabBottomPx: number;
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

function fallbackTarget(
  stepId: JournalOnboardingStepId,
  screenW: number,
  screenH: number,
  newEntryFabBottomPx: number,
): LayoutRectangle {
  const width = Math.min(screenW - 32, 340);
  const x = (screenW - width) / 2;

  switch (stepId) {
    case "create-from-bible": {
      const fabX = (screenW - JOURNAL_NEW_ENTRY_FAB_PX) / 2;
      const fabY = screenH - newEntryFabBottomPx - JOURNAL_NEW_ENTRY_FAB_PX;
      return { x: fabX, y: fabY, width: JOURNAL_NEW_ENTRY_FAB_PX, height: JOURNAL_NEW_ENTRY_FAB_PX };
    }
    case "swipe-actions":
      return { x, y: JOURNAL_ONBOARDING_LIST_FALLBACK_TOP_PX + 140, width, height: 108 };
    case "date-grouping":
      return { x: 16, y: JOURNAL_ONBOARDING_LIST_FALLBACK_TOP_PX + 40, width: screenW - 32, height: 28 };
    case "filters":
      return { x: 16, y: 196, width: screenW - 32, height: 72 };
    case "sort":
      return { x: 16, y: 292, width: screenW - 32, height: 72 };
  }
}

function isMenuStep(stepId: JournalOnboardingStepId): boolean {
  return stepId === "filters" || stepId === "sort";
}

export function useJournalOnboarding({
  journalContentReady,
  menuOpen,
  setMenuOpen,
  targetRefs,
  screenW,
  screenH,
  newEntryFabBottomPx,
}: UseJournalOnboardingArgs) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [presentedStepIndex, setPresentedStepIndex] = useState(0);
  const [stepAnchor, setStepAnchor] = useState<LayoutRectangle | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const storageCheckedRef = useRef(false);
  const tourStartedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const finishTour = useCallback(() => {
    clearTimer();
    setActive(false);
    setMenuOpen(false);
    void markFeatureOnboardingDone("journal");
  }, [clearTimer, setMenuOpen]);

  const measureCurrentStep = useCallback(
    async (index: number) => {
      const step = JOURNAL_ONBOARDING_STEPS[index];
      if (!step) return;
      const measured = await measureViewInWindow(targetRefs[step.id]);
      const anchor = measured ?? fallbackTarget(step.id, screenW, screenH, newEntryFabBottomPx);
      setStepAnchor(anchor);
      setPresentedStepIndex(index);
    },
    [newEntryFabBottomPx, screenH, screenW, targetRefs],
  );

  useEffect(() => {
    if (!journalContentReady || storageCheckedRef.current) return;
    storageCheckedRef.current = true;

    let cancelled = false;

    const startTimeout = setTimeout(() => {
      void (async () => {
        await new Promise<void>((resolve) => {
          InteractionManager.runAfterInteractions(() => resolve());
        });
        if (cancelled) return;

        const done = await isFeatureOnboardingDone("journal");
        if (cancelled || done) return;

        tourStartedRef.current = true;
        setStepIndex(0);
        setActive(true);

        intervalRef.current = setInterval(() => {
          setStepIndex((prev) => {
            const next = prev + 1;
            if (next >= JOURNAL_ONBOARDING_STEPS.length) {
              finishTour();
              return prev;
            }
            return next;
          });
        }, JOURNAL_ONBOARDING_STEP_MS);
      })();
    }, CONTENT_SETTLE_MS);

    return () => {
      cancelled = true;
      clearTimeout(startTimeout);
    };
  }, [clearTimer, finishTour, journalContentReady]);

  useEffect(() => {
    if (!active) return;
    const step = JOURNAL_ONBOARDING_STEPS[stepIndex];
    if (!step) return;

    if (isMenuStep(step.id) && !menuOpen) {
      setMenuOpen(true);
      return;
    }

    const settleMs = isMenuStep(step.id) ? MENU_OPEN_SETTLE_MS : 0;
    const measureTimeout = setTimeout(() => {
      void measureCurrentStep(stepIndex);
    }, settleMs);

    return () => clearTimeout(measureTimeout);
  }, [active, measureCurrentStep, menuOpen, setMenuOpen, stepIndex]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const currentStep = active ? (JOURNAL_ONBOARDING_STEPS[presentedStepIndex] ?? null) : null;
  const requiresMenuOpen = active && currentStep != null && isMenuStep(currentStep.id);
  const showLayer = active && currentStep != null && stepAnchor != null && (!requiresMenuOpen || menuOpen);

  return {
    showLayer,
    currentStep,
    stepAnchor,
    requiresMenuOpen,
    tourActive: active,
  };
}
