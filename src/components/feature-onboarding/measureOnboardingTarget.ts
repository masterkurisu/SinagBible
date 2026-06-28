import { type RefObject } from "react";
import {
  InteractionManager,
  Platform,
  type LayoutRectangle,
  type View,
} from "react-native";

export type MeasureOnboardingTargetOptions = {
  retries?: number;
  minWidth?: number;
  minHeight?: number;
  waitForInteractions?: boolean;
};

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function measureInWindowOnce(ref: RefObject<View | null>): Promise<LayoutRectangle | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node) {
      resolve(null);
      return;
    }
    node.measureInWindow((x: number, y: number, width: number, height: number) => {
      if (width <= 0 || height <= 0) {
        resolve(null);
        return;
      }
      resolve({ x, y, width, height });
    });
  });
}

/** Waits for transitions and layout to settle before measuring onboarding targets. */
export async function waitForOnboardingLayout(): Promise<void> {
  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
  await nextFrame();
  if (Platform.OS === "android") {
    await nextFrame();
  }
}

/**
 * Measures a view in window coordinates with retries (Android often needs extra frames).
 * Attach refs with `collapsable={false}` on the exact tap target wrapper.
 */
export async function measureOnboardingTarget(
  ref: RefObject<View | null>,
  options: MeasureOnboardingTargetOptions = {},
): Promise<LayoutRectangle | null> {
  const {
    retries = Platform.OS === "android" ? 4 : 2,
    minWidth = 1,
    minHeight = 1,
    waitForInteractions = true,
  } = options;

  if (waitForInteractions) {
    await waitForOnboardingLayout();
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      await nextFrame();
      if (Platform.OS === "android") {
        await nextFrame();
      }
    }
    const rect = await measureInWindowOnce(ref);
    if (rect && rect.width >= minWidth && rect.height >= minHeight) {
      return rect;
    }
  }
  return null;
}

/** Measures several targets after a single layout wait (e.g. paired chapter nav arrows). */
export async function measureOnboardingTargets(
  refs: Array<RefObject<View | null> | null | undefined>,
  options?: MeasureOnboardingTargetOptions,
): Promise<(LayoutRectangle | null)[]> {
  if (options?.waitForInteractions !== false) {
    await waitForOnboardingLayout();
  }
  const measureOptions: MeasureOnboardingTargetOptions = {
    ...options,
    waitForInteractions: false,
  };
  const results: (LayoutRectangle | null)[] = [];
  for (const ref of refs) {
    if (!ref) {
      results.push(null);
      continue;
    }
    results.push(await measureOnboardingTarget(ref, measureOptions));
  }
  return results;
}
