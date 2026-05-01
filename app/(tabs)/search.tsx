import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  useFonts,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getSearchResultsForTranslation,
  isTranslationId,
  type TranslationId,
} from "@sinag-bible/core/bible-translations";
import { formatPassageReference } from "@sinag-bible/core";
import type { LocalJournalEntry, SearchResult } from "@sinag-bible/types";
import { readerChapterHref } from "@/lib/reader-navigation";
import {
  loadSearchHistory,
  prependSearchHistory,
  removeSearchHistoryItem,
} from "@/lib/search-history";
import {
  getPreferredReaderTranslationId,
  peekReaderLastPosition,
} from "@/lib/reader-last-position";
import { filterLocalJournalEntriesByQuery } from "@/lib/journal-local-search";
import { getCachedLocalEntries } from "@/lib/journal-local";
import { stripHtmlPreview } from "@/lib/journal-preview";
import { ScreenLoadingSkeleton } from "@/components/loading-skeleton";
import { RecentSvgrepoIcon } from "@/components/icons/RecentSvgrepoIcon";
import { useSbTabScreenPadding } from "@/lib/use-sb-bottom-padding";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { hapticSelection } from "@/lib/haptics";

const FALLBACK_TRANSLATION: TranslationId = "KJV";

function translationFromPeek(): TranslationId {
  const t = peekReaderLastPosition()?.translationId;
  return t && isTranslationId(t) ? t : FALLBACK_TRANSLATION;
}

const QUICK_PICKS = [
  { ref: "Mark 11:22", excerpt: "And Jesus answering saith…" },
  { ref: "John 3:16", excerpt: "For God so loved…" },
  { ref: "Psalm 23", excerpt: "The Lord is my shepherd…" },
  { ref: "Romans 8", excerpt: "No condemnation…" },
  { ref: "Philippians 4:13", excerpt: "I can do all things…" },
] as const;

const DEBOUNCE_MS = 280;

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

