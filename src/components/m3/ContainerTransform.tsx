import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Platform, useWindowDimensions, type View } from "react-native";
import {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isM3ReducedMotion } from "@/lib/m3-motion-profile-state";
import {
  M3_EMPHASIZED_ACCELERATE_REANIMATED,
  M3_EMPHASIZED_DECELERATE_REANIMATED,
  M3_REDUCED_MOTION_CROSSFADE_MS,
  M3_SCRIM_OPACITY,
  M3_SPRING_DEFAULT_SPATIAL,
  M3_SPRING_SLOW_SPATIAL,
  animateM3EffectsOpacity,
  type M3SpringConfig,
} from "@/src/components/m3/m3-motion";
import { measureOnboardingTarget } from "@/src/components/feature-onboarding/measureOnboardingTarget";

/*
 * Minimal usage (feature wiring is Phase 5+):
 *
 * const sourceRef = useRef<View>(null);
 * const { openFrom, close, isOpen } = useContainerTransform();
 *
 * <Pressable
 *   ref={sourceRef}
 *   collapsable={false}
 *   onPress={() =>
 *     openFrom(sourceRef, {
 *       renderSource: <CardPreview item={item} />,
 *       renderExpanded: <DetailPreview item={item} />,
 *       onClose: () => {},
 *     })
 *   }
 * >
 *   <CardPreview item={item} />
 * </Pressable>
 *
 * Optional background dim — pass `backgroundRef` to openFrom and spread this style on that view:
 * const bgStyle = useContainerTransformBackgroundStyle(screenRef);
 * <View ref={screenRef} style={bgStyle}>...</View>
 */

export type ContainerBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
};

export type ContainerTransformOpenOptions = {
  renderExpanded: ReactNode;
  /** Outgoing content during fade-through [0, 0.25]. Falls back to an empty shell. */
  renderSource?: ReactNode;
  targetBounds?: ContainerBounds;
  /** When set, `useContainerTransformBackgroundStyle(ref)` dims this subtree (scale 0.95, opacity 0.9). */
  backgroundRef?: RefObject<View | null>;
  sourceBorderRadius?: number;
  onClose?: () => void;
  /** Fired when enter progress reaches 1 (morph settled). */
  onSettled?: () => void;
  /** Skip enter animation — overlay starts expanded at progress 1 (reverse-morph handoff). */
  startExpanded?: boolean;
};

export type ContainerTransformSession = {
  sourceRef: RefObject<View | null>;
  startBounds: ContainerBounds;
  targetBounds: ContainerBounds;
  renderSource: ReactNode;
  renderExpanded: ReactNode;
  backgroundRef: RefObject<View | null> | null;
  onClose?: () => void;
  skipMorph: boolean;
  spatialSpring: M3SpringConfig;
};

type ContainerTransformContextValue = {
  isOpen: boolean;
  session: ContainerTransformSession | null;
  progress: SharedValue<number>;
  scrimOpacity: SharedValue<number>;
  backgroundDim: SharedValue<number>;
  openFrom: (sourceRef: RefObject<View | null>, options: ContainerTransformOpenOptions) => void;
  openExpanded: (options: Pick<ContainerTransformOpenOptions, "renderExpanded" | "onClose">) => void;
  close: () => void;
  dismissInstantly: () => void;
  abortToFadeOut: () => void;
};

const ContainerTransformContext = createContext<ContainerTransformContextValue | null>(null);

export const FADE_THROUGH_OUTGOING_END = 0.25;
export const FADE_THROUGH_INCOMING_START = 0.25;
const FULL_SCREEN_TARGET_AREA_RATIO = 0.7;
const DEFAULT_SOURCE_BORDER_RADIUS_PX = 12;

export function pickContainerTransformSpatialSpring(
  targetBounds: ContainerBounds,
  screenW: number,
  screenH: number,
): M3SpringConfig {
  const screenArea = screenW * screenH;
  const targetArea = targetBounds.width * targetBounds.height;
  return targetArea < screenArea * FULL_SCREEN_TARGET_AREA_RATIO
    ? M3_SPRING_DEFAULT_SPATIAL
    : M3_SPRING_SLOW_SPATIAL;
}

