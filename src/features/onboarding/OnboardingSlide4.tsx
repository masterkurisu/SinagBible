import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Markdown from "react-native-markdown-display";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Asset } from "expo-asset";
import { readAsStringAsync, EncodingType } from "expo-file-system/legacy";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { PRIVACY_POLICY_URL } from "@/lib/legal-urls";
import { TermsOfServiceSheet } from "@/components/terms-of-service-sheet";
import { OnboardingScrollScreen } from "./OnboardingScrollScreen";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro asset module (repo root)
const privacyPolicyMdModule = require("../../../privacy_policy.md") as number;

const BG = "#FFFFFF";
const STAGGER_MS = 100;
const SLIDE_START = 14;
const ANIM_DURATION_MS = 520;

const PRIVACY_SUMMARY_LINES = [
  "Everything you write is stored on your device.",
  "No account needed. No data leaves your phone.",
] as const;

/** Hardcoded for the white onboarding sheet so labels stay visible in Modal/pageSheet (theme + Pressable bg can fail to paint). */
const PRIVACY_MODAL_BUTTON_BG = "#2c2416";
const PRIVACY_MODAL_BUTTON_LABEL = "#ffffff";

async function readBundledPrivacyPolicyMd(): Promise<string> {
  const asset = Asset.fromModule(privacyPolicyMdModule);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error("Privacy policy asset missing");
  if (/^https?:\/\//i.test(uri)) {
    const res = await fetch(uri);
    if (!res.ok) throw new Error(`Privacy policy fetch failed (${res.status})`);
    return await res.text();
  }
  return readAsStringAsync(uri, { encoding: EncodingType.UTF8 });
}

type OnboardingSlide4Props = {
  onFinish?: () => void;
  onBack?: () => void;
  /** Reserved for future wiring; policy opens inline in a modal. */
  onPrivacyPress?: () => void;
};

