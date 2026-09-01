import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Text,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from "react-native";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import { useLocalSearchParams, Stack, useRouter, usePathname, useNavigation } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
import { formatBookLabel } from "@sinag-bible/core";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { JournalDetailAndroidAppBar } from "@/src/features/journal/JournalDetailAndroidAppBar";
import { JournalEntryScrollView } from "@/src/features/journal/JournalEntryScrollView";
import { peekReaderLastPosition } from "@/lib/reader-last-position";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import {
  peekPendingJournalDetailEntryFor,
  setPendingJournalEditEntry,
  clearPendingJournalDetailEntry,
} from "@/lib/journal-edit-bridge";
import { requestJournalDetailReverseMorph } from "@/lib/journal-detail-morph-bridge";
import { READER_INTERNAL_NO_STACK_ANIMATION } from "@/lib/reader-hub-navigation";
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
  getJournalVersePreview,
  resolveJournalPassageBookSlug,
} from "@/lib/journal-verse-preview";
import { getTranslationDisplayAbbreviation } from "@/lib/translation-display-label";
import { useTranslationPicker } from "@/lib/use-translation-picker";
import { JournalOnboardingLayer } from "@/src/features/journal/JournalOnboardingLayer";
import { useJournalDetailOnboarding } from "@/src/features/journal/useJournalDetailOnboarding";
import type { JournalDetailOnboardingStepId } from "@/src/features/journal/journalDetailOnboardingSteps";
import { ReaderM3IconButton } from "@/src/features/reader/ReaderM3IconButton";
import { READER_M3_APP_BAR_CONTENT_HEIGHT_PX } from "@/src/features/reader/readerSettingsPanelChrome";

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
  .reflection h1 { font-family: Lora, Georgia, serif; font-weight: 400; font-size: 26px; margin: 16px 0 8px; }
  .reflection h2 { font-family: Lora, Georgia, serif; font-weight: 700; font-size: 20px; margin: 14px 0 6px; }
  .reflection a { color: ${ui.brown800}; text-decoration: underline; }
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


