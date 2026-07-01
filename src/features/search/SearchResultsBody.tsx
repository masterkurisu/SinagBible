import { useMemo } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { type Href, Link } from "expo-router";
import type { BookSuggestion, LocalJournalEntry, SearchResult } from "@sinag-bible/types";
import { formatPassageReference } from "@sinag-bible/core";
import { ScreenLoadingSkeleton } from "@/components/loading-skeleton";
import { RecentSvgrepoIcon } from "@/components/icons/RecentSvgrepoIcon";
import { formatBookSuggestionChipLabel } from "@/lib/book-genre-display";
import { stripHtmlPreview } from "@/lib/journal-preview";
import { hapticLightImpact } from "@/lib/haptics";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import type { useBibleSearch } from "@/src/features/search/useBibleSearch";

function journalSearchRowTitle(entry: LocalJournalEntry): string {
  const passage =
    entry.book && entry.chapter > 0
      ? formatPassageReference({
          book: entry.book,
          chapter: entry.chapter,
          verseStart: entry.verse_start,
          verseEnd: entry.verse_end,
        })
      : "";
  const t = entry.title?.trim();
  if (t) return t;
  return passage || "Journal entry";
}

function createSearchBodyStyles(s: MobileAppThemeBundle["search"]) {
  return StyleSheet.create({
    sectionLabel: {
      fontFamily: "Inter_500Medium",
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: s.muted,
    },
    quickPicksSectionLabel: { marginTop: 0 },
    resultsSectionHeader: {
      paddingTop: 4,
      paddingBottom: 8,
    },
    recentSectionLabel: { marginTop: 28 },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      marginTop: 12,
      rowGap: 12,
    },
    pickCard: {
      width: "48%",
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: s.cardBackground,
      borderWidth: 0.5,
      borderColor: s.cardBorder,
    },
    pickCardPressed: { opacity: 0.92 },
    pickRef: {
      fontFamily: "Inter_500Medium",
      fontSize: 14,
      color: s.bodyText,
      marginBottom: 6,
    },
    pickExcerpt: {
      fontFamily: "Inter_300Light",
      fontSize: 11,
      color: s.muted,
    },
    recentList: {
      marginTop: 12,
      gap: 6,
      width: "100%",
      alignSelf: "stretch",
    },
    recentRowWrap: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "stretch",
      borderRadius: 2,
      paddingVertical: 2,
      paddingHorizontal: 2,
    },
    recentMainTouchable: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      minWidth: 0,
    },
    recentTextCell: {
      flex: 1,
      minWidth: 0,
      justifyContent: "center",
    },
    recentIconWrap: {
      width: 40,
      height: 40,
      marginRight: 12,
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      opacity: 0.35,
    },
    recentText: {
      width: "100%",
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      lineHeight: 20,
      color: s.recentText,
    },
    recentRemove: {
      paddingLeft: 8,
      paddingVertical: 4,
      justifyContent: "center",
      alignItems: "center",
    },
    recentRemovePressed: { opacity: 0.6 },
    recentRemoveMark: {
      fontFamily: "Inter_400Regular",
      fontSize: 20,
      lineHeight: 22,
      color: s.bodyText,
      opacity: 0.25,
    },
    listContent: { paddingTop: 8, paddingBottom: 24 },
    row: {
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: s.divider,
    },
    refText: {
      fontFamily: "Inter_500Medium",
      fontSize: 14,
      color: s.bodyText,
      marginBottom: 4,
    },
    snippet: {
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      color: s.recentText,
      lineHeight: 19.5,
    },
    empty: {
      marginTop: 24,
      textAlign: "center",
      fontFamily: "Inter_400Regular",
      fontSize: 15,
      color: s.muted,
    },
    suggestionBanner: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6,
      marginBottom: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: s.cardBackground,
      borderWidth: 0.5,
      borderColor: s.cardBorder,
    },
    suggestionLabel: {
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      color: s.muted,
    },
    suggestionChip: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: s.pageBackground,
      borderWidth: 0.5,
      borderColor: s.cardBorder,
    },
    suggestionChipPressed: { opacity: 0.85 },
    suggestionChipText: {
      fontFamily: "Inter_500Medium",
      fontSize: 13,
      color: s.tint,
    },
    nearbySection: {
      marginTop: 20,
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 8,
    },
    nearbyChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
    },
    bodyScrollGrow: { flexGrow: 1 },
    bodyTapDismiss: { flex: 1, justifyContent: "flex-start" },
    tapToDismissFiller: { flexGrow: 1, minHeight: 80, alignSelf: "stretch" },
    searchPendingSkeleton: {
      flex: 1,
      paddingTop: 12,
      justifyContent: "flex-start",
    },
    biblePendingHint: {
      marginTop: 8,
      marginBottom: 16,
      textAlign: "center",
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      color: s.muted,
    },
    emptyScrollContent: { paddingTop: 4 },
    scroll: { flex: 1 },
  });
}