export default function SearchScreen() {
  const { bundle } = useMobileAppTheme();
  const s = bundle.search;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: s.pageBackground, paddingHorizontal: 20 },
        fontsPending: { flex: 1 },
        pageHeader: {
          marginBottom: 16,
        },
        pageTitle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 24,
          color: s.bodyText,
        },
        pageSubtitle: {
          fontFamily: "Inter_300Light",
          fontSize: 12,
          color: s.subtitle,
          marginTop: 4,
        },
        searchBar: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: s.cardBackground,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: s.searchBarBorder,
          paddingLeft: 16,
          paddingRight: 12,
          minHeight: 48,
          shadowColor: "#242423",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.35,
          shadowRadius: 6,
          elevation: 5,
        },
        searchIcon: { marginRight: 10, opacity: 0.4 },
        inputInSearchBar: {
          flex: 1,
          fontFamily: "Inter_400Regular",
          fontSize: 13,
          color: s.primaryText,
          paddingVertical: 12,
          paddingRight: 6,
          margin: 0,
          minWidth: 0,
        },
        body: { flex: 1, marginTop: 16 },
        bodyScroll: { flex: 1 },
        bodyScrollGrow: { flexGrow: 1 },
        bodyTapDismiss: { flex: 1, justifyContent: "flex-start" },
        tapToDismissFiller: { flexGrow: 1, minHeight: 120, alignSelf: "stretch" },
        clearButton: {
          justifyContent: "center",
          alignItems: "center",
          paddingLeft: 4,
          marginRight: -2,
        },
        clearButtonPressed: { opacity: 0.65 },
        searchPendingSkeleton: {
          flex: 1,
          paddingTop: 12,
          justifyContent: "flex-start",
        },
        emptyScrollContent: { paddingTop: 4 },
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
          backgroundColor: s.pageBackground,
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
      }),
    [s],
  );

  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPad = useSbTabScreenPadding(24);
  const params = useLocalSearchParams<{ q?: string }>();
  const initialQ = typeof params.q === "string" ? params.q : "";

  const [query, setQuery] = useState(initialQ);
  const [verseResults, setVerseResults] = useState<SearchResult[]>([]);
  const [journalResults, setJournalResults] = useState<LocalJournalEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [searchTranslationId, setSearchTranslationId] = useState<TranslationId>(translationFromPeek);

  const recordNextRef = useRef(false);
  const skipNextDebounceRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSearchRequestIdRef = useRef(0);
  const searchInputRef = useRef<TextInput>(null);
  const queryRef = useRef(query);
  queryRef.current = query;
  /** Skip translation-driven refresh on first run; debounced query search handles initial load. */
  const prevSearchTranslationRef = useRef<TranslationId | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getPreferredReaderTranslationId()
        .then(setSearchTranslationId)
        .catch(() => {
          /* keep fallback translation */
        });
      const id = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(id);
    }, []),
  );

  const runSearchInternal = useCallback(async (raw: string) => {
    const requestId = ++latestSearchRequestIdRef.current;
    const q = raw.trim();
    const shouldRecord = recordNextRef.current;
    recordNextRef.current = false;
    if (!q) {
      setVerseResults([]);
      setJournalResults([]);
      setSearchError(null);
      return;
    }
    setPending(true);
    setSearchError(null);
    try {
      const verses = await getSearchResultsForTranslation(searchTranslationId, q);
      if (requestId !== latestSearchRequestIdRef.current) return;
      setVerseResults(verses);
      const journalEntries = getCachedLocalEntries();
      if (requestId !== latestSearchRequestIdRef.current) return;
      setJournalResults(filterLocalJournalEntriesByQuery(journalEntries, q));
      if (shouldRecord) {
        const next = await prependSearchHistory(q);
        if (requestId !== latestSearchRequestIdRef.current) return;
        setRecentQueries(next);
      }
    } catch {
      if (requestId !== latestSearchRequestIdRef.current) return;
      setVerseResults([]);
      setJournalResults([]);
      setSearchError("Search is unavailable right now. Please try again.");
    } finally {
      if (requestId === latestSearchRequestIdRef.current) {
        setPending(false);
      }
    }
  }, [searchTranslationId]);

  const flushDebouncedSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  /** When the reader’s stored translation changes, refresh results for the current query (no history write). */
  useEffect(() => {
    const q = queryRef.current.trim();
    if (!q) {
      prevSearchTranslationRef.current = searchTranslationId;
      return;
    }
    const prev = prevSearchTranslationRef.current;
    prevSearchTranslationRef.current = searchTranslationId;
    if (prev === null) return;

    if (prev === searchTranslationId) return;

    flushDebouncedSearch();
    recordNextRef.current = false;
    let cancelled = false;
    void (async () => {
      setPending(true);
      setSearchError(null);
      try {
        const verses = await getSearchResultsForTranslation(searchTranslationId, q);
        if (cancelled) return;
        setVerseResults(verses);
        if (!cancelled) {
          const journalEntries = getCachedLocalEntries();
          setJournalResults(filterLocalJournalEntriesByQuery(journalEntries, q));
        }
      } catch {
        if (!cancelled) {
          setVerseResults([]);
          setJournalResults([]);
          setSearchError("Search is unavailable right now. Please try again.");
        }
      } finally {
        if (!cancelled) setPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchTranslationId, flushDebouncedSearch]);

  const scheduleDebouncedSearch = useCallback(
    (q: string) => {
      flushDebouncedSearch();
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void runSearchInternal(q);
      }, DEBOUNCE_MS);
    },
    [flushDebouncedSearch, runSearchInternal],
  );

  useEffect(() => {
    void loadSearchHistory()
      .then(setRecentQueries)
      .catch(() => {
        setRecentQueries([]);
      });
  }, []);

  useEffect(() => {
    const q = typeof initialQ === "string" ? initialQ : "";
    if (q.trim()) {
      recordNextRef.current = true;
    }
    setQuery(q);
  }, [initialQ]);

  useEffect(() => {
    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false;
      return () => flushDebouncedSearch();
    }
    scheduleDebouncedSearch(query);
    return () => flushDebouncedSearch();
  }, [query, scheduleDebouncedSearch, flushDebouncedSearch]);

  const onSubmitSearch = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    recordNextRef.current = true;
    flushDebouncedSearch();
    void runSearchInternal(q);
  }, [query, flushDebouncedSearch, runSearchInternal]);

  const onPickQuick = useCallback(
    (ref: string) => {
      recordNextRef.current = true;
      skipNextDebounceRef.current = true;
      setQuery(ref);
      flushDebouncedSearch();
      void runSearchInternal(ref);
    },
    [flushDebouncedSearch, runSearchInternal],
  );

  const onPickRecent = useCallback(
    (q: string) => {
      recordNextRef.current = true;
      skipNextDebounceRef.current = true;
      setQuery(q);
      flushDebouncedSearch();
      void runSearchInternal(q);
    },
    [flushDebouncedSearch, runSearchInternal],
  );

  const onRemoveRecent = useCallback(async (q: string) => {
    try {
      const next = await removeSearchHistoryItem(q);
      setRecentQueries(next);
    } catch {
      // keep current recent list if storage write fails
    }
  }, []);

  const onClearQuery = useCallback(() => {
    skipNextDebounceRef.current = true;
    flushDebouncedSearch();
    setQuery("");
    setVerseResults([]);
    setJournalResults([]);
  }, [flushDebouncedSearch]);

  const onSearchQueryChange = useCallback((q: string) => {
    hapticSelection();
    setQuery(q);
  }, []);

  const showClear = query.length > 0;

  const onPressVerseResult = useCallback(
    (item: SearchResult) => {
      router.push(readerChapterHref(item.bookSlug, item.chapterNumber, searchTranslationId) as Href);
    },
    [router, searchTranslationId],
  );

  const onPressJournalResult = useCallback(
    (entry: LocalJournalEntry) => {
      router.push(`/journal/${entry.id}` as Href);
    },
    [router],
  );

  const showEmptyState = query.trim().length === 0;
  const hasQuery = query.trim().length > 0;
  const noMatches =
    hasQuery && !pending && journalResults.length === 0 && verseResults.length === 0;

  const searchSections = useMemo(() => {
    const sections: { title: string; data: (SearchResult | LocalJournalEntry)[] }[] = [];
    if (journalResults.length > 0) {
      sections.push({ title: "Journal", data: journalResults });
    }
    if (verseResults.length > 0) {
      sections.push({ title: "Bible", data: verseResults });
    }
    return sections;
  }, [journalResults, verseResults]);
  const recentShown = recentQueries.slice(0, 3);

  if (!fontsLoaded) {
    return <View style={[styles.root, styles.fontsPending, { paddingTop: insets.top + 24 }]} />;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Search</Text>
        <Text style={styles.pageSubtitle}>Bible, references, and journal</Text>
      </View>

      <View style={styles.searchBar}>
        <MaterialCommunityIcons
          name="magnify"
          size={22}
          color={s.bodyText}
          style={styles.searchIcon}
        />
        <TextInput
          ref={searchInputRef}
          value={query}
          onChangeText={onSearchQueryChange}
          placeholder=""
          placeholderTextColor={s.placeholder}
          style={styles.inputInSearchBar}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor={s.tint}
          onSubmitEditing={onSubmitSearch}
        />
        {showClear ? (
          <Pressable
            onPress={onClearQuery}
            hitSlop={10}
            style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
            accessibilityLabel="Clear search"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="close-circle" size={22} color={s.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        {pending ? (
          <Pressable style={styles.bodyTapDismiss} onPress={Keyboard.dismiss}>
            <ScreenLoadingSkeleton lines={6} caption="Searching…" style={styles.searchPendingSkeleton} />
          </Pressable>
        ) : showEmptyState ? (
          <ScrollView
            style={styles.bodyScroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={[
              styles.emptyScrollContent,
              styles.bodyScrollGrow,
              { paddingBottom: bottomPad },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.sectionLabel, styles.quickPicksSectionLabel]}>QUICK PICKS</Text>
            <View style={styles.grid}>
              {QUICK_PICKS.map((pick) => (
                <Pressable
                  key={pick.ref}
                  onPress={() => onPickQuick(pick.ref)}
                  style={({ pressed }) => [styles.pickCard, pressed && styles.pickCardPressed]}
                >
                  <Text style={styles.pickRef}>{pick.ref}</Text>
                  <Text style={styles.pickExcerpt} numberOfLines={1}>
                    {pick.excerpt}
                  </Text>
                </Pressable>
              ))}
            </View>

            {recentShown.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, styles.recentSectionLabel]}>RECENT</Text>
                <View style={styles.recentList}>
                  {recentShown.map((q) => (
                    <View key={q} style={styles.recentRowWrap}>
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => onPickRecent(q)}
                        style={styles.recentMainTouchable}
                      >
                        <View style={styles.recentIconWrap}>
                          <RecentSvgrepoIcon size={40} color={s.bodyText} />
                        </View>
                        <View style={styles.recentTextCell} collapsable={false}>
                          <Text
                            style={styles.recentText}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {q}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <Pressable
                        onPress={() => void onRemoveRecent(q)}
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
        ) : noMatches ? (
          <Pressable style={[styles.bodyTapDismiss, styles.bodyScrollGrow]} onPress={Keyboard.dismiss}>
            <Text style={styles.empty}>No matches.</Text>
          </Pressable>
        ) : searchError ? (
          <Pressable style={[styles.bodyTapDismiss, styles.bodyScrollGrow]} onPress={Keyboard.dismiss}>
            <Text style={styles.empty}>{searchError}</Text>
          </Pressable>
        ) : (
          <SectionList
            style={styles.bodyScroll}
            sections={searchSections}
            keyExtractor={(item, index) =>
              "verseNumber" in item
                ? `v-${item.bookSlug}-${item.chapterNumber}-${item.verseNumber}-${index}`
                : `j-${item.id}`
            }
            renderSectionHeader={({ section: { title } }) => (
              <Text style={[styles.sectionLabel, styles.resultsSectionHeader]}>{title}</Text>
            )}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={[styles.listContent, styles.bodyScrollGrow, { paddingBottom: bottomPad }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListFooterComponent={
              <Pressable style={styles.tapToDismissFiller} onPress={Keyboard.dismiss} accessibilityRole="none" />
            }
            renderItem={({ item, section }) =>
              section.title === "Journal" ? (
                <Pressable
                  onPress={() => onPressJournalResult(item as LocalJournalEntry)}
                  style={styles.row}
                >
                  <Text style={styles.refText}>{journalSearchRowTitle(item as LocalJournalEntry)}</Text>
                  <Text style={styles.snippet} numberOfLines={2}>
                    {stripHtmlPreview((item as LocalJournalEntry).content, 160)}
                  </Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => onPressVerseResult(item as SearchResult)} style={styles.row}>
                  <Text style={styles.refText}>
                    {(item as SearchResult).bookName} {(item as SearchResult).chapterNumber}:
                    {(item as SearchResult).verseNumber}
                  </Text>
                  <Text style={styles.snippet} numberOfLines={2}>
                    {(item as SearchResult).verseText}
                  </Text>
                </Pressable>
              )
            }
          />
        )}
      </View>
    </View>
  );
}