export function defaultContainerTransformTargetBounds(
  screenW: number,
  screenH: number,
  insets: { top: number; bottom: number; left: number; right: number },
): ContainerBounds {
  return {
    x: insets.left,
    y: insets.top,
    width: screenW - insets.left - insets.right,
    height: screenH - insets.top - insets.bottom,
    borderRadius: 0,
  };
}

export function animateContainerTransformProgress(
  value: SharedValue<number>,
  target: number,
  entering: boolean,
  springConfig: M3SpringConfig,
  skipMorph: boolean,
  onComplete?: () => void,
): void {
  const finish = (finished?: boolean) => {
    if (finished !== false && onComplete) {
      onComplete();
    }
  };

  if (skipMorph || isM3ReducedMotion()) {
    value.value = withTiming(
      target,
      {
        duration: M3_REDUCED_MOTION_CROSSFADE_MS,
        easing: entering
          ? M3_EMPHASIZED_DECELERATE_REANIMATED
          : M3_EMPHASIZED_ACCELERATE_REANIMATED,
      },
      finish,
    );
    return;
  }

  value.value = withSpring(target, springConfig, finish);
}

export function ContainerTransformProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const progress = useSharedValue(0);
  const scrimOpacity = useSharedValue(0);
  const backgroundDim = useSharedValue(0);

  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<ContainerTransformSession | null>(null);
  const sessionRef = useRef<ContainerTransformSession | null>(null);
  const closingRef = useRef(false);

  const getDefaultTargetBounds = useCallback(
    () => defaultContainerTransformTargetBounds(screenW, screenH, insets),
    [insets, screenH, screenW],
  );

  const finalizeClose = useCallback(() => {
    const onClose = sessionRef.current?.onClose;
    closingRef.current = false;
    sessionRef.current = null;
    setSession(null);
    setIsOpen(false);
    onClose?.();
  }, []);

  const dismissInstantly = useCallback(() => {
    cancelAnimation(progress);
    cancelAnimation(scrimOpacity);
    cancelAnimation(backgroundDim);
    progress.value = 0;
    scrimOpacity.value = 0;
    backgroundDim.value = 0;
    finalizeClose();
  }, [backgroundDim, finalizeClose, progress, scrimOpacity]);

  const runCloseAnimation = useCallback(() => {
    const active = sessionRef.current;
    if (!active || closingRef.current) return;

    closingRef.current = true;
    cancelAnimation(progress);
    cancelAnimation(scrimOpacity);
    cancelAnimation(backgroundDim);

    animateM3EffectsOpacity(scrimOpacity, 0, false);
    if (active.backgroundRef) {
      animateM3EffectsOpacity(backgroundDim, 0, false);
    }

    animateContainerTransformProgress(
      progress,
      0,
      false,
      active.spatialSpring,
      active.skipMorph,
      () => {
        runOnJS(finalizeClose)();
      },
    );
  }, [backgroundDim, finalizeClose, progress, scrimOpacity]);

  const close = useCallback(() => {
    runCloseAnimation();
  }, [runCloseAnimation]);

  const abortToFadeOut = useCallback(() => {
    runCloseAnimation();
  }, [runCloseAnimation]);

  const openExpanded = useCallback(
    (options: Pick<ContainerTransformOpenOptions, "renderExpanded" | "onClose">) => {
      const targetBounds = getDefaultTargetBounds();
      const spatialSpring = pickContainerTransformSpatialSpring(targetBounds, screenW, screenH);
      const skipMorph = isM3ReducedMotion();

      cancelAnimation(progress);
      cancelAnimation(scrimOpacity);
      cancelAnimation(backgroundDim);

      const nextSession: ContainerTransformSession = {
        sourceRef: { current: null },
        startBounds: targetBounds,
        targetBounds,
        renderSource: null,
        renderExpanded: options.renderExpanded,
        backgroundRef: null,
        onClose: options.onClose,
        skipMorph,
        spatialSpring,
      };

      closingRef.current = false;
      sessionRef.current = nextSession;
      setSession(nextSession);
      setIsOpen(true);
      progress.value = 1;
      scrimOpacity.value = M3_SCRIM_OPACITY;
      backgroundDim.value = 0;
    },
    [getDefaultTargetBounds, progress, screenH, screenW, scrimOpacity, backgroundDim],
  );

  const openFrom = useCallback(
    (sourceRef: RefObject<View | null>, options: ContainerTransformOpenOptions) => {
      void (async () => {
        const rect = await measureOnboardingTarget(sourceRef, {
          retries: Platform.OS === "android" ? 4 : 2,
        });
        if (!rect) {
          options.onClose?.();
          return;
        }

        const targetBounds = options.targetBounds ?? getDefaultTargetBounds();
        const spatialSpring = pickContainerTransformSpatialSpring(targetBounds, screenW, screenH);
        const skipMorph = isM3ReducedMotion();

        const startBounds: ContainerBounds = {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          borderRadius: options.sourceBorderRadius ?? DEFAULT_SOURCE_BORDER_RADIUS_PX,
        };

        const onSettled = options.onSettled;
        const nextSession: ContainerTransformSession = {
          sourceRef,
          startBounds,
          targetBounds,
          renderSource: options.renderSource ?? null,
          renderExpanded: options.renderExpanded,
          backgroundRef: options.backgroundRef ?? null,
          onClose: options.onClose,
          skipMorph,
          spatialSpring,
        };

        cancelAnimation(progress);
        cancelAnimation(scrimOpacity);
        cancelAnimation(backgroundDim);

        if (!sessionRef.current && !options.startExpanded) {
          progress.value = 0;
          scrimOpacity.value = 0;
          backgroundDim.value = 0;
        }

        closingRef.current = false;
        sessionRef.current = nextSession;
        setSession(nextSession);
        setIsOpen(true);

        if (options.startExpanded) {
          progress.value = 1;
          scrimOpacity.value = M3_SCRIM_OPACITY;
          if (options.backgroundRef) {
            backgroundDim.value = 1;
          }
          onSettled?.();
          return;
        }

        animateContainerTransformProgress(progress, 1, true, spatialSpring, skipMorph, () => {
          if (onSettled) {
            runOnJS(onSettled)();
          }
        });
        animateM3EffectsOpacity(scrimOpacity, M3_SCRIM_OPACITY, true);
        if (options.backgroundRef) {
          animateM3EffectsOpacity(backgroundDim, 1, true);
        }
      })();
    },
    [backgroundDim, getDefaultTargetBounds, progress, screenH, screenW, scrimOpacity],
  );

  const value = useMemo(
    () => ({
      isOpen,
      session,
      progress,
      scrimOpacity,
      backgroundDim,
      openFrom,
      openExpanded,
      close,
      dismissInstantly,
      abortToFadeOut,
    }),
    [abortToFadeOut, backgroundDim, close, dismissInstantly, isOpen, openExpanded, openFrom, progress, scrimOpacity, session],
  );

  return (
    <ContainerTransformContext.Provider value={value}>{children}</ContainerTransformContext.Provider>
  );
}

