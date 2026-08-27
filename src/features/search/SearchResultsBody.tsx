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
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
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
import { SearchM3FilterChip } from "@/src/features/search/SearchM3FilterChip";
import {
  getSearchOverlayChrome,
  type SearchOverlayChrome,
} from "@/src/features/search/searchOverlayChrome";
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

function createSearchBodyStyles(md: SearchOverlayChrome) {
  return StyleSheet.create({
    sectionLabel: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 11,
      lineHeight: 16,
      letterSpacing: 1.6,
      textTransform: "uppercase",
      color: md.primary,
    },
    filterSectionLabel: { marginTop: 10, marginBottom: 10, marginLeft: 2 },
    quickPicksSectionLabel: { marginTop: 14, marginBottom: 10, marginLeft: 2 },
    resultsSectionHeader: {
      paddingTop: 14,
      paddingBottom: 8,
      marginLeft: 2,
    },
    recentSectionLabel: { marginTop: 14, marginBottom: 4, marginLeft: 2 },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 10,
    },
    pickCard: {
      width: "48.5%",
      borderRadius: 12,
      backgroundColor: md.surfaceContainerHighest,
      overflow: "hidden",
    },
    pickCardPress: {
      paddingVertical: 14,
      paddingHorizontal: 14,
    },
    pickCardPressed: { opacity: 0.92 },
    pickRef: {
      fontFamily: "Inter_500Medium",
      fontSize: 15,
      lineHeight: 20,
      color: md.onSurface,
      marginBottom: 3,
    },
    pickExcerpt: {
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      lineHeight: 16,
      color: md.onSurfaceVariant,
    },
    recentList: {
      marginTop: 4,
      width: "100%",
      alignSelf: "stretch",
    },
    recentRowWrap: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "stretch",
      paddingVertical: 12,
      paddingLeft: 2,
      borderBottomWidth: 1,
      borderBottomColor: md.outlineVariant,
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
      width: 24,
      height: 24,
      marginRight: 12,
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    recentText: {
      width: "100%",
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: md.onSurface,
    },
    recentRemove: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    recentRemovePressed: { opacity: 0.6 },
    listContent: { paddingTop: 4, paddingBottom: 24 },
    row: {
      paddingVertical: 12,
      paddingHorizontal: 2,
      borderBottomWidth: 1,
      borderBottomColor: md.outlineVariant,
    },
    refText: {
      fontFamily: "Inter_500Medium",
      fontSize: 16,
      lineHeight: 24,
      color: md.onSurface,
      marginBottom: 3,
    },
    snippet: {
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      color: md.onSurfaceVariant,
      lineHeight: 21,
    },
    snippetHighlight: {
      fontFamily: "Inter_600SemiBold",
      color: md.onSurface,
    },
    snippetNeighbor: {
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      color: md.outline,
      lineHeight: 21,
    },
    snippetAlso: {
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: md.outline,
      lineHeight: 16,
    },
    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
    },
    journalTags: {
      marginTop: 2,
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      lineHeight: 16,
      color: md.onSurfaceVariant,
    },
    colorRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
      marginTop: 10,
      marginBottom: 6,
    },
    colorDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: md.outlineVariant,
    },
    colorDotSelected: {
      borderWidth: 2,
      borderColor: md.primary,
    },
    empty: {
      marginTop: 24,
      textAlign: "center",
      fontFamily: "Inter_400Regular",
      fontSize: 15,
      color: md.onSurfaceVariant,
    },
    suggestionBanner: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
      paddingVertical: 12,
      paddingHorizontal: 4,
    },
    suggestionLabel: {
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: md.onSurfaceVariant,
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
      color: md.onSurfaceVariant,
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
      paddingHorizontal: 4,
      alignItems: "center",
    },
    retryFooterPressed: { opacity: 0.85 },
    retryFooterText: {
      fontFamily: "Inter_500Medium",
      fontSize: 13,
      color: md.primary,
      textAlign: "center",
    },
    emptyScrollContent: { paddingTop: 2 },
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
  const md = useMemo(() => getSearchOverlayChrome(bundle), [bundle]);
  const styles = useMemo(() => createSearchBodyStyles(md), [md]);
  const chipRipple =
    Platform.OS === "android" ? { color: md.iconRipple } : undefined;

  const renderMarkChip = (
    kind: NonNullable<SearchState["activeMarksKind"]>,
    label: string,
    accessibilityLabel: string,
  ) => (
    <SearchM3FilterChip
      label={label}
      selected={search.activeMarksKind === kind}
      onPress={() => search.onChangeMarksKind(search.activeMarksKind === kind ? null : kind)}
      chrome={md}
      accessibilityLabel={accessibilityLabel}
    />
  );

  const renderScopeChips = () => {
    const showColorDots =
      search.activeMarksKind === "highlights" || search.activeMarksKind === "marks";
    return (
      <View>
        <Text style={[styles.sectionLabel, styles.filterSectionLabel]}>Filter</Text>
        <View style={styles.chipWrap}>
          {search.showScopeChips && search.scopeBookName ? (
            <>
              <SearchM3FilterChip
                label="Whole Bible"
                selected={search.bibleScope === "all"}
                onPress={() => search.onChangeBibleScope("all")}
                chrome={md}
                accessibilityLabel="Search the whole Bible"
              />
              <SearchM3FilterChip
                label={search.scopeBookName}
                selected={search.bibleScope === "book"}
                onPress={() => search.onChangeBibleScope("book")}
                chrome={md}
                accessibilityLabel={`Search in ${search.scopeBookName}`}
              />
            </>
          ) : null}
          <SearchM3FilterChip
            label="Favorites"
            selected={search.journalFavoritesOnly}
            onPress={() => search.onChangeJournalFavoritesOnly(!search.journalFavoritesOnly)}
            chrome={md}
            accessibilityLabel="Show favorite journal entries only"
          />
          {renderMarkChip("marks", "Marks", "Show highlighted, underlined, and saved verses")}
          {renderMarkChip("highlights", "Highlights", "Show highlighted verses")}
          {renderMarkChip("underlines", "Underlines", "Show underlined verses")}
          {renderMarkChip("favorites", "Saved verses", "Show saved favorite verses")}
          {search.alsoChipLabel ? (
            <SearchM3FilterChip
              label={`Also in ${search.alsoChipLabel}`}
              selected={search.alsoTranslationActive}
              onPress={() =>
                search.onChangeAlsoTranslationEnabled(!search.alsoTranslationActive)
              }
              chrome={md}
              accessibilityLabel={`Also show this verse in ${search.alsoChipLabel}`}
            />
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
                  pressed && styles.pickCardPressed,
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
      <SearchM3FilterChip
        key={key}
        label={chipLabel}
        selected={false}
        onPress={() => onPickBookSuggestion(suggestion)}
        chrome={md}
        accessibilityLabel={`Search for ${chipLabel}`}
      />
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
            color={md.primary}
            containerColor={md.surfaceContainerHigh}
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
        <Text style={[styles.sectionLabel, styles.quickPicksSectionLabel]}>Quick picks</Text>
        <View style={styles.grid}>
          {search.quickPicks.map((pick) => (
            <View key={pick.ref} collapsable={false} style={styles.pickCard}>
              <Pressable
                onPress={() => search.runImmediateSearch(pick.ref)}
                android_ripple={chipRipple}
                style={({ pressed }) => [styles.pickCardPress, pressed && styles.pickCardPressed]}
              >
                <Text style={styles.pickRef}>{pick.ref}</Text>
                <Text style={styles.pickExcerpt} numberOfLines={1}>
                  {pick.excerpt}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        {search.recentShown.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, styles.recentSectionLabel]}>Recent</Text>
            <View style={styles.recentList}>
              {search.recentShown.map((q) => (
                <View key={q} style={styles.recentRowWrap}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => search.runImmediateSearch(q)}
                    style={styles.recentMainTouchable}
                  >
                    <View style={styles.recentIconWrap}>
                      <RecentSvgrepoIcon size={22} color={md.onSurfaceVariant} />
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
                    <MaterialCommunityIcons name="close" size={18} color={md.onSurfaceVariant} />
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
                color={md.primary}
                containerColor={md.surfaceContainerHigh}
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
