import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSearchResultsForReaderTranslation } from "@/lib/bible-search-service";
import type { BookSuggestion, HighlightColor, LocalJournalEntry, SearchResult } from "@sinag-bible/types";
import {
  loadSearchHistory,
  prependSearchHistory,
  removeSearchHistoryItem,
} from "@/lib/search-history";
import { buildSearchQuickPicks } from "@/lib/search-quick-picks";
import {
  getPreferredReaderTranslation,
  peekReaderLastPosition,
  saveReaderLastPosition,
} from "@/lib/reader-last-position";
import { rankLocalJournalEntriesForOverlay } from "@/lib/journal-local-search";
import { getCachedLocalEntries, refreshLocalEntriesCache } from "@/lib/journal-local";
import {
  filterSearchResultsByReaderMarks,
  listReaderVerseMarks,
  parseOverlayMarksQuery,
  readerMarksToSearchResults,
  resolveOverlayMarksFilter,
  type OverlayMarksKind,
  type ReaderVerseMark,
} from "@/lib/reader-marks-search";
import {
  overlayPowerToJournalCombinator,
  parseOverlayPowerQuery,
} from "@/lib/search-power-query";
import {
  attachAlsoTranslationSnippets,
  pickAlsoTranslationId,
} from "@/lib/search-also-translation";
import { getTranslationDisplayAbbreviation } from "@/lib/translation-display-label";
import {
  loadFavoriteTranslationIds,
  peekFavoriteTranslationIds,
} from "@/lib/use-favorite-translations";
import { getDefaultPinnedTranslationIds } from "@/lib/default-pinned-translations";
import { getRelatedVerseRefsForQuery } from "@sinag-bible/core/search-related-verses";
import { relatedRefsToSearchResults } from "@/lib/search-related-results";
import { hapticSelection } from "@/lib/haptics";
import { type Href } from "expo-router";
import { readerChapterHref } from "@/lib/reader-navigation";
import type { TranslationSearchOptions } from "@sinag-bible/core/bible-translations";
import { getBookNameFromSlug } from "@sinag-bible/core/bible-meta";

const FALLBACK_TRANSLATION = "KJV";
const DEBOUNCE_MS = 280;
const JOURNAL_DEBOUNCE_MS = 140;
const JOURNAL_DEBOUNCE_MIN_ENTRIES = 200;

export type OverlayBibleScope = "all" | "book";
export type { OverlayMarksKind };

function overlaySearchOptions(
  signal?: AbortSignal,
  bookScopeSlug?: string,
): TranslationSearchOptions {
  const slug = peekReaderLastPosition()?.bookSlug?.trim();
  return {
    ...(slug ? { lastReadBookSlug: slug } : {}),
    ...(bookScopeSlug ? { bookScopeSlug } : {}),
    ...(signal ? { signal } : {}),
  };
}

function translationFromPeek(): string {
  return peekReaderLastPosition()?.translationId?.trim() || FALLBACK_TRANSLATION;
}

