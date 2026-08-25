import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { Asset } from "expo-asset";
import { readAsStringAsync, EncodingType } from "expo-file-system/legacy";
import Markdown from "react-native-markdown-display";
import { ReaderM3BottomSheet } from "@/src/components/m3/ReaderM3BottomSheet";
import { M3Button } from "@/src/components/m3/M3Button";
import { getReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import type { ReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import {
  READER_M3_BODY_FONT_PX,
  READER_M3_BODY_LINE_HEIGHT_PX,
  READER_M3_LABEL_FONT_PX,
  READER_M3_LABEL_LINE_HEIGHT_PX,
  READER_M3_SETTINGS_SHEET_TITLE_FONT,
  READER_M3_SETTINGS_SHEET_TITLE_FONT_PX,
  READER_M3_SETTINGS_SHEET_TITLE_LINE_HEIGHT_PX,
  READER_OVERLAY_CONTENT_SCALE,
} from "@/src/features/reader/readerSettingsPanelChrome";

/**
 * Bundled from repo root `privacy_policy.md` (see `metro.config.js` `.md` asset handling).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro asset module
const privacyPolicyMdModule = require("../privacy_policy.md") as number;

async function readBundledPrivacyPolicy(): Promise<string> {
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

function preparePrivacyPolicyMarkdown(raw: string): { subtitle?: string; body: string } {
  const effectiveMatch = raw.match(/\*\*Effective date:\*\*\s*(.+)/i);
  const subtitle = effectiveMatch?.[1]?.trim();
  const bodyStart = raw.search(/^## /m);
  const body = bodyStart >= 0 ? raw.slice(bodyStart).trim() : raw.trim();
  return { subtitle, body };
}

function buildMarkdownStyles(scale: number, sheetChrome: ReaderSheetChrome) {
  const bodySize = READER_M3_BODY_FONT_PX * scale * 0.9375;
  const bodyLineHeight = READER_M3_BODY_LINE_HEIGHT_PX * scale * 0.9375;
  const sectionSize = READER_M3_SETTINGS_SHEET_TITLE_FONT_PX * scale * 0.9;
  const sectionLineHeight = READER_M3_SETTINGS_SHEET_TITLE_LINE_HEIGHT_PX * scale * 0.9;
  const labelSize = READER_M3_LABEL_FONT_PX * scale;
  const labelLineHeight = READER_M3_LABEL_LINE_HEIGHT_PX * scale;

  return {
    body: {
      fontFamily: "Inter_400Regular",
      fontSize: bodySize,
      lineHeight: bodyLineHeight,
      color: sheetChrome.onSurface,
    },
    paragraph: {
      fontFamily: "Inter_400Regular",
      fontSize: bodySize,
      lineHeight: bodyLineHeight,
      color: sheetChrome.onSurface,
      marginTop: 0,
      marginBottom: 12 * scale,
    },
    heading1: {
      fontFamily: READER_M3_SETTINGS_SHEET_TITLE_FONT,
      fontSize: sectionSize,
      lineHeight: sectionLineHeight,
      color: sheetChrome.onSurface,
      marginTop: 8 * scale,
      marginBottom: 8 * scale,
    },
    heading2: {
      fontFamily: READER_M3_SETTINGS_SHEET_TITLE_FONT,
      fontSize: sectionSize,
      lineHeight: sectionLineHeight,
      color: sheetChrome.onSurface,
      marginTop: 20 * scale,
      marginBottom: 8 * scale,
    },
    heading3: {
      fontFamily: "Inter_500Medium",
      fontSize: labelSize + 2 * scale,
      lineHeight: labelLineHeight + 4 * scale,
      color: sheetChrome.onSurface,
      marginTop: 14 * scale,
      marginBottom: 6 * scale,
    },
    strong: {
      fontFamily: "Inter_500Medium",
      color: sheetChrome.onSurface,
    },
    em: {
      fontFamily: "Inter_400Regular",
      fontStyle: "italic" as const,
      color: sheetChrome.onSurfaceVariant,
    },
    hr: {
      backgroundColor: sheetChrome.outlineVariant,
      height: 1,
      marginVertical: 16 * scale,
    },
    bullet_list: {
      marginBottom: 10 * scale,
    },
    ordered_list: {
      marginBottom: 10 * scale,
    },
    list_item: {
      marginBottom: 4 * scale,
    },
    bullet_list_icon: {
      marginLeft: 0,
      marginRight: 8 * scale,
      color: sheetChrome.onSurfaceVariant,
    },
  } as const;
}

export type PrivacyPolicySheetProps = {
  visible: boolean;
  onClose: () => void;
  bundle: MobileAppThemeBundle;
  insets: { top: number; bottom: number; left: number; right: number };
  isTabletReaderLayout?: boolean;
};

export function PrivacyPolicySheet({
  visible,
  onClose,
  bundle,
  insets,
  isTabletReaderLayout = false,
}: PrivacyPolicySheetProps) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const scale = READER_OVERLAY_CONTENT_SCALE;
  const sheetChrome = useMemo(() => getReaderSheetChrome(bundle), [bundle]);
  const markdownStyles = useMemo(
    () => buildMarkdownStyles(scale, sheetChrome),
    [scale, sheetChrome],
  );

  const prepared = useMemo(
    () => (markdown ? preparePrivacyPolicyMarkdown(markdown) : null),
    [markdown],
  );

  useEffect(() => {
    if (!visible || markdown !== null) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    void (async () => {
      try {
        const text = await readBundledPrivacyPolicy();
        if (!cancelled) setMarkdown(text);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, markdown]);

  const retryLoad = useCallback(() => {
    setLoadError(false);
    setLoading(true);
    void (async () => {
      try {
        const text = await readBundledPrivacyPolicy();
        setMarkdown(text);
        setLoadError(false);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <ReaderM3BottomSheet
      isOpen={visible}
      onClose={onClose}
      bundle={bundle}
      insets={insets}
      isTabletReaderLayout={isTabletReaderLayout}
      title="Privacy Policy"
      subtitle={prepared?.subtitle ? `Effective ${prepared.subtitle}` : undefined}
      accessibilityDismissLabel="Dismiss privacy policy"
      widthVariant="reading"
      maxHeightRatio={0.9}
    >
      {loading && markdown === null ? (
        <View style={[styles.stateBox, { minHeight: 160 * scale, gap: 12 * scale }]}>
          <ActivityIndicator color={bundle.chrome.tabTint} />
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: READER_M3_BODY_FONT_PX * scale * 0.875,
              lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale * 0.875,
              color: sheetChrome.onSurfaceVariant,
              textAlign: "center",
            }}
          >
            Loading privacy policy…
          </Text>
        </View>
      ) : loadError ? (
        <View style={[styles.stateBox, { minHeight: 160 * scale, gap: 16 * scale }]}>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: READER_M3_BODY_FONT_PX * scale * 0.9375,
              lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale * 0.9375,
              color: sheetChrome.onSurface,
              textAlign: "center",
            }}
          >
            Could not load the privacy policy.
          </Text>
          <M3Button
            label="Try again"
            onPress={retryLoad}
            variant="tonal"
            bundle={bundle}
            scale={scale}
            accessibilityLabel="Retry loading privacy policy"
          />
        </View>
      ) : (
        <View style={styles.markdownWrap}>
          <Markdown style={markdownStyles}>{prepared?.body ?? ""}</Markdown>
        </View>
      )}
    </ReaderM3BottomSheet>
  );
}

const styles = StyleSheet.create({
  stateBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  markdownWrap: {
    gap: 0,
  },
});
