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
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";

const BG = "#FFFFFF";
const STAGGER_MS = 150;
const SLIDE_START = 14;
const ANIM_DURATION_MS = 520;

type OnboardingSlide1Props = {
  onNext?: () => void;
};

export function OnboardingSlide1({ onNext }: OnboardingSlide1Props) {
  const { bundle } = useMobileAppTheme();
  const { ui } = bundle;
  const insets = useSafeAreaInsets();

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(SLIDE_START)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineY = useRef(new Animated.Value(SLIDE_START)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const bodyY = useRef(new Animated.Value(SLIDE_START)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonY = useRef(new Animated.Value(SLIDE_START)).current;

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
      timing(titleOpacity, titleY, 0),
      timing(taglineOpacity, taglineY, STAGGER_MS),
      timing(bodyOpacity, bodyY, STAGGER_MS * 2),
      timing(buttonOpacity, buttonY, STAGGER_MS * 3),
    ]).start();
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: BG, paddingTop: insets.top + 48 }]}>
      <View style={styles.content}>
        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleY }],
          }}
        >
          <Text style={[styles.title, { color: ui.brown800 }]}>Sinag Bible</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.taglineWrap,
            { opacity: taglineOpacity, transform: [{ translateY: taglineY }] },
          ]}
        >
          <Text style={[styles.tagline, { color: ui.gold }]}>
            Bible · Journal · Reflection
          </Text>
        </Animated.View>

        <Animated.View
          style={{
            opacity: bodyOpacity,
            transform: [{ translateY: bodyY }],
          }}
        >
          <Text style={[styles.body, { color: ui.tan300 }]}>
            A quiet space to read Scripture, highlight verses, and write what’s on your heart.
          </Text>
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 28),
            opacity: buttonOpacity,
            transform: [{ translateY: buttonY }],
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next"
          onPress={onNext}
          style={({ pressed }) => [styles.nextPressable, pressed && { opacity: 0.65 }]}
        >
          <Text style={[styles.nextLabel, { color: ui.gold }]}>Next</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    paddingHorizontal: 36,
    paddingTop: 8,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 34,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  taglineWrap: {
    marginTop: 14,
  },
  tagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    letterSpacing: 3.2,
    textAlign: "center",
  },
  body: {
    fontFamily: "Lora_400Regular",
    fontSize: 17,
    lineHeight: 28,
    textAlign: "center",
    marginTop: 36,
    maxWidth: 340,
    alignSelf: "center",
  },
  footer: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  nextPressable: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  nextLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
