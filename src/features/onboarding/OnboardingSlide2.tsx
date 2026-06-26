import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OnboardingScrollScreen } from "./OnboardingScrollScreen";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";

const BG = "#FFFFFF";
const STAGGER_MS = 100;
const SLIDE_START = 14;
const ANIM_DURATION_MS = 520;

const FEATURE_LINES = [
  "1,000+ Bible translations",
  "Multiple languages",
  "Red letter editions",
  "5 highlight colors",
  "Per-verse notes",
  "Study notes",
  "Offline reading",
  "Reader themes & typography",
] as const;

type OnboardingSlide2Props = {
  onNext?: () => void;
  onBack?: () => void;
};

export function OnboardingSlide2({ onNext, onBack }: OnboardingSlide2Props) {
  const { bundle } = useMobileAppTheme();
  const { ui } = bundle;
  const insets = useSafeAreaInsets();

  const labelOpacity = useRef(new Animated.Value(0)).current;
  const labelY = useRef(new Animated.Value(SLIDE_START)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineY = useRef(new Animated.Value(SLIDE_START)).current;
  const descOpacity = useRef(new Animated.Value(0)).current;
  const descY = useRef(new Animated.Value(SLIDE_START)).current;
  const feat1Opacity = useRef(new Animated.Value(0)).current;
  const feat1Y = useRef(new Animated.Value(SLIDE_START)).current;
  const feat2Opacity = useRef(new Animated.Value(0)).current;
  const feat2Y = useRef(new Animated.Value(SLIDE_START)).current;
  const feat3Opacity = useRef(new Animated.Value(0)).current;
  const feat3Y = useRef(new Animated.Value(SLIDE_START)).current;
  const feat4Opacity = useRef(new Animated.Value(0)).current;
  const feat4Y = useRef(new Animated.Value(SLIDE_START)).current;
  const feat5Opacity = useRef(new Animated.Value(0)).current;
  const feat5Y = useRef(new Animated.Value(SLIDE_START)).current;
  const feat6Opacity = useRef(new Animated.Value(0)).current;
  const feat6Y = useRef(new Animated.Value(SLIDE_START)).current;
  const feat7Opacity = useRef(new Animated.Value(0)).current;
  const feat7Y = useRef(new Animated.Value(SLIDE_START)).current;
  const feat8Opacity = useRef(new Animated.Value(0)).current;
  const feat8Y = useRef(new Animated.Value(SLIDE_START)).current;
  const navOpacity = useRef(new Animated.Value(0)).current;
  const navY = useRef(new Animated.Value(SLIDE_START)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    const timing = (
      opacity: Animated.Value,
      translateY: Animated.Value,
      delay: number,
    ) =>
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: ANIM_DURATION_MS,
          delay,
          easing: ease,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: ANIM_DURATION_MS,
          delay,
          easing: ease,
          useNativeDriver: true,
        }),
      ]);

    Animated.parallel([
      timing(labelOpacity, labelY, STAGGER_MS * 0),
      timing(headlineOpacity, headlineY, STAGGER_MS * 1),
      timing(descOpacity, descY, STAGGER_MS * 2),
      timing(feat1Opacity, feat1Y, STAGGER_MS * 3),
      timing(feat2Opacity, feat2Y, STAGGER_MS * 4),
      timing(feat3Opacity, feat3Y, STAGGER_MS * 5),
      timing(feat4Opacity, feat4Y, STAGGER_MS * 6),
      timing(feat5Opacity, feat5Y, STAGGER_MS * 7),
      timing(feat6Opacity, feat6Y, STAGGER_MS * 8),
      timing(feat7Opacity, feat7Y, STAGGER_MS * 9),
      timing(feat8Opacity, feat8Y, STAGGER_MS * 10),
      timing(navOpacity, navY, STAGGER_MS * 11),
    ]).start();
  }, []);

  const featAnimated = [
    { opacity: feat1Opacity, y: feat1Y },
    { opacity: feat2Opacity, y: feat2Y },
    { opacity: feat3Opacity, y: feat3Y },
    { opacity: feat4Opacity, y: feat4Y },
    { opacity: feat5Opacity, y: feat5Y },
    { opacity: feat6Opacity, y: feat6Y },
    { opacity: feat7Opacity, y: feat7Y },
    { opacity: feat8Opacity, y: feat8Y },
  ];

  return (
    <OnboardingScrollScreen
      backgroundColor={BG}
      paddingTop={insets.top + 24}
      mainContentStyle={styles.centerBlock}
      footer={
        <Animated.View
          style={[
            styles.navRow,
            {
              paddingBottom: Math.max(insets.bottom, 28),
              opacity: navOpacity,
              transform: [{ translateY: navY }],
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            style={({ pressed }) => [styles.navPressable, pressed && styles.navPressed]}
          >
            <Text style={[styles.navLabel, { color: ui.brown600 }]}>Back</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next"
            onPress={onNext}
            style={({ pressed }) => [styles.navPressable, pressed && styles.navPressed]}
          >
            <Text style={[styles.navLabel, { color: ui.gold }]}>Next</Text>
          </Pressable>
        </Animated.View>
      }
    >
      <>
        <Animated.View
          style={{
            opacity: labelOpacity,
            transform: [{ translateY: labelY }],
          }}
        >
          <Text style={[styles.sectionLabel, { color: ui.brown600 }]}>{"READ & ANNOTATE"}</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.headlineWrap,
            {
              opacity: headlineOpacity,
              transform: [{ translateY: headlineY }],
            },
          ]}
        >
          <Text style={[styles.headline, { color: ui.brown800 }]}>Your Bible, your way.</Text>
        </Animated.View>

        <Animated.View
          style={{
            opacity: descOpacity,
            transform: [{ translateY: descY }],
          }}
        >
          <Text style={[styles.description, { color: ui.tan300 }]}>
            Read across 1,000+ translations in multiple languages, mark what moves you, and go deeper with study
            notes.
          </Text>
        </Animated.View>

        <View style={styles.featureList}>
          {FEATURE_LINES.map((line, i) => {
            const { opacity, y } = featAnimated[i]!;
            return (
              <Animated.View
                key={line}
                style={{
                  opacity,
                  transform: [{ translateY: y }],
                }}
              >
                <Text style={[styles.featureLine, { color: ui.brown800 }]}>{line}</Text>
              </Animated.View>
            );
          })}
        </View>
      </>
    </OnboardingScrollScreen>
  );
}

const styles = StyleSheet.create({
  centerBlock: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 36,
    gap: 24,
  },
  sectionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 3.2,
    textTransform: "uppercase",
    textAlign: "center",
  },
  headlineWrap: {
    marginTop: 0,
  },
  headline: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  description: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 26,
    textAlign: "center",
    maxWidth: 320,
    alignSelf: "center",
  },
  featureList: {
    marginTop: 8,
    gap: 7,
    alignItems: "center",
  },
  featureLine: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    textAlign: "center",
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  navPressable: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    minWidth: 88,
  },
  navPressed: {
    opacity: 0.65,
  },
  navLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
