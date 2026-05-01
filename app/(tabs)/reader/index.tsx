import { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { getBookNameFromSlug } from "@sinag-bible/core";
import { isTranslationId } from "@sinag-bible/core/bible-translations";
import { ScreenLoadingSkeleton } from "@/components/loading-skeleton";
import { READER_INTERNAL_NO_STACK_ANIMATION } from "@/lib/reader-hub-navigation";
import { loadReaderLastPosition, peekReaderLastPosition, type ReaderLastPosition } from "@/lib/reader-last-position";

/** Module scope so tab `JUMP_TO` remounts do not reset — `useRef(0)` would. */
let readerHubSuccessfulRedirects = 0;

function resolveReaderTarget(saved: ReaderLastPosition | null): {
  book: string;
  chapter: number;
  translation: string;
} {
  if (
    saved &&
    getBookNameFromSlug(saved.bookSlug) &&
    saved.chapter >= 1 &&
    saved.chapter <= 200 &&
    isTranslationId(saved.translationId)
  ) {
    return { book: saved.bookSlug, chapter: saved.chapter, translation: saved.translationId };
  }
  return { book: "genesis", chapter: 1, translation: "KJV" };
}

export default function ReaderIndexScreen() {
  const router = useRouter();
  // No spinner flash on repeat hub opens when we already have an in-memory last position.
  const [showHubSpinner] = useState(
    () => !(readerHubSuccessfulRedirects > 0 && peekReaderLastPosition() != null),
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const navigateToResolved = (resolved: { book: string; chapter: number; translation: string }) => {
        const isRepeatHubVisit = readerHubSuccessfulRedirects > 0;
        const internalParam = isRepeatHubVisit ? `&${READER_INTERNAL_NO_STACK_ANIMATION}=1` : "";
        router.replace(
          `/reader/${resolved.book}/${resolved.chapter}?translation=${resolved.translation}${internalParam}`,
        );
        if (!cancelled) {
          readerHubSuccessfulRedirects += 1;
        }
      };

      const isRepeat = readerHubSuccessfulRedirects > 0;
      if (isRepeat) {
        const mem = peekReaderLastPosition();
        if (mem) {
          navigateToResolved(resolveReaderTarget(mem));
          return () => {
            cancelled = true;
          };
        }
      }

      void (async () => {
        const saved = await loadReaderLastPosition();
        if (cancelled) return;
        navigateToResolved(resolveReaderTarget(saved));
      })();

      return () => {
        cancelled = true;
      };
    }, [router]),
  );

  return (
    <View className="flex-1 bg-parchment-canvas">
      {showHubSpinner ? (
        <ScreenLoadingSkeleton lines={5} caption="Opening reader…" />
      ) : null}
    </View>
  );
}