export default function JournalEntryScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { id: idParam, [READER_INTERNAL_NO_STACK_ANIMATION]: noStackAnimationParam } =
    useLocalSearchParams<{
      id?: string | string[];
      [READER_INTERNAL_NO_STACK_ANIMATION]?: string | string[];
    }>();
  const id = resolveJournalEntryRouteId(idParam, pathname);
  const { bundle } = useMobileAppTheme();
  const colors = bundle.ui;
  const j = bundle.journal;
  const headerIconColor = colors.tan300;
  const androidAppBarIconColor = colors.brown800;
  const androidAppBarRipple = bundle.chrome.androidRipple;
  const journalAndroidTopToolsTopPx = Math.max(insets.top, 8) + 2;
  const journalAndroidAppBarBottomPx =
    journalAndroidTopToolsTopPx + READER_M3_APP_BAR_CONTENT_HEIGHT_PX;

  const bridgedEntryOnMount = useRef(
    id ? peekPendingJournalDetailEntryFor(id) : null,
  );
  const noStackAnimation =
    noStackAnimationParam === "1" ||
    (Array.isArray(noStackAnimationParam) && noStackAnimationParam[0] === "1");
  const enteredWithoutStackAnimation = noStackAnimation || bridgedEntryOnMount.current != null;

  const shareCaptureRef = useRef<View>(null);
  const captureReadyResolveRef = useRef<(() => void) | null>(null);
  const shareActionRef = useRef<View>(null);
  const saveActionRef = useRef<View>(null);
  const pdfActionRef = useRef<View>(null);
  const exportTrailingActionsRef = useRef<View>(null);
  const detailOnboardingTargetRefs = useMemo(
    (): Record<JournalDetailOnboardingStepId, React.RefObject<View | null>> => ({
      "share-as-image": shareActionRef,
      "save-to-library": saveActionRef,
      "export-as-pdf": pdfActionRef,
    }),
    [],
  );
  const [exportAction, setExportAction] = useState<null | "share" | "save" | "pdf">(null);
  const [capturePass, setCapturePass] = useState(false);

  const [entry, setEntry] = useState<MobileJournalListItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [storageAccessError, setStorageAccessError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [verseText, setVerseText] = useState<string | null>(null);
  const { items: translationPickerItems } = useTranslationPicker();

  const bibleTranslationDisplay = useMemo(
    () => getTranslationDisplayAbbreviation(entry?.bible_translation, translationPickerItems),
    [entry?.bible_translation, translationPickerItems],
  );

  const detailOnboarding = useJournalDetailOnboarding({
    entryReady: entry != null && !loadError,
    targetRefs: detailOnboardingTargetRefs,
    trailingActionsRef: exportTrailingActionsRef,
    insets,
    screenW,
    screenH,
    androidTopToolsTopPx: journalAndroidTopToolsTopPx,
  });

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      setIsLoading(true);
      setLoadError(false);
      setStorageAccessError(false);

      const bridged = peekPendingJournalDetailEntryFor(id);
      if (bridged) {
        setEntry(bridged);
        setIsLoading(false);
        requestAnimationFrame(() => {
          clearPendingJournalDetailEntry();
        });
        return () => {
          cancelled = true;
        };
      }

      setEntry(null);
      void (async () => {
        try {
          const row = await loadJournalEntryById(id);
          if (cancelled) return;
          setEntry(row);
          if (!row) setLoadError(true);
        } catch (e) {
          if (cancelled) return;
          if (__DEV__) {
            console.error(e);
          }
          setEntry(null);
          setStorageAccessError(true);
          setLoadError(true);
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [id]),
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
        const translation = entry.bible_translation?.trim() || "KJV";
        const resolvedBook = await resolveJournalPassageBookSlug(translation, entry.book);
        if (!resolvedBook) {
          if (!cancelled) setVerseText(null);
          return;
        }
        const fullVerse = await getJournalVersePreview(
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

  const passageLine = useMemo(() => {
    if (!entry || !entry.book || entry.chapter < 1) return null;
    return passageLineForDisplay({
      book: entry.book,
      chapter: entry.chapter,
      verse_start: entry.verse_start,
      verse_end: entry.verse_end,
    });
  }, [entry]);

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

  const onCaptureTreeReady = useCallback(() => {
    captureReadyResolveRef.current?.();
    captureReadyResolveRef.current = null;
  }, []);

  const captureEntryPngUri = useCallback(async (): Promise<string | null> => {
    const ready = new Promise<void>((resolve) => {
      captureReadyResolveRef.current = resolve;
    });
    setCapturePass(true);
    const timeout = setTimeout(() => {
      captureReadyResolveRef.current?.();
      captureReadyResolveRef.current = null;
    }, 500);
    await ready;
    clearTimeout(timeout);
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    const node = shareCaptureRef.current;
    try {
      if (!node) return null;
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
    } finally {
      setCapturePass(false);
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
      capturedUri = await captureEntryPngUri();
      if (!capturedUri) {
        Alert.alert("Could not save", "Unable to create an image of this entry.");
        return;
      }

      // Android: do not request READ_MEDIA_* / MediaLibrary read access.
      // Share sheet lets the user save to Photos without broad gallery permission.
      if (Platform.OS === "android") {
        if (!(await Sharing.isAvailableAsync())) {
          Alert.alert("Could not save", "Sharing is not available on this device.");
          return;
        }
        await Sharing.shareAsync(capturedUri, {
          mimeType: "image/png",
          dialogTitle: "Save journal image",
        });
        return;
      }

      const perm = await requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Photos access needed",
          "Allow photo library access in Settings to save journal images.",
        );
        return;
      }
      await Asset.create(capturedUri);
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
        if (!capturedUri) {
          capturedUri = await captureEntryPngUri();
        }
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
        bibleTranslation: entry.bible_translation ? bibleTranslationDisplay : null,
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
    bibleTranslationDisplay,
    colors.brown800,
    colors.gold,
    colors.parchmentMid,
    colors.tan200,
    entry,
    exportAction,
    passageLine,
    verseText,
  ]);

  const handleBack = useCallback(() => {
    hapticLightImpact();
    router.back();
  }, [router]);

  useEffect(() => {
    if (!id) return;
    return navigation.addListener("beforeRemove", () => {
      requestJournalDetailReverseMorph(id);
    });
  }, [id, navigation]);

  const journalExportActions =
    entry && !loadError ? (
      <>
        {Platform.OS === "android" ? (
          <ReaderM3IconButton
            buttonRef={shareActionRef}
            onPress={() => void handleShareImage()}
            accessibilityLabel="Share journal as image"
            rippleColor={androidAppBarRipple}
            suppressHaptic
          >
            {exportAction === "share" ? (
              <ActivityIndicator color={androidAppBarIconColor} size="small" />
            ) : (
              <ShareOutlineIcon color={androidAppBarIconColor} />
            )}
          </ReaderM3IconButton>
        ) : (
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
        )}
        {Platform.OS === "android" ? (
          <ReaderM3IconButton
            buttonRef={saveActionRef}
            onPress={() => void handleDownloadImage()}
            accessibilityLabel="Save journal as image"
            rippleColor={androidAppBarRipple}
            suppressHaptic
          >
            {exportAction === "save" ? (
              <ActivityIndicator color={androidAppBarIconColor} size="small" />
            ) : (
              <DownloadOutlineIcon color={androidAppBarIconColor} />
            )}
          </ReaderM3IconButton>
        ) : (
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
        )}
        {Platform.OS === "android" ? (
          <ReaderM3IconButton
            buttonRef={pdfActionRef}
            onPress={() => void handleDownloadPdf()}
            accessibilityLabel="Download journal as PDF"
            rippleColor={androidAppBarRipple}
            suppressHaptic
          >
            {exportAction === "pdf" ? (
              <ActivityIndicator color={androidAppBarIconColor} size="small" />
            ) : (
              <Ionicons name="document-text-outline" size={22} color={androidAppBarIconColor} />
            )}
          </ReaderM3IconButton>
        ) : (
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
        )}
      </>
    ) : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: "",
          animation: enteredWithoutStackAnimation ? "none" : undefined,
          headerShown: Platform.OS !== "android",
          headerShadowVisible: false,
          headerBackVisible: false,
          headerStyle: { backgroundColor: j.listPageBackground },
          headerTintColor: colors.brown800,
          headerLeft: () => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={handleBack}
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
                  <View
                    ref={exportTrailingActionsRef}
                    collapsable={false}
                    style={{ flexDirection: "row", alignItems: "center", gap: 2, marginRight: 2 }}
                  >
                    {journalExportActions}
                  </View>
                )
              : undefined,
        }}
      />
      <View
        className="flex-1"
        style={{
          backgroundColor: j.listPageBackground,
          paddingTop: Platform.OS === "android" ? journalAndroidAppBarBottomPx : 0,
        }}
      >
        {!id ? (
          <View className="flex-1 px-5 py-8">
            <Text style={{ fontFamily: "Lora_400Regular", fontSize: 16, color: colors.tan300 }}>
              This entry link is invalid. Go back and try again.
            </Text>
          </View>
        ) : isLoading && !entry ? (
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
            <JournalEntryScrollView
              key={id}
              title={entry.title?.trim() ?? ""}
              dateLine={formatDate(entry.created_at)}
              tags={entry.tags}
              passageLine={passageLine}
              bibleTranslationDisplay={bibleTranslationDisplay}
              hasBibleTranslation={Boolean(entry.bible_translation?.trim())}
              verseText={verseText}
              reserveVerseSlot={passageLine != null}
              contentHtml={entry.content}
              capturePass={capturePass}
              shareCaptureRef={shareCaptureRef}
              onCaptureTreeReady={onCaptureTreeReady}
              colors={{
                brown800: colors.brown800,
                gold: colors.gold,
                tan200: colors.tan200,
              }}
              pageBackgroundColor={j.listPageBackground}
              bundle={bundle}
              activeTranslationId={
                peekReaderLastPosition()?.translationId?.trim() ||
                entry.bible_translation?.trim() ||
                "KJV"
              }
            />

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
          </>
        )}
      </View>

      {Platform.OS === "android" ? (
        <JournalDetailAndroidAppBar
          topInsetPx={journalAndroidTopToolsTopPx}
          backgroundColor={j.listPageBackground}
          insets={insets}
          leadingAction={
            <ReaderM3IconButton
              onPress={handleBack}
              accessibilityLabel="Go back"
              rippleColor={androidAppBarRipple}
            >
              <MaterialIcons name="arrow-back" size={24} color={androidAppBarIconColor} />
            </ReaderM3IconButton>
          }
          trailingActions={
            journalExportActions ? (
              <View
                ref={exportTrailingActionsRef}
                collapsable={false}
                pointerEvents={exportAction !== null ? "none" : "auto"}
                style={{ flexDirection: "row", alignItems: "center" }}
              >
                {journalExportActions}
              </View>
            ) : null
          }
        />
      ) : null}

      <JournalOnboardingLayer
        visible={detailOnboarding.showLayer}
        step={detailOnboarding.currentStep}
        stepAnchor={detailOnboarding.stepAnchor}
        tooltipPlacement="below"
        verticalOffsetPx={-55}
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
