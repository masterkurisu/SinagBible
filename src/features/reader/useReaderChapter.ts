import { useEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";
import {
  getChapterBySlugForTranslation,
  isBundledFeaturedTranslationId,
} from "@sinag-bible/core/bible-translations";
import { getUsfmBookId } from "@sinag-bible/core";
import {
  apiChapterToBibleChapter,
  fetchChapter as fetchApiChapter,
  type ApiChapter,
} from "@/lib/bible-api-service";
import { canonicalTranslationId } from "@/lib/canonical-translation-id";
import { isChapterDbOpen } from "@/lib/chapter-db";
import { getChapterSync, hasChapterSync, getTranslationMetaSync } from "@/lib/chapter-store";
import {
  loadYvpTranslationAttribution,
  type YvpTranslationAttribution,
} from "@/lib/yvp-translation-attribution";
import { yvpPassageToBibleChapter } from "@/lib/yvp-chapter-payload";
import { isYvpTranslationId, type YvpPassage } from "@/lib/youversion-api";
import {
  fetchReaderChapterContent,
  primeReaderChapterFetch,
  resolveReaderBooksForTranslation,
} from "@/lib/reader-chapter-load";
import { collectPrefetchChapterTargets } from "@/lib/reader-chapter-nav";
import { mergeVerseInlineFromHelloaoChapter } from "@/lib/merge-helloao-verse-inline";
import { isDeviceOffline } from "@/lib/network-connectivity";
import type { BibleBookNavItem, BibleChapter } from "@sinag-bible/types";

const READER_CHAPTER_PREFETCH_DEPTH = 2;

export type ReaderChapterPayload = {
  resolvedTranslationId: string;
  books: BibleBookNavItem[];
  chapter: BibleChapter;
};

export type ReaderChapterError =
  | "chapter_not_found"
  | "load_failed"
  | "not_downloaded_offline";

function hasChapterInlineAnnotations(chapter: BibleChapter): boolean {
  return (chapter.verseInlineContent ?? []).some((segments) => segments.length > 0);
}

function payloadMatchesRoute(
  payload: ReaderChapterPayload,
  translationId: string,
  bookSlug: string,
  chapterNumber: number,
): boolean {
  return (
    payload.resolvedTranslationId === translationId &&
    payload.chapter.bookSlug === bookSlug &&
    payload.chapter.chapterNumber === chapterNumber
  );
}

function buildWarmStartPayload(
  translationId: string,
  bookSlug: string,
  chapterNumber: number,
): ReaderChapterPayload | null {
  if (translationId === "KJV" || !isChapterDbOpen()) return null;

  const stored = getChapterSync(
    canonicalTranslationId(translationId),
    bookSlug,
    chapterNumber,
  );
  if (!stored) return null;

  if (stored.source === "helloao") {
    const chapter = apiChapterToBibleChapter(bookSlug, stored.payload as ApiChapter);
    return {
      resolvedTranslationId: translationId,
      books: [],
      chapter,
    };
  }

  if (stored.source === "yvp") {
    const chapter = yvpPassageToBibleChapter(
      bookSlug,
      chapterNumber,
      stored.payload as YvpPassage,
    );
    return {
      resolvedTranslationId: translationId,
      books: [],
      chapter,
    };
  }

  return null;
}

function isTranslationChapterAvailableOffline(
  translationId: string,
  bookSlug: string,
  chapterNumber: number,
): boolean {
  if (translationId === "KJV" || isBundledFeaturedTranslationId(translationId)) {
    return true;
  }
  if (!isChapterDbOpen()) return false;
  const canonicalId = canonicalTranslationId(translationId);
  if (hasChapterSync(canonicalId, bookSlug, chapterNumber)) return true;
  return getTranslationMetaSync(canonicalId)?.fullyDownloaded === true;
}

export function useReaderChapter(bookSlug: string, chapterNumber: number, translationId: string) {
  const [readerPayload, setReaderPayload] = useState<ReaderChapterPayload | null>(
    () => buildWarmStartPayload(translationId, bookSlug, chapterNumber),
  );
  const readerPayloadRef = useRef(readerPayload);
  readerPayloadRef.current = readerPayload;
  const [error, setError] = useState<ReaderChapterError | null>(null);
  const [yvpAttribution, setYvpAttribution] = useState<YvpTranslationAttribution | null>(() =>
    loadYvpTranslationAttribution(translationId),
  );

  const syncedPayload =
    readerPayload && payloadMatchesRoute(readerPayload, translationId, bookSlug, chapterNumber)
      ? readerPayload
      : null;

  useEffect(() => {
    let cancelled = false;

    const warmStart = buildWarmStartPayload(translationId, bookSlug, chapterNumber);
    if (warmStart) {
      setReaderPayload(warmStart);
      setError(null);
    }

    const loadChapter = async () => {
      try {
        setError(null);

        let resolvedTranslation = translationId;
        const cachedPayload = readerPayloadRef.current;
        const cachedBooks =
          cachedPayload?.resolvedTranslationId === resolvedTranslation && cachedPayload.books.length > 0
            ? cachedPayload.books
            : null;

        let books: BibleBookNavItem[];
        let chapter: BibleChapter | null;

        [books, chapter] = await Promise.all([
          resolveReaderBooksForTranslation(resolvedTranslation, cachedBooks),
          resolvedTranslation === "KJV"
            ? getChapterBySlugForTranslation("KJV", bookSlug, chapterNumber)
            : fetchReaderChapterContent(resolvedTranslation, bookSlug, chapterNumber),
        ]);

        if (!chapter) {
          if (
            !(await isTranslationChapterAvailableOffline(resolvedTranslation, bookSlug, chapterNumber)) &&
            (await isDeviceOffline())
          ) {
            if (cancelled) return;
            setReaderPayload(null);
            setError("not_downloaded_offline");
            return;
          }

          resolvedTranslation = "KJV";
          books = await resolveReaderBooksForTranslation("KJV", null);
          chapter = await getChapterBySlugForTranslation("KJV", bookSlug, chapterNumber);
        }

        if (cancelled) return;

        if (!chapter) {
          setReaderPayload(null);
          setError("chapter_not_found");
          return;
        }

        setReaderPayload({ resolvedTranslationId: resolvedTranslation, books, chapter });
        if (isYvpTranslationId(resolvedTranslation)) {
          setYvpAttribution(loadYvpTranslationAttribution(resolvedTranslation));
        }
      } catch {
        if (!cancelled) {
          if (
            !(await isTranslationChapterAvailableOffline(translationId, bookSlug, chapterNumber)) &&
            (await isDeviceOffline())
          ) {
            setReaderPayload(null);
            setError("not_downloaded_offline");
            return;
          }
          setReaderPayload(null);
          setError("load_failed");
        }
      }
    };

    const hasDisplayedPayload = readerPayloadRef.current != null;
    if (hasDisplayedPayload) {
      void loadChapter();
      return () => {
        cancelled = true;
      };
    }

    const task = InteractionManager.runAfterInteractions(() => {
      void loadChapter();
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [translationId, bookSlug, chapterNumber]);

  useEffect(() => {
    if (!isYvpTranslationId(translationId)) {
      setYvpAttribution(null);
      return;
    }
    setYvpAttribution(loadYvpTranslationAttribution(translationId));
  }, [translationId]);

  const kjvInlineEnrichmentKey =
    readerPayload?.resolvedTranslationId === "KJV" &&
    syncedPayload?.chapter &&
    !hasChapterInlineAnnotations(syncedPayload.chapter)
      ? `${syncedPayload.chapter.bookSlug}:${syncedPayload.chapter.chapterNumber}`
      : null;

  useEffect(() => {
    if (!kjvInlineEnrichmentKey) return;
    const [chapterBookSlug, chapterNumRaw] = kjvInlineEnrichmentKey.split(":");
    const chapterNum = Number(chapterNumRaw);
    const usfm = getUsfmBookId(chapterBookSlug);
    if (!usfm) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        try {
          const helloKjv = await fetchApiChapter("eng_kjv", usfm, chapterNum);
          if (cancelled) return;
          setReaderPayload((curr) => {
            if (!curr) return curr;
            if (
              curr.resolvedTranslationId !== "KJV" ||
              curr.chapter.bookSlug !== chapterBookSlug ||
              curr.chapter.chapterNumber !== chapterNum
            ) {
              return curr;
            }
            return {
              ...curr,
              chapter: mergeVerseInlineFromHelloaoChapter(curr.chapter, helloKjv),
            };
          });
        } catch {
          /* offline or API error — keep unannotated KJV */
        }
      })();
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [kjvInlineEnrichmentKey]);

  useEffect(() => {
    if (translationId === "KJV") return;
    const booksForPrefetch =
      readerPayload?.books ?? readerPayloadRef.current?.books ?? [];
    if (booksForPrefetch.length === 0) return;
    const targets = collectPrefetchChapterTargets(
      booksForPrefetch,
      bookSlug,
      chapterNumber,
      READER_CHAPTER_PREFETCH_DEPTH,
    );
    for (const target of targets) {
      primeReaderChapterFetch(translationId, target, booksForPrefetch);
    }
  }, [translationId, bookSlug, chapterNumber, readerPayload?.books]);

  const chapter = syncedPayload?.chapter ?? null;
  const books =
    syncedPayload?.books ??
    (readerPayload?.books && readerPayload.books.length > 0 ? readerPayload.books : null);
  const resolvedTranslationId =
    syncedPayload?.resolvedTranslationId ?? readerPayload?.resolvedTranslationId;
  const isContentSynced = syncedPayload != null;
  const isLoading = error == null && chapter == null;

  return {
    chapter,
    books,
    resolvedTranslationId,
    yvpAttribution,
    isContentSynced,
    isLoading,
    error,
  };
}