export function useBibleSearch({ enabled }: { enabled: boolean }) {
  const [query, setQuery] = useState("");
  const [verseResults, setVerseResults] = useState<SearchResult[]>([]);
  const [relatedResults, setRelatedResults] = useState<SearchResult[]>([]);
  const [journalResults, setJournalResults] = useState<LocalJournalEntry[]>([]);
  const [bookSuggestion, setBookSuggestion] = useState<BookSuggestion | null>(null);
  const [nearbyBooks, setNearbyBooks] = useState<BookSuggestion[]>([]);
  const [pending, setPending] = useState(false);
  const [debouncing, setDebouncing] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [failedHydrationCount, setFailedHydrationCount] = useState(0);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [searchTranslationId, setSearchTranslationId] = useState<string>(translationFromPeek);
  const [quickPicksSeed, setQuickPicksSeed] = useState(0);
  const [bibleScope, setBibleScope] = useState<OverlayBibleScope>("all");
  const [scopeBook, setScopeBook] = useState<{ slug: string; name: string } | null>(null);
  const [journalFavoritesOnly, setJournalFavoritesOnly] = useState(false);
  const [marksKind, setMarksKind] = useState<OverlayMarksKind | null>(null);
  const [highlightColor, setHighlightColor] = useState<HighlightColor | null>(null);
  const [alsoTranslationEnabled, setAlsoTranslationEnabled] = useState(false);
  const [pinnedTranslationIds, setPinnedTranslationIds] = useState<string[]>(
    () => peekFavoriteTranslationIds() ?? getDefaultPinnedTranslationIds(),
  );

  const recordNextRef = useRef(false);
  const skipNextDebounceRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSearchRequestIdRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const queryRef = useRef(query);
  queryRef.current = query;
  const journalFavoritesOnlyRef = useRef(journalFavoritesOnly);
  journalFavoritesOnlyRef.current = journalFavoritesOnly;
  const marksKindRef = useRef(marksKind);
  marksKindRef.current = marksKind;
  const highlightColorRef = useRef(highlightColor);
  highlightColorRef.current = highlightColor;
  const alsoTranslationEnabledRef = useRef(alsoTranslationEnabled);
  alsoTranslationEnabledRef.current = alsoTranslationEnabled;
  const pinnedTranslationIdsRef = useRef(pinnedTranslationIds);
  pinnedTranslationIdsRef.current = pinnedTranslationIds;
  const marksCacheRef = useRef<ReaderVerseMark[] | null>(null);
  const prevSearchTranslationRef = useRef<string | null>(null);

  const flushDebouncedSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const beginSearchRequest = useCallback(() => {
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const requestId = ++latestSearchRequestIdRef.current;
    return { requestId, signal: controller.signal };
  }, []);

  const runSearchInternal = useCallback(async (raw: string, scopeOverride?: OverlayBibleScope) => {
    const { requestId, signal } = beginSearchRequest();
    const power = parseOverlayPowerQuery(raw);
    const scope = scopeOverride ?? bibleScope;
    const bookScopeSlug = power.bookSlug ?? (scope === "book" ? scopeBook?.slug : undefined);
    const filter = {
      ...resolveOverlayMarksFilter(power, marksKindRef.current, highlightColorRef.current),
      bookScopeSlug,
    };
    const keyword = power.keyword;
    const pinned = peekFavoriteTranslationIds() ?? pinnedTranslationIdsRef.current;
    const chipAlsoId = alsoTranslationEnabledRef.current
      ? pickAlsoTranslationId(searchTranslationId, pinned)
      : null;
    const alsoId = power.alsoTranslationId ?? chipAlsoId;
    const shouldRecord = recordNextRef.current;
    recordNextRef.current = false;

    if (!keyword && !filter.kind && !power.hasJournalCombinator) {
      setVerseResults([]);
      setRelatedResults([]);
      setBookSuggestion(null);
      setNearbyBooks([]);
      setSearchError(null);
      setFailedHydrationCount(0);
      setPending(false);
      return;
    }

    setPending(true);
    setSearchError(null);
    try {
      if (!keyword && filter.kind) {
        const marks = await listReaderVerseMarks();
        if (requestId !== latestSearchRequestIdRef.current) return;
        marksCacheRef.current = marks;
        let listed = await readerMarksToSearchResults(marks, filter, {
          fallbackTranslationId: searchTranslationId,
        });
        if (requestId !== latestSearchRequestIdRef.current) return;
        if (alsoId && alsoId.toLowerCase() !== searchTranslationId.toLowerCase()) {
          listed = await attachAlsoTranslationSnippets(listed, alsoId, { signal });
          if (requestId !== latestSearchRequestIdRef.current) return;
        }
        setVerseResults(listed);
        setRelatedResults([]);
        setBookSuggestion(null);
        setNearbyBooks([]);
        setFailedHydrationCount(0);
        if (shouldRecord && raw.trim()) {
          const next = await prependSearchHistory(raw.trim());
          if (requestId !== latestSearchRequestIdRef.current) return;
          setRecentQueries(next);
        }
        return;
      }

      if (!keyword && power.hasJournalCombinator) {
        setVerseResults([]);
        setRelatedResults([]);
        setBookSuggestion(null);
        setNearbyBooks([]);
        setFailedHydrationCount(0);
        if (shouldRecord && raw.trim()) {
          const next = await prependSearchHistory(raw.trim());
          if (requestId !== latestSearchRequestIdRef.current) return;
          setRecentQueries(next);
        }
        return;
      }

      const outcome = await getSearchResultsForReaderTranslation(
        searchTranslationId,
        keyword,
        overlaySearchOptions(signal, bookScopeSlug),
      );
      if (requestId !== latestSearchRequestIdRef.current) return;
      let results = outcome.results;
      if (filter.kind) {
        const marks = marksCacheRef.current ?? (await listReaderVerseMarks());
        if (requestId !== latestSearchRequestIdRef.current) return;
        marksCacheRef.current = marks;
        results = filterSearchResultsByReaderMarks(results, marks, filter);
      }
      if (alsoId && alsoId.toLowerCase() !== searchTranslationId.toLowerCase()) {
        results = await attachAlsoTranslationSnippets(results, alsoId, { signal });
        if (requestId !== latestSearchRequestIdRef.current) return;
      }
      setVerseResults(results);
      setBookSuggestion(outcome.bookSuggestion);
      setNearbyBooks(outcome.nearbyBooks);
      setFailedHydrationCount(outcome.failedHydrationCount ?? 0);
      const relatedRefs = getRelatedVerseRefsForQuery(keyword);
      if (relatedRefs.length === 0) {
        setRelatedResults([]);
      } else {
        const related = await relatedRefsToSearchResults(relatedRefs, searchTranslationId, {
          exclude: results,
          signal,
        });
        if (requestId !== latestSearchRequestIdRef.current) return;
        setRelatedResults(related);
      }
      if (shouldRecord) {
        const next = await prependSearchHistory(raw.trim());
        if (requestId !== latestSearchRequestIdRef.current) return;
        setRecentQueries(next);
      }
    } catch {
      if (requestId !== latestSearchRequestIdRef.current) return;
      setVerseResults([]);
      setRelatedResults([]);
      setBookSuggestion(null);
      setNearbyBooks([]);
      setFailedHydrationCount(0);
      setSearchError("Search is unavailable right now. Please try again.");
    } finally {
      if (requestId === latestSearchRequestIdRef.current) {
        setPending(false);
      }
    }
  }, [beginSearchRequest, bibleScope, scopeBook?.slug, searchTranslationId]);

  const scheduleDebouncedSearch = useCallback(
    (q: string) => {
      flushDebouncedSearch();
      const trimmed = q.trim();
      const hasMarksGate =
        Boolean(marksKindRef.current) ||
        Boolean(highlightColorRef.current) ||
        Boolean(parseOverlayMarksQuery(q).kind);
      if (!trimmed && !hasMarksGate) {
        setDebouncing(false);
        void runSearchInternal(q);
        return;
      }
      setDebouncing(true);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        setDebouncing(false);
        void runSearchInternal(q);
      }, DEBOUNCE_MS);
    },
    [flushDebouncedSearch, runSearchInternal],
  );

  useEffect(() => {
    if (!enabled) return;
    setQuickPicksSeed((n) => n + 1);
    const last = peekReaderLastPosition();
    const slug = last?.bookSlug?.trim();
    if (slug) {
      setScopeBook({ slug, name: getBookNameFromSlug(slug) ?? "This book" });
    } else {
      setScopeBook(null);
      setBibleScope("all");
    }
    void getPreferredReaderTranslation()
      .then(setSearchTranslationId)
      .catch(() => {
        /* keep fallback */
      });
    void loadFavoriteTranslationIds()
      .then(setPinnedTranslationIds)
      .catch(() => setPinnedTranslationIds(getDefaultPinnedTranslationIds()));
    void loadSearchHistory()
      .then(setRecentQueries)
      .catch(() => setRecentQueries([]));
    void listReaderVerseMarks()
      .then((marks) => {
        marksCacheRef.current = marks;
      })
      .catch(() => {
        marksCacheRef.current = [];
      });
    let cancelled = false;
    void refreshLocalEntriesCache().then((entries) => {
      if (cancelled) return;
      const power = parseOverlayPowerQuery(queryRef.current);
      if (power.keyword || power.hasJournalCombinator) {
        setJournalResults(
          rankLocalJournalEntriesForOverlay(entries, power.keyword, {
            favoritesOnly: journalFavoritesOnlyRef.current,
            combinator: overlayPowerToJournalCombinator(power),
          }),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const power = parseOverlayPowerQuery(query);
    if (!power.keyword && !power.hasJournalCombinator) {
      setJournalResults([]);
      return;
    }
    const entries = getCachedLocalEntries();
    const apply = () => {
      setJournalResults(
        rankLocalJournalEntriesForOverlay(entries, power.keyword, {
          favoritesOnly: journalFavoritesOnly,
          combinator: overlayPowerToJournalCombinator(power),
        }),
      );
    };
    if (entries.length < JOURNAL_DEBOUNCE_MIN_ENTRIES) {
      apply();
      return;
    }
    const timer = setTimeout(apply, JOURNAL_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, query, journalFavoritesOnly]);

  useEffect(() => {
    if (!enabled) {
      latestSearchRequestIdRef.current += 1;
      searchAbortRef.current?.abort();
      flushDebouncedSearch();
      setQuery("");
      setVerseResults([]);
      setRelatedResults([]);
      setJournalResults([]);
      setBookSuggestion(null);
      setNearbyBooks([]);
      setSearchError(null);
      setFailedHydrationCount(0);
      setPending(false);
      setDebouncing(false);
      setBibleScope("all");
      setScopeBook(null);
      setJournalFavoritesOnly(false);
      setMarksKind(null);
      setHighlightColor(null);
      setAlsoTranslationEnabled(false);
      marksCacheRef.current = null;
      return;
    }
  }, [enabled, flushDebouncedSearch]);

  useEffect(() => {
    if (!enabled) return;
    const q = queryRef.current;
    const hasMarksGate =
      Boolean(marksKindRef.current) ||
      Boolean(highlightColorRef.current) ||
      Boolean(parseOverlayMarksQuery(q).kind);
    if (!q.trim() && !hasMarksGate) {
      prevSearchTranslationRef.current = searchTranslationId;
      return;
    }
    const prev = prevSearchTranslationRef.current;
    prevSearchTranslationRef.current = searchTranslationId;
    if (prev === null || prev === searchTranslationId) return;

    flushDebouncedSearch();
    recordNextRef.current = false;
    skipNextDebounceRef.current = true;
    void runSearchInternal(q);
  }, [enabled, searchTranslationId, flushDebouncedSearch, runSearchInternal]);

  useEffect(() => {
    if (!enabled) return;
    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false;
      return () => flushDebouncedSearch();
    }
    scheduleDebouncedSearch(query);
    return () => flushDebouncedSearch();
  }, [enabled, query, scheduleDebouncedSearch, flushDebouncedSearch]);

  const onChangeJournalFavoritesOnly = useCallback((next: boolean) => {
    setJournalFavoritesOnly(next);
  }, []);

  const rerunWithoutHistory = useCallback(
    (raw: string, scopeOverride?: OverlayBibleScope) => {
      skipNextDebounceRef.current = true;
      flushDebouncedSearch();
      recordNextRef.current = false;
      setDebouncing(false);
      void runSearchInternal(raw, scopeOverride);
    },
    [flushDebouncedSearch, runSearchInternal],
  );

  const onChangeMarksKind = useCallback(
    (next: OverlayMarksKind | null) => {
      marksKindRef.current = next;
      setMarksKind(next);
      if (next !== "highlights" && next !== "marks") {
        highlightColorRef.current = null;
        setHighlightColor(null);
      }
      rerunWithoutHistory(queryRef.current);
    },
    [rerunWithoutHistory],
  );

  const onChangeHighlightColor = useCallback(
    (next: HighlightColor | null) => {
      highlightColorRef.current = next;
      setHighlightColor(next);
      if (next && marksKindRef.current == null) {
        marksKindRef.current = "highlights";
        setMarksKind("highlights");
      }
      rerunWithoutHistory(queryRef.current);
    },
    [rerunWithoutHistory],
  );

  const onChangeAlsoTranslationEnabled = useCallback(
    (next: boolean) => {
      alsoTranslationEnabledRef.current = next;
      setAlsoTranslationEnabled(next);
      rerunWithoutHistory(queryRef.current);
    },
    [rerunWithoutHistory],
  );

  const onChangeBibleScope = useCallback((next: OverlayBibleScope) => {
    if (next === "book" && !scopeBook?.slug) return;
    setBibleScope(next);
    rerunWithoutHistory(queryRef.current, next);
  }, [scopeBook?.slug, rerunWithoutHistory]);

  const onSubmitSearch = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    recordNextRef.current = true;
    flushDebouncedSearch();
    setDebouncing(false);
    void runSearchInternal(q);
  }, [query, flushDebouncedSearch, runSearchInternal]);

  const runImmediateSearch = useCallback(
    (q: string) => {
      recordNextRef.current = true;
      skipNextDebounceRef.current = true;
      setQuery(q);
      flushDebouncedSearch();
      setDebouncing(false);
      void runSearchInternal(q);
    },
    [flushDebouncedSearch, runSearchInternal],
  );

  const onClearQuery = useCallback(() => {
    skipNextDebounceRef.current = true;
    latestSearchRequestIdRef.current += 1;
    searchAbortRef.current?.abort();
    flushDebouncedSearch();
    setQuery("");
    setJournalResults([]);
    setBookSuggestion(null);
    setNearbyBooks([]);
    setSearchError(null);
    setFailedHydrationCount(0);
    setDebouncing(false);
    recordNextRef.current = false;
    void runSearchInternal("");
  }, [flushDebouncedSearch, runSearchInternal]);

  const onRemoveRecent = useCallback(async (q: string) => {
    try {
      const next = await removeSearchHistoryItem(q);
      setRecentQueries(next);
    } catch {
      /* keep list */
    }
  }, []);

  const onRetryBibleSearch = useCallback(() => {
    const q = queryRef.current;
    if (!q.trim() && !marksKindRef.current && !highlightColorRef.current) return;
    recordNextRef.current = false;
    flushDebouncedSearch();
    setDebouncing(false);
    void runSearchInternal(q);
  }, [flushDebouncedSearch, runSearchInternal]);

  const onSearchQueryChange = useCallback((q: string) => {
    hapticSelection();
    setQuery(q);
  }, []);

  const onVoiceTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      if (isFinal) {
        runImmediateSearch(text);
        return;
      }
      skipNextDebounceRef.current = true;
      setQuery(text);
    },
    [runImmediateSearch],
  );

  const readerHrefForResult = useCallback(
    (item: SearchResult): Href =>
      readerChapterHref(
        item.bookSlug,
        item.chapterNumber,
        searchTranslationId,
        undefined,
        item.verseNumber,
      ) as Href,
    [searchTranslationId],
  );

  const onOpenVerseResult = useCallback(
    (item: SearchResult) => {
      void saveReaderLastPosition({
        bookSlug: item.bookSlug,
        chapter: item.chapterNumber,
        translationId: searchTranslationId,
      });
    },
    [searchTranslationId],
  );

  const parsedPower = useMemo(() => parseOverlayPowerQuery(query), [query]);
  const activeMarksFilter = resolveOverlayMarksFilter(parsedPower, marksKind, highlightColor);
  const listingMarksOnly = Boolean(activeMarksFilter.kind && !parsedPower.keyword);
  const snippetQuery = parsedPower.keyword;
  const alsoChipTargetId = pickAlsoTranslationId(searchTranslationId, pinnedTranslationIds);
  const alsoChipLabel = alsoChipTargetId
    ? getTranslationDisplayAbbreviation(alsoChipTargetId)
    : null;
  const alsoTranslationActive = Boolean(
    parsedPower.alsoTranslationId ?? (alsoTranslationEnabled ? alsoChipTargetId : null),
  );
  const showEmptyState = query.trim().length === 0 && !activeMarksFilter.kind;
  const hasQuery = query.trim().length > 0 || Boolean(activeMarksFilter.kind);
  const searchSections = useMemo(() => {
    const sections: { title: string; data: (SearchResult | LocalJournalEntry)[] }[] = [];
    if (journalResults.length > 0) {
      sections.push({ title: "Journal", data: journalResults });
    }
    if (verseResults.length > 0) {
      sections.push({ title: listingMarksOnly ? "Marks" : "Bible", data: verseResults });
    }
    if (relatedResults.length > 0 && !listingMarksOnly) {
      sections.push({ title: "Related", data: relatedResults });
    }
    return sections;
  }, [journalResults, verseResults, relatedResults, listingMarksOnly]);
  const isSearching = debouncing || pending;
  const showSearchLoading = isSearching && searchSections.length === 0;
  const noMatches =
    hasQuery &&
    !isSearching &&
    journalResults.length === 0 &&
    verseResults.length === 0 &&
    relatedResults.length === 0;
  const showBookSuggestionBanner =
    bookSuggestion != null &&
    bookSuggestion.distance > 0 &&
    (verseResults.length > 0 || journalResults.length > 0);
  const emptyNearbyBooks = useMemo(
    () => nearbyBooks.filter((book) => book.distance > 0),
    [nearbyBooks],
  );
  const recentShown = recentQueries.slice(0, 3);
  const quickPicks = useMemo(
    () =>
      buildSearchQuickPicks({
        recentQueries,
        lastReaderPosition: peekReaderLastPosition(),
      }),
    [recentQueries, quickPicksSeed],
  );

  return {
    query,
    onSearchQueryChange,
    onVoiceTranscript,
    onSubmitSearch,
    onClearQuery,
    onRemoveRecent,
    runImmediateSearch,
    onRetryBibleSearch,
    pending,
    isSearching,
    showSearchLoading,
    searchError,
    failedHydrationCount,
    showEmptyState,
    noMatches,
    showBookSuggestionBanner,
    bookSuggestion,
    emptyNearbyBooks,
    searchSections,
    recentShown,
    quickPicks,
    readerHrefForResult,
    onOpenVerseResult,
    bibleScope,
    onChangeBibleScope,
    scopeBookName: scopeBook?.name ?? null,
    showScopeChips: scopeBook != null,
    journalFavoritesOnly,
    onChangeJournalFavoritesOnly,
    activeMarksKind: activeMarksFilter.kind,
    activeHighlightColor: activeMarksFilter.color,
    onChangeMarksKind,
    onChangeHighlightColor,
    snippetQuery,
    alsoChipLabel,
    alsoTranslationActive,
    onChangeAlsoTranslationEnabled,
  };
}
