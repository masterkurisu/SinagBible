import { useCallback, useEffect, useRef } from "react";
import { Image } from "expo-image";
import {
  Animated,
  Dimensions,
  Easing,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@sinag-bible/ui";

/**
 * Your public Ko-fi page, e.g. `https://ko-fi.com/yourname`.
 * Leave empty until you set it — `Linking.openURL` rejects on many devices for fake/invalid URLs.
 * Button graphic: `assets/support-me-on-kofi.png` (Ko-fi "Support me on Ko-fi" badge).
 */
const KOFI_SUPPORT_URL = "https://ko-fi.com/sinagbible";

const KOFI_BUTTON_IMAGE = require("../assets/support-me-on-kofi.png");
/** Native pixel size of `support-me-on-kofi.png` (980×198). */
const KOFI_BUTTON_ASPECT = 980 / 198;

/** Body copy (paragraphs, list text). */
const BODY_FONT = "Inter_400Regular" as const;
/** Emphasis and links in body. */
const BODY_BOLD_FONT = "Inter_500Medium" as const;
/** Modal title, UI labels in this sheet. */
const UI_FONT = "Inter_600SemiBold" as const;
const SECTION_HEADING_FONT = "Inter_500Medium" as const;

export type CreditsSheetProps = {
  visible: boolean;
  onClose: () => void;
  onOpenPrivacyPolicy: () => void;
  onOpenTermsOfService: () => void;
};

export function CreditsSheet({
  visible,
  onClose,
  onOpenPrivacyPolicy,
  onOpenTermsOfService,
}: CreditsSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const cardMaxH = windowH * 0.9;
  const bottomPad = Math.max(insets.bottom, 12) + 12;

  const slideAnim = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      closingRef.current = false;
      const h = Dimensions.get("window").height;
      slideAnim.setValue(h);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const h = Dimensions.get("window").height;
    Animated.timing(slideAnim, {
      toValue: h,
      duration: 280,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      closingRef.current = false;
      slideAnim.setValue(0);
      onClose();
    });
  }, [onClose, slideAnim]);

  const openKofi = useCallback(() => {
    const url = KOFI_SUPPORT_URL.trim();
    if (!url) return;
    void Linking.openURL(url).catch(() => {
      /* User or OS blocked open; avoid uncaught promise in dev overlay */
    });
  }, []);
  const showKofiSupport = KOFI_SUPPORT_URL.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
      accessibilityViewIsModal
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          accessibilityLabel="Dismiss credits"
        />
        <View
          pointerEvents="box-none"
          style={[styles.sheetWrap, { paddingBottom: bottomPad, paddingTop: insets.top + 8 }]}
        >
          <Animated.View style={[styles.card, { maxHeight: cardMaxH, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.header}>
              <View style={styles.headerEdge} />
              <Text style={[styles.modalTitle, styles.modalTitleCentered]}>Credits</Text>
              <View style={[styles.headerEdge, styles.headerEdgeEnd]}>
                <Pressable
                  onPress={handleClose}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close credits"
                >
                  <Ionicons name="close" size={24} color={colors.brown800} />
                </Pressable>
              </View>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
            >
              {/* ── Bible Translations ── */}
              <Text style={styles.sectionHeading}>Bible Translations</Text>

              <Text style={styles.body}>
                The New International Version (NIV) is provided via the{" "}
                <Text
                  style={styles.link}
                  onPress={() => void Linking.openURL("https://www.youversion.com")}
                  accessibilityRole="link"
                  accessibilityLabel="YouVersion website"
                >
                  YouVersion Platform API
                </Text>
                . The Holy Bible, New International Version®, NIV® Copyright © 1973, 1978,
                1984, 2011 by Biblica, Inc.® Used by permission. All rights reserved worldwide.
              </Text>

              <Text style={styles.body}>
                The Holy Bible, Berean Standard Bible (BSB) is produced in cooperation with Bible Hub,
                Discovery Bible, OpenBible.com, and the Berean Bible Translation Committee.
              </Text>

              <Text style={styles.body}>
                The King James Version (KJV) is in the public domain.
              </Text>

              <Text style={styles.body}>
                The World English Bible (WEB) and World English Bible British Edition (WEBBE) are in the
                public domain. See{" "}
                <Text
                  style={styles.link}
                  onPress={() => void Linking.openURL("https://worldenglish.bible")}
                  accessibilityRole="link"
                  accessibilityLabel="World English Bible website"
                >
                  worldenglish.bible
                </Text>
              </Text>

              <Text style={styles.body}>
                The Open English Bible (OEB) is released under a Creative Commons CC0 1.0 Universal
                public domain dedication.
              </Text>

              <Text style={styles.body}>
                The American Standard Version (ASV) and Darby Bible are in the public domain.
              </Text>

              <Text style={styles.body}>
                The Bible in Basic English (BBE) is in the public domain.
              </Text>

              <Text style={styles.body}>
                Ang Dating Biblia (ADB 1905) is in the public domain.
              </Text>

              <Text style={styles.body}>
                Bible translations are sourced from the{" "}
                <Text
                  style={styles.link}
                  onPress={() => void Linking.openURL("https://bible.helloao.org")}
                  accessibilityRole="link"
                  accessibilityLabel="Free Use Bible API website"
                >
                  Free Use Bible API (bible.helloao.org)
                </Text>
                , a project by AO Lab. Translations are drawn from{" "}
                <Text
                  style={styles.link}
                  onPress={() => void Linking.openURL("https://ebible.org")}
                  accessibilityRole="link"
                  accessibilityLabel="eBible.org website"
                >
                  eBible.org
                </Text>{" "}
                and other public domain or openly licensed sources.
              </Text>

              <Text style={styles.body}>
                The Berean Standard Bible (BSB) is dedicated to the public domain in partnership
                with Bible Hub, Discovery Bible, OpenBible.com, and the Berean Bible Translation
                Committee.
              </Text>

              <Text style={styles.body}>
                Individual translation licenses are available at{" "}
                <Text
                  style={styles.link}
                  onPress={() => void Linking.openURL("https://ebible.org/Scriptures")}
                  accessibilityRole="link"
                  accessibilityLabel="eBible.org translation licenses"
                >
                  ebible.org/Scriptures
                </Text>
                .
              </Text>

              <View style={styles.divider} />

              {/* ── Fonts ── */}
              <Text style={styles.sectionHeading}>Fonts</Text>

              <Text style={styles.body}>
                Inter by Rasmus Andersson, licensed under the{" "}
                <Text
                  style={styles.link}
                  onPress={() => void Linking.openURL("https://github.com/rsms/inter/blob/master/LICENSE.txt")}
                  accessibilityRole="link"
                  accessibilityLabel="Inter font SIL Open Font License"
                >
                  SIL Open Font License 1.1
                </Text>
                .
              </Text>

              <View style={styles.divider} />

              {/* ── Vectors & Icons ── */}
              <Text style={styles.sectionHeading}>Vectors &amp; Icons</Text>

              <Text style={styles.body}>
                Vectors and icons by{" "}
                <Text
                  style={styles.link}
                  onPress={() => void Linking.openURL("https://www.svgrepo.com")}
                  accessibilityRole="link"
                  accessibilityLabel="SVG Repo website"
                >
                  SVG Repo
                </Text>
              </Text>

              <View style={styles.divider} />

              {/* ── Open Source ── */}
              <Text style={styles.sectionHeading}>Open Source</Text>

              <Text style={styles.body}>
                Built with{" "}
                <Text
                  style={styles.link}
                  onPress={() => void Linking.openURL("https://expo.dev")}
                  accessibilityRole="link"
                  accessibilityLabel="Expo website"
                >
                  Expo
                </Text>{" "}
                and{" "}
                <Text
                  style={styles.link}
                  onPress={() => void Linking.openURL("https://reactnative.dev")}
                  accessibilityRole="link"
                  accessibilityLabel="React Native website"
                >
                  React Native
                </Text>
                . This app makes use of open-source software. Licenses for all packages are
                included in the app bundle.
              </Text>

              <View style={styles.divider} />

              {/* ── Privacy ── */}
              <Text style={styles.sectionHeading}>Privacy</Text>

              <View style={styles.privacyLinkRow} accessibilityRole="text">
                <Text style={styles.body}>Read our </Text>
                <Pressable
                  onPress={onOpenTermsOfService}
                  hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                  accessibilityRole="link"
                  accessibilityLabel="Open terms of service"
                >
                  <Text style={styles.link}>Terms of Use</Text>
                </Pressable>
                <Text style={styles.body}> and </Text>
                <Pressable
                  onPress={onOpenPrivacyPolicy}
                  hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                  accessibilityRole="link"
                  accessibilityLabel="Open privacy policy"
                >
                  <Text style={styles.link}>Privacy Policy</Text>
                </Pressable>
                <Text style={styles.body}>.</Text>
              </View>

              <View style={styles.divider} />

              {showKofiSupport ? (
                <>
                  {/* ── Support ── */}
                  <Text style={styles.sectionHeading}>Support</Text>

                  <Text style={styles.body}>
                    This app is free, no strings attached. But if you would like to support its development, a
                    small Ko-fi goes a long way.
                  </Text>

                  <Pressable
                    onPress={openKofi}
                    style={styles.kofiButton}
                    accessibilityRole="link"
                    accessibilityLabel="Support me on Ko-fi"
                  >
                    <Image
                      source={KOFI_BUTTON_IMAGE}
                      style={styles.kofiButtonImage}
                      contentFit="contain"
                      accessibilityIgnoresInvertColors
                    />
                  </Pressable>
                </>
              ) : null}

              <Text style={styles.thankYou}>Thank you for using Sinag Bible.</Text>
            </ScrollView>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(44,36,22,0.52)",
  },
  sheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderSolid,
    backgroundColor: colors.parchment,
    overflow: "hidden",
    shadowColor: "#2c2416",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingTop: 16,
    paddingBottom: 10,
    backgroundColor: colors.parchment,
  },
  headerEdge: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerEdgeEnd: {
    alignItems: "flex-end",
  },
  modalTitle: {
    fontFamily: UI_FONT,
    fontSize: 20,
    color: colors.brown800,
  },
  modalTitleCentered: {
    flex: 1,
    textAlign: "center",
  },
  scroll: { flexGrow: 0 },
  scrollContent: {
    paddingHorizontal: 5,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  sectionHeading: {
    fontFamily: SECTION_HEADING_FONT,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.brown600,
    marginTop: 4,
    marginBottom: 2,
  },
  body: {
    fontFamily: BODY_FONT,
    fontSize: 15,
    lineHeight: 24,
    color: colors.brown800,
  },
  link: {
    fontFamily: BODY_BOLD_FONT,
    color: colors.brown800,
    textDecorationLine: "underline",
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSolid,
    marginVertical: 4,
  },
  privacyLinkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  kofiButton: {
    alignSelf: "center",
    marginTop: 4,
    maxWidth: "100%",
  },
  kofiButtonImage: {
    width: 180,
    maxWidth: "100%",
    aspectRatio: KOFI_BUTTON_ASPECT,
  },
  thankYou: {
    fontFamily: BODY_FONT,
    fontSize: 15,
    lineHeight: 24,
    color: colors.brown800,
    textAlign: "center",
    marginTop: 8,
  },
});