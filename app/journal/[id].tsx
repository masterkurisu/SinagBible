import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { useLocalSearchParams, Stack, useRouter, usePathname } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { formatBookLabel } from "@sinag-bible/core";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { UpCircleIcon } from "@/components/icons/UpCircleIcon";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";
import { setPendingJournalEditEntry } from "@/lib/journal-edit-bridge";
import { resolveJournalEntryRouteId } from "@/lib/journal-route-id";
import { loadJournalEntryById } from "@/lib/load-journal-entries";
import type { MobileJournalListItem } from "@/lib/load-journal-entries";
import {
  deleteLocalEntry,
  isSampleJournalEntry,
  JOURNAL_LOCAL_STORAGE_USER_MESSAGE,
} from "@/lib/journal-local";
import { hapticLightImpact } from "@/lib/haptics";
import {
  getVersePreviewForTranslation,
  isTranslationId,
  resolvePassageBookSlugForTranslation,
  type TranslationId,
} from "@sinag-bible/core/bible-translations";
import { JournalOnboardingLayer } from "@/src/features/journal/JournalOnboardingLayer";
import { useJournalDetailOnboarding } from "@/src/features/journal/useJournalDetailOnboarding";
import type { JournalDetailOnboardingStepId } from "@/src/features/journal/journalDetailOnboardingSteps";

const JOURNAL_TITLE_BOTTOM_MARGIN_PX = 10;
const JOURNAL_DATE_BOTTOM_MARGIN_PX = 10;
const JOURNAL_PASSAGE_LABEL_BOTTOM_MARGIN_PX = 5;
const JOURNAL_PASSAGE_REF_BOTTOM_MARGIN_PX = 5;

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type PassageLineEntry = {
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
};

/** Full reference (book + chapter + verses) bold; translation is appended separately in regular weight. */
function passageLineForDisplay(entry: PassageLineEntry): { refBold: string } | null {
  if (!entry.book?.trim() || entry.chapter < 1) return null;
  const label = formatBookLabel(entry.book);
  const ch = entry.chapter;
  const vs = entry.verse_start;
  const ve = entry.verse_end;
  if (!vs) {
    return { refBold: `${label} ${ch}` };
  }
  const tail = ve && ve > vs ? `:${vs}-${ve}` : `:${vs}`;
  return { refBold: `${label} ${ch}${tail}` };
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escapeHtmlAttributeSafeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeJournalHtmlForPrint(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\s(on\w+)=("([^"]*)"|'([^']*)')/gi, "");
}

function buildJournalPdfHtml(opts: {
  title: string | null;
  dateLine: string;
  passageLine: { refBold: string } | null;
  bibleTranslation: string | null;
  verseText: string | null;
  reflectionHtml: string;
  ui: { parchmentMid: string; brown800: string; gold: string; tan200: string };
}): string {
  const { title, dateLine, passageLine, bibleTranslation, verseText, reflectionHtml, ui } = opts;
  const safeBody = sanitizeJournalHtmlForPrint(reflectionHtml);
  const passageSection =
    passageLine || verseText
      ? `<div class="section">
          <div class="label">Passage</div>
          ${
            passageLine
              ? `<p class="passage-ref"><strong>${escapeHtmlAttributeSafeText(passageLine.refBold)}</strong>${
                  bibleTranslation?.trim()
                    ? ` <span class="trans">(${escapeHtmlAttributeSafeText(bibleTranslation.trim())})</span>`
                    : ""
                }</p>`
              : ""
          }
          ${verseText ? `<p class="verse">${escapeHtmlAttributeSafeText(verseText)}</p>` : ""}
        </div>`
      : "";
  const titleBlock = title?.trim()
    ? `<h1>${escapeHtmlAttributeSafeText(title.trim())}</h1>`
    : "";
  const dateBlock = dateLine.trim()
    ? `<div class="date">${escapeHtmlAttributeSafeText(dateLine)}</div>`
    : "";
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&amp;family=Lora:ital,wght@0,400;0,700;1,400&amp;display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px 24px 40px; background: ${ui.parchmentMid}; color: ${ui.brown800}; font-family: Lora, Georgia, serif; font-size: 17px; line-height: 1.55; }
  h1 { font-family: Lora, Georgia, serif; font-size: 32px; font-weight: 400; line-height: 1.2; margin: 0 0 10px; color: ${ui.brown800}; }
  .date { font-family: Inter, system-ui, sans-serif; font-size: 14px; color: ${ui.tan200}; margin-bottom: 24px; }
  .section { margin-bottom: 28px; }
  .label { font-family: Inter, system-ui, sans-serif; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: ${ui.gold}; margin-bottom: 8px; }
  .passage-ref { font-size: 17px; line-height: 1.65; margin: 0 0 8px; }
  .trans { font-weight: 400; }
  .verse { font-family: Lora, Georgia, serif; font-style: italic; font-size: 16px; line-height: 1.5; margin: 0; }
  .reflection p, .reflection div { margin: 0 0 10px; }
  .reflection img { max-width: 100%; height: auto; border-radius: 8px; }
  .reflection ul, .reflection ol { margin: 0 0 10px; padding-left: 1.25em; }
  .reflection li { margin-bottom: 4px; }
