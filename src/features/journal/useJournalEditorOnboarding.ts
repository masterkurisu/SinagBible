import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { InteractionManager, type LayoutRectangle, type View } from "react-native";
import {
  isFeatureOnboardingDone,
  markFeatureOnboardingDone,
} from "@/lib/feature-onboarding-storage";
import {
  JOURNAL_EDITOR_ONBOARDING_STEP_MS,
  JOURNAL_EDITOR_ONBOARDING_STEPS,
  type JournalEditorOnboardingStepId,
} from "@/src/features/journal/journalEditorOnboardingSteps";

const CONTENT_SETTLE_MS = 320;
const TOOLBAR_BTN_PX = 40;

type UseJournalEditorOnboardingArgs = {
  enabled: boolean;
  targetRefs: Record<JournalEditorOnboardingStepId, RefObject<View | null>>;
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

function fallbackTarget(stepId: JournalEditorOnboardingStepId, screenW: number, screenH: number): LayoutRectangle {
  const toolbarY = screenH * 0.52;
  const toolbarRightX = screenW - 16 - TOOLBAR_BTN_PX;

  switch (stepId) {
    case "passage-anchoring":
      return { x: 24, y: screenH * 0.22, width: screenW - 48, height: 44 };
    case "optional-title":
      return { x: 24, y: screenH * 0.32, width: screenW - 48, height: 44 };
    case "rich-text-toolbar":
      return { x: toolbarRightX - TOOLBAR_BTN_PX * 2 - 20, y: toolbarY, width: TOOLBAR_BTN_PX, height: TOOLBAR_BTN_PX };
    case "photo-attachment":
      return { x: toolbarRightX, y: toolbarY, width: TOOLBAR_BTN_PX, height: TOOLBAR_BTN_PX };
    case "fullscreen-mode":
      return { x: 20, y: toolbarY, width: TOOLBAR_BTN_PX, height: TOOLBAR_BTN_PX };
  }
}

export function useJournalEditorOnboarding({
  enabled,
  targetRefs,
  screenW,
  screenH,
}: UseJournalEditorOnboardingArgs) {
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
    void markFeatureOnboardingDone("journalEditor");
  }, [clearTimer]);

  const measureCurrentStep = useCallback(
    async (index: number) => {
      const step = JOURNAL_EDITOR_ONBOARDING_STEPS[index];
      if (!step) return;
      const measured = await measureViewInWindow(targetRefs[step.id]);
      const anchor = measured ?? fallbackTarget(step.id, screenW, screenH);
      setStepAnchor(anchor);
      setPresentedStepIndex(index);
    },
    [screenH, screenW, targetRefs],
  );

  useEffect(() => {
    if (!enabled || storageCheckedRef.current) return;
    storageCheckedRef.current = true;

    let cancelled = false;

    const startTimeout = setTimeout(() => {
      void (async () => {
        await new Promise<void>((resolve) => {
          InteractionManager.runAfterInteractions(() => resolve());
        });
        if (cancelled) return;

        const done = await isFeatureOnboardingDone("journalEditor");
        if (cancelled || done) return;

        setStepIndex(0);
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
      cancelled = true;
      clearTimeout(startTimeout);
    };
  }, [enabled, finishTour]);

  useEffect(() => {
    if (!active) return;
    void measureCurrentStep(stepIndex);
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
