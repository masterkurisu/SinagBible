import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { InteractionManager, type LayoutRectangle, type View } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import {
  isFeatureOnboardingDone,
  markFeatureOnboardingDone,
} from "@/lib/feature-onboarding-storage";
import { measureOnboardingTarget } from "@/src/components/feature-onboarding/measureOnboardingTarget";
import { adjustAnchorForOnboardingModal } from "@/src/components/feature-onboarding/onboardingOverlayCoords";
import {
  JOURNAL_DETAIL_ONBOARDING_STEP_MS,
  JOURNAL_DETAIL_ONBOARDING_STEPS,
  type JournalDetailOnboardingStepId,
} from "@/src/features/journal/journalDetailOnboardingSteps";
import { resolveJournalDetailExportActionAnchor } from "@/src/features/journal/journalDetailHeaderToolTargets";

const CONTENT_SETTLE_MS = 360;

type UseJournalDetailOnboardingArgs = {
  entryReady: boolean;
  targetRefs: Record<JournalDetailOnboardingStepId, RefObject<View | null>>;
  trailingActionsRef: RefObject<View | null>;
  insets: EdgeInsets;
  screenW: number;
  screenH: number;
  androidTopToolsTopPx: number;
};

export function useJournalDetailOnboarding({
  entryReady,
  targetRefs,
  trailingActionsRef,
  insets,
  screenW,
  screenH: _screenH,
  androidTopToolsTopPx,
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

      const [measuredButton, measuredTrailingRow] = await Promise.all([
        measureOnboardingTarget(targetRefs[step.id], {
          minWidth: 20,
          minHeight: 20,
        }),
        measureOnboardingTarget(trailingActionsRef, {
          minWidth: 120,
          minHeight: 36,
        }),
      ]);

      const anchor = adjustAnchorForOnboardingModal(
        resolveJournalDetailExportActionAnchor(
          step.id,
          measuredButton,
          measuredTrailingRow,
          insets,
          screenW,
          androidTopToolsTopPx,
        ),
      );
      setStepAnchor(anchor);
      setPresentedStepIndex(index);
    },
    [androidTopToolsTopPx, insets, screenW, targetRefs, trailingActionsRef],
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
    void measureCurrentStep(stepIndex);
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
