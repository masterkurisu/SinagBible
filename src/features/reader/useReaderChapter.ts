import { useEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";
import {
  getChapterBySlugForTranslation,
} from "@sinag-bible/core/bible-translations";
import { getUsfmBookId } from "@sinag-bible/core";
import { fetchChapter as fetchApiChapter } from "@/lib/bible-api-service";
import {
  getCachedReaderChapter,
  readerChapterCacheKey,
  setCachedReaderChapter,
  type ReaderChapterPayload,
} from "@/lib/reader-chapter-cache";
import {
  fetchReaderChapterContent,
  primeReaderChapterFetch,
  resolveReaderBooksForTranslation,
} from "@/lib/reader-chapter-load";
import { collectPrefetchChapterTargets } from "@/lib/reader-chapter-nav";
import { mergeVerseInlineFromHelloaoChapter } from "@/lib/merge-helloao-verse-inline";
import type { BibleBookNavItem, BibleChapter } from "@sinag-bible/types";

const READER_CHAPTER_PREFETCH_DEPTH = 2;

export type ReaderChapterError = "chapter_not_found" | "load_failed";

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

export function useReaderChapter(bookSlug: string, chapterNumber: number, translationId: string) {
  const cacheKey = readerChapterCacheKey(translationId, bookSlug, chapterNumber);
  const [readerPayload, setReaderPayload] = useState<ReaderChapterPayload | null>(
    () => getCachedReaderChapter(cacheKey) ?? null,
  );
  const readerPayloadRef = useRef(readerPayload);
  readerPayloadRef.current = readerPayload;
  const [error, setError] = useState<ReaderChapterError | null>(null);

  const syncedPayload =
    getCachedReaderChapter(cacheKey) ??
    (readerPayload && payloadMatchesRoute(readerPayload, translationId, bookSlug, chapterNumber)
      ? readerPayload
      : null);

  useEffect(() => {
    let cancelled = false;

    const memHit = getCachedReaderChapter(cacheKey);
    if (memHit) {
      setReaderPayload(memHit);
      setError(null);
      return;
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

        const payload = { resolvedTranslationId: resolvedTranslation, books, chapter };
        setCachedReaderChapter(cacheKey, payload);
        setReaderPayload(payload);
      } catch {
        if (!cancelled) {
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
  }, [translationId, bookSlug, chapterNumber, cacheKey]);

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

  const chapter = (syncedPayload ?? readerPayload)?.chapter;
  const books = (syncedPayload ?? readerPayload)?.books;
  const resolvedTranslationId = (syncedPayload ?? readerPayload)?.resolvedTranslationId;
  const isContentSynced = syncedPayload != null;
  const isLoading = error == null && readerPayload == null;

  return { chapter, books, resolvedTranslationId, isContentSynced, isLoading, error };
}