export function useContainerTransform(): {
  isOpen: boolean;
  openFrom: (sourceRef: RefObject<View | null>, options: ContainerTransformOpenOptions) => void;
  openExpanded: (options: Pick<ContainerTransformOpenOptions, "renderExpanded" | "onClose">) => void;
  close: () => void;
  dismissInstantly: () => void;
} {
  const ctx = useContext(ContainerTransformContext);
  if (!ctx) {
    throw new Error("useContainerTransform must be used within ContainerTransformProvider");
  }
  return {
    isOpen: ctx.isOpen,
    openFrom: ctx.openFrom,
    openExpanded: ctx.openExpanded,
    close: ctx.close,
    dismissInstantly: ctx.dismissInstantly,
  };
}

export function useContainerTransformInternals(): ContainerTransformContextValue {
  const ctx = useContext(ContainerTransformContext);
  if (!ctx) {
    throw new Error("useContainerTransformInternals must be used within ContainerTransformProvider");
  }
  return ctx;
}

/** Apply to the View passed as `backgroundRef` in `openFrom` when optional root dim is needed. */
export function useContainerTransformBackgroundStyle(targetRef: RefObject<View | null>) {
  const ctx = useContext(ContainerTransformContext);

  return useAnimatedStyle(() => {
    if (!ctx?.session?.backgroundRef || ctx.session.backgroundRef !== targetRef) {
      return {};
    }
    const t = ctx.backgroundDim.value;
    return {
      transform: [{ scale: 1 - t * 0.05 }],
      opacity: 1 - t * 0.1,
    };
  }, [ctx?.session?.backgroundRef, targetRef]);
}
