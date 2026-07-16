import { useMemo } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { formatBookLabel } from "@sinag-bible/core";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import type { MobileJournalListItem } from "@/lib/load-journal-entries";
import { stripHtmlPreview } from "@/lib/journal-preview";
import { getTranslationDisplayAbbreviation } from "@/lib/translation-display-label";
import { useTranslationPicker } from "@/lib/use-translation-picker";
import { READER_M3_APP_BAR_CONTENT_HEIGHT_PX } from "@/src/features/reader/readerSettingsPanelChrome";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

function passageRefBold(entry: MobileJournalListItem): string | null {
  if (!entry.book?.trim() || entry.chapter < 1) return null;
  const label = formatBookLabel(entry.book);
  const ch = entry.chapter;
  const vs = entry.verse_start;
  const ve = entry.verse_end;
  if (!vs) return `${label} ${ch}`;
  const tail = ve && ve > vs ? `:${vs}-${ve}` : `:${vs}`;
  return `${label} ${ch}${tail}`;
}

type JournalEntryDetailPreviewProps = {
  entry: MobileJournalListItem;
};

/** Minimal detail layout for container-transform handoff — matches journal detail initial paint. */
export function JournalEntryDetailPreview({ entry }: JournalEntryDetailPreviewProps) {
  const insets = useSafeAreaInsets();
  const { bundle } = useMobileAppTheme();
  const colors = bundle.ui;
  const j = bundle.journal;
  const { items: translationPickerItems } = useTranslationPicker();

  const title = entry.title?.trim() ?? "";
  const dateLine = formatDate(entry.created_at);
  const passageLine = passageRefBold(entry);
  const bibleTranslationDisplay = useMemo(
    () => getTranslationDisplayAbbreviation(entry.bible_translation, translationPickerItems),
    [entry.bible_translation, translationPickerItems],
  );
  const reflectionPreview = useMemo(() => stripHtmlPreview(entry.content, 600), [entry.content]);

  const topPad =
    Platform.OS === "android"
      ? Math.max(insets.top, 8) + 2 + READER_M3_APP_BAR_CONTENT_HEIGHT_PX + 4
      : 24;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: j.listPageBackground }}
      contentContainerStyle={{
        paddingTop: topPad,
        paddingBottom: 36,
        paddingHorizontal: 20,
      }}
      scrollEnabled={false}
    >
      {title ? (
        <Text
          style={{
            fontFamily: "Lora_400Regular",
            marginBottom: JOURNAL_TITLE_BOTTOM_MARGIN_PX,
            fontSize: 36,
            lineHeight: 42,
            color: colors.brown800,
          }}
        >
          {title}
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
        {dateLine}
      </Text>

      {passageLine ? (
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
          <Text
            style={{
              fontFamily: "Lora_400Regular",
              marginBottom: JOURNAL_PASSAGE_REF_BOTTOM_MARGIN_PX,
              fontSize: 17,
              lineHeight: 28,
              color: colors.brown800,
            }}
          >
            <Text style={{ fontFamily: "Lora_700Bold" }}>{passageLine}</Text>
            {entry.bible_translation?.trim() ? ` (${bibleTranslationDisplay})` : ""}
          </Text>
        </>
      ) : null}

      <Text
        className="text-xs tracking-[2px] uppercase mb-2"
        style={{ fontFamily: "Inter_400Regular", color: colors.gold }}
      >
        Reflection
      </Text>
      {reflectionPreview ? (
        <Text
          className="text-[17px] leading-8"
          style={{ fontFamily: "Lora_400Regular", color: colors.brown800 }}
        >
          {reflectionPreview}
        </Text>
      ) : (
        <View style={{ minHeight: 24 }} />
      )}
    </ScrollView>
  );
}
