import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getSearchResultsForReaderTranslation,
  warmReaderTranslationSearchCache,
} from "@/lib/bible-search-service";
import type { BookSuggestion, LocalJournalEntry, SearchResult } from "@sinag-bible/types";
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
import { filterLocalJournalEntriesByQuery } from "@/lib/journal-local-search";
import { getCachedLocalEntries, refreshLocalEntriesCache } from "@/lib/journal-local";
import { hapticSelection } from "@/lib/haptics";
import { type Href } from "expo-router";
import { readerChapterHref } from "@/lib/reader-navigation";

const FALLBACK_TRANSLATION = "KJV";
const DEBOUNCE_MS = 280;

function translationFromPeek(): string {
  return peekReaderLastPosition()?.translationId?.trim() || FALLBACK_TRANSLATION;
}

export function useBibleSearch({ enabled }: { enabled: boolean }) {
  const [query, setQuery] = useState("");
  const [verseResults, setVerseResults] = useState<SearchResult[]>([]);
  const [journalResults, setJournalResults] = useState<LocalJournalEntry[]>([]);
  const [bookSuggestion, setBookSuggestion] = useState<BookSuggestion | null>(null);
  const [nearbyBooks, setNearbyBooks] = useState<BookSuggestion[]>([]);
  const [pending, setPending] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [searchTranslationId, setSearchTranslationId] = useState<string>(translationFromPeek);
  const [quickPicksSeed, setQuickPicksSeed] = useState(0);

  const recordNextRef = useRef(false);
  const skipNextDebounceRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSearchRequestIdRef = useRef(0);
  const queryRef = useRef(query);
  queryRef.current = query;
  const prevSearchTranslationRef = useRef<string | null>(null);

  const flushDebouncedSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const runSearchInternal = useCallback(async (raw: string) => {
    const requestId = ++latestSearchRequestIdRef.current;
    const q = raw.trim();
    const shouldRecord = recordNextRef.current;
    recordNextRef.current = false;
    if (!q) {
      setVerseResults([]);
      setJournalResults([]);
      setBookSuggestion(null);
      setNearbyBooks([]);
      setSearchError(null);
      return;
    }
    setPending(true);
    setSearchError(null);
    try {
      const outcome = await getSearchResultsForReaderTranslation(searchTranslationId, q);
      if (requestId !== latestSearchRequestIdRef.current) return;
      setVerseResults(outcome.results);
      setBookSuggestion(outcome.bookSuggestion);
      setNearbyBooks(outcome.nearbyBooks);
      if (shouldRecord) {
        const next = await prependSearchHistory(q);
        if (requestId !== latestSearchRequestIdRef.current) return;
        setRecentQueries(next);
      }
    } catch {
      if (requestId !== latestSearchRequestIdRef.current) return;
      setVerseResults([]);
      setBookSuggestion(null);
      setNearbyBooks([]);
      setSearchError("Search is unavailable right now. Please try again.");
    } finally {
      if (requestId === latestSearchRequestIdRef.current) {
        setPending(false);
      }
    }
  }, [searchTranslationId]);

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
    if (!enabled) return;
    setQuickPicksSeed((n) => n + 1);
    void getPreferredReaderTranslation()
      .then(setSearchTranslationId)
      .catch(() => {
        /* keep fallback */
      });
    void loadSearchHistory()
      .then(setRecentQueries)
      .catch(() => setRecentQueries([]));
    let cancelled = false;
    void refreshLocalEntriesCache().then((entries) => {
      if (cancelled) return;
      const q = queryRef.current.trim();
      if (q) {
        setJournalResults(filterLocalJournalEntriesByQuery(entries, q));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    warmReaderTranslationSearchCache(searchTranslationId);
  }, [enabled, searchTranslationId]);

  useEffect(() => {
    if (!enabled) return;
    const q = query.trim();
    if (!q) {
      setJournalResults([]);
      return;
    }
    setJournalResults(filterLocalJournalEntriesByQuery(getCachedLocalEntries(), q));
  }, [enabled, query]);

  useEffect(() => {
    if (!enabled) {
      flushDebouncedSearch();
      setQuery("");
      setVerseResults([]);
      setJournalResults([]);
      setBookSuggestion(null);
      setNearbyBooks([]);
      setSearchError(null);
      setPending(false);
      return;
    }
  }, [enabled, flushDebouncedSearch]);

  useEffect(() => {
    if (!enabled) return;
    const q = queryRef.current.trim();
    if (!q) {
      prevSearchTranslationRef.current = searchTranslationId;
      return;
    }
    const prev = prevSearchTranslationRef.current;
    prevSearchTranslationRef.current = searchTranslationId;
    if (prev === null || prev === searchTranslationId) return;

    flushDebouncedSearch();
    recordNextRef.current = false;
    let cancelled = false;
    void (async () => {
      setPending(true);
      setSearchError(null);
      try {
        const outcome = await getSearchResultsForReaderTranslation(searchTranslationId, q);
        if (cancelled) return;
        setVerseResults(outcome.results);
        setBookSuggestion(outcome.bookSuggestion);
        setNearbyBooks(outcome.nearbyBooks);
      } catch {
        if (!cancelled) {
          setVerseResults([]);
          setBookSuggestion(null);
          setNearbyBooks([]);
          setSearchError("Search is unavailable right now. Please try again.");
        }
      } finally {
        if (!cancelled) setPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, searchTranslationId, flushDebouncedSearch]);

  useEffect(() => {
    if (!enabled) return;
    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false;
      return () => flushDebouncedSearch();
    }
    scheduleDebouncedSearch(query);
    return () => flushDebouncedSearch();
  }, [enabled, query, scheduleDebouncedSearch, flushDebouncedSearch]);

  const onSubmitSearch = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    recordNextRef.current = true;
    flushDebouncedSearch();
    void runSearchInternal(q);
  }, [query, flushDebouncedSearch, runSearchInternal]);

  const runImmediateSearch = useCallback(
    (q: string) => {
      recordNextRef.current = true;
      skipNextDebounceRef.current = true;
      setQuery(q);
      flushDebouncedSearch();
      void runSearchInternal(q);
    },
    [flushDebouncedSearch, runSearchInternal],
  );

  const onClearQuery = useCallback(() => {
    skipNextDebounceRef.current = true;
    flushDebouncedSearch();
    setQuery("");
    setVerseResults([]);
    setJournalResults([]);
    setBookSuggestion(null);
    setNearbyBooks([]);
    setSearchError(null);
    setPending(false);
  }, [flushDebouncedSearch]);

  const onRemoveRecent = useCallback(async (q: string) => {
    try {
      const next = await removeSearchHistoryItem(q);
      setRecentQueries(next);
    } catch {
      /* keep list */
    }
  }, []);

  const onSearchQueryChange = useCallback((q: string) => {
    hapticSelection();
    setQuery(q);
  }, []);

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

  const showEmptyState = query.trim().length === 0;
  const hasQuery = query.trim().length > 0;
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
  const showSearchSkeleton = pending && searchSections.length === 0;
  const noMatches = hasQuery && !pending && journalResults.length === 0 && verseResults.length === 0;
  const showBookSuggestionBanner =
    bookSuggestion != null && bookSuggestion.distance > 0 && verseResults.length > 0;
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
    onSubmitSearch,
    onClearQuery,
    onRemoveRecent,
    runImmediateSearch,
    pending,
    showSearchSkeleton,
    searchError,
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
  };
}
