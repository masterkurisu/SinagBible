import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  InteractionManager,
  type LayoutRectangle,
  type View,
} from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import {
  isFeatureOnboardingDone,
  markFeatureOnboardingDone,
} from "@/lib/feature-onboarding-storage";
import type { SpotlightTarget } from "@/src/components/feature-onboarding/SpotlightOverlay";
import {
  READER_CHAPTER_NAV_ARROW_CIRCLE_PX,
  READER_CHAPTER_NAV_ARROW_EDGE_INSET_PX,
} from "@/src/features/reader/ReaderChapterNavArrows";
import {
  estimateReaderHeaderToolsPillRect,
  readerHeaderToolTargetsFromPill,
} from "@/src/features/reader/readerHeaderToolTargets";

export type ReaderOnboardingStep =
  | "book-selector"
  | "settings"
  | "page-turns"
  | "tap-select-verse"
  | "long-press-highlight"
  | "clear-selection";

const READER_ONBOARDING_STEPS: ReaderOnboardingStep[] = [
  "book-selector",
  "settings",
  "page-turns",
  "tap-select-verse",
  "long-press-highlight",
  "clear-selection",
];

export const READER_ONBOARDING_MESSAGES: Record<ReaderOnboardingStep, string> = {
  "book-selector": "Choose any book and chapter from here.",
  settings: "Open reader settings — translation, fonts, themes, and more.",
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
  bookButtonRef: RefObject<View | null>;
  settingsButtonRef: RefObject<View | null>;
  selectionBannerRef: RefObject<View | null>;
  headerToolsPillRect: LayoutRectangle | null;
  headerToolsLayoutEpoch: number;
  insets: EdgeInsets;
  screenW: number;
  screenH: number;
  hasPrevChapter: boolean;
  hasNextChapter: boolean;
  selectionBannerTopPx: number;
  androidTopToolsTopPx: number;
  selectedVerseCount: number;
  onTourComplete?: () => void;
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

function chapterNavArrowTargets(
  insets: EdgeInsets,
  screenW: number,
  screenH: number,
  hasPrevChapter: boolean,
  hasNextChapter: boolean,
): LayoutRectangle[] {
  const circle = READER_CHAPTER_NAV_ARROW_CIRCLE_PX;
  const leftInset = Math.max(insets.left, READER_CHAPTER_NAV_ARROW_EDGE_INSET_PX);
  const rightInset = Math.max(insets.right, READER_CHAPTER_NAV_ARROW_EDGE_INSET_PX);
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

function resolveHeaderToolTarget(
  which: "book" | "settings",
  measuredButton: LayoutRectangle | null,
  headerToolsPillRect: LayoutRectangle | null,
  insets: EdgeInsets,
  screenW: number,
  androidTopToolsTopPx: number,
): SpotlightTarget {
  const pill =
    headerToolsPillRect ??
    estimateReaderHeaderToolsPillRect(insets, screenW, androidTopToolsTopPx);
  const fromPill = readerHeaderToolTargetsFromPill(pill)[which];

  if (measuredButton && measuredButton.width > 0 && measuredButton.height > 0) {
    const pillCy = fromPill.y + fromPill.height / 2;
    return {
      x: measuredButton.x,
      y: Math.abs(measuredButton.y - pillCy) < 80 ? measuredButton.y : fromPill.y,
      width: measuredButton.width,
      height: measuredButton.height,
      borderRadius: Math.max(measuredButton.width, measuredButton.height) / 2,
      shape: "circle",
    };
  }

  return fromPill;
}

export function useReaderFeatureOnboarding({
  readerContentReady,
  readerOverlayOpen,
  bookButtonRef,
  settingsButtonRef,
  selectionBannerRef,
  headerToolsPillRect,
  headerToolsLayoutEpoch,
  insets,
  screenW,
  screenH,
  hasPrevChapter,
  hasNextChapter,
  selectionBannerTopPx,
  androidTopToolsTopPx,
  selectedVerseCount,
  onTourComplete,
}: UseReaderFeatureOnboardingArgs) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightTargets, setSpotlightTargets] = useState<SpotlightTarget[]>([]);
  const [coachMarkAnchor, setCoachMarkAnchor] = useState<LayoutRectangle | null>(null);
  const [targetsReady, setTargetsReady] = useState(false);
  const storageCheckedRef = useRef(false);

  const currentStep = READER_ONBOARDING_STEPS[stepIndex] ?? null;
  const isSpotlightStep =
    currentStep === "book-selector" ||
    currentStep === "settings" ||
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

    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    if (currentStep === "book-selector") {
      const measured = await measureViewInWindow(bookButtonRef);
      setSpotlightTargets([
        resolveHeaderToolTarget(
          "book",
          measured,
          headerToolsPillRect,
          insets,
          screenW,
          androidTopToolsTopPx,
        ),
      ]);
      setCoachMarkAnchor(null);
      setTargetsReady(true);
      return;
    }

    if (currentStep === "settings") {
      const measured = await measureViewInWindow(settingsButtonRef);
      setSpotlightTargets([
        resolveHeaderToolTarget(
          "settings",
          measured,
          headerToolsPillRect,
          insets,
          screenW,
          androidTopToolsTopPx,
        ),
      ]);
      setCoachMarkAnchor(null);
      setTargetsReady(true);
      return;
    }

    if (currentStep === "page-turns") {
      const targets = chapterNavArrowTargets(
        insets,
        screenW,
        screenH,
        hasPrevChapter,
        hasNextChapter,
      );
      setSpotlightTargets(
        targets.map((t) => ({
          ...t,
          borderRadius: READER_CHAPTER_NAV_ARROW_CIRCLE_PX / 2,
          shape: "circle" as const,
        })),
      );
      setCoachMarkAnchor(null);
      setTargetsReady(true);
      return;
    }

    if (currentStep === "tap-select-verse" || currentStep === "long-press-highlight") {
      setSpotlightTargets([]);
      setCoachMarkAnchor(null);
      setTargetsReady(true);
      return;
    }

    if (currentStep === "clear-selection") {
      const measured = await measureViewInWindow(selectionBannerRef);
      const anchor = measured ?? selectionBannerFallbackAnchor(screenW, selectionBannerTopPx);
      setSpotlightTargets([
        {
          ...anchor,
          borderRadius: anchor.height / 2,
          shape: "pill",
        },
      ]);
      setCoachMarkAnchor(null);
      setTargetsReady(selectedVerseCount > 0 || measured != null);
      return;
    }
  }, [
    active,
    androidTopToolsTopPx,
    bookButtonRef,
    currentStep,
    hasNextChapter,
    hasPrevChapter,
    headerToolsPillRect,
    insets,
    screenH,
    screenW,
    selectionBannerRef,
    selectionBannerTopPx,
    selectedVerseCount,
    settingsButtonRef,
  ]);

  useEffect(() => {
    if (!active || readerOverlayOpen || !currentStep) return;
    void measureStepTargets();
  }, [
    active,
    currentStep,
    headerToolsLayoutEpoch,
    headerToolsPillRect,
    measureStepTargets,
    readerOverlayOpen,
    screenW,
    screenH,
    selectedVerseCount,
  ]);

  const advanceStep = useCallback(() => {
    const nextIndex = stepIndex + 1;
    if (nextIndex >= READER_ONBOARDING_STEPS.length) {
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
    coachMarkAnchor,
    forceChapterNavArrowsVisible,
    dismissCurrentStep,
    completeInteractionStep,
    message: currentStep ? READER_ONBOARDING_MESSAGES[currentStep] : "",
    subtitle: currentStep ? READER_ONBOARDING_SUBTITLES[currentStep] : undefined,
  };
}
