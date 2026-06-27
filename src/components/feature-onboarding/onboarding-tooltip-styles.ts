import { StyleSheet } from "react-native";

export const ONBOARDING_TOOLTIP_BORDER_RADIUS = 22;

export const onboardingTooltipStyles = StyleSheet.create({
  card: {
    borderRadius: ONBOARDING_TOOLTIP_BORDER_RADIUS,
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  message: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 8,
    opacity: 0.72,
  },
});