type SearchState = ReturnType<typeof useBibleSearch>;

export type SearchResultsBodyProps = {
  search: SearchState;
  bundle: MobileAppThemeBundle;
  onPickBookSuggestion: (suggestion: BookSuggestion) => void;
  onNavigateResult: () => void;
};

export function SearchResultsBody({
  search,
  bundle,
  onPickBookSuggestion,
  onNavigateResult,
}: SearchResultsBodyProps) {
  const s = bundle.search;
  const styles = useMemo(() => createSearchBodyStyles(s), [s]);

  const renderBookSuggestionChip = (suggestion: BookSuggestion, key: string) => {
    const chipLabel = formatBookSuggestionChipLabel(suggestion.bookName, suggestion.bookSlug);
    return (
      <Pressable
        key={key}
        onPress={() => onPickBookSuggestion(suggestion)}
        style={({ pressed }) => [styles.suggestionChip, pressed && styles.suggestionChipPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Search for ${chipLabel}`}
      >
        <Text style={styles.suggestionChipText}>{chipLabel}</Text>
      </Pressable>
    );
  };

  const suggestionBanner =
    search.showBookSuggestionBanner && search.bookSuggestion ? (
      <View style={styles.suggestionBanner}>
        <Text style={styles.suggestionLabel}>Did you mean</Text>
        {renderBookSuggestionChip(search.bookSuggestion, search.bookSuggestion.bookName)}
        <Text style={styles.suggestionLabel}>?</Text>
      </View>
    ) : null;

  if (search.showSearchSkeleton) {
    return (
      <Pressable style={styles.bodyTapDismiss} onPress={Keyboard.dismiss}>
        <ScreenLoadingSkeleton lines={6} caption="Searching…" style={styles.searchPendingSkeleton} />
      </Pressable>
    );
  }

  if (search.showEmptyState) {
    return (
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.emptyScrollContent, styles.bodyScrollGrow]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionLabel, styles.quickPicksSectionLabel]}>QUICK PICKS</Text>
        <View style={styles.grid}>
          {search.quickPicks.map((pick) => (
            <Pressable
              key={pick.ref}
              onPress={() => search.runImmediateSearch(pick.ref)}
              style={({ pressed }) => [styles.pickCard, pressed && styles.pickCardPressed]}
            >
              <Text style={styles.pickRef}>{pick.ref}</Text>
              <Text style={styles.pickExcerpt} numberOfLines={1}>
                {pick.excerpt}
              </Text>
            </Pressable>
          ))}
        </View>

        {search.recentShown.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, styles.recentSectionLabel]}>RECENT</Text>
            <View style={styles.recentList}>
              {search.recentShown.map((q) => (
                <View key={q} style={styles.recentRowWrap}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => search.runImmediateSearch(q)}
                    style={styles.recentMainTouchable}
                  >
                    <View style={styles.recentIconWrap}>
                      <RecentSvgrepoIcon size={40} color={s.bodyText} />
                    </View>
                    <View style={styles.recentTextCell} collapsable={false}>
                      <Text style={styles.recentText} numberOfLines={1} ellipsizeMode="tail">
                        {q}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <Pressable
                    onPress={() => void search.onRemoveRecent(q)}
                    hitSlop={10}
                    style={({ pressed }) => [styles.recentRemove, pressed && styles.recentRemovePressed]}
                    accessibilityLabel={`Remove ${q} from history`}
                  >
                    <Text style={styles.recentRemoveMark}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        ) : null}
        <Pressable style={styles.tapToDismissFiller} onPress={Keyboard.dismiss} accessibilityRole="none" />
      </ScrollView>
    );
  }

  if (search.noMatches) {
    return (
      <Pressable style={[styles.bodyTapDismiss, styles.bodyScrollGrow]} onPress={Keyboard.dismiss}>
        <Text style={styles.empty}>No matches.</Text>
        {search.emptyNearbyBooks.length > 0 ? (
          <View style={styles.nearbySection}>
            <Text style={styles.suggestionLabel}>Did you mean</Text>
            <View style={styles.nearbyChips}>
              {search.emptyNearbyBooks.map((book) => renderBookSuggestionChip(book, book.bookName))}
            </View>
          </View>
        ) : null}
      </Pressable>
    );
  }

  if (search.searchError) {
    return (
      <Pressable style={[styles.bodyTapDismiss, styles.bodyScrollGrow]} onPress={Keyboard.dismiss}>
        <Text style={styles.empty}>{search.searchError}</Text>
      </Pressable>
    );
  }

  return (
    <SectionList
      style={styles.scroll}
      sections={search.searchSections}
      keyExtractor={(item, index) =>
        "verseNumber" in item
          ? `v-${item.bookSlug}-${item.chapterNumber}-${item.verseNumber}-${index}`
          : `j-${item.id}`
      }
      ListHeaderComponent={suggestionBanner}
      renderSectionHeader={({ section: { title } }) => (
        <Text style={[styles.sectionLabel, styles.resultsSectionHeader]}>{title}</Text>
      )}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={[styles.listContent, styles.bodyScrollGrow]}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode="on-drag"
      ListFooterComponent={
        <>
          {search.pending ? (
            <Text style={styles.biblePendingHint}>Searching Bible…</Text>
          ) : null}
          <Pressable style={styles.tapToDismissFiller} onPress={Keyboard.dismiss} accessibilityRole="none" />
        </>
      }
      renderItem={({ item, section }) =>
        section.title === "Journal" ? (
          <Link
            href={`/journal/${(item as LocalJournalEntry).id}` as Href}
            asChild
            onPress={() => {
              hapticLightImpact();
              Keyboard.dismiss();
              onNavigateResult();
            }}
          >
            <TouchableOpacity activeOpacity={0.75} style={styles.row}>
              <Text style={styles.refText}>{journalSearchRowTitle(item as LocalJournalEntry)}</Text>
              <Text style={styles.snippet} numberOfLines={2}>
                {stripHtmlPreview((item as LocalJournalEntry).content, 160)}
              </Text>
            </TouchableOpacity>
          </Link>
        ) : (
          <Link
            href={search.readerHrefForResult(item as SearchResult)}
            asChild
            onPress={() => {
              hapticLightImpact();
              Keyboard.dismiss();
              search.onOpenVerseResult(item as SearchResult);
              onNavigateResult();
            }}
          >
            <TouchableOpacity activeOpacity={0.75} style={styles.row}>
              <Text style={styles.refText}>
                {(item as SearchResult).bookName} {(item as SearchResult).chapterNumber}:
                {(item as SearchResult).verseNumber}
              </Text>
              <Text style={styles.snippet} numberOfLines={2}>
                {(item as SearchResult).verseText}
              </Text>
            </TouchableOpacity>
          </Link>
        )
      }
    />
  );
}
