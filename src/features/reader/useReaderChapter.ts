import { useEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";
import {
  getBookNavForTranslation,
  getChapterBySlugForTranslation,
  isTranslationId,
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
  readerUsesPerChapterFetch,
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

export function useReaderChapter(bookSlug: string, chapterNumber: number, translationId: string) {
  const [readerPayload, setReaderPayload] = useState<ReaderChapterPayload | null>(null);
  const readerPayloadRef = useRef(readerPayload);
  readerPayloadRef.current = readerPayload;
  const [error, setError] = useState<ReaderChapterError | null>(null);

  useEffect(() => {
    let cancelled = false;

    const slug = bookSlug;
    const resolved = translationId;
    const cacheKey = readerChapterCacheKey(resolved, slug, chapterNumber);
    const memHit = getCachedReaderChapter(cacheKey);
    if (memHit) {
      setReaderPayload(memHit);
      setError(null);
      return;
    }

    void (async () => {
      try {
        setError(null);

        let resolvedTranslation = resolved;
        const cachedPayload = readerPayloadRef.current;
        const cachedBooks =
          cachedPayload?.resolvedTranslationId === resolvedTranslation && cachedPayload.books.length > 0
            ? cachedPayload.books
            : null;

        let books: BibleBookNavItem[];
        let chapter: BibleChapter | null;

        if (resolvedTranslation === "KJV" || !readerUsesPerChapterFetch(resolvedTranslation)) {
          if (isTranslationId(resolvedTranslation)) {
            if (cachedBooks) {
              books = cachedBooks;
              chapter = await getChapterBySlugForTranslation(resolvedTranslation, slug, chapterNumber);
            } else {
              [books, chapter] = await Promise.all([
                getBookNavForTranslation(resolvedTranslation),
                getChapterBySlugForTranslation(resolvedTranslation, slug, chapterNumber),
              ]);
            }
          } else {
            books = cachedBooks ?? (await resolveReaderBooksForTranslation(resolvedTranslation, null));
            chapter = await fetchReaderChapterContent(resolvedTranslation, slug, chapterNumber);
          }
        } else {
          books = await resolveReaderBooksForTranslation(resolvedTranslation, cachedBooks);
          if (!cachedBooks && isTranslationId(resolvedTranslation)) {
            void getBookNavForTranslation(resolvedTranslation).then((nav) => {
              if (cancelled) return;
              setReaderPayload((curr) =>
                curr?.resolvedTranslationId === resolvedTranslation ? { ...curr, books: nav } : curr,
              );
            });
          }
          chapter = await fetchReaderChapterContent(resolvedTranslation, slug, chapterNumber);
        }

        if (!chapter) {
          resolvedTranslation = "KJV";
          books = await getBookNavForTranslation("KJV");
          chapter = await getChapterBySlugForTranslation("KJV", slug, chapterNumber);
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
    })();

    return () => {
      cancelled = true;
    };
  }, [translationId, bookSlug, chapterNumber]);

  const kjvInlineEnrichmentKey =
    readerPayload?.resolvedTranslationId === "KJV" &&
    !hasChapterInlineAnnotations(readerPayload.chapter)
      ? `${readerPayload.chapter.bookSlug}:${readerPayload.chapter.chapterNumber}`
      : null;

  useEffect(() => {
    if (!kjvInlineEnrichmentKey) return;
    const [chapterBookSlug, chapterNumRaw] = kjvInlineEnrichmentKey.split(":");
    const chapterNum = Number(chapterNumRaw);
    const usfm = getUsfmBookId(chapterBookSlug);
    if (!usfm) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      // Keep first paint fast; enrich KJV inline spans after initial chapter render and gestures settle.
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
      primeReaderChapterFetch(translationId, target);
    }
  }, [translationId, bookSlug, chapterNumber, readerPayload?.books]);

  const chapter = readerPayload?.chapter;
  const books = readerPayload?.books;
  const resolvedTranslationId = readerPayload?.resolvedTranslationId;
  const isLoading =
    error == null && (chapter == null || books == null || resolvedTranslationId == null);

  return { chapter, books, resolvedTranslationId, isLoading, error };
}
