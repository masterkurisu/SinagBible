import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { type LayoutRectangle, type View } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import {
  FEATURE_ONBOARDING_FORCE_ALL,
  isFeatureOnboardingDone,
  markFeatureOnboardingDone,
} from "@/lib/feature-onboarding-storage";
import { measureOnboardingTarget } from "@/src/components/feature-onboarding/measureOnboardingTarget";
import { adjustAnchorForOnboardingModal } from "@/src/components/feature-onboarding/onboardingOverlayCoords";
import {
  BOOK_PICKER_FILTER_ONBOARDING_STEP,
  BOOK_PICKER_ONBOARDING_SETTLE_MS,
  BOOK_PICKER_ONBOARDING_STEP_MS,
} from "@/src/features/reader/bookPickerOnboardingSteps";

type UseBookPickerOnboardingArgs = {
  isOpen: boolean;
  pickerStep: "books" | "chapters";
  viewMenuOpen: boolean;
  filterButtonRef: RefObject<View | null>;
  insets: EdgeInsets;
  screenW: number;
  readerBookSheetScreenEdgePad: number;
  readerBookSheetPad: number;
};

function fallbackFilterButtonAnchor(
  insets: EdgeInsets,
  screenW: number,
  readerBookSheetScreenEdgePad: number,
  readerBookSheetPad: number,
): LayoutRectangle {
  const sheetLeft = insets.left + readerBookSheetScreenEdgePad;
  const buttonSize = 48;
  return {
    x: sheetLeft + readerBookSheetPad,
    y: insets.top + 8 + 6 + 58 + 12,
    width: buttonSize,
    height: 44,
  };
}

export function useBookPickerOnboarding({
  isOpen,
  pickerStep,
  viewMenuOpen,
  filterButtonRef,
  insets,
  screenW,
  readerBookSheetScreenEdgePad,
  readerBookSheetPad,
}: UseBookPickerOnboardingArgs) {
  const [active, setActive] = useState(false);
  const [buttonAnchor, setButtonAnchor] = useState<LayoutRectangle | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = useRef(0);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current != null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const resetSession = useCallback(() => {
    clearDismissTimer();
    setActive(false);
    setButtonAnchor(null);
  }, [clearDismissTimer]);

  const finishTour = useCallback(() => {
    sessionTokenRef.current += 1;
    resetSession();
    if (!FEATURE_ONBOARDING_FORCE_ALL) {
      void markFeatureOnboardingDone("readerBookPicker");
    }
  }, [resetSession]);

  const measureFilterButton = useCallback(async () => {
    const measured = await measureOnboardingTarget(filterButtonRef, {
      minWidth: 20,
      minHeight: 20,
    });
    return adjustAnchorForOnboardingModal(
      measured ??
        fallbackFilterButtonAnchor(
          insets,
          screenW,
          readerBookSheetScreenEdgePad,
          readerBookSheetPad,
        ),
    );
  }, [filterButtonRef, insets, readerBookSheetPad, readerBookSheetScreenEdgePad, screenW]);

  useEffect(() => {
    if (!isOpen || pickerStep !== "books") {
      sessionTokenRef.current += 1;
      resetSession();
      return;
    }

    const token = sessionTokenRef.current;
    const startTimeout = setTimeout(() => {
      void (async () => {
        const done = FEATURE_ONBOARDING_FORCE_ALL
          ? false
          : await isFeatureOnboardingDone("readerBookPicker");
        if (token !== sessionTokenRef.current) return;
        if (done) return;

        setActive(true);
        const anchor = await measureFilterButton();
        if (token !== sessionTokenRef.current) return;

        setButtonAnchor(anchor);
        clearDismissTimer();
        dismissTimerRef.current = setTimeout(() => {
          if (token !== sessionTokenRef.current) return;
          finishTour();
        }, BOOK_PICKER_ONBOARDING_STEP_MS);
      })();
    }, BOOK_PICKER_ONBOARDING_SETTLE_MS);

    return () => {
      clearTimeout(startTimeout);
    };
  }, [clearDismissTimer, finishTour, isOpen, measureFilterButton, pickerStep, resetSession]);

  useEffect(() => {
    if (active && viewMenuOpen) {
      finishTour();
    }
  }, [active, finishTour, viewMenuOpen]);

  useEffect(() => () => clearDismissTimer(), [clearDismissTimer]);

  const showLayer = active && pickerStep === "books" && !viewMenuOpen && buttonAnchor != null;

  return {
    showLayer,
    currentStep: showLayer ? BOOK_PICKER_FILTER_ONBOARDING_STEP : null,
    buttonAnchor,
  };
}