export function OnboardingSlide4({ onFinish, onBack, onPrivacyPress: _onPrivacyPress }: OnboardingSlide4Props) {
  const { bundle } = useMobileAppTheme();
  const { ui } = bundle;
  const insets = useSafeAreaInsets();

  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [policyText, setPolicyText] = useState<string | null>(null);
  const [policyLoadError, setPolicyLoadError] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);

  const labelOpacity = useRef(new Animated.Value(0)).current;
  const labelY = useRef(new Animated.Value(SLIDE_START)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineY = useRef(new Animated.Value(SLIDE_START)).current;
  const sum1Opacity = useRef(new Animated.Value(0)).current;
  const sum1Y = useRef(new Animated.Value(SLIDE_START)).current;
  const sum2Opacity = useRef(new Animated.Value(0)).current;
  const sum2Y = useRef(new Animated.Value(SLIDE_START)).current;
  const finePrintOpacity = useRef(new Animated.Value(0)).current;
  const finePrintY = useRef(new Animated.Value(SLIDE_START)).current;

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
      timing(sum1Opacity, sum1Y, STAGGER_MS * 2),
      timing(sum2Opacity, sum2Y, STAGGER_MS * 3),
      timing(finePrintOpacity, finePrintY, STAGGER_MS * 4),
    ]).start();
  }, []);

  /** Load policy on mount so the sheet footer can enable “I agree” as soon as the modal opens. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const md = await readBundledPrivacyPolicyMd();
        if (!cancelled) setPolicyText(md);
      } catch {
        if (!cancelled) {
          setPolicyLoadError(true);
          setPolicyText("");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openPrivacyModal = useCallback(() => {
    setPrivacyModalVisible(true);
  }, []);

  const closePrivacyModal = useCallback(() => {
    setPrivacyModalVisible(false);
  }, []);

  const onPrivacyAgree = useCallback(() => {
    setPrivacyAgreed(true);
    setPrivacyModalVisible(false);
  }, []);

  const openLivePrivacyPolicy = useCallback(() => {
    void (async () => {
      try {
        await Linking.openURL(PRIVACY_POLICY_URL);
      } catch {
        // ignore blocked URL-open failures
      }
    })();
  }, []);

  const privacyMarkdownStyles = useMemo(
    () => ({
      body: {
        fontFamily: "Inter_400Regular",
        fontSize: 14,
        color: ui.brown800,
        lineHeight: 22,
      },
      paragraph: {
        fontFamily: "Inter_400Regular",
        fontSize: 14,
        color: ui.brown800,
        lineHeight: 22,
        marginTop: 0,
        marginBottom: 12,
      },
      heading1: {
        fontFamily: "Inter_700Bold",
        fontSize: 18,
        color: ui.brown800,
        marginBottom: 8,
      },
      heading2: {
        fontFamily: "Inter_600SemiBold",
        fontSize: 15,
        color: ui.brown800,
        marginTop: 20,
        marginBottom: 6,
      },
      heading3: {
        fontFamily: "Inter_600SemiBold",
        fontSize: 15,
        color: ui.brown800,
        marginTop: 16,
        marginBottom: 6,
      },
      strong: {
        fontFamily: "Inter_600SemiBold",
      },
      hr: {
        backgroundColor: ui.tan100,
        height: 1,
        marginVertical: 16,
      },
      bullet_list: {
        marginBottom: 8,
      },
      ordered_list: {
        marginBottom: 8,
      },
    }),
    [ui.brown800, ui.tan100],
  );

  const summaryAnimated = [
    { opacity: sum1Opacity, y: sum1Y },
    { opacity: sum2Opacity, y: sum2Y },
  ];

  return (
    <>
      <OnboardingScrollScreen
        backgroundColor={BG}
        paddingTop={insets.top + 24}
        mainContentStyle={styles.mainColumn}
        footer={
          <View
            style={[
              styles.backFooter,
              {
                paddingBottom: Math.max(insets.bottom, 28),
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={onBack}
              style={({ pressed }) => [styles.backLinkPressable, pressed && styles.backLinkPressed]}
            >
              <Text style={[styles.backLink, { color: ui.brown600 }]}>Back</Text>
            </Pressable>
          </View>
        }
      >
        <>
          <View style={styles.upperBlock}>
            <Animated.View
              style={{
                opacity: labelOpacity,
                transform: [{ translateY: labelY }],
              }}
            >
              <Text style={[styles.sectionLabel, { color: ui.brown600 }]}>{"BEFORE YOU BEGIN"}</Text>
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
              <Text style={[styles.headline, { color: ui.brown800 }]}>Your words stay yours.</Text>
            </Animated.View>

            <View style={styles.summaryBlock}>
              {PRIVACY_SUMMARY_LINES.map((line, i) => {
                const { opacity, y } = summaryAnimated[i]!;
                return (
                  <Animated.View
                    key={line}
                    style={{
                      opacity,
                      transform: [{ translateY: y }],
                    }}
                  >
                    <Text style={[styles.summaryLine, { color: ui.tan300 }]}>{line}</Text>
                  </Animated.View>
                );
              })}
            </View>

            <Animated.View
              style={[styles.finePrintWrap, { opacity: finePrintOpacity, transform: [{ translateY: finePrintY }] }]}
            >
              <Text style={[styles.finePrint, { color: ui.tan300 }]}>
                By continuing, you agree to our{" "}
                <Text
                  onPress={() => setTermsModalVisible(true)}
                  style={[styles.privacyLink, { color: ui.gold }]}
                  accessibilityRole="link"
                  accessibilityLabel="Terms of Use"
                >
                  Terms of Use
                </Text>{" "}
                and{" "}
                <Text
                  onPress={openPrivacyModal}
                  style={[styles.privacyLink, { color: ui.gold }]}
                  accessibilityRole="link"
                  accessibilityLabel="Privacy Policy"
                >
                  Privacy Policy
                </Text>.
              </Text>
            </Animated.View>
          </View>

          <View style={styles.beginReadingMiddle}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Begin Reading"
              accessibilityState={{ disabled: !privacyAgreed }}
              accessibilityHint={
                privacyAgreed ? undefined : "Open the Privacy Policy and tap I agree to continue."
              }
              disabled={!privacyAgreed}
              onPress={onFinish}
              style={({ pressed }) => [
                styles.beginButton,
                privacyAgreed && pressed && styles.beginButtonPressed,
              ]}
            >
              <Text
                style={[
                  styles.beginButtonLabel,
                  { color: privacyAgreed ? ui.brown800 : ui.tan300 },
                ]}
              >
                Begin Reading
              </Text>
            </Pressable>
          </View>
        </>
      </OnboardingScrollScreen>

      <Modal
        visible={privacyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePrivacyModal}
      >
        {/*
          Footer lives outside ScrollView so Markdown/layout cannot cover the action row, and the
          label sits on a plain View (reliable fill) with fixed contrast colors for this white sheet.
        */}
        <SafeAreaView style={[styles.privacyModalRoot, { backgroundColor: BG }]} edges={["top", "bottom"]}>
          <View style={styles.privacyModalHeader}>
            <Text style={[styles.privacyModalTitle, { color: ui.brown800 }]}>Privacy Policy</Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Open live privacy policy"
              onPress={openLivePrivacyPolicy}
              style={({ pressed }) => [styles.livePolicyLinkPressable, pressed && styles.livePolicyLinkPressed]}
            >
              <Text style={[styles.livePolicyLinkLabel, { color: ui.brown600 }]}>Open live policy URL</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.privacyScroll}
            contentContainerStyle={styles.privacyScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {policyLoadError ? (
              <Text style={[styles.privacyErrorText, { color: ui.brown800 }]}>
                Couldn&apos;t load the privacy policy. Please try again later.
              </Text>
            ) : policyText === null ? (
              <ActivityIndicator size="small" color={ui.brown800} style={styles.privacyLoading} />
            ) : (
              <Markdown style={privacyMarkdownStyles}>{policyText}</Markdown>
            )}
          </ScrollView>
          <View style={[styles.privacyModalFooter, { borderTopColor: ui.tan100 }]}>
            {policyLoadError ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={closePrivacyModal}
                style={({ pressed }) => [pressed && styles.privacyModalButtonPressed]}
              >
                <View style={styles.privacyModalButtonInner}>
                  <Text style={styles.privacyModalButtonLabel}>Close</Text>
                </View>
              </Pressable>
            ) : policyText === null ? (
              <View style={styles.privacyModalButtonInnerMuted} accessibilityElementsHidden>
                <ActivityIndicator size="small" color={PRIVACY_MODAL_BUTTON_BG} />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="I agree"
                onPress={onPrivacyAgree}
                style={({ pressed }) => [pressed && styles.privacyModalButtonPressed]}
              >
                <View style={styles.privacyModalButtonInner}>
                  <Text style={styles.privacyModalButtonLabel}>I agree</Text>
                </View>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      </Modal>
      <TermsOfServiceSheet visible={termsModalVisible} onClose={() => setTermsModalVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  mainColumn: {
    flexGrow: 1,
    justifyContent: "space-between",
  },
  upperBlock: {
    flexShrink: 0,
    paddingHorizontal: 36,
    paddingTop: 16,
    paddingBottom: 8,
  },
  beginReadingMiddle: {
    flexGrow: 1,
    minHeight: 0,
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  backFooter: {
    flexShrink: 0,
    paddingHorizontal: 36,
    alignItems: "center",
  },
  sectionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 3.2,
    textTransform: "uppercase",
    textAlign: "center",
  },
  headlineWrap: {
    marginTop: 16,
  },
  headline: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  summaryBlock: {
    marginTop: 20,
    gap: 8,
    alignItems: "center",
  },
  summaryLine: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 26,
    textAlign: "center",
    maxWidth: 320,
  },
  finePrintWrap: {
    marginTop: 24,
  },
  finePrint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
    alignSelf: "center",
  },
  privacyLink: {
    fontFamily: "Inter_500Medium",
  },
  beginButton: {
    width: "100%",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  beginButtonPressed: {
    opacity: 0.88,
  },
  beginButtonLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    textAlign: "center",
  },
  backLinkPressable: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  backLinkPressed: {
    opacity: 0.65,
  },
  backLink: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
  privacyModalRoot: {
    flex: 1,
  },
  privacyModalHeader: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  privacyModalTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    textAlign: "center",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  livePolicyLinkPressable: {
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  livePolicyLinkPressed: {
    opacity: 0.7,
  },
  livePolicyLinkLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  privacyScroll: {
    flex: 1,
    minHeight: 0,
  },
  privacyScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  privacyModalFooter: {
    flexShrink: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  privacyModalButtonInner: {
    width: "100%",
    minHeight: 52,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIVACY_MODAL_BUTTON_BG,
  },
  privacyModalButtonInnerMuted: {
    width: "100%",
    minHeight: 52,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8e4dc",
  },
  privacyModalButtonLabel: {
    color: PRIVACY_MODAL_BUTTON_LABEL,
    fontSize: 16,
    fontWeight: "600",
  },
  privacyModalButtonPressed: {
    opacity: 0.88,
  },
  privacyErrorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
  },
  privacyLoading: {
    marginVertical: 24,
  },
});
