import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { CarouselPexelsAttribution } from "@/components/carousel-pexels-attribution";
import { ReaderM3BottomSheet } from "@/src/components/m3/ReaderM3BottomSheet";
import {
  READER_M3_BODY_FONT_PX,
  READER_M3_BODY_LINE_HEIGHT_PX,
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
  READER_M3_OUTLINE_VARIANT,
} from "@/src/features/reader/readerSettingsPanelChrome";

export type CreditsSheetProps = {
  visible: boolean;
  onClose: () => void;
  onOpenPrivacyPolicy: () => void;
  onOpenTermsOfService: () => void;
  bundle: MobileAppThemeBundle;
  insets: { top: number; bottom: number; left: number; right: number };
  isTabletReaderLayout?: boolean;
};

export function CreditsSheet({
  visible,
  onClose,
  onOpenPrivacyPolicy,
  onOpenTermsOfService,
  bundle,
  insets,
  isTabletReaderLayout = false,
}: CreditsSheetProps) {
  const colors = bundle.ui;
  const primary = bundle.chrome.tabTint;
  const scale = isTabletReaderLayout ? 1.35 : 1;

  const sectionHeadingStyle = useMemo(
    () => ({
      fontFamily: "Inter_500Medium" as const,
      fontSize: 13 * scale,
      letterSpacing: 0.6,
      textTransform: "uppercase" as const,
      color: READER_M3_ON_SURFACE_VARIANT,
      marginTop: 8 * scale,
      marginBottom: 4 * scale,
    }),
    [scale],
  );

  const bodyStyle = useMemo(
    () => ({
      fontFamily: "Inter_400Regular" as const,
      fontSize: READER_M3_BODY_FONT_PX * scale * 0.9375,
      lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale * 0.9375,
      color: READER_M3_ON_SURFACE,
    }),
    [scale],
  );

  const linkStyle = useMemo(
    () => ({
      fontFamily: "Inter_500Medium" as const,
      color: primary,
      textDecorationLine: "underline" as const,
    }),
    [primary],
  );

  const openUrl = useCallback((url: string) => {
    void Linking.openURL(url);
  }, []);

  return (
    <ReaderM3BottomSheet
      isOpen={visible}
      onClose={onClose}
      bundle={bundle}
      insets={insets}
      isTabletReaderLayout={isTabletReaderLayout}
      title="Credits"
      accessibilityDismissLabel="Dismiss credits"
      maxHeightRatio={0.9}
    >
      <View style={styles.content}>
        <Text style={sectionHeadingStyle}>Bible Translations</Text>

        <Text style={bodyStyle}>
          The New International Version (NIV) is provided via the{" "}
          <Text
            style={linkStyle}
            onPress={() => openUrl("https://www.youversion.com")}
            accessibilityRole="link"
            accessibilityLabel="YouVersion website"
          >
            YouVersion Platform API
          </Text>
          . The Holy Bible, New International Version®, NIV® Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.®
          Used by permission. All rights reserved worldwide.
        </Text>

        <Text style={bodyStyle}>
          The Holy Bible, Berean Standard Bible (BSB) is produced in cooperation with Bible Hub, Discovery Bible,
          OpenBible.com, and the Berean Bible Translation Committee.
        </Text>

        <Text style={bodyStyle}>The King James Version (KJV) is in the public domain.</Text>

        <Text style={bodyStyle}>
          The World English Bible (WEB) and World English Bible British Edition (WEBBE) are in the public domain. See{" "}
          <Text
            style={linkStyle}
            onPress={() => openUrl("https://worldenglish.bible")}
            accessibilityRole="link"
            accessibilityLabel="World English Bible website"
          >
            worldenglish.bible
          </Text>
        </Text>

        <Text style={bodyStyle}>
          The Open English Bible (OEB) is released under a Creative Commons CC0 1.0 Universal public domain dedication.
        </Text>

        <Text style={bodyStyle}>The American Standard Version (ASV) and Darby Bible are in the public domain.</Text>

        <Text style={bodyStyle}>The Bible in Basic English (BBE) is in the public domain.</Text>

        <Text style={bodyStyle}>Ang Dating Biblia (ADB 1905) is in the public domain.</Text>

        <Text style={bodyStyle}>
          Bible translations are sourced from the{" "}
          <Text
            style={linkStyle}
            onPress={() => openUrl("https://bible.helloao.org")}
            accessibilityRole="link"
            accessibilityLabel="Free Use Bible API website"
          >
            Free Use Bible API (bible.helloao.org)
          </Text>
          , a project by AO Lab. Translations are drawn from{" "}
          <Text
            style={linkStyle}
            onPress={() => openUrl("https://ebible.org")}
            accessibilityRole="link"
            accessibilityLabel="eBible.org website"
          >
            eBible.org
          </Text>{" "}
          and other public domain or openly licensed sources.
        </Text>

        <Text style={bodyStyle}>
          The Berean Standard Bible (BSB) is dedicated to the public domain in partnership with Bible Hub, Discovery
          Bible, OpenBible.com, and the Berean Bible Translation Committee.
        </Text>

        <Text style={bodyStyle}>
          Individual translation licenses are available at{" "}
          <Text
            style={linkStyle}
            onPress={() => openUrl("https://ebible.org/Scriptures")}
            accessibilityRole="link"
            accessibilityLabel="eBible.org translation licenses"
          >
            ebible.org/Scriptures
          </Text>
          .
        </Text>

        <View style={[styles.divider, { backgroundColor: READER_M3_OUTLINE_VARIANT, marginVertical: 12 * scale }]} />

        <Text style={sectionHeadingStyle}>Fonts</Text>

        <Text style={bodyStyle}>
          Inter by Rasmus Andersson, licensed under the{" "}
          <Text
            style={linkStyle}
            onPress={() => openUrl("https://github.com/rsms/inter/blob/master/LICENSE.txt")}
            accessibilityRole="link"
            accessibilityLabel="Inter font SIL Open Font License"
          >
            SIL Open Font License 1.1
          </Text>
          .
        </Text>

        <View style={[styles.divider, { backgroundColor: READER_M3_OUTLINE_VARIANT, marginVertical: 12 * scale }]} />

        <Text style={sectionHeadingStyle}>Vectors &amp; Icons</Text>

        <Text style={bodyStyle}>
          Vectors and icons by{" "}
          <Text
            style={linkStyle}
            onPress={() => openUrl("https://www.svgrepo.com")}
            accessibilityRole="link"
            accessibilityLabel="SVG Repo website"
          >
            SVG Repo
          </Text>
        </Text>

        <View style={[styles.divider, { backgroundColor: READER_M3_OUTLINE_VARIANT, marginVertical: 12 * scale }]} />

        <Text style={sectionHeadingStyle}>Photography</Text>

        <CarouselPexelsAttribution />

        <View style={[styles.divider, { backgroundColor: READER_M3_OUTLINE_VARIANT, marginVertical: 12 * scale }]} />

        <Text style={sectionHeadingStyle}>Open Source</Text>

        <Text style={bodyStyle}>
          Built with{" "}
          <Text
            style={linkStyle}
            onPress={() => openUrl("https://expo.dev")}
            accessibilityRole="link"
            accessibilityLabel="Expo website"
          >
            Expo
          </Text>{" "}
          and{" "}
          <Text
            style={linkStyle}
            onPress={() => openUrl("https://reactnative.dev")}
            accessibilityRole="link"
            accessibilityLabel="React Native website"
          >
            React Native
          </Text>
          . This app makes use of open-source software. Licenses for all packages are included in the app bundle.
        </Text>

        <View style={[styles.divider, { backgroundColor: READER_M3_OUTLINE_VARIANT, marginVertical: 12 * scale }]} />

        <Text style={sectionHeadingStyle}>Privacy</Text>

        <View style={styles.privacyLinkRow} accessibilityRole="text">
          <Text style={bodyStyle}>Read our </Text>
          <Pressable
            onPress={onOpenTermsOfService}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            accessibilityRole="link"
            accessibilityLabel="Open terms of service"
          >
            <Text style={linkStyle}>Terms of Use</Text>
          </Pressable>
          <Text style={bodyStyle}> and </Text>
          <Pressable
            onPress={onOpenPrivacyPolicy}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            accessibilityRole="link"
            accessibilityLabel="Open privacy policy"
          >
            <Text style={linkStyle}>Privacy Policy</Text>
          </Pressable>
          <Text style={bodyStyle}>.</Text>
        </View>

        <Text
          style={[
            bodyStyle,
            {
              textAlign: "center",
              marginTop: 16 * scale,
              color: colors.brown800,
            },
          ]}
        >
          Thank you for using Sinag Bible.
        </Text>
      </View>
    </ReaderM3BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
  },
  divider: {
    height: 1,
  },
  privacyLinkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
});
