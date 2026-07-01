import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { type LayoutRectangle, Platform, type View } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import {
  isFeatureOnboardingDone,
  markFeatureOnboardingDone,
} from "@/lib/feature-onboarding-storage";
import {
  measureOnboardingTarget,
  measureOnboardingTargets,
} from "@/src/components/feature-onboarding/measureOnboardingTarget";
import {
  adjustAnchorForOnboardingModal,
} from "@/src/components/feature-onboarding/onboardingOverlayCoords";
import type { SpotlightTarget } from "@/src/components/feature-onboarding/SpotlightOverlay";
import {
  READER_CHAPTER_NAV_ARROW_CIRCLE_PX,
  READER_CHAPTER_NAV_ARROW_EDGE_INSET_PX,
  READER_CHAPTER_NAV_ARROW_RIGHT_EDGE_INSET_PX,
} from "@/src/features/reader/ReaderChapterNavArrows";
import {
  estimateReaderAndroidAppBarToolRect,
  estimateReaderHeaderToolsPillRect,
  estimateReaderNavigationRailToolsPillRect,
  isPlausibleAndroidAppBarRect,
  isPlausibleHeaderToolsPillRect,
  readerAndroidAppBarToolTargetsFromBar,
  readerHeaderToolTargetsFromPill,
} from "@/src/features/reader/readerHeaderToolTargets";
import {
  readerHeaderIconSpotlight,
  readerPageTurnIconSpotlight,
} from "@/src/features/reader/readerOnboardingSpotlightTargets";

export type ReaderOnboardingStep =
  | "book-selector"
  | "settings"
  | "font-settings"
  | "page-turns"
  | "tap-select-verse"
  | "long-press-highlight"
  | "clear-selection";

function readerOnboardingStepsForPlatform(): ReaderOnboardingStep[] {
  const steps: ReaderOnboardingStep[] = ["book-selector", "settings"];
  if (Platform.OS === "android") {
    steps.push("font-settings");
  }
  steps.push("page-turns", "tap-select-verse", "long-press-highlight", "clear-selection");
  return steps;
}

export const READER_ONBOARDING_MESSAGES: Record<ReaderOnboardingStep, string> = {
  "book-selector": "Choose any book and chapter from here.",
  settings: "Open reader settings — translation, themes, and more.",
  "font-settings": "Adjust size, spacing, and choose a font that's easy on your eyes.",
  "page-turns": "Turn pages with these arrows, or swipe left and right.",
  "tap-select-verse": "Single tap a verse to select it.",
  "long-press-highlight": "Long press a verse to highlight it.",
  "clear-selection": "Tap anywhere to clear your selection.",
};

export const READER_ONBOARDING_SUBTITLES: Partial<Record<ReaderOnboardingStep, string>> = {
  "clear-selection": "Or tap the highlighted verse again.",
};

type UseReaderFeatureOnboardingArgs = {
  readerContentReady: boolean;
  readerOverlayOpen: boolean;
  headerToolsGroupRef: RefObject<View | null>;
  bookButtonRef: RefObject<View | null>;
  settingsButtonRef: RefObject<View | null>;
  fontButtonRef: RefObject<View | null>;
  selectionBannerRef: RefObject<View | null>;
  chapterNavPrevArrowRef: RefObject<View | null>;
  chapterNavNextArrowRef: RefObject<View | null>;
  headerToolsLayoutEpoch: number;
  insets: EdgeInsets;
  screenW: number;
  screenH: number;
  hasPrevChapter: boolean;
  hasNextChapter: boolean;
  selectionBannerTopPx: number;
  androidTopToolsTopPx: number;
  headerToolsTopPx: number;
  isNavigationRailLayout: boolean;
  toolsOnLeft: boolean;
  selectedVerseCount: number;
  onTourComplete?: () => void;
};

function circleSpotlightTarget(rect: LayoutRectangle): SpotlightTarget {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    borderRadius: Math.max(rect.width, rect.height) / 2,
    shape: "circle",
  };
}

function headerToolSpotlightFromLayout(
  which: "book" | "settings" | "font",
  rect: LayoutRectangle,
): SpotlightTarget {
  return readerHeaderIconSpotlight(which, adjustAnchorForOnboardingModal(rect));
}

