import { Pressable, StyleSheet, Text, View, type LayoutRectangle } from "react-native";
import { onboardingTooltipStyles } from "@/src/components/feature-onboarding/onboarding-tooltip-styles";

type CoachMarkOverlayProps = {
  message: string;
  onDismiss?: () => void;
  anchor?: LayoutRectangle | null;
  placement?: "center" | "near-anchor-below" | "near-anchor-above";
  dimmed?: boolean;
  dismissOnTap?: boolean;
  hint?: string | null;
  colors: {
    tooltipBackground: string;
    tooltipText: string;
    scrim: string;
  };
};

export function CoachMarkOverlay({
  message,
  onDismiss,
  anchor,
  placement = "center",
  dimmed = true,
  dismissOnTap = true,
  hint = "Tap anywhere to continue",
  colors,
}: CoachMarkOverlayProps) {
  const cardPositionStyle =
    placement === "near-anchor-below" && anchor
      ? {
          position: "absolute" as const,
          top: anchor.y + anchor.height + 14,
          left: Math.max(20, anchor.x - 8),
          right: 20,
        }
      : placement === "near-anchor-above" && anchor
        ? {
            position: "absolute" as const,
            top: Math.max(20, anchor.y - 96),
            left: Math.max(20, anchor.x - 8),
            right: 20,
          }
        : {
            position: "absolute" as const,
            top: "55%" as const,
            left: 24,
            right: 24,
          };

  return (
    <View style={styles.root} pointerEvents="box-none">
      {dimmed ? (
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
          onPress={dismissOnTap ? onDismiss : undefined}
          accessibilityRole="button"
          accessibilityLabel={`${message}. ${hint ?? ""}`}
        />
      ) : null}
      <View pointerEvents="none" style={[styles.cardWrap, cardPositionStyle]}>
        <View style={[onboardingTooltipStyles.card, { backgroundColor: colors.tooltipBackground }]}>
          <Text style={[onboardingTooltipStyles.message, { color: colors.tooltipText }]}>{message}</Text>
          {hint ? (
            <Text style={[onboardingTooltipStyles.hint, { color: colors.tooltipText }]}>{hint}</Text>
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
  cardWrap: {
    alignItems: "center",
  },
});
