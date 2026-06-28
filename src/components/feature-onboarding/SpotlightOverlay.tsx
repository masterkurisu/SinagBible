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

const TARGET_MORPH_MS = 380;
const LABEL_CROSSFADE_MS = 220;

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

function targetsMatchForMorph(a: SpotlightTarget[], b: SpotlightTarget[]): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  return a.every((target, index) => target.shape === b[index]?.shape);
}

function lerpTargets(from: SpotlightTarget[], to: SpotlightTarget[], t: number): SpotlightTarget[] {
  return from.map((start, index) => {
    const end = to[index]!;
    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      width: start.width + (end.width - start.width) * t,
      height: start.height + (end.height - start.height) * t,
      borderRadius: start.borderRadius ?? end.borderRadius,
      shape: start.shape,
    };
  });
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

function useMorphingTargets(paddedTargets: SpotlightTarget[]): SpotlightTarget[] {
  const prevTargetsRef = useRef<SpotlightTarget[]>(paddedTargets);
  const morphAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const [renderTargets, setRenderTargets] = useState(paddedTargets);

  useEffect(() => {
    const previous = prevTargetsRef.current;
    const next = paddedTargets;

    if (
      previous === next ||
      (previous.length === next.length &&
        previous.every(
          (target, index) =>
            target.x === next[index]?.x &&
            target.y === next[index]?.y &&
            target.width === next[index]?.width &&
            target.height === next[index]?.height,
        ))
    ) {
      prevTargetsRef.current = next;
      setRenderTargets(next);
      return;
    }

    morphAnimRef.current?.stop();

    if (!targetsMatchForMorph(previous, next)) {
      prevTargetsRef.current = next;
      setRenderTargets(next);
      return;
    }

    const progress = new Animated.Value(0);
    const listenerId = progress.addListener(({ value }) => {
      setRenderTargets(lerpTargets(previous, next, value));
    });

    morphAnimRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: TARGET_MORPH_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    morphAnimRef.current.start(({ finished }) => {
      progress.removeListener(listenerId);
      morphAnimRef.current = null;
      if (finished) {
        prevTargetsRef.current = next;
        setRenderTargets(next);
      }
    });

    return () => {
      morphAnimRef.current?.stop();
      progress.removeListener(listenerId);
    };
  }, [paddedTargets]);

  return renderTargets;
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
      toValue: 0,
      duration: LABEL_CROSSFADE_MS,
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
        duration: LABEL_CROSSFADE_MS,
        easing: Easing.out(Easing.quad),
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

  const paddedTargets = useMemo(
    () => targets.map((t) => paddedTarget(t, targetPadding)),
    [targets, targetPadding],
  );

  const renderTargets = useMorphingTargets(paddedTargets);
  const { displayMessage, displaySubtitle, labelOpacity } = useCrossfadingLabel(message, subtitle);

  const labelTarget =
    renderTargets[labelAnchorTargetIndex] ?? renderTargets[0];
  const topTargetY = renderTargets.length
    ? Math.min(...renderTargets.map((t) => t.y))
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
      <SvgMaskedScrim targets={renderTargets} scrimOpacity={scrimOpacity} maskId={maskId} />

      {allowTargetInteraction ? (
        renderTargets.map((target, index) => (
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

      <Animated.View pointerEvents="none" style={[styles.labelWrap, labelStyle, { opacity: labelOpacity }]}>
        <View style={[onboardingTooltipStyles.card, { backgroundColor: colors.tooltipBackground }]}>
          <Text style={[onboardingTooltipStyles.message, { color: colors.tooltipText }]}>{displayMessage}</Text>
          {displaySubtitle ? (
            <Text style={[onboardingTooltipStyles.hint, { color: colors.tooltipText }]}>{displaySubtitle}</Text>
          ) : null}
          {showDismissHint ? (
            <Text style={[onboardingTooltipStyles.hint, { color: colors.tooltipText }]}>
              Tap anywhere to continue
            </Text>
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