function headerToolSpotlightFromFallback(
  which: "book" | "settings" | "font",
  pillRect: LayoutRectangle,
  insets: EdgeInsets,
  screenW: number,
  androidTopToolsTopPx: number,
): SpotlightTarget {
  if (which === "font") {
    const fontRect =
      Platform.OS === "android" && isPlausibleAndroidAppBarRect(pillRect, screenW)
        ? readerAndroidAppBarToolTargetsFromBar(pillRect, insets, screenW).font
        : estimateReaderAndroidAppBarToolRect("font", insets, screenW, androidTopToolsTopPx);
    return headerToolSpotlightFromLayout(which, fontRect);
  }

  const fallback =
    Platform.OS === "android" && isPlausibleAndroidAppBarRect(pillRect, screenW)
      ? readerAndroidAppBarToolTargetsFromBar(pillRect, insets, screenW)[which]
      : readerHeaderToolTargetsFromPill(pillRect)[which];
  return headerToolSpotlightFromLayout(which, fallback);
}

function chapterNavArrowFallbackTargets(
  screenW: number,
  screenH: number,
  hasPrevChapter: boolean,
  hasNextChapter: boolean,
): LayoutRectangle[] {
  const circle = READER_CHAPTER_NAV_ARROW_CIRCLE_PX;
  const leftInset = READER_CHAPTER_NAV_ARROW_EDGE_INSET_PX;
  const rightInset = READER_CHAPTER_NAV_ARROW_RIGHT_EDGE_INSET_PX;
  const y = screenH / 2 - circle / 2;
  const targets: LayoutRectangle[] = [];
  if (hasPrevChapter) {
    targets.push({ x: leftInset, y, width: circle, height: circle });
  }
  if (hasNextChapter) {
    targets.push({ x: screenW - rightInset - circle, y, width: circle, height: circle });
  }
  return targets;
}

function selectionBannerFallbackAnchor(
  screenW: number,
  selectionBannerTopPx: number,
): LayoutRectangle {
  const width = Math.min(220, screenW - 48);
  return {
    x: (screenW - width) / 2,
    y: selectionBannerTopPx,
    width,
    height: 44,
  };
}

async function measureHeaderToolsPillRect(
  headerToolsGroupRef: RefObject<View | null>,
  insets: EdgeInsets,
  screenW: number,
  androidTopToolsTopPx: number,
  headerToolsTopPx: number,
  isNavigationRailLayout: boolean,
  toolsOnLeft: boolean,
): Promise<LayoutRectangle> {
  const measured = await measureOnboardingTarget(headerToolsGroupRef, {
    minWidth: Platform.OS === "android" ? screenW * 0.5 : 80,
    minHeight: 36,
  });
  if (Platform.OS === "android" && isPlausibleAndroidAppBarRect(measured, screenW)) {
    return measured;
  }
  if (isPlausibleHeaderToolsPillRect(measured, insets, screenW, toolsOnLeft)) {
    return measured;
  }
  if (Platform.OS === "android") {
    return {
      x: 0,
      y: androidTopToolsTopPx,
      width: screenW,
      height: 56,
    };
  }
  if (isNavigationRailLayout) {
    return estimateReaderNavigationRailToolsPillRect(insets, headerToolsTopPx);
  }
  return estimateReaderHeaderToolsPillRect(insets, screenW, androidTopToolsTopPx, toolsOnLeft);
}

async function measureHeaderToolSpotlightTarget(
  which: "book" | "settings" | "font",
  buttonRef: RefObject<View | null>,
  headerToolsGroupRef: RefObject<View | null>,
  insets: EdgeInsets,
  screenW: number,
  androidTopToolsTopPx: number,
  headerToolsTopPx: number,
  isNavigationRailLayout: boolean,
  toolsOnLeft: boolean,
): Promise<SpotlightTarget> {
  const measuredButton = await measureOnboardingTarget(buttonRef, {
    minWidth: 20,
    minHeight: 20,
  });
  if (measuredButton) {
    return headerToolSpotlightFromLayout(which, measuredButton);
  }

  const pillRect = await measureHeaderToolsPillRect(
    headerToolsGroupRef,
    insets,
    screenW,
    androidTopToolsTopPx,
    headerToolsTopPx,
    isNavigationRailLayout,
    toolsOnLeft,
  );
  return headerToolSpotlightFromFallback(which, pillRect, insets, screenW, androidTopToolsTopPx);
}

