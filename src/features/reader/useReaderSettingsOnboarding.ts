import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Platform, type LayoutRectangle, type View } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import {
  isFeatureOnboardingDone,
  markFeatureOnboardingDone,
} from "@/lib/feature-onboarding-storage";
import { readerSettingsDeleteMyDataScreenBottomPx } from "@/lib/native-tab-chrome";
import { adjustAnchorForOnboardingModal } from "@/src/components/feature-onboarding/onboardingOverlayCoords";
import { measureOnboardingTarget } from "@/src/components/feature-onboarding/measureOnboardingTarget";
import {
  READER_SETTINGS_ONBOARDING_STEP_MS,
  READER_SETTINGS_ONBOARDING_STEPS,
  type ReaderSettingsOnboardingStepId,
} from "@/src/features/reader/readerSettingsOnboardingSteps";
import {
  fallbackSettingsRowAnchor,
  visibleSettingsRowAnchor,
} from "@/src/features/reader/readerSettingsOnboardingAnchor";

const MENU_OPEN_SETTLE_MS = 320;
const SETTINGS_ROW_HEIGHT_PX = 52;
const SETTINGS_ROW_GAP_PX = 10;

type UseReaderSettingsOnboardingArgs = {
  toolsMenuOpen: boolean;
  rowRefs: Record<ReaderSettingsOnboardingStepId, RefObject<View | null>>;
  scrollPaddingTop: number;
  screenW: number;
  screenH: number;
  insets: EdgeInsets;
  settingsLayoutEpoch: number;
  settingsRevealedStripWidthPx: number;
};

function resolveSettingsRowAnchor(
  stepId: ReaderSettingsOnboardingStepId,
  measured: LayoutRectangle | null,
  screenW: number,
  screenH: number,
  scrollPaddingTop: number,
  insets: EdgeInsets,
  settingsRevealedStripWidthPx: number,
): LayoutRectangle {
  const deleteMyDataBottomPx = readerSettingsDeleteMyDataScreenBottomPx(insets.bottom);
  const stepIndex = READER_SETTINGS_ONBOARDING_STEPS.findIndex((step) => step.id === stepId);

  if (measured) {
    return visibleSettingsRowAnchor(measured, screenW, insets, settingsRevealedStripWidthPx);
  }

  return fallbackSettingsRowAnchor(
    stepIndex,
    screenW,
    screenH,
    scrollPaddingTop,
    insets,
    settingsRevealedStripWidthPx,
    SETTINGS_ROW_HEIGHT_PX,
    SETTINGS_ROW_GAP_PX,
    deleteMyDataBottomPx,
    stepId === "delete-my-data",
  );
}

export function useReaderSettingsOnboarding({
  toolsMenuOpen,
  rowRefs,
  scrollPaddingTop,
  screenW,
  screenH,
  insets,
  settingsLayoutEpoch,
  settingsRevealedStripWidthPx,
}: UseReaderSettingsOnboardingArgs) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [presentedStepIndex, setPresentedStepIndex] = useState(0);
  const [rowAnchor, setRowAnchor] = useState<LayoutRectangle | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tourStartedRef = useRef(false);
  const measureRequestRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const finishTour = useCallback(() => {
    clearTimer();
    setActive(false);
    void markFeatureOnboardingDone("readerSettings");
  }, [clearTimer]);

  const measureCurrentStep = useCallback(
    async (index: number) => {
      const requestId = ++measureRequestRef.current;
      const step = READER_SETTINGS_ONBOARDING_STEPS[index];
      if (!step) return;
      const measured = await measureOnboardingTarget(rowRefs[step.id], {
        minWidth: 40,
        minHeight: 20,
      });
      if (requestId !== measureRequestRef.current) return;
      const anchor = adjustAnchorForOnboardingModal(
        resolveSettingsRowAnchor(
          step.id,
          measured,
          screenW,
          screenH,
          scrollPaddingTop,
          insets,
          settingsRevealedStripWidthPx,
        ),
      );
      setRowAnchor(anchor);
      setPresentedStepIndex(index);
    },
    [insets, rowRefs, screenH, screenW, scrollPaddingTop, settingsRevealedStripWidthPx],
  );

  useEffect(() => {
    if (!active || !toolsMenuOpen) return;
    void measureCurrentStep(stepIndex);
  }, [active, measureCurrentStep, settingsLayoutEpoch, stepIndex, toolsMenuOpen]);

  useEffect(() => {
    if (!toolsMenuOpen) {
      clearTimer();
      tourStartedRef.current = false;
      measureRequestRef.current += 1;
      setActive(false);
      setStepIndex(0);
      setPresentedStepIndex(0);
      setRowAnchor(null);
      return;
    }

    if (tourStartedRef.current) return;

    let cancelled = false;

    const startTimeout = setTimeout(() => {
      void (async () => {
        const done = await isFeatureOnboardingDone("readerSettings");
        if (cancelled || done) return;

        tourStartedRef.current = true;
        setStepIndex(0);
        setActive(true);

        intervalRef.current = setInterval(() => {
          setStepIndex((prev) => {
            const next = prev + 1;
            if (next >= READER_SETTINGS_ONBOARDING_STEPS.length) {
              finishTour();
              return prev;
            }
            return next;
          });
        }, READER_SETTINGS_ONBOARDING_STEP_MS);
      })();
    }, MENU_OPEN_SETTLE_MS);

    return () => {
      cancelled = true;
      clearTimeout(startTimeout);
    };
  }, [clearTimer, finishTour, toolsMenuOpen]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const currentStep = active ? (READER_SETTINGS_ONBOARDING_STEPS[presentedStepIndex] ?? null) : null;
  const showLayer = active && toolsMenuOpen && currentStep != null && rowAnchor != null;

  return {
    showLayer,
    currentStep,
    rowAnchor,
  };
}
