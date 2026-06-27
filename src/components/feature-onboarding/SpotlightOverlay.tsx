import { useId, useMemo } from "react";
import {
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

  const labelTarget =
    paddedTargets[labelAnchorTargetIndex] ?? paddedTargets[0];
  const topTargetY = paddedTargets.length
    ? Math.min(...paddedTargets.map((t) => t.y))
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
      <SvgMaskedScrim targets={paddedTargets} scrimOpacity={scrimOpacity} maskId={maskId} />

      {allowTargetInteraction ? (
        paddedTargets.map((target, index) => (
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

      <View pointerEvents="none" style={[styles.labelWrap, labelStyle]}>
        <View style={[onboardingTooltipStyles.card, { backgroundColor: colors.tooltipBackground }]}>
          <Text style={[onboardingTooltipStyles.message, { color: colors.tooltipText }]}>{message}</Text>
          {subtitle ? (
            <Text style={[onboardingTooltipStyles.hint, { color: colors.tooltipText }]}>{subtitle}</Text>
          ) : null}
          {showDismissHint ? (
            <Text style={[onboardingTooltipStyles.hint, { color: colors.tooltipText }]}>
              Tap anywhere to continue
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  scrimPanel: {
    position: "absolute",
  },
  labelWrap: {
    position: "absolute",
    alignItems: "center",
  },
});
