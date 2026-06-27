import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { InteractionManager, Platform, type LayoutRectangle, type View } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import {
  isFeatureOnboardingDone,
  markFeatureOnboardingDone,
} from "@/lib/feature-onboarding-storage";
import { nativeTabSheetBottomInsetPx } from "@/lib/native-tab-chrome";
import {
  READER_SETTINGS_ONBOARDING_STEP_MS,
  READER_SETTINGS_ONBOARDING_STEPS,
  type ReaderSettingsOnboardingStepId,
} from "@/src/features/reader/readerSettingsOnboardingSteps";

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

function fallbackSettingsRowTarget(
  stepId: ReaderSettingsOnboardingStepId,
  screenW: number,
  screenH: number,
  scrollPaddingTop: number,
  insets: EdgeInsets,
): LayoutRectangle {
  const visibleStripW = screenW * 0.42;
  const x = screenW - visibleStripW - Math.max(insets.right, 10);

  if (stepId === "delete-my-data") {
    const bottomPx =
      nativeTabSheetBottomInsetPx(insets.bottom, 10) + (Platform.OS === "ios" ? 30 : 70);
    return {
      x,
      y: screenH - bottomPx - SETTINGS_ROW_HEIGHT_PX,
      width: visibleStripW,
      height: SETTINGS_ROW_HEIGHT_PX,
    };
  }

  const index = READER_SETTINGS_ONBOARDING_STEPS.findIndex((step) => step.id === stepId);
  const y = scrollPaddingTop + Math.max(0, index) * (SETTINGS_ROW_HEIGHT_PX + SETTINGS_ROW_GAP_PX);
  return { x, y, width: visibleStripW, height: SETTINGS_ROW_HEIGHT_PX };
}

export function useReaderSettingsOnboarding({
  toolsMenuOpen,
  rowRefs,
  scrollPaddingTop,
  screenW,
  screenH,
  insets,
}: UseReaderSettingsOnboardingArgs) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [presentedStepIndex, setPresentedStepIndex] = useState(0);
  const [rowAnchor, setRowAnchor] = useState<LayoutRectangle | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      const step = READER_SETTINGS_ONBOARDING_STEPS[index];
      if (!step) return;
      const measured = await measureViewInWindow(rowRefs[step.id]);
      const anchor =
        measured ??
        fallbackSettingsRowTarget(step.id, screenW, screenH, scrollPaddingTop, insets);
      setRowAnchor(anchor);
      setPresentedStepIndex(index);
    },
    [insets, rowRefs, screenH, screenW, scrollPaddingTop],
  );

  useEffect(() => {
    if (!active || !toolsMenuOpen) return;
    void measureCurrentStep(stepIndex);
  }, [active, measureCurrentStep, stepIndex, toolsMenuOpen]);

  useEffect(() => {
    if (!toolsMenuOpen) {
      clearTimer();
      setActive(false);
      setStepIndex(0);
      setPresentedStepIndex(0);
      setRowAnchor(null);
      return;
    }

    let cancelled = false;

    const startTimeout = setTimeout(() => {
      void (async () => {
        await new Promise<void>((resolve) => {
          InteractionManager.runAfterInteractions(() => resolve());
        });
        if (cancelled) return;

        const done = await isFeatureOnboardingDone("readerSettings");
        if (cancelled || done) return;

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
      clearTimer();
    };
  }, [clearTimer, finishTour, toolsMenuOpen]);

  const currentStep = active ? (READER_SETTINGS_ONBOARDING_STEPS[presentedStepIndex] ?? null) : null;
  const showLayer = active && toolsMenuOpen && currentStep != null && rowAnchor != null;

  return {
    showLayer,
    currentStep,
    rowAnchor,
  };
}
