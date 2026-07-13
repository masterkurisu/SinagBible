import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle, Defs, Mask, Rect } from "react-native-svg";
import Reanimated, {
  Easing as ReanimatedEasing,
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { isLowEndDevice } from "@/lib/device-capability";
import { onboardingTooltipStyles } from "@/src/components/feature-onboarding/onboarding-tooltip-styles";

export type SpotlightTarget = {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
  shape?: "circle" | "rect" | "pill";
};

type SpotlightOverlayProps = {
  targets: SpotlightTarget[];
  message: string;
  subtitle?: string;
  onDismiss: () => void;
  onSkip?: () => void;
  scrimOpacity?: number;
  targetPadding?: number;
  labelPosition?: "below" | "above" | "center" | "auto";
  labelGap?: number;
  labelAnchorTargetIndex?: number;
  showDismissHint?: boolean;
  /** When true, dimmed scrim taps pass through to targets in cutout holes. */
  allowTargetInteraction?: boolean;
  colors: {
    tooltipBackground: string;
    tooltipText: string;
  };
};

const TARGET_MORPH_MS = 520;
const LABEL_CROSSFADE_MS = 300;
const MAX_MORPH_HOLES = 4;

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
const AnimatedRect = Reanimated.createAnimatedComponent(Rect);

function toCircleTarget(target: SpotlightTarget, pad: number): SpotlightTarget {
  const cx = target.x + target.width / 2;
  const cy = target.y + target.height / 2;
  const diameter = Math.max(target.width, target.height) + pad * 2;
  return {
    x: cx - diameter / 2,
    y: cy - diameter / 2,
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    shape: "circle",
  };
}

function paddedTarget(target: SpotlightTarget, pad: number): SpotlightTarget {
  if (target.shape === "circle") {
    return toCircleTarget(target, pad);
  }
  if (target.shape === "pill") {
    const rx = (target.height + pad * 2) / 2;
    return {
      x: target.x - pad,
      y: target.y - pad,
      width: target.width + pad * 2,
      height: target.height + pad * 2,
      borderRadius: rx,
      shape: "pill",
    };
  }
  return {
    x: target.x - pad,
    y: target.y - pad,
    width: target.width + pad * 2,
    height: target.height + pad * 2,
    borderRadius: (target.borderRadius ?? 12) + pad * 0.5,
    shape: "rect",
  };
}

function targetsCanMorph(a: SpotlightTarget[], b: SpotlightTarget[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const shapeOf = (target: SpotlightTarget) => target.shape ?? "rect";
  const fromShape = shapeOf(a[0]!);
  return a.every((target) => shapeOf(target) === fromShape) && b.every((target) => shapeOf(target) === fromShape);
}

function targetsEqual(a: SpotlightTarget[], b: SpotlightTarget[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (target, index) =>
        target.x === b[index]?.x &&
        target.y === b[index]?.y &&
        target.width === b[index]?.width &&
        target.height === b[index]?.height,
    )
  );
}

function targetCornerRadius(target: SpotlightTarget): number {
  if (target.shape === "circle") return target.width / 2;
  if (target.shape === "pill") return target.height / 2;
  return target.borderRadius ?? 12;
}

function pickLabelPlacement(
  primary: SpotlightTarget,
  screenH: number,
): "below" | "above" {
  const belowSpace = screenH - (primary.y + primary.height);
  const aboveSpace = primary.y;
  return belowSpace >= aboveSpace ? "below" : "above";
}

/** Transparent press targets on dimmed regions only — visual dim comes from SVG mask. */
function ScrimPressPanels({
  target,
  onPress,
}: {
  target: SpotlightTarget;
  onPress: () => void;
}) {
  const x = target.x;
  const y = target.y;
  const w = target.width;
  const h = target.height;

  return (
    <>
      <Pressable
        style={[styles.scrimPanel, { top: 0, left: 0, right: 0, height: y }]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Dismiss spotlight"
      />
      <Pressable
        style={[styles.scrimPanel, { top: y + h, left: 0, right: 0, bottom: 0 }]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Dismiss spotlight"
      />
      <Pressable
        style={[styles.scrimPanel, { top: y, left: 0, width: x, height: h }]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Dismiss spotlight"
      />
      <Pressable
        style={[styles.scrimPanel, { top: y, left: x + w, right: 0, height: h }]}
        onPress={onPress}
        accessibilityLabel="Dismiss spotlight"
        accessibilityRole="button"
      />
    </>
  );
}

function SvgMaskedScrim({
  targets,
  scrimOpacity,
  maskId,
}: {
  targets: SpotlightTarget[];
  scrimOpacity: number;
  maskId: string;
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();

  return (
    <Svg
      pointerEvents="none"
      width={screenW}
      height={screenH}
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        <Mask id={maskId} maskUnits="userSpaceOnUse">
          <Rect x={0} y={0} width={screenW} height={screenH} fill="white" />
          {targets.map((target, index) => {
            if (target.shape === "circle") {
              const r = target.width / 2;
              return (
                <Circle
                  key={`hole-${index}`}
                  cx={target.x + r}
                  cy={target.y + r}
                  r={r}
                  fill="black"
                />
              );
            }
            const rx =
              target.shape === "pill"
                ? target.height / 2
                : (target.borderRadius ?? 12);
            return (
              <Rect
                key={`hole-${index}`}
                x={target.x}
                y={target.y}
                width={target.width}
                height={target.height}
                rx={rx}
                ry={rx}
                fill="black"
              />
            );
          })}
        </Mask>
      </Defs>
      <Rect
        x={0}
        y={0}
        width={screenW}
        height={screenH}
        fill={`rgba(0,0,0,${scrimOpacity})`}
        mask={`url(#${maskId})`}
      />
    </Svg>
  );
}

type MorphHoleChannel = {
  fromX: SharedValue<number>;
  fromY: SharedValue<number>;
  fromW: SharedValue<number>;
  fromH: SharedValue<number>;
  fromRx: SharedValue<number>;
  toX: SharedValue<number>;
  toY: SharedValue<number>;
  toW: SharedValue<number>;
  toH: SharedValue<number>;
  toRx: SharedValue<number>;
};

function useMorphHoleChannel(): MorphHoleChannel {
  return {
    fromX: useSharedValue(0),
    fromY: useSharedValue(0),
    fromW: useSharedValue(0),
    fromH: useSharedValue(0),
    fromRx: useSharedValue(0),
    toX: useSharedValue(0),
    toY: useSharedValue(0),
    toW: useSharedValue(0),
    toH: useSharedValue(0),
    toRx: useSharedValue(0),
  };
}

function useMorphHoleChannels(): MorphHoleChannel[] {
  const h0 = useMorphHoleChannel();
  const h1 = useMorphHoleChannel();
  const h2 = useMorphHoleChannel();
  const h3 = useMorphHoleChannel();
  return [h0, h1, h2, h3];
}

function assignMorphHoleChannel(
  channel: MorphHoleChannel,
  from: SpotlightTarget,
  to: SpotlightTarget,
) {
  channel.fromX.value = from.x;
  channel.fromY.value = from.y;
  channel.fromW.value = from.width;
  channel.fromH.value = from.height;
  channel.fromRx.value = targetCornerRadius(from);
  channel.toX.value = to.x;
  channel.toY.value = to.y;
  channel.toW.value = to.width;
  channel.toH.value = to.height;
  channel.toRx.value = targetCornerRadius(to);
}

function MorphCircleHole({
  channel,
  progress,
}: {
  channel: MorphHoleChannel;
  progress: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = progress.value;
    const width = channel.fromW.value + (channel.toW.value - channel.fromW.value) * t;
    const x = channel.fromX.value + (channel.toX.value - channel.fromX.value) * t;
    const y = channel.fromY.value + (channel.toY.value - channel.fromY.value) * t;
    const r = width / 2;
    return {
      cx: x + r,
      cy: y + r,
      r,
    };
  });

  return <AnimatedCircle animatedProps={animatedProps} fill="black" />;
}

function MorphRectHole({
  channel,
  progress,
}: {
  channel: MorphHoleChannel;
  progress: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = progress.value;
    const width = channel.fromW.value + (channel.toW.value - channel.fromW.value) * t;
    const height = channel.fromH.value + (channel.toH.value - channel.fromH.value) * t;
    const x = channel.fromX.value + (channel.toX.value - channel.fromX.value) * t;
    const y = channel.fromY.value + (channel.toY.value - channel.fromY.value) * t;
    const rx = channel.fromRx.value + (channel.toRx.value - channel.fromRx.value) * t;
    return {
      x,
      y,
      width,
      height,
      rx,
      ry: rx,
    };
  });

  return <AnimatedRect animatedProps={animatedProps} fill="black" />;
}

function ReanimatedMorphScrim({
  channels,
  holeCount,
  holeShapes,
  progress,
  scrimOpacity,
  maskId,
}: {
  channels: MorphHoleChannel[];
  holeCount: number;
  holeShapes: Array<SpotlightTarget["shape"]>;
  progress: SharedValue<number>;
  scrimOpacity: number;
  maskId: string;
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();

  return (
    <Svg
      pointerEvents="none"
      width={screenW}
      height={screenH}
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        <Mask id={maskId} maskUnits="userSpaceOnUse">
          <Rect x={0} y={0} width={screenW} height={screenH} fill="white" />
          {Array.from({ length: holeCount }, (_, index) => {
            const channel = channels[index]!;
            const shape = holeShapes[index] ?? "rect";
            if (shape === "circle") {
              return <MorphCircleHole key={`morph-hole-${index}`} channel={channel} progress={progress} />;
            }
            return <MorphRectHole key={`morph-hole-${index}`} channel={channel} progress={progress} />;
          })}
        </Mask>
      </Defs>
      <Rect
        x={0}
        y={0}
        width={screenW}
        height={screenH}
        fill={`rgba(0,0,0,${scrimOpacity})`}
        mask={`url(#${maskId})`}
      />
    </Svg>
  );
}

type SpotlightTransition =
  | { mode: "static"; targets: SpotlightTarget[] }
  | {
      mode: "crossfade";
      outgoing: SpotlightTarget[];
      incoming: SpotlightTarget[];
      outgoingOpacity: Animated.Value;
      incomingOpacity: Animated.Value;
    }
  | {
      mode: "morph";
      targets: SpotlightTarget[];
      holeCount: number;
      holeShapes: Array<SpotlightTarget["shape"]>;
      progress: SharedValue<number>;
    };

function useSpotlightTargetTransition(paddedTargets: SpotlightTarget[]): {
  transition: SpotlightTransition;
  morphChannels: MorphHoleChannel[];
} {
  const prevTargetsRef = useRef(paddedTargets);
  const crossfadeAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const morphChannels = useMorphHoleChannels();
  const morphProgress = useSharedValue(1);
  const morphHoleCount = useRef(0);
  const morphHoleShapes = useRef<Array<SpotlightTarget["shape"]>>([]);

  const outgoingOpacity = useRef(new Animated.Value(0)).current;
  const incomingOpacity = useRef(new Animated.Value(1)).current;

  const [transition, setTransition] = useState<SpotlightTransition>({
    mode: "static",
    targets: paddedTargets,
  });

  const finishMorph = useRef(() => {
    setTransition({ mode: "static", targets: prevTargetsRef.current });
  }).current;

  const finishCrossfade = useRef((next: SpotlightTarget[]) => {
    outgoingOpacity.setValue(0);
    incomingOpacity.setValue(1);
    setTransition({ mode: "static", targets: next });
  }).current;

  useEffect(() => {
    const previous = prevTargetsRef.current;
    const next = paddedTargets;

    if (targetsEqual(previous, next)) {
      return;
    }

    crossfadeAnimRef.current?.stop();
    cancelAnimation(morphProgress);

    if (!targetsCanMorph(previous, next)) {
      prevTargetsRef.current = next;
      setTransition({ mode: "static", targets: next });
      return;
    }

    prevTargetsRef.current = next;

    if (isLowEndDevice) {
      outgoingOpacity.setValue(1);
      incomingOpacity.setValue(0);
      setTransition({
        mode: "crossfade",
        outgoing: previous,
        incoming: next,
        outgoingOpacity,
        incomingOpacity,
      });

      crossfadeAnimRef.current = Animated.parallel([
        Animated.timing(outgoingOpacity, {
          toValue: 0,
          duration: TARGET_MORPH_MS,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(incomingOpacity, {
          toValue: 1,
          duration: TARGET_MORPH_MS,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

      crossfadeAnimRef.current.start(({ finished }) => {
        crossfadeAnimRef.current = null;
        if (finished) {
          finishCrossfade(next);
        }
      });
      return;
    }

    const holeCount = Math.min(Math.max(previous.length, next.length), MAX_MORPH_HOLES);
    morphHoleCount.current = holeCount;
    morphHoleShapes.current = Array.from({ length: holeCount }, (_, index) => {
      const from = previous[Math.min(index, previous.length - 1)]!;
      return from.shape ?? "rect";
    });

    for (let index = 0; index < holeCount; index += 1) {
      const from = previous[Math.min(index, previous.length - 1)]!;
      const to = next[Math.min(index, next.length - 1)]!;
      assignMorphHoleChannel(morphChannels[index]!, from, to);
    }

    morphProgress.value = 0;
    setTransition({
      mode: "morph",
      targets: next,
      holeCount,
      holeShapes: [...morphHoleShapes.current],
      progress: morphProgress,
    });

    morphProgress.value = withTiming(
      1,
      {
        duration: TARGET_MORPH_MS,
        easing: ReanimatedEasing.inOut(ReanimatedEasing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(finishMorph)();
        }
      },
    );
  }, [
    finishCrossfade,
    finishMorph,
    incomingOpacity,
    morphProgress,
    outgoingOpacity,
    paddedTargets,
  ]);

  useEffect(
    () => () => {
      crossfadeAnimRef.current?.stop();
      cancelAnimation(morphProgress);
    },
    [morphProgress],
  );

  return { transition, morphChannels };
}

function useCrossfadingLabel(message: string, subtitle?: string) {
  const labelOpacity = useRef(new Animated.Value(1)).current;
  const fadeAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const [displayMessage, setDisplayMessage] = useState(message);
  const [displaySubtitle, setDisplaySubtitle] = useState(subtitle);
  const contentKeyRef = useRef(`${message}|${subtitle ?? ""}`);

  useEffect(() => {
    const nextKey = `${message}|${subtitle ?? ""}`;
    if (contentKeyRef.current === nextKey) return;

    fadeAnimRef.current?.stop();
    fadeAnimRef.current = Animated.timing(labelOpacity, {
      toValue: 0.2,
      duration: LABEL_CROSSFADE_MS * 0.4,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    });

    fadeAnimRef.current.start(({ finished }) => {
      fadeAnimRef.current = null;
      if (!finished) return;

      contentKeyRef.current = nextKey;
      setDisplayMessage(message);
      setDisplaySubtitle(subtitle);

      fadeAnimRef.current = Animated.timing(labelOpacity, {
        toValue: 1,
        duration: LABEL_CROSSFADE_MS * 0.6,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      fadeAnimRef.current.start(({ finished: fadeInFinished }) => {
        if (fadeInFinished) fadeAnimRef.current = null;
      });
    });
  }, [labelOpacity, message, subtitle]);

  useEffect(
    () => () => {
      fadeAnimRef.current?.stop();
    },
    [],
  );

  return { displayMessage, displaySubtitle, labelOpacity };
}

export function SpotlightOverlay({
  targets,
  message,
  subtitle,
  onDismiss,
  onSkip,
  scrimOpacity = 0.62,
  targetPadding = 8,
  labelPosition = "auto",
  labelGap = 16,
  labelAnchorTargetIndex = 0,
  showDismissHint = true,
  allowTargetInteraction = false,
  colors,
}: SpotlightOverlayProps) {
  const { height: screenH } = useWindowDimensions();
  const maskId = `spotlight-${useId().replace(/[^a-zA-Z0-9-_]/g, "")}`;
  const morphMaskId = `${maskId}-morph`;

  const paddedTargets = useMemo(
    () => targets.map((t) => paddedTarget(t, targetPadding)),
    [targets, targetPadding],
  );

  const { transition, morphChannels } = useSpotlightTargetTransition(paddedTargets);
  const { displayMessage, displaySubtitle, labelOpacity } = useCrossfadingLabel(message, subtitle);

  const interactionTargets =
    transition.mode === "crossfade"
      ? transition.incoming
      : transition.mode === "morph"
        ? transition.targets
        : transition.targets;

  const labelTarget =
    interactionTargets[labelAnchorTargetIndex] ?? interactionTargets[0];
  const topTargetY = interactionTargets.length
    ? Math.min(...interactionTargets.map((t) => t.y))
    : 0;

  const resolvedLabelPosition =
    labelPosition === "auto" && labelTarget
      ? pickLabelPlacement(labelTarget, screenH)
      : labelPosition === "auto"
        ? "below"
        : labelPosition;

  const labelStyle = useMemo(() => {
    const horizontalInset = 24;
    if (!labelTarget || resolvedLabelPosition === "center") {
      return {
        top: screenH * 0.38,
        left: horizontalInset,
        right: horizontalInset,
      };
    }
    if (resolvedLabelPosition === "below") {
      return {
        top: Math.min(
          labelTarget.y + labelTarget.height + labelGap,
          screenH - 140,
        ),
        left: horizontalInset,
        right: horizontalInset,
      };
    }
    return {
      top: Math.max(24, topTargetY - 118 - labelGap),
      left: horizontalInset,
      right: horizontalInset,
    };
  }, [labelGap, labelTarget, resolvedLabelPosition, screenH, topTargetY]);

  return (
    <View style={styles.root} pointerEvents="box-none" accessibilityViewIsModal>
      {transition.mode === "crossfade" ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { opacity: transition.outgoingOpacity }]}
          >
            <SvgMaskedScrim
              targets={transition.outgoing}
              scrimOpacity={scrimOpacity}
              maskId={`${maskId}-out`}
            />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { opacity: transition.incomingOpacity }]}
          >
            <SvgMaskedScrim
              targets={transition.incoming}
              scrimOpacity={scrimOpacity}
              maskId={`${maskId}-in`}
            />
          </Animated.View>
        </>
      ) : transition.mode === "morph" ? (
        <ReanimatedMorphScrim
          channels={morphChannels}
          holeCount={transition.holeCount}
          holeShapes={transition.holeShapes}
          progress={transition.progress}
          scrimOpacity={scrimOpacity}
          maskId={morphMaskId}
        />
      ) : (
        <SvgMaskedScrim targets={transition.targets} scrimOpacity={scrimOpacity} maskId={maskId} />
      )}

      {allowTargetInteraction ? (
        interactionTargets.map((target, index) => (
          <ScrimPressPanels key={`touch-${index}`} target={target} onPress={onDismiss} />
        ))
      ) : (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={`${message}. Tap anywhere to continue.`}
        />
      )}

      <Animated.View
        pointerEvents={onSkip ? "box-none" : "none"}
        style={[styles.labelWrap, labelStyle, { opacity: labelOpacity }]}
      >
        <View
          pointerEvents={onSkip ? "auto" : "none"}
          style={[onboardingTooltipStyles.card, { backgroundColor: colors.tooltipBackground }]}
        >
          <Text style={[onboardingTooltipStyles.message, { color: colors.tooltipText }]}>{displayMessage}</Text>
          {displaySubtitle ? (
            <Text style={[onboardingTooltipStyles.hint, { color: colors.tooltipText }]}>{displaySubtitle}</Text>
          ) : null}
          {showDismissHint ? (
            <Text style={[onboardingTooltipStyles.hint, { color: colors.tooltipText }]}>
              Tap anywhere to continue
            </Text>
          ) : null}
          {onSkip ? (
            <Pressable
              onPress={onSkip}
              accessibilityRole="button"
              accessibilityLabel="Skip tour"
              hitSlop={8}
              style={{ marginTop: 8 }}
            >
              <Text style={[onboardingTooltipStyles.hint, { color: colors.tooltipText, textDecorationLine: "underline" }]}>
                Skip tour
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
  },
  scrimPanel: {
    position: "absolute",
  },
  labelWrap: {
    position: "absolute",
    alignItems: "center",
  },
});
