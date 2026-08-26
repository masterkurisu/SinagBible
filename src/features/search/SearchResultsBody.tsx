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
import { formatJournalTagList } from "@/lib/journal-tags";
import { formatReaderMarkCaption, HIGHLIGHT_COLOR_IDS } from "@/lib/reader-marks-search";
import { highlightColors } from "@/lib/token";
import { M3ContainedLoadingIndicator } from "@/components/m3-contained-loading-indicator";
import { RecentSvgrepoIcon } from "@/components/icons/RecentSvgrepoIcon";
import { formatBookSuggestionChipLabel } from "@/lib/book-genre-display";
import { stripHtmlPreview } from "@/lib/journal-preview";
import { hapticLightImpact } from "@/lib/haptics";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import type { useBibleSearch } from "@/src/features/search/useBibleSearch";
import { findSnippetHighlightRange } from "@/src/features/search/searchVerseSnippet";

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

function BibleVerseSnippet({
  result,
  query,
  snippetStyle,
  highlightStyle,
  neighborStyle,
  alsoStyle,
}: {
  result: SearchResult;
  query: string;
  snippetStyle: object;
  highlightStyle: object;
  neighborStyle: object;
  alsoStyle: object;
}) {
  const range = findSnippetHighlightRange(result.verseText, query);
  const verse = range ? (
    <>
      {result.verseText.slice(0, range.start)}
      <Text style={highlightStyle}>{result.verseText.slice(range.start, range.end)}</Text>
      {result.verseText.slice(range.end)}
    </>
  ) : (
    result.verseText
  );
  const extraLines = (result.neighborVerseText ? 1 : 0) + (result.alsoVerseText ? 1 : 0);
  return (
    <Text style={snippetStyle} numberOfLines={2 + extraLines}>
      {verse}
      {result.neighborVerseText ? (
        <Text style={neighborStyle}> {result.neighborVerseText}</Text>
      ) : null}
      {result.alsoVerseText ? (
        <Text style={alsoStyle}>
          {"\n"}
          {result.alsoTranslationLabel ? `${result.alsoTranslationLabel} · ` : ""}
          {result.alsoVerseText}
        </Text>
      ) : null}
    </Text>
  );
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
    snippetHighlight: {
      fontFamily: "Inter_600SemiBold",
      color: s.bodyText,
    },
    snippetNeighbor: {
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      color: s.muted,
      lineHeight: 19.5,
    },
    snippetAlso: {
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: s.muted,
      lineHeight: 18,
    },
    scopeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    scopeChip: {
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: s.cardBackground,
      borderWidth: 0.5,
      borderColor: s.cardBorder,
    },
    scopeChipSelected: {
      borderColor: s.tint,
      backgroundColor: s.pageBackground,
    },
    scopeChipPressed: { opacity: 0.85 },
    scopeChipText: {
      fontFamily: "Inter_500Medium",
      fontSize: 12,
      color: s.muted,
    },
    scopeChipTextSelected: {
      color: s.tint,
    },
    journalTags: {
      marginTop: 2,
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: s.muted,
    },
    colorRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    colorDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: s.cardBorder,
    },
    colorDotSelected: {
      borderWidth: 2,
      borderColor: s.tint,
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
    searchPendingCenter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "flex-start",
      paddingTop: 28,
      gap: 16,
    },
    searchLoadingLabel: {
      fontFamily: "Inter_500Medium",
      fontSize: 14,
      lineHeight: 20,
      color: s.muted,
      textAlign: "center",
    },
    searchPendingInline: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 12,
    },
    retryFooter: {
      marginTop: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: s.cardBackground,
      borderWidth: 0.5,
      borderColor: s.cardBorder,
      alignItems: "center",
    },
    retryFooterPressed: { opacity: 0.85 },
    retryFooterText: {
      fontFamily: "Inter_500Medium",
      fontSize: 13,
      color: s.tint,
      textAlign: "center",
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

  const renderMarkChip = (
    kind: NonNullable<SearchState["activeMarksKind"]>,
    label: string,
    accessibilityLabel: string,
  ) => (
    <Pressable
      onPress={() => search.onChangeMarksKind(search.activeMarksKind === kind ? null : kind)}
      style={({ pressed }) => [
        styles.scopeChip,
        search.activeMarksKind === kind && styles.scopeChipSelected,
        pressed && styles.scopeChipPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: search.activeMarksKind === kind }}
      accessibilityLabel={accessibilityLabel}
    >
      <Text
        style={[
          styles.scopeChipText,
          search.activeMarksKind === kind && styles.scopeChipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  const renderScopeChips = () => {
    const showColorDots =
      search.activeMarksKind === "highlights" || search.activeMarksKind === "marks";
    return (
      <View>
        <View style={styles.scopeRow}>
          {search.showScopeChips && search.scopeBookName ? (
            <>
              <Pressable
                onPress={() => search.onChangeBibleScope("all")}
                style={({ pressed }) => [
                  styles.scopeChip,
                  search.bibleScope === "all" && styles.scopeChipSelected,
                  pressed && styles.scopeChipPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: search.bibleScope === "all" }}
                accessibilityLabel="Search the whole Bible"
              >
                <Text
                  style={[
                    styles.scopeChipText,
                    search.bibleScope === "all" && styles.scopeChipTextSelected,
                  ]}
                >
                  Whole Bible
                </Text>
              </Pressable>
              <Pressable
                onPress={() => search.onChangeBibleScope("book")}
                style={({ pressed }) => [
                  styles.scopeChip,
                  search.bibleScope === "book" && styles.scopeChipSelected,
                  pressed && styles.scopeChipPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: search.bibleScope === "book" }}
                accessibilityLabel={`Search in ${search.scopeBookName}`}
              >
                <Text
                  style={[
                    styles.scopeChipText,
                    search.bibleScope === "book" && styles.scopeChipTextSelected,
                  ]}
                >
                  {search.scopeBookName}
                </Text>
              </Pressable>
            </>
          ) : null}
          <Pressable
            onPress={() => search.onChangeJournalFavoritesOnly(!search.journalFavoritesOnly)}
            style={({ pressed }) => [
              styles.scopeChip,
              search.journalFavoritesOnly && styles.scopeChipSelected,
              pressed && styles.scopeChipPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: search.journalFavoritesOnly }}
            accessibilityLabel="Show favorite journal entries only"
          >
            <Text
              style={[
                styles.scopeChipText,
                search.journalFavoritesOnly && styles.scopeChipTextSelected,
              ]}
            >
              Favorites
            </Text>
          </Pressable>
          {renderMarkChip("marks", "Marks", "Show highlighted, underlined, and saved verses")}
          {renderMarkChip("highlights", "Highlights", "Show highlighted verses")}
          {renderMarkChip("underlines", "Underlines", "Show underlined verses")}
          {renderMarkChip("favorites", "Saved verses", "Show saved favorite verses")}
          {search.alsoChipLabel ? (
            <Pressable
              onPress={() => search.onChangeAlsoTranslationEnabled(!search.alsoTranslationActive)}
              style={({ pressed }) => [
                styles.scopeChip,
                search.alsoTranslationActive && styles.scopeChipSelected,
                pressed && styles.scopeChipPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: search.alsoTranslationActive }}
              accessibilityLabel={`Also show this verse in ${search.alsoChipLabel}`}
            >
              <Text
                style={[
                  styles.scopeChipText,
                  search.alsoTranslationActive && styles.scopeChipTextSelected,
                ]}
              >
                Also in {search.alsoChipLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {showColorDots ? (
          <View style={styles.colorRow}>
            {HIGHLIGHT_COLOR_IDS.map((id) => (
              <Pressable
                key={id}
                onPress={() =>
                  search.onChangeHighlightColor(search.activeHighlightColor === id ? null : id)
                }
                style={({ pressed }) => [
                  styles.colorDot,
                  { backgroundColor: highlightColors[id] },
                  search.activeHighlightColor === id && styles.colorDotSelected,
                  pressed && styles.scopeChipPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: search.activeHighlightColor === id }}
                accessibilityLabel={`Filter highlights by ${id}`}
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  };

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

  const retryFooter =
    !search.pending && search.failedHydrationCount > 0 ? (
      <Pressable
        onPress={search.onRetryBibleSearch}
        style={({ pressed }) => [styles.retryFooter, pressed && styles.retryFooterPressed]}
        accessibilityRole="button"
        accessibilityLabel="Retry loading Bible verses"
      >
        <Text style={styles.retryFooterText}>Some verses could not be loaded. Tap to retry.</Text>
      </Pressable>
    ) : null;

  const suggestionBanner =
    search.showBookSuggestionBanner && search.bookSuggestion ? (
      <View style={styles.suggestionBanner}>
        <Text style={styles.suggestionLabel}>Did you mean</Text>
        {renderBookSuggestionChip(search.bookSuggestion, search.bookSuggestion.bookName)}
        <Text style={styles.suggestionLabel}>?</Text>
      </View>
    ) : null;

  if (search.showSearchLoading) {
    return (
      <Pressable style={styles.bodyTapDismiss} onPress={Keyboard.dismiss}>
        {renderScopeChips()}
        <View
          style={styles.searchPendingCenter}
          accessibilityLabel="Searching"
          accessibilityState={{ busy: true }}
        >
          <M3ContainedLoadingIndicator
            size={44}
            color={s.tint}
            containerColor={bundle.chrome.androidIndicator}
          />
          <Text style={styles.searchLoadingLabel}>Searching…</Text>
        </View>
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
        {renderScopeChips()}
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
        {renderScopeChips()}
        <Text style={styles.empty}>No matches.</Text>
        {search.emptyNearbyBooks.length > 0 ? (
          <View style={styles.nearbySection}>
            <Text style={styles.suggestionLabel}>Did you mean</Text>
            <View style={styles.nearbyChips}>
              {search.emptyNearbyBooks.map((book) => renderBookSuggestionChip(book, book.bookName))}
            </View>
          </View>
        ) : null}
        {retryFooter}
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
      ListHeaderComponent={
        <>
          {renderScopeChips()}
          {suggestionBanner}
        </>
      }
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
            <View style={styles.searchPendingInline}>
              <M3ContainedLoadingIndicator
                size={28}
                color={s.tint}
                containerColor={bundle.chrome.androidIndicator}
              />
              <Text style={styles.searchLoadingLabel}>Searching Bible…</Text>
            </View>
          ) : null}
          {retryFooter}
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
              {formatJournalTagList((item as LocalJournalEntry).tags) ? (
                <Text style={styles.journalTags} numberOfLines={1}>
                  {formatJournalTagList((item as LocalJournalEntry).tags)}
                </Text>
              ) : null}
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
              {formatReaderMarkCaption(item as SearchResult) || (item as SearchResult).strongsLabel ? (
                <Text style={styles.journalTags} numberOfLines={1}>
                  {formatReaderMarkCaption(item as SearchResult) ?? (item as SearchResult).strongsLabel}
                </Text>
              ) : null}
              <BibleVerseSnippet
                result={item as SearchResult}
                query={search.snippetQuery}
                snippetStyle={styles.snippet}
                highlightStyle={styles.snippetHighlight}
                neighborStyle={styles.snippetNeighbor}
                alsoStyle={styles.snippetAlso}
              />
            </TouchableOpacity>
          </Link>
        )
      }
    />
  );
}
