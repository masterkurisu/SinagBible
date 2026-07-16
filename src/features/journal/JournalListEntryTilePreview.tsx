import { useMemo } from "react";
import { Platform, Text, View } from "react-native";
import { formatPassageReference } from "@sinag-bible/core";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import type { MobileJournalListItem } from "@/lib/load-journal-entries";
import { stripHtmlPreview } from "@/lib/journal-preview";
import { getTranslationDisplayAbbreviation } from "@/lib/translation-display-label";
import type { TranslationPickerItem } from "@/lib/use-translation-picker";
import {
  JOURNAL_M3_ELEVATED_CARD_RADIUS_PX,
  journalM3ElevatedCardStyle,
} from "@/src/features/journal/journalCardChrome";

const JOURNAL_TILE_CONTENT_HEIGHT_PX = 108;
const JOURNAL_TILE_BADGE_SLOT_MIN_PX = 18;
const JOURNAL_TILE_PREVIEW_BLOCK_MIN_PX = 28;
const JOURNAL_TILE_RADIUS_PX = Platform.OS === "android" ? JOURNAL_M3_ELEVATED_CARD_RADIUS_PX : 16;
const JOURNAL_TILE_PREVIEW_FONT_PX = 13;
const JOURNAL_TILE_PREVIEW_LINE_HEIGHT_PX = 16;

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type JournalListEntryTilePreviewProps = {
  item: MobileJournalListItem;
  translationPickerItems: readonly TranslationPickerItem[];
};

/** List-tile chrome for container-transform outgoing content. */
export function JournalListEntryTilePreview({
  item,
  translationPickerItems,
}: JournalListEntryTilePreviewProps) {
  const { bundle } = useMobileAppTheme();
  const colors = bundle.ui;
  const j = bundle.journal;
  const isAndroid = Platform.OS === "android";

  const passage = useMemo(
    () =>
      item.book && item.chapter > 0
        ? formatPassageReference({
            book: item.book,
            chapter: item.chapter,
            verseStart: item.verse_start,
            verseEnd: item.verse_end,
          })
        : "",
    [item.book, item.chapter, item.verse_start, item.verse_end],
  );

  const translationLabel = useMemo(
    () =>
      item.bible_translation
        ? getTranslationDisplayAbbreviation(item.bible_translation, translationPickerItems)
        : "",
    [item.bible_translation, translationPickerItems],
  );

  const title = useMemo(() => item.title?.trim() || passage || "Untitled entry", [item.title, passage]);
  const preview = useMemo(() => stripHtmlPreview(item.content, 120), [item.content]);
  const createdLabel = useMemo(() => formatDate(item.created_at), [item.created_at]);
  const isFavorite = item.is_favorite === true;
  const pinClass = isFavorite ? "border-l-[10px] border-l-[#fbe0e0]" : "border-l-[3px] border-l-transparent";
  const favoriteLeftRadii = isFavorite
    ? { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }
    : undefined;

  const cardStyle = isAndroid
    ? journalM3ElevatedCardStyle(bundle, favoriteLeftRadii)
    : {
        backgroundColor: j.cardBackground,
        borderRadius: JOURNAL_TILE_RADIUS_PX,
        overflow: "hidden",
        ...(favoriteLeftRadii ?? {}),
      };

  return (
    <View style={[{ flex: 1, overflow: "hidden" }, cardStyle]}>
      <View
        className={`py-1.5 pl-4 pr-4 ${pinClass}`}
        style={{
          height: JOURNAL_TILE_CONTENT_HEIGHT_PX,
          overflow: "hidden",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexShrink: 1 }}>
          <View style={{ minHeight: JOURNAL_TILE_BADGE_SLOT_MIN_PX, justifyContent: "center" }}>
            {passage ? (
              <View
                className="self-start rounded-full px-2 py-0.5"
                style={{ backgroundColor: j.chipActiveBackground }}
              >
                <Text
                  className="text-[10px] font-medium uppercase"
                  style={{
                    fontFamily: "Inter_500Medium",
                    letterSpacing: 1.4,
                    color: j.chipActiveText,
                  }}
                  numberOfLines={1}
                >
                  {passage}
                  {translationLabel ? ` · ${translationLabel}` : ""}
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            className="mt-0.5 text-[14px] font-medium"
            style={{ fontFamily: "Lora_400Regular", lineHeight: 18, color: colors.brown800 }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          <View style={{ minHeight: JOURNAL_TILE_PREVIEW_BLOCK_MIN_PX, marginTop: 1 }}>
            {preview ? (
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: JOURNAL_TILE_PREVIEW_FONT_PX,
                  lineHeight: JOURNAL_TILE_PREVIEW_LINE_HEIGHT_PX,
                  color: colors.tan300,
                }}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {preview}
              </Text>
            ) : null}
          </View>
        </View>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            paddingTop: 1,
            lineHeight: 13,
            fontSize: 10,
            color: j.dateHeading,
          }}
          numberOfLines={1}
        >
          {createdLabel}
        </Text>
      </View>
    </View>
  );
}