</style>
</head>
<body>
${titleBlock}
${dateBlock}
${passageSection}
<div class="section">
  <div class="label">Reflection</div>
  <div class="reflection">${safeBody}</div>
</div>
</body>
</html>`;
}

/**
 * contentEditable / WebView often uses `<span style="font-style: italic">` (and bold via
 * font-weight) instead of `<em>` / `<strong>`. We strip spans later for plain text, so convert
 * these first or italic/bold is lost on the journal detail screen. Patterns allow oblique and
 * flexible spaces around `:` (iOS/Android WebViews differ).
 */
const SPAN_FONT_ITALIC = String.raw`font-style\s*:\s*(?:italic|oblique)`;
const SPAN_FONT_BOLD = String.raw`font-weight\s*:\s*(?:bold|700|bolder|[6-9]00)`;

function normalizeStyleSpansForInline(html: string): string {
  let s = html;
  for (let n = 0; n < 20; n++) {
    const prev = s;
    s = s
      .replace(
        new RegExp(
          `<span\\b[^>]*\\b${SPAN_FONT_ITALIC}[^>]*\\b${SPAN_FONT_BOLD}[^>]*>([\\s\\S]*?)<\\/span>`,
          "gi",
        ),
        "<strong><em>$1</em></strong>",
      )
      .replace(
        new RegExp(
          `<span\\b[^>]*\\b${SPAN_FONT_BOLD}[^>]*\\b${SPAN_FONT_ITALIC}[^>]*>([\\s\\S]*?)<\\/span>`,
          "gi",
        ),
        "<strong><em>$1</em></strong>",
      )
      .replace(
        new RegExp(`<span\\b[^>]*\\b${SPAN_FONT_BOLD}[^>]*>([\\s\\S]*?)<\\/span>`, "gi"),
        "<strong>$1</strong>",
      )
      .replace(
        new RegExp(`<span\\b[^>]*\\b${SPAN_FONT_ITALIC}[^>]*>([\\s\\S]*?)<\\/span>`, "gi"),
        "<em>$1</em>",
      );
    if (s === prev) break;
  }
  return s;
}

function renderInlineHtml(input: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const styleStack: Array<"strong" | "em"> = [];
  const normalized = normalizeStyleSpansForInline(input)
    .replace(/<(\/?)b(\s[^>]*)?>/gi, "<$1strong$2>")
    .replace(/<(\/?)i(\s[^>]*)?>/gi, "<$1em$2>");
  const tokenRegex = /<\/?strong(?:\s[^>]*)?>|<\/?em(?:\s[^>]*)?>|<br\s*\/?>/gi;
  let last = 0;
  let part = 0;

  const pushText = (text: string) => {
    if (!text) return;
    const hasStrong = styleStack.includes("strong");
    const hasEm = styleStack.includes("em");
    let fontFamily = "Lora_400Regular";
    if (hasStrong && hasEm) fontFamily = "Lora_700Bold_Italic";
    else if (hasStrong) fontFamily = "Lora_700Bold";
    else if (hasEm) fontFamily = "Lora_400Regular_Italic";
    nodes.push(
      <Text key={`t-${part++}`} style={{ fontFamily }}>
        {decodeHtmlEntities(text)}
      </Text>,
    );
  };

  for (const match of normalized.matchAll(tokenRegex)) {
    const idx = match.index ?? 0;
    const raw = normalized
      .slice(last, idx)
      .replace(/<\/?(?:p|div|span|font|u)\b[^>]*>/gi, "");
    pushText(raw);
    const tok = match[0] ?? "";
    if (/^<strong\b/i.test(tok)) styleStack.push("strong");
    else if (/^<\/strong\b/i.test(tok)) {
      const i = styleStack.lastIndexOf("strong");
      if (i >= 0) styleStack.splice(i, 1);
    } else if (/^<em\b/i.test(tok)) styleStack.push("em");
    else if (/^<\/em\b/i.test(tok)) {
      const i = styleStack.lastIndexOf("em");
      if (i >= 0) styleStack.splice(i, 1);
    } else {
      nodes.push(
        <Text key={`br-${part++}`}>
          {"\n"}
        </Text>,
      );
    }
    last = idx + (match[0]?.length ?? 0);
  }

  pushText(normalized.slice(last).replace(/<\/?(?:p|div|span|font|u)\b[^>]*>/gi, ""));
  return nodes;
}

function renderSavedReflection(contentHtml: string, bodyColor: string): React.ReactNode[] {
  const blocks = contentHtml.match(/<(p|div|ul|ol)\b[^>]*>[\s\S]*?<\/\1>/gi) ?? [];
  if (blocks.length === 0 && contentHtml.trim()) {
    const forInline = contentHtml
      .replace(/<\/?p\b[^>]*>/gi, "\n")
      .replace(/<\/?div\b[^>]*>/gi, "\n")
      .trim();
    return [
      <Text
        key="fallback"
        className="text-[17px] leading-8 mb-2"
        style={{ fontFamily: "Lora_400Regular", color: bodyColor }}
      >
        {renderInlineHtml(forInline)}
      </Text>,
    ];
  }

  const nodes: React.ReactNode[] = [];
  const normalizeListItemBody = (html: string) =>
    html
      .replace(/<\/?(?:p|div)\b[^>]*>/gi, "")
      .replace(/^(?:\s|<br\s*\/?>)+/gi, "")
      .replace(/(?:\s|<br\s*\/?>)+$/gi, "");

  const appendListNodes = (listBlock: string, keyPrefix: string) => {
    const ordered = /^<ol\b/i.test(listBlock);
    const listItems = Array.from(listBlock.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
    listItems.forEach((li, j) => {
      const marker = ordered ? `${j + 1}. ` : "\u2022 ";
      const body = normalizeListItemBody(li[1] ?? "");
      nodes.push(
        <Text
          key={`${keyPrefix}-${j}`}
          className="text-[17px] leading-8"
          style={{
            fontFamily: "Lora_400Regular",
            marginBottom: j < listItems.length - 1 ? 4 : 0,
            color: bodyColor,
          }}
        >
          {marker}
          {renderInlineHtml(body)}
        </Text>,
      );
    });
  };

  blocks.forEach((block, i) => {
    if (/^<(?:p|div)\b/i.test(block)) {
      const imgMatch = /<img\b[^>]*src="([^"]+)"[^>]*>/i.exec(block);
      if (imgMatch?.[1]) {
        nodes.push(
          <Image
            key={`img-${i}`}
            source={{ uri: decodeHtmlEntities(imgMatch[1]) }}
            placeholder="L6PZfSi_.AyE_3t7t7R**0o#DgR4"
            style={{
              width: "100%",
              height: 220,
              borderRadius: 14,
              backgroundColor: "rgba(255,255,255,0.35)",
              marginBottom: 12,
            }}
            contentFit="contain"
          />,
        );
        const bodyAfterImg = block
          .replace(/^<(?:p|div)[^>]*>/i, "")
          .replace(/<\/(?:p|div)>$/i, "")
          .replace(/<img\b[^>]*>/gi, "")
          .replace(/&nbsp;/gi, " ");
        const plainAfterImg = decodeHtmlEntities(bodyAfterImg.replace(/<[^>]*>/g, "").trim());
        if (plainAfterImg) {
          nodes.push(
            <Text
              key={`p-after-img-${i}`}
              className="text-[17px] leading-8 mb-2"
              style={{ fontFamily: "Lora_400Regular", color: bodyColor }}
            >
              {renderInlineHtml(bodyAfterImg)}
            </Text>,
          );
        }
        return;
      }
      const body = block
        .replace(/^<(?:p|div)[^>]*>/i, "")
        .replace(/<\/(?:p|div)>$/i, "")
        .replace(/&nbsp;/gi, " ");
      const nestedLists = body.match(/<(ul|ol)\b[^>]*>[\s\S]*?<\/\1>/gi) ?? [];
      if (nestedLists.length > 0) {
        nestedLists.forEach((listBlock, listIndex) => {
          appendListNodes(listBlock, `li-${i}-${listIndex}`);
        });
        return;
      }
      const plainBody = decodeHtmlEntities(body.replace(/<[^>]*>/g, "").trim());
      if (!plainBody) return;
      nodes.push(
        <Text
          key={`p-${i}`}
          className="text-[17px] leading-8 mb-2"
          style={{ fontFamily: "Lora_400Regular", color: bodyColor }}
        >
          {renderInlineHtml(body)}
        </Text>,
      );
      return;
    }

    appendListNodes(block, `li-${i}`);
  });
  return nodes;
}

export default function JournalEntryScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { id: idParam } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = resolveJournalEntryRouteId(idParam, pathname);
  const { bundle } = useMobileAppTheme();
  const colors = bundle.ui;
  const j = bundle.journal;
  const headerIconColor = colors.tan300;

  const scrollRef = useRef<ScrollView>(null);
  const shareCaptureRef = useRef<View>(null);
  const shareActionRef = useRef<View>(null);
  const saveActionRef = useRef<View>(null);
  const pdfActionRef = useRef<View>(null);
  const detailOnboardingTargetRefs = useMemo(
    (): Record<JournalDetailOnboardingStepId, React.RefObject<View | null>> => ({
      "share-as-image": shareActionRef,
      "save-to-library": saveActionRef,
      "export-as-pdf": pdfActionRef,
    }),
    [],
  );
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [exportAction, setExportAction] = useState<null | "share" | "save" | "pdf">(null);
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.Value(6)).current;

  const [entry, setEntry] = useState<MobileJournalListItem | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [storageAccessError, setStorageAccessError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [verseText, setVerseText] = useState<string | null>(null);

  const detailOnboarding = useJournalDetailOnboarding({
    entryReady: entry != null && !loadError,
    targetRefs: detailOnboardingTargetRefs,
    screenW,
    screenH,
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError(false);
    setStorageAccessError(false);
    try {
      const row = await loadJournalEntryById(id);
      setEntry(row);
      if (!row) setLoadError(true);
    } catch (e) {
      if (__DEV__) {
        console.error(e);
      }
      setEntry(null);
      setStorageAccessError(true);
      setLoadError(true);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!entry) {
          setVerseText(null);
          return;
        }
        if (!entry.book || entry.chapter <= 0) {
          setVerseText(null);
          return;
        }
        const translationRaw = entry.bible_translation?.trim().toUpperCase();
        const translation: TranslationId = isTranslationId(translationRaw) ? translationRaw : "KJV";
        const resolvedBook = await resolvePassageBookSlugForTranslation(translation, entry.book);
        if (!resolvedBook) {
          if (!cancelled) setVerseText(null);
          return;
        }
        const fullVerse = await getVersePreviewForTranslation(
          translation,
          resolvedBook,
          entry.chapter,
          entry.verse_start,
          entry.verse_end,
        );
        if (!cancelled) setVerseText(fullVerse ?? null);
      } catch {
        if (!cancelled) setVerseText(null);
        return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entry]);

  const showHideThresholds = useMemo(
    () => ({
      showDistancePx: 30,
      hideDistancePx: 55,
    }),
    [],
  );

  const handleScroll = (e: {
    nativeEvent: {
      contentOffset: { y: number };
      layoutMeasurement: { height: number };
      contentSize: { height: number };
    };
  }) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const bottomDistance = contentSize.height - (contentOffset.y + layoutMeasurement.height);

    setShowScrollToTop((prev) => {
      const canScroll = contentSize.height > layoutMeasurement.height + 10;
      if (!canScroll) return false;
      if (prev) {
        return bottomDistance <= showHideThresholds.hideDistancePx;
      }
      return bottomDistance <= showHideThresholds.showDistancePx;
    });
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: showScrollToTop ? 1 : 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: showScrollToTop ? 0 : 6,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacityAnim, translateAnim, showScrollToTop]);

  const passageLine = useMemo(() => {
    if (!entry || !entry.book || entry.chapter < 1) return null;
    return passageLineForDisplay({
      book: entry.book,
      chapter: entry.chapter,
      verse_start: entry.verse_start,
      verse_end: entry.verse_end,
    });
  }, [entry]);

  const renderedBody = entry ? renderSavedReflection(entry.content, colors.brown800) : null;

  const confirmDelete = () => {
    if (!entry || !id) return;
    hapticLightImpact();
    Alert.alert("Delete entry?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void handleDelete(),
      },
    ]);
  };

  const handleDelete = async () => {
    if (!entry || !id) return;
    setDeleting(true);
    try {
      await deleteLocalEntry(id);
      router.back();
    } catch (e) {
      if (__DEV__) {
        console.error(e);
      }
      Alert.alert("Could not delete", "Try again.");
    } finally {
      setDeleting(false);
    }
  };

  const captureEntryPngUri = useCallback(async (): Promise<string | null> => {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    const node = shareCaptureRef.current;
    if (!node) return null;
    try {
      return await captureRef(node, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
    } catch (e) {
      if (__DEV__) {
        console.error(e);
      }
      return null;
    }
  }, []);

  const handleShareImage = useCallback(async () => {
    if (!entry || exportAction !== null) return;
    setExportAction("share");
    let capturedUri: string | null = null;
    try {
      capturedUri = await captureEntryPngUri();
      if (!capturedUri) {
        Alert.alert("Could not share", "Unable to create an image of this entry.");
        return;
      }
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Sharing unavailable", "Sharing is not available on this device.");
        return;
      }
      await Sharing.shareAsync(capturedUri, {
        mimeType: "image/png",
        dialogTitle: entry.title?.trim() || "Journal entry",
      });
    } catch (e) {
      if (__DEV__) {
        console.error(e);
      }
      Alert.alert("Could not share", "Something went wrong. Try again.");
    } finally {
      setExportAction(null);
      if (capturedUri) {
        void FileSystem.deleteAsync(capturedUri, { idempotent: true }).catch(() => {});
      }
    }
  }, [captureEntryPngUri, entry, exportAction]);

  const handleDownloadImage = useCallback(async () => {
    if (!entry || exportAction !== null) return;
    setExportAction("save");
    let capturedUri: string | null = null;
    try {
      const perm =
        Platform.OS === "android"
          ? await MediaLibrary.requestPermissionsAsync(false, ["photo"])
          : await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Photos access needed",
          "Allow photo library access in Settings to save journal images.",
        );
        return;
      }
      capturedUri = await captureEntryPngUri();
      if (!capturedUri) {
        Alert.alert("Could not save", "Unable to create an image of this entry.");
        return;
      }
      await MediaLibrary.saveToLibraryAsync(capturedUri);
      Alert.alert("Saved", "The image was saved to your photo library.");
    } catch (e) {
      if (__DEV__) {
        console.error(e);
      }
      const errorMessage = e instanceof Error ? e.message : String(e ?? "");
      const isExpoGoAndroidMediaLibraryPermissionError =
        Platform.OS === "android" &&
        /expo go can no longer provide full access to the media library/i.test(errorMessage);
      if (isExpoGoAndroidMediaLibraryPermissionError) {
        capturedUri = await captureEntryPngUri();
        if (!capturedUri) {
          Alert.alert("Could not save", "Unable to create an image of this entry.");
          return;
        }
        if (!(await Sharing.isAvailableAsync())) {
          Alert.alert("Could not save", "Media library access is unavailable in Expo Go on Android.");
          return;
        }
        await Sharing.shareAsync(capturedUri, {
          mimeType: "image/png",
          dialogTitle: "Save journal image",
        });
        Alert.alert(
          "Use Share to Save",
          "Expo Go on Android cannot save directly to Photos. Use the share sheet to save the image.",
        );
        return;
      }
      Alert.alert("Could not save", "Something went wrong. Try again.");
    } finally {
      setExportAction(null);
      if (capturedUri) {
        void FileSystem.deleteAsync(capturedUri, { idempotent: true }).catch(() => {});
      }
    }
  }, [captureEntryPngUri, entry, exportAction]);

  const handleDownloadPdf = useCallback(async () => {
    if (!entry || exportAction !== null) return;
    setExportAction("pdf");
    let pdfUri: string | null = null;
    try {
      const html = buildJournalPdfHtml({
        title: entry.title ?? null,
        dateLine: formatDate(entry.created_at),
        passageLine,
        bibleTranslation: entry.bible_translation ?? null,
        verseText,
        reflectionHtml: entry.content ?? "",
        ui: {
          parchmentMid: colors.parchmentMid,
          brown800: colors.brown800,
          gold: colors.gold,
          tan200: colors.tan200,
        },
      });
      const { uri } = await Print.printToFileAsync({ html });
      pdfUri = uri;
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Sharing unavailable", "Sharing is not available on this device.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: entry.title?.trim() || "Journal entry",
        UTI: "com.adobe.pdf",
      });
    } catch (e) {
      if (__DEV__) {
        console.error(e);
      }
      Alert.alert("Could not create PDF", "Something went wrong. Try again.");
    } finally {
      setExportAction(null);
      if (pdfUri) {
        void FileSystem.deleteAsync(pdfUri, { idempotent: true }).catch(() => {});
      }
    }
  }, [
    colors.brown800,
    colors.gold,
    colors.parchmentMid,
    colors.tan200,
    entry,
    exportAction,
    passageLine,
    verseText,
  ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "",
          headerShadowVisible: false,
          headerBackVisible: false,
          headerStyle: { backgroundColor: j.listPageBackground },
          headerTintColor: colors.brown800,
          headerLeft: () => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              activeOpacity={0.85}
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: j.cardBackground,
              }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.brown800} />
            </TouchableOpacity>
          ),
          headerRight:
            entry && !loadError
              ? () => (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginRight: 2 }}>
                    <View ref={shareActionRef} collapsable={false}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Share journal as image"
                        onPress={() => void handleShareImage()}
                        disabled={exportAction !== null}
                        activeOpacity={0.85}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 999,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {exportAction === "share" ? (
                          <ActivityIndicator color={headerIconColor} size="small" />
                        ) : (
                          <ShareOutlineIcon color={headerIconColor} />
                        )}
                      </TouchableOpacity>
                    </View>
                    <View ref={saveActionRef} collapsable={false}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Save journal as image"
                        onPress={() => void handleDownloadImage()}
                        disabled={exportAction !== null}
                        activeOpacity={0.85}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 999,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {exportAction === "save" ? (
                          <ActivityIndicator color={headerIconColor} size="small" />
                        ) : (
                          <DownloadOutlineIcon color={headerIconColor} />
                        )}
                      </TouchableOpacity>
                    </View>
                    <View ref={pdfActionRef} collapsable={false}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Download journal as PDF"
                        onPress={() => void handleDownloadPdf()}
                        disabled={exportAction !== null}
                        activeOpacity={0.85}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 999,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {exportAction === "pdf" ? (
                          <ActivityIndicator color={headerIconColor} size="small" />
                        ) : (
                          <Ionicons name="document-text-outline" size={22} color={headerIconColor} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )
              : undefined,
        }}
      />
      <View className="flex-1" style={{ backgroundColor: j.listPageBackground }}>
        {!id ? (
          <View className="flex-1 px-5 py-8">
            <Text style={{ fontFamily: "Lora_400Regular", fontSize: 16, color: colors.tan300 }}>
              This entry link is invalid. Go back and try again.
            </Text>
          </View>
        ) : !entry && !loadError ? (
          <View className="flex-1 items-center justify-center gap-2">
            <ActivityIndicator color={colors.brown800} />
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: colors.tan200 }}>
              Loading…
            </Text>
          </View>
        ) : loadError || !entry ? (
          <View className="flex-1 px-5 py-8">
            <Text style={{ fontFamily: "Lora_400Regular", fontSize: 16, color: colors.tan300 }}>
              {storageAccessError
                ? JOURNAL_LOCAL_STORAGE_USER_MESSAGE
                : "We couldn’t find this entry. It may have been removed or is not stored on this device."}
            </Text>
          </View>
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              className="flex-1"
              style={{ backgroundColor: j.listPageBackground }}
              contentContainerClassName="pb-36 pt-[4px]"
              scrollEventThrottle={16}
              onScroll={handleScroll}
            >
              <View
                ref={shareCaptureRef}
                collapsable={false}
                className="px-5"
                style={{
                  paddingTop: 20,
                  paddingBottom: 20,
                  marginBottom: 4,
                  backgroundColor: j.listPageBackground,
                }}
              >
                {entry.title?.trim() ? (
                  <Text
                    style={{
                      fontFamily: "Lora_400Regular",
                      marginBottom: JOURNAL_TITLE_BOTTOM_MARGIN_PX,
                      fontSize: 36,
                      lineHeight: 42,
                      color: colors.brown800,
                    }}
                  >
                    {entry.title.trim()}
                  </Text>
                ) : null}
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    marginBottom: JOURNAL_DATE_BOTTOM_MARGIN_PX,
                    fontSize: 14,
                    color: colors.tan200,
                  }}
                >
                  {formatDate(entry.created_at)}
                </Text>

                {passageLine || verseText ? (
                  <>
                    <Text
                      className="text-xs tracking-[2px] uppercase"
                      style={{
                        fontFamily: "Inter_400Regular",
                        marginBottom: JOURNAL_PASSAGE_LABEL_BOTTOM_MARGIN_PX,
                        color: colors.gold,
                      }}
                    >
                      Passage
                    </Text>
                    {passageLine ? (
                      <Text
                        style={{
                          fontFamily: "Lora_400Regular",
                          fontWeight: "500",
                          marginBottom: JOURNAL_PASSAGE_REF_BOTTOM_MARGIN_PX,
                          fontSize: 17,
                          lineHeight: 28,
                          color: colors.brown800,
                        }}
                      >
                        <Text style={{ fontFamily: "Lora_700Bold" }}>{passageLine.refBold}</Text>
                        {entry.bible_translation?.trim()
                          ? ` (${entry.bible_translation.trim()})`
                          : ""}
                      </Text>
                    ) : null}
                    {verseText ? (
                      <Text
                        style={{
                          fontFamily: "Lora_400Regular_Italic",
                          fontSize: 16,
                          lineHeight: 24,
                          marginBottom: 32,
                          color: colors.brown800,
                        }}
                      >
                        {verseText}
                      </Text>
                    ) : null}
                  </>
                ) : null}

                <Text
                  className="text-xs tracking-[2px] uppercase mb-2"
                  style={{ fontFamily: "Inter_400Regular", color: colors.gold }}
                >
                  Reflection
                </Text>
                {renderedBody}
              </View>
            </ScrollView>

            <View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                left: 18,
                bottom: 24,
                zIndex: 20,
              }}
            >
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Delete entry"
                onPress={confirmDelete}
                disabled={deleting}
                activeOpacity={0.85}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: j.cardBackground,
                }}
              >
                {deleting ? (
                  <ActivityIndicator color={colors.brown800} />
                ) : (
                  <TrashIcon color={colors.brown800} />
                )}
              </TouchableOpacity>
            </View>

            {!isSampleJournalEntry(id) ? (
              <View
                pointerEvents="box-none"
                style={{
                  position: "absolute",
                  right: 18,
                  bottom: 24,
                  zIndex: 20,
                }}
              >
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Edit entry"
                  onPress={() => {
                    if (!id || !entry) return;
                    hapticLightImpact();
                    setPendingJournalEditEntry(entry);
                    router.push({
                      pathname: "/journal/edit/[id]",
                      params: { id },
                    } as never);
                  }}
                  activeOpacity={0.88}
                  style={{ borderRadius: 999, overflow: "hidden" }}
                >
                  <LinearGradient
                    colors={[...j.saveReflectionGradient]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 999,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <PencilIcon />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : null}

            <Animated.View
              pointerEvents={showScrollToTop ? "auto" : "none"}
              style={{
                position: "absolute",
                bottom: 92,
                right: 24,
                zIndex: 10,
                opacity: opacityAnim,
                transform: [{ translateY: translateAnim }],
              }}
            >
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => {
                  scrollRef.current?.scrollTo({ y: 0, animated: false });
                  setShowScrollToTop(false);
                }}
                activeOpacity={0.85}
                style={{
                  width: 44,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                }}
              >
                <UpCircleIcon size={29} color={colors.brown800} />
              </TouchableOpacity>
            </Animated.View>
          </>
        )}
      </View>

      <JournalOnboardingLayer
        visible={detailOnboarding.showLayer}
        step={detailOnboarding.currentStep}
        stepAnchor={detailOnboarding.stepAnchor}
        tooltipPlacement="below"
        verticalOffsetPx={15}
        colors={{
          tooltipBackground: colors.brown800,
          tooltipText: "#f5f2ec",
          arrow: "#FFFFFF",
        }}
      />
    </>
  );
}

function TrashIcon({ size = 22, color = "#2C2118" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.7628 9H7.63719C7.18864 9 6.82501 9.37295 6.82501 9.833V16.5C6.82501 17.8807 7.91632 19 9.26251 19H14.1375C14.784 19 15.404 18.7366 15.8611 18.2678C16.3182 17.7989 16.575 17.163 16.575 16.5V9.833C16.575 9.37295 16.2114 9 15.7628 9Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.625 7L13.9191 5.553C13.7541 5.21427 13.4167 5.0002 13.0475 5H10.3526C9.98338 5.0002 9.64596 5.21427 9.48092 5.553L8.77502 7H14.625Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.32469 12.333V15.666M12.5753 12.333V15.666M14.625 7.75H16.575M8.77501 7.75H6.82501"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function PencilIcon({ size = 22, color = "#F6EFE4" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.8787 3.70705C17.0503 2.53547 18.9498 2.53548 20.1213 3.70705L20.2929 3.87862C21.4645 5.05019 21.4645 6.94969 20.2929 8.12126L18.5556 9.85857L8.70713 19.7071C8.57897 19.8352 8.41839 19.9261 8.24256 19.9701L4.24256 20.9701C3.90178 21.0553 3.54129 20.9554 3.29291 20.7071C3.04453 20.4587 2.94468 20.0982 3.02988 19.7574L4.02988 15.7574C4.07384 15.5816 4.16476 15.421 4.29291 15.2928L14.1989 5.38685L15.8787 3.70705ZM18.7071 5.12126C18.3166 4.73074 17.6834 4.73074 17.2929 5.12126L16.3068 6.10738L17.8622 7.72357L18.8787 6.70705C19.2692 6.31653 19.2692 5.68336 18.8787 5.29283L18.7071 5.12126ZM16.4477 9.13804L14.8923 7.52185L5.90299 16.5112L5.37439 18.6256L7.48877 18.097L16.4477 9.13804Z"
        fill={color}
      />
    </Svg>
  );
}

function ShareOutlineIcon({ size = 22, color = "#8B7E6A" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Circle cx="6" cy="12" r="2.25" stroke={color} strokeWidth={1.5} fill="none" />
      <Circle cx="18" cy="6" r="2.25" stroke={color} strokeWidth={1.5} fill="none" />
      <Circle cx="18" cy="18" r="2.25" stroke={color} strokeWidth={1.5} fill="none" />
      <Path
        d="M7.9 10.7L15.4 7.1M7.9 13.3L15.4 16.9"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function DownloadOutlineIcon({ size = 22, color = "#8B7E6A" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d="M12 4v9M8.25 10.25L12 14l3.75-3.75M5 19.5h14"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