export function useReaderFeatureOnboarding({
  readerContentReady,
  readerOverlayOpen,
  headerToolsGroupRef,
  bookButtonRef,
  settingsButtonRef,
  fontButtonRef,
  selectionBannerRef,
  chapterNavPrevArrowRef,
  chapterNavNextArrowRef,
  headerToolsLayoutEpoch,
  insets,
  screenW,
  screenH,
  hasPrevChapter,
  hasNextChapter,
  selectionBannerTopPx,
  androidTopToolsTopPx,
  headerToolsTopPx,
  isNavigationRailLayout,
  toolsOnLeft,
  selectedVerseCount,
  onTourComplete,
}: UseReaderFeatureOnboardingArgs) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightTargets, setSpotlightTargets] = useState<SpotlightTarget[]>([]);
  const [spotlightTargetsStep, setSpotlightTargetsStep] = useState<ReaderOnboardingStep | null>(null);
  const [coachMarkAnchor, setCoachMarkAnchor] = useState<LayoutRectangle | null>(null);
  const [targetsReady, setTargetsReady] = useState(false);
  const storageCheckedRef = useRef(false);

  const currentStep = readerOnboardingStepsForPlatform()[stepIndex] ?? null;
  const isSpotlightStep =
    currentStep === "book-selector" ||
    currentStep === "settings" ||
    currentStep === "font-settings" ||
    currentStep === "page-turns" ||
    currentStep === "clear-selection";
  const isInteractionCoachMark =
    currentStep === "tap-select-verse" || currentStep === "long-press-highlight";
  const isClearSelectionStep = currentStep === "clear-selection";
  const forceChapterNavArrowsVisible = active && currentStep === "page-turns";

  useEffect(() => {
    if (!readerContentReady) return;
    if (storageCheckedRef.current) return;
    storageCheckedRef.current = true;
    void (async () => {
      const done = await isFeatureOnboardingDone("reader");
      if (!done) {
        setActive(true);
      }
    })();
  }, [readerContentReady]);

  const measureStepTargets = useCallback(async () => {
    if (!active || !currentStep) {
      setTargetsReady(false);
      return;
    }

    if (currentStep === "book-selector") {
      const bookTarget = await measureHeaderToolSpotlightTarget(
        "book",
        bookButtonRef,
        headerToolsGroupRef,
        insets,
        screenW,
        androidTopToolsTopPx,
        headerToolsTopPx,
        isNavigationRailLayout,
        toolsOnLeft,
      );
      setSpotlightTargets([bookTarget]);
      setSpotlightTargetsStep("book-selector");
      setCoachMarkAnchor(null);
      setTargetsReady(true);
      return;
    }

    if (currentStep === "settings") {
      const settingsTarget = await measureHeaderToolSpotlightTarget(
        "settings",
        settingsButtonRef,
        headerToolsGroupRef,
        insets,
        screenW,
        androidTopToolsTopPx,
        headerToolsTopPx,
        isNavigationRailLayout,
        toolsOnLeft,
      );
      setSpotlightTargets([settingsTarget]);
      setSpotlightTargetsStep("settings");
      setCoachMarkAnchor(null);
      setTargetsReady(true);
      return;
    }

    if (currentStep === "font-settings") {
      const fontTarget = await measureHeaderToolSpotlightTarget(
        "font",
        fontButtonRef,
        headerToolsGroupRef,
        insets,
        screenW,
        androidTopToolsTopPx,
        headerToolsTopPx,
        isNavigationRailLayout,
        toolsOnLeft,
      );
      setSpotlightTargets([fontTarget]);
      setSpotlightTargetsStep("font-settings");
      setCoachMarkAnchor(null);
      setTargetsReady(true);
      return;
    }

    if (currentStep === "page-turns") {
      const [measuredPrev, measuredNext] = await measureOnboardingTargets(
        [
          hasPrevChapter ? chapterNavPrevArrowRef : null,
          hasNextChapter ? chapterNavNextArrowRef : null,
        ],
        { minWidth: 20, minHeight: 20 },
      );

      const fallbackTargets = chapterNavArrowFallbackTargets(
        screenW,
        screenH,
        hasPrevChapter,
        hasNextChapter,
      );
      const targets: SpotlightTarget[] = [];
      let fallbackIndex = 0;

      if (hasPrevChapter) {
        const rect = adjustAnchorForOnboardingModal(
          measuredPrev ?? fallbackTargets[fallbackIndex++]!,
        );
        targets.push(readerPageTurnIconSpotlight("prev", rect));
      }
      if (hasNextChapter) {
        const rect = adjustAnchorForOnboardingModal(
          measuredNext ?? fallbackTargets[fallbackIndex++]!,
        );
        targets.push(readerPageTurnIconSpotlight("next", rect));
      }

      setSpotlightTargets(targets);
      setSpotlightTargetsStep("page-turns");
      setCoachMarkAnchor(null);
      setTargetsReady(targets.length > 0);
      return;
    }

    if (currentStep === "tap-select-verse" || currentStep === "long-press-highlight") {
      setSpotlightTargets([]);
      setSpotlightTargetsStep(null);
      setCoachMarkAnchor(null);
      setTargetsReady(true);
      return;
    }

    if (currentStep === "clear-selection") {
      const measured = await measureOnboardingTarget(selectionBannerRef, { minWidth: 20, minHeight: 20 });
      const anchor = adjustAnchorForOnboardingModal(
        measured ?? selectionBannerFallbackAnchor(screenW, selectionBannerTopPx),
      );
      setSpotlightTargets([
        {
          ...anchor,
          borderRadius: anchor.height / 2,
          shape: "pill",
        },
      ]);
      setSpotlightTargetsStep("clear-selection");
      setCoachMarkAnchor(null);
      setTargetsReady(selectedVerseCount > 0 || measured != null);
      return;
    }
  }, [
    active,
    androidTopToolsTopPx,
    bookButtonRef,
    fontButtonRef,
    headerToolsGroupRef,
    chapterNavNextArrowRef,
    chapterNavPrevArrowRef,
    currentStep,
    hasNextChapter,
    hasPrevChapter,
    headerToolsTopPx,
    insets,
    isNavigationRailLayout,
    screenH,
    screenW,
    selectionBannerRef,
    selectionBannerTopPx,
    selectedVerseCount,
    settingsButtonRef,
    toolsOnLeft,
  ]);

  useEffect(() => {
    if (!active || readerOverlayOpen || !currentStep) return;
    void measureStepTargets();
  }, [
    active,
    currentStep,
    forceChapterNavArrowsVisible,
    headerToolsLayoutEpoch,
    measureStepTargets,
    readerOverlayOpen,
    screenW,
    screenH,
    selectedVerseCount,
  ]);

  const advanceStep = useCallback(() => {
    const steps = readerOnboardingStepsForPlatform();
    const nextIndex = stepIndex + 1;
    if (nextIndex >= steps.length) {
      setActive(false);
      void markFeatureOnboardingDone("reader");
      onTourComplete?.();
      return;
    }
    setStepIndex(nextIndex);
  }, [onTourComplete, stepIndex]);

  const dismissCurrentStep = useCallback(() => {
    advanceStep();
  }, [advanceStep]);

  const completeInteractionStep = useCallback(() => {
    if (isInteractionCoachMark || isClearSelectionStep) {
      advanceStep();
    }
  }, [advanceStep, isClearSelectionStep, isInteractionCoachMark]);

  const showLayer =
    active &&
    !readerOverlayOpen &&
    currentStep != null &&
    targetsReady &&
    (isSpotlightStep ? spotlightTargets.length > 0 : true);

  return {
    showLayer,
    currentStep,
    isSpotlightStep,
    isCoachMarkStep: currentStep != null && !isSpotlightStep,
    isInteractionCoachMark,
    spotlightTargets,
    spotlightTargetsStep,
    coachMarkAnchor,
    forceChapterNavArrowsVisible,
    dismissCurrentStep,
    completeInteractionStep,
    message: currentStep ? READER_ONBOARDING_MESSAGES[currentStep] : "",
    subtitle: currentStep ? READER_ONBOARDING_SUBTITLES[currentStep] : undefined,
  };
}
